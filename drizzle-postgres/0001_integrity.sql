CREATE OR REPLACE FUNCTION fraguan_cash_movement_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."sessionId" IS NOT NULL AND EXISTS (SELECT 1 FROM cash_sessions WHERE id=NEW."sessionId" AND "closedAt" IS NOT NULL) THEN
    RAISE EXCEPTION 'cash_closed';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER cash_movement_open BEFORE INSERT ON cash_movements FOR EACH ROW EXECUTE FUNCTION fraguan_cash_movement_guard();

CREATE OR REPLACE FUNCTION fraguan_cashback_usage() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE available BIGINT;
BEGIN
  SELECT balance INTO available FROM customer_cashback WHERE id=NEW."cashbackId" AND status='active' FOR UPDATE;
  IF available IS NULL OR NEW.amount>available THEN RAISE EXCEPTION 'insufficient_cashback'; END IF;
  UPDATE customer_cashback SET balance=balance-NEW.amount,status=CASE WHEN balance-NEW.amount=0 THEN 'used' ELSE 'active' END WHERE id=NEW."cashbackId";
  RETURN NEW;
END $$;
CREATE TRIGGER cashback_usage_apply BEFORE INSERT ON cashback_usages FOR EACH ROW EXECUTE FUNCTION fraguan_cashback_usage();

CREATE OR REPLACE FUNCTION fraguan_credit_usage() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE available BIGINT;
BEGIN
  SELECT balance INTO available FROM customer_credits WHERE id=NEW."creditId" AND status='active' FOR UPDATE;
  IF available IS NULL OR NEW.amount>available THEN RAISE EXCEPTION 'insufficient_credit'; END IF;
  UPDATE customer_credits SET balance=balance-NEW.amount,status=CASE WHEN balance-NEW.amount=0 THEN 'used' ELSE 'active' END WHERE id=NEW."creditId";
  RETURN NEW;
END $$;
CREATE TRIGGER credit_usage_apply BEFORE INSERT ON credit_usages FOR EACH ROW EXECUTE FUNCTION fraguan_credit_usage();

CREATE OR REPLACE FUNCTION fraguan_check_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."payableId" IS NOT NULL AND (NEW.direction<>'issued' OR NOT EXISTS(SELECT 1 FROM payables WHERE id=NEW."payableId" AND status='pending' AND amount=NEW.amount)) THEN
    RAISE EXCEPTION 'invalid_check_payable';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER check_payable_guard BEFORE INSERT ON checks FOR EACH ROW EXECUTE FUNCTION fraguan_check_guard();

CREATE OR REPLACE FUNCTION fraguan_check_transition_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS(SELECT 1 FROM checks WHERE id=NEW."checkId" AND status=NEW."fromStatus" AND version=NEW.version FOR UPDATE) THEN RAISE EXCEPTION 'check_changed'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER check_transition_guard BEFORE INSERT ON check_events FOR EACH ROW EXECUTE FUNCTION fraguan_check_transition_guard();

CREATE OR REPLACE FUNCTION fraguan_inventory_frozen() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE old_status TEXT; new_status TEXT;
BEGIN
  IF TG_OP<>'INSERT' THEN SELECT status INTO old_status FROM inventory_counts WHERE id=OLD."countId"; END IF;
  IF TG_OP<>'DELETE' THEN SELECT status INTO new_status FROM inventory_counts WHERE id=NEW."countId"; END IF;
  IF COALESCE(old_status,'draft')<>'draft' OR COALESCE(new_status,'draft')<>'draft' THEN RAISE EXCEPTION 'inventory_already_approved'; END IF;
  RETURN COALESCE(NEW,OLD);
END $$;
CREATE TRIGGER inventory_items_frozen BEFORE INSERT OR UPDATE OR DELETE ON inventory_count_items FOR EACH ROW EXECUTE FUNCTION fraguan_inventory_frozen();

CREATE OR REPLACE FUNCTION fraguan_count_approved_once() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status='approved' THEN RAISE EXCEPTION 'already_approved'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER count_approved_once BEFORE UPDATE OF status ON inventory_counts FOR EACH ROW EXECUTE FUNCTION fraguan_count_approved_once();

CREATE OR REPLACE FUNCTION fraguan_obligation_paid() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status='paid' AND OLD.status<>'paid' THEN
    UPDATE obligation_installments SET status='paid',"paidAt"=CURRENT_TIMESTAMP::text WHERE "payableId"=NEW.id;
    UPDATE financial_obligations obligation SET status='paid'
      WHERE id IN (SELECT "obligationId" FROM obligation_installments WHERE "payableId"=NEW.id)
        AND NOT EXISTS (SELECT 1 FROM obligation_installments item WHERE item."obligationId"=obligation.id AND item.status<>'paid');
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER obligation_installment_paid AFTER UPDATE OF status ON payables FOR EACH ROW EXECUTE FUNCTION fraguan_obligation_paid();

CREATE OR REPLACE FUNCTION fraguan_online_order_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD."paymentStatus"='paid' AND NEW."paymentStatus"<>'paid' THEN RAISE EXCEPTION 'paid_order_is_final'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER online_order_paid_once BEFORE UPDATE OF "paymentStatus" ON online_orders FOR EACH ROW EXECUTE FUNCTION fraguan_online_order_guard();

CREATE OR REPLACE FUNCTION fraguan_online_price_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."onlinePrice" IS NOT NULL AND NEW."onlinePrice"<=0 THEN RAISE EXCEPTION 'online_price_must_be_positive'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER online_price_guard BEFORE INSERT OR UPDATE OF "onlinePrice" ON variants FOR EACH ROW EXECUTE FUNCTION fraguan_online_price_guard();

CREATE OR REPLACE FUNCTION fraguan_online_reservation_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE physical BIGINT; reserved BIGINT;
BEGIN
  SELECT stock INTO physical FROM variants WHERE id=NEW."variantId" FOR UPDATE;
  SELECT COALESCE(SUM(quantity),0) INTO reserved FROM stock_reservations WHERE "variantId"=NEW."variantId" AND status='active' AND "expiresAt"::timestamptz>CURRENT_TIMESTAMP;
  IF physical IS NULL OR physical-reserved<NEW.quantity THEN RAISE EXCEPTION 'online_stock_unavailable'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER online_reservation_guard BEFORE INSERT ON stock_reservations FOR EACH ROW EXECUTE FUNCTION fraguan_online_reservation_guard();

CREATE OR REPLACE FUNCTION fraguan_payable_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status='paid' THEN RAISE EXCEPTION 'already_paid'; END IF;
  IF NEW.status='paid' AND EXISTS(SELECT 1 FROM checks WHERE "payableId"=NEW.id AND status IN ('issued','deposited')) THEN RAISE EXCEPTION 'settle_check_first'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER payable_paid_guard BEFORE UPDATE OF status ON payables FOR EACH ROW EXECUTE FUNCTION fraguan_payable_guard();

CREATE OR REPLACE FUNCTION fraguan_purchase_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."idempotencyKey" IS NOT NULL AND (NEW.subtotal<0 OR NEW.discount<0 OR NEW.discount>NEW.subtotal OR NEW.tax<0 OR NEW.shipping<0 OR NEW.total<=0 OR NEW.total<>NEW.subtotal-NEW.discount+NEW.tax+NEW.shipping) THEN RAISE EXCEPTION 'invalid_purchase_totals'; END IF;
  IF TG_OP='INSERT' AND NEW."idempotencyKey" IS NOT NULL AND NEW.status NOT IN ('draft','sent','confirmed','partially_received','received') THEN RAISE EXCEPTION 'invalid_purchase_status'; END IF;
  IF TG_OP='UPDATE' AND OLD.status<>NEW.status AND NOT ((OLD.status='draft' AND NEW.status IN ('sent','received')) OR (OLD.status='sent' AND NEW.status IN ('draft','confirmed')) OR (OLD.status='confirmed' AND NEW.status IN ('partially_received','received')) OR (OLD.status='partially_received' AND NEW.status='received')) THEN RAISE EXCEPTION 'invalid_purchase_status_transition'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER purchase_guard BEFORE INSERT OR UPDATE ON purchases FOR EACH ROW EXECUTE FUNCTION fraguan_purchase_guard();

CREATE OR REPLACE FUNCTION fraguan_purchase_item_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (SELECT "idempotencyKey" FROM purchases WHERE id=NEW."purchaseId") IS NOT NULL AND (NEW.quantity<=0 OR NEW.cost<0 OR NEW.discount<0 OR NEW.discount>NEW.quantity*NEW.cost) THEN RAISE EXCEPTION 'invalid_purchase_item'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER purchase_item_discount_guard BEFORE INSERT ON purchase_items FOR EACH ROW EXECUTE FUNCTION fraguan_purchase_item_guard();

CREATE OR REPLACE FUNCTION fraguan_purchase_receipt_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (SELECT status FROM purchases WHERE id=NEW."purchaseId" FOR UPDATE) NOT IN ('confirmed','partially_received') THEN RAISE EXCEPTION 'purchase_not_receivable'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER purchase_receipt_guard BEFORE INSERT ON purchase_receipts FOR EACH ROW EXECUTE FUNCTION fraguan_purchase_receipt_guard();

CREATE OR REPLACE FUNCTION fraguan_purchase_receipt_item() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE line purchase_items%ROWTYPE; receipt purchase_receipts%ROWTYPE; current_stock BIGINT;
BEGIN
  SELECT * INTO receipt FROM purchase_receipts WHERE id=NEW."receiptId";
  SELECT * INTO line FROM purchase_items WHERE id=NEW."purchaseItemId" FOR UPDATE;
  SELECT stock INTO current_stock FROM variants WHERE id=NEW."variantId" FOR UPDATE;
  IF receipt."purchaseId"<>line."purchaseId" OR line."variantId"<>NEW."variantId" OR line.cost<>NEW."unitCost" THEN RAISE EXCEPTION 'invalid_purchase_receipt_item'; END IF;
  IF NEW.quantity>line.quantity-line.received THEN RAISE EXCEPTION 'purchase_over_receipt'; END IF;
  IF NEW."beforeStock"<>current_stock OR NEW."afterStock"<>NEW."beforeStock"+NEW.quantity THEN RAISE EXCEPTION 'stock_conflict'; END IF;
  UPDATE purchase_items SET received=received+NEW.quantity WHERE id=NEW."purchaseItemId";
  UPDATE purchases purchase SET status=CASE WHEN NOT EXISTS(SELECT 1 FROM purchase_items item WHERE item."purchaseId"=purchase.id AND item.received<item.quantity) THEN 'received' ELSE 'partially_received' END,
    "updatedAt"=receipt."createdAt", "receivedAt"=CASE WHEN NOT EXISTS(SELECT 1 FROM purchase_items item WHERE item."purchaseId"=purchase.id AND item.received<item.quantity) THEN receipt."createdAt" ELSE NULL END
    WHERE id=receipt."purchaseId";
  RETURN NEW;
END $$;
CREATE TRIGGER purchase_receipt_item BEFORE INSERT ON purchase_receipt_items FOR EACH ROW EXECUTE FUNCTION fraguan_purchase_receipt_item();

CREATE OR REPLACE FUNCTION fraguan_redemption() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE available BIGINT; reward_points BIGINT;
BEGIN
  IF TG_OP='INSERT' THEN
    SELECT points INTO available FROM customers WHERE id=NEW."customerId" AND active=1 FOR UPDATE;
    SELECT points INTO reward_points FROM club_rewards WHERE id=NEW."rewardId" AND active=1;
    IF available IS NULL OR available<NEW.points THEN RAISE EXCEPTION 'insufficient_points'; END IF;
    IF reward_points IS NULL OR reward_points<>NEW.points THEN RAISE EXCEPTION 'reward_changed'; END IF;
    UPDATE customers SET points=points-NEW.points WHERE id=NEW."customerId";
  ELSIF NEW.status='cancelled' AND OLD.status='reserved' THEN
    UPDATE customers SET points=points+NEW.points WHERE id=NEW."customerId";
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER redemption_apply BEFORE INSERT OR UPDATE OF status ON club_redemptions FOR EACH ROW EXECUTE FUNCTION fraguan_redemption();

CREATE OR REPLACE FUNCTION fraguan_refund_item_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE remaining BIGINT;
BEGIN
  SELECT quantity-refunded INTO remaining FROM sale_items WHERE id=NEW."saleItemId" FOR UPDATE;
  IF remaining IS NULL OR NEW.quantity>remaining THEN RAISE EXCEPTION 'already_refunded'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER refund_item_guard BEFORE INSERT ON refund_items FOR EACH ROW EXECUTE FUNCTION fraguan_refund_item_guard();

CREATE OR REPLACE FUNCTION fraguan_sale_item_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE current_stock BIGINT; expected_price BIGINT; expected_cost BIGINT;
BEGIN
  SELECT stock,cost INTO current_stock,expected_cost FROM variants WHERE id=NEW."variantId" FOR UPDATE;
  SELECT CASE WHEN sale.channel='online' THEN (SELECT item."unitPrice" FROM online_order_items item WHERE item."orderId"=sale."onlineOrderId" AND item."variantId"=NEW."variantId" LIMIT 1) ELSE variant.price END
    INTO expected_price FROM variants variant JOIN sales sale ON sale.id=NEW."saleId" WHERE variant.id=NEW."variantId";
  IF current_stock IS NULL OR NEW.quantity>current_stock THEN RAISE EXCEPTION 'insufficient_stock'; END IF;
  IF NEW.price<>expected_price OR NEW.cost<>expected_cost THEN RAISE EXCEPTION 'price_changed'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER sale_item_guard BEFORE INSERT ON sale_items FOR EACH ROW EXECUTE FUNCTION fraguan_sale_item_guard();

CREATE OR REPLACE FUNCTION fraguan_sale_item_stock() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO stock_movements(id,"variantId",quantity,before,after,reason,"actorId",reference,"createdAt")
    SELECT NEW.id,NEW."variantId",-NEW.quantity,variant.stock,variant.stock-NEW.quantity,'Venta',sale."sellerId",sale.id,sale."createdAt" FROM variants variant JOIN sales sale ON sale.id=NEW."saleId" WHERE variant.id=NEW."variantId";
  RETURN NEW;
END $$;
CREATE TRIGGER sale_item_stock AFTER INSERT ON sale_items FOR EACH ROW EXECUTE FUNCTION fraguan_sale_item_stock();

CREATE OR REPLACE FUNCTION fraguan_stock_movement_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE current_stock BIGINT; located BIGINT;
BEGIN
  SELECT stock INTO current_stock FROM variants WHERE id=NEW."variantId" FOR UPDATE;
  IF NEW.before<>current_stock OR NEW.after<>NEW.before+NEW.quantity OR NEW.after<0 THEN RAISE EXCEPTION 'stock_conflict'; END IF;
  IF NEW."locationId" IS NOT NULL AND NOT EXISTS(SELECT 1 FROM stock_locations WHERE id=NEW."locationId" AND active=1) THEN RAISE EXCEPTION 'invalid_stock_location'; END IF;
  IF NEW.quantity<0 THEN
    SELECT COALESCE(SUM(quantity),0) INTO located FROM variant_location_stock WHERE "variantId"=NEW."variantId" AND (NEW."locationId" IS NULL OR "locationId"=NEW."locationId");
    IF located < -NEW.quantity THEN RAISE EXCEPTION 'location_stock_conflict'; END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER stock_movement_guard BEFORE INSERT ON stock_movements FOR EACH ROW EXECUTE FUNCTION fraguan_stock_movement_guard();

CREATE OR REPLACE FUNCTION fraguan_stock_movement_apply() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE target TEXT; remaining BIGINT; location RECORD; taken BIGINT;
BEGIN
  UPDATE variants SET stock=NEW.after WHERE id=NEW."variantId";
  IF NEW.quantity>0 THEN
    target:=COALESCE(NEW."locationId",CASE WHEN NEW.reason='Devolución' THEN 'loc-salon' ELSE 'loc-deposito' END);
    INSERT INTO variant_location_stock("variantId","locationId",quantity,"updatedAt") VALUES(NEW."variantId",target,0,NEW."createdAt") ON CONFLICT("variantId","locationId") DO NOTHING;
    SELECT quantity INTO taken FROM variant_location_stock WHERE "variantId"=NEW."variantId" AND "locationId"=target FOR UPDATE;
    INSERT INTO stock_location_movements(id,"stockMovementId","variantId","locationId",quantity,before,after,"createdAt") VALUES(NEW.id||':'||target,NEW.id,NEW."variantId",target,NEW.quantity,taken,taken+NEW.quantity,NEW."createdAt");
    UPDATE variant_location_stock SET quantity=quantity+NEW.quantity,"updatedAt"=NEW."createdAt" WHERE "variantId"=NEW."variantId" AND "locationId"=target;
  ELSIF NEW.quantity<0 THEN
    remaining:=-NEW.quantity;
    FOR location IN SELECT stock."locationId",stock.quantity FROM variant_location_stock stock JOIN stock_locations place ON place.id=stock."locationId" WHERE stock."variantId"=NEW."variantId" AND stock.quantity>0 AND (NEW."locationId" IS NULL OR stock."locationId"=NEW."locationId") ORDER BY place.priority,stock."locationId" FOR UPDATE OF stock LOOP
      EXIT WHEN remaining=0;
      taken:=LEAST(location.quantity,remaining);
      INSERT INTO stock_location_movements(id,"stockMovementId","variantId","locationId",quantity,before,after,"createdAt") VALUES(NEW.id||':'||location."locationId",NEW.id,NEW."variantId",location."locationId",-taken,location.quantity,location.quantity-taken,NEW."createdAt");
      UPDATE variant_location_stock SET quantity=quantity-taken,"updatedAt"=NEW."createdAt" WHERE "variantId"=NEW."variantId" AND "locationId"=location."locationId";
      remaining:=remaining-taken;
    END LOOP;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER stock_movement_apply AFTER INSERT ON stock_movements FOR EACH ROW EXECUTE FUNCTION fraguan_stock_movement_apply();

CREATE OR REPLACE FUNCTION fraguan_stock_movement_cleanup() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN DELETE FROM stock_location_movements WHERE "stockMovementId"=OLD.id; RETURN OLD; END $$;
CREATE TRIGGER stock_location_movement_cleanup BEFORE DELETE ON stock_movements FOR EACH ROW EXECUTE FUNCTION fraguan_stock_movement_cleanup();

CREATE OR REPLACE FUNCTION fraguan_stock_transfer() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE available BIGINT;
BEGIN
  IF NEW."fromLocationId"=NEW."toLocationId" THEN RAISE EXCEPTION 'same_stock_location'; END IF;
  IF NOT EXISTS(SELECT 1 FROM stock_locations WHERE id=NEW."fromLocationId" AND active=1) OR NOT EXISTS(SELECT 1 FROM stock_locations WHERE id=NEW."toLocationId" AND active=1) THEN RAISE EXCEPTION 'invalid_stock_location'; END IF;
  SELECT quantity INTO available FROM variant_location_stock WHERE "variantId"=NEW."variantId" AND "locationId"=NEW."fromLocationId" FOR UPDATE;
  IF available IS NULL OR available<NEW.quantity THEN RAISE EXCEPTION 'location_stock_conflict'; END IF;
  UPDATE variant_location_stock SET quantity=quantity-NEW.quantity,"updatedAt"=NEW."createdAt" WHERE "variantId"=NEW."variantId" AND "locationId"=NEW."fromLocationId";
  INSERT INTO variant_location_stock("variantId","locationId",quantity,"updatedAt") VALUES(NEW."variantId",NEW."toLocationId",0,NEW."createdAt") ON CONFLICT("variantId","locationId") DO NOTHING;
  UPDATE variant_location_stock SET quantity=quantity+NEW.quantity,"updatedAt"=NEW."createdAt" WHERE "variantId"=NEW."variantId" AND "locationId"=NEW."toLocationId";
  RETURN NEW;
END $$;
CREATE TRIGGER stock_transfer_apply BEFORE INSERT ON stock_transfers FOR EACH ROW EXECUTE FUNCTION fraguan_stock_transfer();

CREATE OR REPLACE FUNCTION fraguan_variant_storage_cleanup() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN DELETE FROM stock_transfers WHERE "variantId"=OLD.id; DELETE FROM variant_location_stock WHERE "variantId"=OLD.id; RETURN OLD; END $$;
CREATE TRIGGER variant_storage_cleanup BEFORE DELETE ON variants FOR EACH ROW EXECUTE FUNCTION fraguan_variant_storage_cleanup();
