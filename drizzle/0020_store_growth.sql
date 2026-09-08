ALTER TABLE online_orders ADD COLUMN couponCode TEXT NOT NULL DEFAULT '';
ALTER TABLE online_orders ADD COLUMN attributionJson TEXT NOT NULL DEFAULT '';

CREATE TABLE store_events (
  id TEXT PRIMARY KEY NOT NULL,
  sessionId TEXT NOT NULL,
  customerId TEXT REFERENCES customers(id),
  event TEXT NOT NULL,
  path TEXT NOT NULL DEFAULT '',
  productId TEXT REFERENCES products(id),
  variantId TEXT REFERENCES variants(id),
  orderId TEXT REFERENCES online_orders(id),
  value INTEGER NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT '',
  medium TEXT NOT NULL DEFAULT '',
  campaign TEXT NOT NULL DEFAULT '',
  metadata TEXT NOT NULL DEFAULT '',
  createdAt TEXT NOT NULL
);
CREATE INDEX idx_store_events_event_date ON store_events(event,createdAt DESC);
CREATE INDEX idx_store_events_session_date ON store_events(sessionId,createdAt DESC);
CREATE INDEX idx_store_events_product_date ON store_events(productId,createdAt DESC);
CREATE INDEX idx_store_events_order ON store_events(orderId);

CREATE TABLE abandoned_carts (
  id TEXT PRIMARY KEY NOT NULL,
  sessionId TEXT NOT NULL UNIQUE,
  customerId TEXT REFERENCES customers(id),
  email TEXT NOT NULL DEFAULT '',
  cartJson TEXT NOT NULL,
  subtotal INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  recoveryToken TEXT NOT NULL UNIQUE,
  source TEXT NOT NULL DEFAULT '',
  campaign TEXT NOT NULL DEFAULT '',
  lastActivityAt TEXT NOT NULL,
  firstReminderAt TEXT,
  secondReminderAt TEXT,
  recoveredAt TEXT,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);
CREATE INDEX idx_abandoned_carts_due ON abandoned_carts(status,lastActivityAt);
CREATE INDEX idx_abandoned_carts_customer ON abandoned_carts(customerId,updatedAt DESC);

CREATE TABLE back_in_stock_requests (
  id TEXT PRIMARY KEY NOT NULL,
  variantId TEXT NOT NULL REFERENCES variants(id),
  email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'waiting',
  source TEXT NOT NULL DEFAULT 'product',
  createdAt TEXT NOT NULL,
  notifiedAt TEXT,
  UNIQUE(variantId,email)
);
CREATE INDEX idx_back_in_stock_waiting ON back_in_stock_requests(status,variantId);

CREATE TABLE product_reviews (
  id TEXT PRIMARY KEY NOT NULL,
  productId TEXT NOT NULL REFERENCES products(id),
  customerId TEXT REFERENCES customers(id),
  orderId TEXT REFERENCES online_orders(id),
  email TEXT NOT NULL,
  displayName TEXT NOT NULL,
  rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
  title TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  verified INTEGER NOT NULL DEFAULT 0,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);
CREATE INDEX idx_product_reviews_public ON product_reviews(productId,status,createdAt DESC);
CREATE INDEX idx_product_reviews_moderation ON product_reviews(status,createdAt DESC);

CREATE TABLE customer_addresses (
  id TEXT PRIMARY KEY NOT NULL,
  customerId TEXT NOT NULL REFERENCES customers(id),
  label TEXT NOT NULL DEFAULT 'Casa',
  recipient TEXT NOT NULL,
  phone TEXT NOT NULL,
  postalCode TEXT NOT NULL,
  address TEXT NOT NULL,
  addressExtra TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL,
  province TEXT NOT NULL,
  isDefault INTEGER NOT NULL DEFAULT 0,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);
CREATE INDEX idx_customer_addresses_customer ON customer_addresses(customerId,isDefault DESC,createdAt DESC);

CREATE TABLE marketing_automation_log (
  id TEXT PRIMARY KEY NOT NULL,
  kind TEXT NOT NULL,
  entityId TEXT NOT NULL,
  recipient TEXT NOT NULL,
  status TEXT NOT NULL,
  detail TEXT NOT NULL DEFAULT '',
  createdAt TEXT NOT NULL,
  UNIQUE(kind,entityId)
);
CREATE INDEX idx_marketing_automation_date ON marketing_automation_log(createdAt DESC);

PRAGMA optimize;
