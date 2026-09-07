ALTER TABLE variants ADD COLUMN onlinePrice INTEGER;

CREATE TRIGGER online_price_insert_guard
BEFORE INSERT ON variants
WHEN NEW.onlinePrice IS NOT NULL AND NEW.onlinePrice <= 0
BEGIN
  SELECT RAISE(ABORT,'online_price_must_be_positive');
END;

CREATE TRIGGER online_price_update_guard
BEFORE UPDATE OF onlinePrice ON variants
WHEN NEW.onlinePrice IS NOT NULL AND NEW.onlinePrice <= 0
BEGIN
  SELECT RAISE(ABORT,'online_price_must_be_positive');
END;
