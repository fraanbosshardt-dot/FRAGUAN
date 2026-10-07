DROP TRIGGER sale_item_guard;
CREATE TRIGGER sale_item_guard BEFORE INSERT ON sale_items BEGIN
  SELECT CASE WHEN (SELECT channel FROM sales WHERE id=NEW.saleId)='online'
    AND NOT EXISTS (
      SELECT 1 FROM stock_reservations r JOIN online_orders o ON o.id=r.orderId
      JOIN sales s ON s.onlineOrderId=o.id
      WHERE s.id=NEW.saleId AND r.variantId=NEW.variantId AND r.quantity=NEW.quantity
        AND r.status='active' AND julianday(r.expiresAt)>julianday('now')
        AND julianday(o.expiresAt)>julianday('now') AND o.paymentStatus='pending' AND o.status<>'cancelled'
    ) THEN RAISE(ABORT,'online_stock_unavailable') END;
  SELECT CASE WHEN NEW.quantity>(
    SELECT stock-COALESCE((SELECT SUM(r.quantity) FROM stock_reservations r
      WHERE r.variantId=NEW.variantId AND r.status='active' AND julianday(r.expiresAt)>julianday('now')
        AND ((SELECT channel FROM sales WHERE id=NEW.saleId)<>'online'
          OR r.orderId<>(SELECT onlineOrderId FROM sales WHERE id=NEW.saleId))),0)
      FROM variants WHERE id=NEW.variantId
    ) THEN RAISE(ABORT,'insufficient_stock') END;
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM variants v JOIN sales s ON s.id=NEW.saleId
      WHERE v.id=NEW.variantId AND NEW.cost=v.cost AND NEW.price=CASE WHEN s.channel='online' THEN
      (SELECT oi.unitPrice FROM online_order_items oi WHERE oi.orderId=s.onlineOrderId AND oi.variantId=NEW.variantId)
      ELSE v.price END
    )
    THEN RAISE(ABORT,'price_changed') END;
END;
