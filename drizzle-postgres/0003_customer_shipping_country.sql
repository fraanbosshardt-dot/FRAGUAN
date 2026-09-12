ALTER TABLE customer_addresses
  ADD COLUMN IF NOT EXISTS country TEXT NOT NULL DEFAULT 'Argentina';

ALTER TABLE online_orders
  ADD COLUMN IF NOT EXISTS country TEXT NOT NULL DEFAULT 'Argentina';
