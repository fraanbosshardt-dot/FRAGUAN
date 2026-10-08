UPDATE variants SET "onlinePrice"=price WHERE "onlinePrice" IS NULL;
UPDATE store_price_campaign_items SET "originalOnlinePrice"="originalPrice" WHERE "originalOnlinePrice" IS NULL;
CREATE OR REPLACE FUNCTION fraguan_independent_online_price() RETURNS TRIGGER AS $$
BEGIN
 IF NEW."onlinePrice" IS NULL THEN
  NEW."onlinePrice" := NEW.price;
 END IF;
 RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER independent_online_price BEFORE INSERT OR UPDATE OF "onlinePrice" ON variants
FOR EACH ROW EXECUTE FUNCTION fraguan_independent_online_price();
