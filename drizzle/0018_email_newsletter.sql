CREATE TABLE newsletter_subscribers (
  id TEXT PRIMARY KEY NOT NULL,
  email TEXT NOT NULL COLLATE NOCASE UNIQUE,
  name TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','unsubscribed')),
  source TEXT NOT NULL DEFAULT 'storefront',
  unsubscribeToken TEXT NOT NULL UNIQUE,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  unsubscribedAt TEXT
);

CREATE TABLE newsletter_campaigns (
  id TEXT PRIMARY KEY NOT NULL,
  subject TEXT NOT NULL,
  preheader TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL,
  ctaLabel TEXT NOT NULL DEFAULT '',
  ctaUrl TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft',
  recipientCount INTEGER NOT NULL DEFAULT 0,
  sentCount INTEGER NOT NULL DEFAULT 0,
  failedCount INTEGER NOT NULL DEFAULT 0,
  createdBy TEXT NOT NULL REFERENCES users(id),
  createdAt TEXT NOT NULL,
  sentAt TEXT
);

CREATE TABLE email_deliveries (
  id TEXT PRIMARY KEY NOT NULL,
  kind TEXT NOT NULL,
  recipient TEXT NOT NULL,
  orderId TEXT REFERENCES online_orders(id),
  campaignId TEXT REFERENCES newsletter_campaigns(id),
  providerId TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL,
  error TEXT NOT NULL DEFAULT '',
  createdAt TEXT NOT NULL
);

CREATE INDEX idx_newsletter_status ON newsletter_subscribers(status,createdAt DESC);
CREATE INDEX idx_email_deliveries_order ON email_deliveries(orderId,createdAt);
CREATE INDEX idx_email_deliveries_campaign ON email_deliveries(campaignId,createdAt);
