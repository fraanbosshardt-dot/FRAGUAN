-- Serialize sales and reservation creation on the same variant row.
CREATE OR REPLACE FUNCTION fraguan_sale_item_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  current_stock BIGINT;
  expected_price BIGINT;
  expected_cost BIGINT;
  reserved BIGINT;
  own_order TEXT;
  sale_channel TEXT;
  own_reservation TEXT;
  own_expiry TEXT;
  order_expiry TEXT;
BEGIN
  SELECT stock,cost INTO current_stock,expected_cost FROM variants WHERE id=NEW."variantId" FOR UPDATE;
  SELECT channel,"onlineOrderId" INTO sale_channel,own_order FROM sales WHERE id=NEW."saleId";
  IF sale_channel='online' THEN
    SELECT r.id,r."expiresAt",o."expiresAt" INTO own_reservation,own_expiry,order_expiry FROM stock_reservations r
      JOIN online_orders o ON o.id=r."orderId"
      WHERE r."orderId"=own_order AND r."variantId"=NEW."variantId"
        AND r.status='active' AND r.quantity=NEW.quantity
        AND r."expiresAt"::timestamptz>clock_timestamp()
        AND o."expiresAt"::timestamptz>clock_timestamp()
        AND o."paymentStatus"='pending' AND o.status<>'cancelled'
      FOR UPDATE OF r;
    IF own_reservation IS NULL OR own_expiry::timestamptz<=clock_timestamp() OR order_expiry::timestamptz<=clock_timestamp() THEN RAISE EXCEPTION 'online_stock_unavailable'; END IF;
  END IF;
  SELECT COALESCE(SUM(quantity),0) INTO reserved FROM stock_reservations
    WHERE "variantId"=NEW."variantId" AND status='active'
      AND "expiresAt"::timestamptz>clock_timestamp()
      AND (sale_channel<>'online' OR "orderId"<>own_order);
  IF current_stock IS NULL OR NEW.quantity>current_stock-reserved THEN RAISE EXCEPTION 'insufficient_stock'; END IF;
  SELECT CASE WHEN sale_channel='online' THEN
    (SELECT "unitPrice" FROM online_order_items WHERE "orderId"=own_order AND "variantId"=NEW."variantId" LIMIT 1)
    ELSE price END INTO expected_price FROM variants WHERE id=NEW."variantId";
  IF expected_price IS NULL OR NEW.price<>expected_price OR NEW.cost<>expected_cost THEN RAISE EXCEPTION 'price_changed'; END IF;
  RETURN NEW;
END $$;
