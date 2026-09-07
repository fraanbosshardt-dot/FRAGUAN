CREATE TABLE online_product_profiles (
  productId TEXT PRIMARY KEY NOT NULL REFERENCES products(id),
  slug TEXT NOT NULL UNIQUE,
  shortDescription TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  material TEXT NOT NULL DEFAULT '',
  care TEXT NOT NULL DEFAULT '',
  fit TEXT NOT NULL DEFAULT 'Regular',
  section TEXT NOT NULL DEFAULT 'Colección',
  featured INTEGER NOT NULL DEFAULT 0,
  published INTEGER NOT NULL DEFAULT 1,
  sortOrder INTEGER NOT NULL DEFAULT 100,
  updatedAt TEXT NOT NULL
);

INSERT INTO online_product_profiles(productId,slug,shortDescription,description,material,care,fit,section,featured,published,sortOrder,updatedAt)
SELECT id,
       lower(replace(replace(replace(replace(replace(name,' ','-'),'á','a'),'é','e'),'í','i'),'ó','o'))||'-'||substr(id,-6),
       'Una prenda versátil para usar todos los días.',
       'Diseñada para combinar fácil, sentirse cómoda y acompañarte durante todo el día.',
       'Consultar composición en la etiqueta.',
       'Seguir las indicaciones de la etiqueta interior.',
       'Regular',
       category,
       CASE WHEN rowid<=6 THEN 1 ELSE 0 END,
       active,
       rowid,
       datetime('now')
  FROM products;

CREATE TABLE customer_accounts (
  id TEXT PRIMARY KEY NOT NULL,
  customerId TEXT NOT NULL UNIQUE REFERENCES customers(id),
  email TEXT NOT NULL UNIQUE,
  passwordHash TEXT NOT NULL,
  passwordSalt TEXT NOT NULL,
  emailVerified INTEGER NOT NULL DEFAULT 0,
  marketingConsent INTEGER NOT NULL DEFAULT 0,
  createdAt TEXT NOT NULL,
  lastLoginAt TEXT
);

CREATE TABLE customer_sessions (
  id TEXT PRIMARY KEY NOT NULL,
  accountId TEXT NOT NULL REFERENCES customer_accounts(id),
  tokenHash TEXT NOT NULL UNIQUE,
  expiresAt TEXT NOT NULL,
  createdAt TEXT NOT NULL
);

CREATE TABLE online_orders (
  id TEXT PRIMARY KEY NOT NULL,
  orderNumber INTEGER NOT NULL UNIQUE,
  customerId TEXT REFERENCES customers(id),
  email TEXT NOT NULL,
  customerName TEXT NOT NULL,
  phone TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'awaiting_payment',
  paymentStatus TEXT NOT NULL DEFAULT 'pending',
  paymentMethod TEXT NOT NULL CHECK(paymentMethod IN ('transfer','card')),
  fulfillmentStatus TEXT NOT NULL DEFAULT 'unfulfilled',
  subtotal INTEGER NOT NULL,
  discount INTEGER NOT NULL DEFAULT 0,
  shipping INTEGER NOT NULL DEFAULT 0,
  total INTEGER NOT NULL,
  shippingMethod TEXT NOT NULL,
  postalCode TEXT NOT NULL,
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  province TEXT NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  accessTokenHash TEXT NOT NULL,
  transferReference TEXT NOT NULL UNIQUE,
  paymentReference TEXT NOT NULL DEFAULT '',
  trackingNumber TEXT NOT NULL DEFAULT '',
  expiresAt TEXT NOT NULL,
  paidAt TEXT,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);

CREATE TABLE online_order_items (
  id TEXT PRIMARY KEY NOT NULL,
  orderId TEXT NOT NULL REFERENCES online_orders(id),
  variantId TEXT NOT NULL REFERENCES variants(id),
  productName TEXT NOT NULL,
  sku TEXT NOT NULL,
  color TEXT NOT NULL,
  size TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK(quantity>0),
  unitPrice INTEGER NOT NULL,
  lineTotal INTEGER NOT NULL
);

CREATE TABLE stock_reservations (
  id TEXT PRIMARY KEY NOT NULL,
  orderId TEXT NOT NULL REFERENCES online_orders(id),
  variantId TEXT NOT NULL REFERENCES variants(id),
  quantity INTEGER NOT NULL CHECK(quantity>0),
  status TEXT NOT NULL DEFAULT 'active',
  expiresAt TEXT NOT NULL,
  createdAt TEXT NOT NULL,
  UNIQUE(orderId,variantId)
);

CREATE TABLE online_order_events (
  id TEXT PRIMARY KEY NOT NULL,
  orderId TEXT NOT NULL REFERENCES online_orders(id),
  kind TEXT NOT NULL,
  detail TEXT NOT NULL DEFAULT '',
  actorId TEXT,
  createdAt TEXT NOT NULL
);

CREATE TABLE online_payment_events (
  id TEXT PRIMARY KEY NOT NULL,
  provider TEXT NOT NULL,
  providerEventId TEXT NOT NULL UNIQUE,
  orderId TEXT NOT NULL REFERENCES online_orders(id),
  status TEXT NOT NULL,
  amount INTEGER NOT NULL,
  payload TEXT NOT NULL DEFAULT '',
  createdAt TEXT NOT NULL
);

ALTER TABLE sales ADD COLUMN channel TEXT NOT NULL DEFAULT 'pos';
ALTER TABLE sales ADD COLUMN onlineOrderId TEXT REFERENCES online_orders(id);
CREATE UNIQUE INDEX idx_sales_online_order ON sales(onlineOrderId) WHERE onlineOrderId IS NOT NULL;
CREATE INDEX idx_online_profiles_published_sort ON online_product_profiles(published,sortOrder);
CREATE INDEX idx_customer_sessions_token ON customer_sessions(tokenHash,expiresAt);
CREATE INDEX idx_online_orders_customer_date ON online_orders(customerId,createdAt DESC);
CREATE INDEX idx_online_orders_status_date ON online_orders(status,createdAt DESC);
CREATE INDEX idx_online_items_order ON online_order_items(orderId);
CREATE INDEX idx_stock_reservations_variant ON stock_reservations(variantId,status,expiresAt);
CREATE INDEX idx_online_events_order ON online_order_events(orderId,createdAt);

CREATE TRIGGER online_reservation_guard
BEFORE INSERT ON stock_reservations
BEGIN
  SELECT CASE WHEN (
    SELECT stock-COALESCE((
      SELECT SUM(quantity) FROM stock_reservations
       WHERE variantId=NEW.variantId AND status='active' AND julianday(expiresAt)>julianday('now')
    ),0) FROM variants WHERE id=NEW.variantId
  )<NEW.quantity THEN RAISE(ABORT,'online_stock_unavailable') END;
END;

CREATE TRIGGER online_order_paid_once
BEFORE UPDATE OF paymentStatus ON online_orders
WHEN OLD.paymentStatus='paid' AND NEW.paymentStatus<>'paid'
BEGIN
  SELECT RAISE(ABORT,'paid_order_is_final');
END;
