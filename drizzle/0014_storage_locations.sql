CREATE TABLE stock_locations (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  kind TEXT NOT NULL CHECK(kind IN ('store','warehouse','other')),
  detail TEXT NOT NULL DEFAULT '',
  priority INTEGER NOT NULL DEFAULT 100,
  active INTEGER NOT NULL DEFAULT 1,
  createdAt TEXT NOT NULL
);

INSERT INTO stock_locations(id,name,code,kind,detail,priority,active,createdAt) VALUES
  ('loc-salon','Salón','SALON','store','Área de venta',10,1,datetime('now')),
  ('loc-deposito','Depósito principal','DEPOSITO','warehouse','Depósito de mercadería',20,1,datetime('now')),
  ('loc-unassigned','Sin asignar','SIN-ASIGNAR','other','Revisar y ubicar físicamente',999,1,datetime('now'));

CREATE TABLE variant_location_stock (
  variantId TEXT NOT NULL REFERENCES variants(id),
  locationId TEXT NOT NULL REFERENCES stock_locations(id),
  quantity INTEGER NOT NULL DEFAULT 0 CHECK(quantity >= 0),
  updatedAt TEXT NOT NULL,
  PRIMARY KEY(variantId,locationId)
);

INSERT INTO variant_location_stock(variantId,locationId,quantity,updatedAt)
SELECT id,'loc-unassigned',stock,datetime('now') FROM variants WHERE stock > 0;

CREATE TABLE stock_location_movements (
  id TEXT PRIMARY KEY NOT NULL,
  stockMovementId TEXT NOT NULL REFERENCES stock_movements(id),
  variantId TEXT NOT NULL REFERENCES variants(id),
  locationId TEXT NOT NULL REFERENCES stock_locations(id),
  quantity INTEGER NOT NULL,
  before INTEGER NOT NULL,
  after INTEGER NOT NULL,
  createdAt TEXT NOT NULL
);

CREATE TABLE stock_transfers (
  id TEXT PRIMARY KEY NOT NULL,
  variantId TEXT NOT NULL REFERENCES variants(id),
  fromLocationId TEXT NOT NULL REFERENCES stock_locations(id),
  toLocationId TEXT NOT NULL REFERENCES stock_locations(id),
  quantity INTEGER NOT NULL CHECK(quantity > 0),
  actorId TEXT NOT NULL REFERENCES users(id),
  notes TEXT NOT NULL DEFAULT '',
  createdAt TEXT NOT NULL
);

ALTER TABLE stock_movements ADD COLUMN locationId TEXT REFERENCES stock_locations(id);

CREATE INDEX idx_variant_location_location ON variant_location_stock(locationId,quantity);
CREATE INDEX idx_location_movements_variant_date ON stock_location_movements(variantId,createdAt DESC);
CREATE INDEX idx_stock_transfers_date ON stock_transfers(createdAt DESC);

CREATE TRIGGER stock_location_movement_cleanup
BEFORE DELETE ON stock_movements
BEGIN
  DELETE FROM stock_location_movements WHERE stockMovementId=OLD.id;
END;

CREATE TRIGGER variant_storage_cleanup
BEFORE DELETE ON variants
BEGIN
  DELETE FROM stock_transfers WHERE variantId=OLD.id;
  DELETE FROM variant_location_stock WHERE variantId=OLD.id;
END;

CREATE TRIGGER stock_location_choice_guard
BEFORE INSERT ON stock_movements
WHEN NEW.locationId IS NOT NULL
BEGIN
  SELECT CASE WHEN NOT EXISTS(
    SELECT 1 FROM stock_locations WHERE id=NEW.locationId AND active=1
  ) THEN RAISE(ABORT,'invalid_stock_location') END;
END;

CREATE TRIGGER stock_location_available_guard
BEFORE INSERT ON stock_movements
WHEN NEW.quantity < 0
BEGIN
  SELECT CASE WHEN COALESCE((
    SELECT SUM(quantity) FROM variant_location_stock
    WHERE variantId=NEW.variantId
      AND (NEW.locationId IS NULL OR locationId=NEW.locationId)
  ),0) < -NEW.quantity THEN RAISE(ABORT,'location_stock_conflict') END;
END;

CREATE TRIGGER stock_location_increase
AFTER INSERT ON stock_movements
WHEN NEW.quantity > 0
BEGIN
  INSERT INTO variant_location_stock(variantId,locationId,quantity,updatedAt)
  VALUES(
    NEW.variantId,
    COALESCE(NEW.locationId,CASE WHEN NEW.reason='Devolución' THEN 'loc-salon' ELSE 'loc-deposito' END),
    0,
    NEW.createdAt
  ) ON CONFLICT(variantId,locationId) DO NOTHING;

  INSERT INTO stock_location_movements(id,stockMovementId,variantId,locationId,quantity,before,after,createdAt)
  SELECT NEW.id||':'||locationId,NEW.id,NEW.variantId,locationId,NEW.quantity,quantity,quantity+NEW.quantity,NEW.createdAt
  FROM variant_location_stock
  WHERE variantId=NEW.variantId
    AND locationId=COALESCE(NEW.locationId,CASE WHEN NEW.reason='Devolución' THEN 'loc-salon' ELSE 'loc-deposito' END);

  UPDATE variant_location_stock
  SET quantity=quantity+NEW.quantity,updatedAt=NEW.createdAt
  WHERE variantId=NEW.variantId
    AND locationId=COALESCE(NEW.locationId,CASE WHEN NEW.reason='Devolución' THEN 'loc-salon' ELSE 'loc-deposito' END);
END;

CREATE TRIGGER stock_location_decrease
AFTER INSERT ON stock_movements
WHEN NEW.quantity < 0
BEGIN
  INSERT INTO stock_location_movements(id,stockMovementId,variantId,locationId,quantity,before,after,createdAt)
  SELECT
    NEW.id||':'||s.locationId,
    NEW.id,
    NEW.variantId,
    s.locationId,
    -MIN(
      s.quantity,
      MAX(0,-NEW.quantity-COALESCE((
        SELECT SUM(previous.quantity)
        FROM variant_location_stock previous
        JOIN stock_locations previous_location ON previous_location.id=previous.locationId
        WHERE previous.variantId=NEW.variantId
          AND (NEW.locationId IS NULL OR previous.locationId=NEW.locationId)
          AND (
            previous_location.priority<location.priority OR
            (previous_location.priority=location.priority AND previous.locationId<s.locationId)
          )
      ),0))
    ),
    s.quantity,
    s.quantity-MIN(
      s.quantity,
      MAX(0,-NEW.quantity-COALESCE((
        SELECT SUM(previous.quantity)
        FROM variant_location_stock previous
        JOIN stock_locations previous_location ON previous_location.id=previous.locationId
        WHERE previous.variantId=NEW.variantId
          AND (NEW.locationId IS NULL OR previous.locationId=NEW.locationId)
          AND (
            previous_location.priority<location.priority OR
            (previous_location.priority=location.priority AND previous.locationId<s.locationId)
          )
      ),0))
    ),
    NEW.createdAt
  FROM variant_location_stock s
  JOIN stock_locations location ON location.id=s.locationId
  WHERE s.variantId=NEW.variantId
    AND s.quantity>0
    AND (NEW.locationId IS NULL OR s.locationId=NEW.locationId)
    AND MAX(0,-NEW.quantity-COALESCE((
      SELECT SUM(previous.quantity)
      FROM variant_location_stock previous
      JOIN stock_locations previous_location ON previous_location.id=previous.locationId
      WHERE previous.variantId=NEW.variantId
        AND (NEW.locationId IS NULL OR previous.locationId=NEW.locationId)
        AND (
          previous_location.priority<location.priority OR
          (previous_location.priority=location.priority AND previous.locationId<s.locationId)
        )
    ),0))>0;

  UPDATE variant_location_stock
  SET quantity=quantity+(
        SELECT movement.quantity FROM stock_location_movements movement
        WHERE movement.stockMovementId=NEW.id
          AND movement.variantId=variant_location_stock.variantId
          AND movement.locationId=variant_location_stock.locationId
      ),
      updatedAt=NEW.createdAt
  WHERE variantId=NEW.variantId AND EXISTS(
    SELECT 1 FROM stock_location_movements movement
    WHERE movement.stockMovementId=NEW.id
      AND movement.variantId=variant_location_stock.variantId
      AND movement.locationId=variant_location_stock.locationId
  );
END;

CREATE TRIGGER stock_transfer_guard
BEFORE INSERT ON stock_transfers
BEGIN
  SELECT CASE WHEN NEW.fromLocationId=NEW.toLocationId
    THEN RAISE(ABORT,'same_stock_location') END;
  SELECT CASE WHEN NOT EXISTS(
    SELECT 1 FROM stock_locations WHERE id=NEW.fromLocationId AND active=1
  ) OR NOT EXISTS(
    SELECT 1 FROM stock_locations WHERE id=NEW.toLocationId AND active=1
  ) THEN RAISE(ABORT,'invalid_stock_location') END;
  SELECT CASE WHEN COALESCE((
    SELECT quantity FROM variant_location_stock
    WHERE variantId=NEW.variantId AND locationId=NEW.fromLocationId
  ),0)<NEW.quantity THEN RAISE(ABORT,'location_stock_conflict') END;
END;

CREATE TRIGGER stock_transfer_apply
AFTER INSERT ON stock_transfers
BEGIN
  UPDATE variant_location_stock
  SET quantity=quantity-NEW.quantity,updatedAt=NEW.createdAt
  WHERE variantId=NEW.variantId AND locationId=NEW.fromLocationId;
  INSERT INTO variant_location_stock(variantId,locationId,quantity,updatedAt)
  VALUES(NEW.variantId,NEW.toLocationId,0,NEW.createdAt)
  ON CONFLICT(variantId,locationId) DO NOTHING;
  UPDATE variant_location_stock
  SET quantity=quantity+NEW.quantity,updatedAt=NEW.createdAt
  WHERE variantId=NEW.variantId AND locationId=NEW.toLocationId;
END;
