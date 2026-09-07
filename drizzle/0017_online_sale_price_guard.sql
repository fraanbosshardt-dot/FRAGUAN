DROP TRIGGER sale_item_guard;

CREATE TRIGGER sale_item_guard BEFORE INSERT ON sale_items BEGIN
  SELECT CASE WHEN NEW.quantity > (SELECT stock FROM variants WHERE id=NEW.variantId)
    THEN RAISE(ABORT,'insufficient_stock') END;
  SELECT CASE WHEN NEW.price != (
    SELECT CASE WHEN s.channel='online'
      THEN (SELECT oi.unitPrice FROM online_order_items oi
             WHERE oi.orderId=s.onlineOrderId AND oi.variantId=NEW.variantId)
      ELSE v.price END
      FROM variants v JOIN sales s ON s.id=NEW.saleId
     WHERE v.id=NEW.variantId
  ) OR NEW.cost != (SELECT cost FROM variants WHERE id=NEW.variantId)
    THEN RAISE(ABORT,'price_changed') END;
END;
