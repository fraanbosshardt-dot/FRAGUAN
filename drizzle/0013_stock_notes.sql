ALTER TABLE stock_movements ADD COLUMN notes TEXT NOT NULL DEFAULT '';
CREATE INDEX idx_stock_movements_created_at ON stock_movements(createdAt DESC);
