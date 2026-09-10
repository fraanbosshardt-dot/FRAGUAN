CREATE OR REPLACE FUNCTION fraguan_online_order_financial_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.subtotal<0 OR NEW.discount<0 OR NEW.discount>NEW.subtotal OR NEW.shipping<0 OR NEW.total<=0 OR NEW.total<>NEW.subtotal-NEW.discount+NEW.shipping THEN
    RAISE EXCEPTION 'invalid_online_order_totals';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER online_order_financial_guard BEFORE INSERT OR UPDATE OF subtotal,discount,shipping,total ON online_orders FOR EACH ROW EXECUTE FUNCTION fraguan_online_order_financial_guard();

CREATE OR REPLACE FUNCTION fraguan_payment_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE sale_total BIGINT; paid BIGINT;
BEGIN
  IF NEW.amount<=0 OR NEW.commission<0 OR NEW.commission>NEW.amount OR NEW.net<>NEW.amount-NEW.commission THEN
    RAISE EXCEPTION 'invalid_payment_amounts';
  END IF;
  SELECT total INTO sale_total FROM sales WHERE id=NEW."saleId" FOR UPDATE;
  SELECT COALESCE(SUM(amount),0) INTO paid FROM payments WHERE "saleId"=NEW."saleId" AND (TG_OP='INSERT' OR id<>OLD.id);
  IF sale_total IS NULL OR paid+NEW.amount>sale_total THEN RAISE EXCEPTION 'sale_payment_exceeded'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER payment_guard BEFORE INSERT OR UPDATE OF amount,commission,net,"saleId" ON payments FOR EACH ROW EXECUTE FUNCTION fraguan_payment_guard();

CREATE OR REPLACE FUNCTION fraguan_refund_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE sale_total BIGINT; refunded_total BIGINT;
BEGIN
  IF NEW.amount<=0 THEN RAISE EXCEPTION 'invalid_refund_amount'; END IF;
  SELECT total INTO sale_total FROM sales WHERE id=NEW."saleId" FOR UPDATE;
  SELECT COALESCE(SUM(amount),0) INTO refunded_total FROM refunds WHERE "saleId"=NEW."saleId" AND (TG_OP='INSERT' OR id<>OLD.id);
  IF sale_total IS NULL OR refunded_total+NEW.amount>sale_total THEN RAISE EXCEPTION 'refund_exceeds_sale'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER refund_guard BEFORE INSERT OR UPDATE OF amount,"saleId" ON refunds FOR EACH ROW EXECUTE FUNCTION fraguan_refund_guard();

CREATE OR REPLACE FUNCTION fraguan_online_payment_event_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE order_total BIGINT;
BEGIN
  SELECT total INTO order_total FROM online_orders WHERE id=NEW."orderId" FOR UPDATE;
  IF NEW.amount<=0 OR order_total IS NULL OR NEW.amount<>order_total THEN RAISE EXCEPTION 'invalid_online_payment_amount'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER online_payment_event_guard BEFORE INSERT ON online_payment_events FOR EACH ROW EXECUTE FUNCTION fraguan_online_payment_event_guard();
