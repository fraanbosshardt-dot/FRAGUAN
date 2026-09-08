ALTER TABLE customer_accounts ADD COLUMN authProvider TEXT NOT NULL DEFAULT 'password';
ALTER TABLE customer_accounts ADD COLUMN googleSub TEXT;
CREATE UNIQUE INDEX idx_customer_accounts_google_sub ON customer_accounts(googleSub) WHERE googleSub IS NOT NULL;

ALTER TABLE online_orders ADD COLUMN document TEXT NOT NULL DEFAULT '';
ALTER TABLE online_orders ADD COLUMN addressExtra TEXT NOT NULL DEFAULT '';

CREATE TABLE online_return_requests (
  id TEXT PRIMARY KEY NOT NULL,
  code TEXT NOT NULL UNIQUE,
  orderId TEXT NOT NULL REFERENCES online_orders(id),
  orderNumber INTEGER NOT NULL,
  email TEXT NOT NULL,
  customerName TEXT NOT NULL,
  phone TEXT NOT NULL DEFAULT '',
  kind TEXT NOT NULL CHECK(kind IN ('withdrawal','exchange','return')),
  reason TEXT NOT NULL,
  detail TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'received',
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);

CREATE INDEX idx_online_return_requests_order ON online_return_requests(orderId,createdAt DESC);
CREATE INDEX idx_online_return_requests_status ON online_return_requests(status,createdAt DESC);
