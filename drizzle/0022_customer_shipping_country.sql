ALTER TABLE customer_addresses ADD COLUMN country TEXT NOT NULL DEFAULT 'Argentina';
ALTER TABLE online_orders ADD COLUMN country TEXT NOT NULL DEFAULT 'Argentina';
