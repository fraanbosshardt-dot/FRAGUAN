-- Materializar el precio web vigente sin alterar importes ni pedidos históricos.
UPDATE variants SET onlinePrice=price WHERE onlinePrice IS NULL;
UPDATE store_price_campaign_items SET originalOnlinePrice=originalPrice WHERE originalOnlinePrice IS NULL;
CREATE TRIGGER independent_online_price_insert AFTER INSERT ON variants
WHEN NEW.onlinePrice IS NULL
BEGIN
 UPDATE variants SET onlinePrice=NEW.price WHERE id=NEW.id;
END;
CREATE TRIGGER independent_online_price_update AFTER UPDATE OF onlinePrice ON variants
WHEN NEW.onlinePrice IS NULL
BEGIN
 UPDATE variants SET onlinePrice=NEW.price WHERE id=NEW.id;
END;
