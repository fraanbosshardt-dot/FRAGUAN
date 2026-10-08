CREATE TABLE order_email_outbox (
 id TEXT PRIMARY KEY, "dedupKey" TEXT NOT NULL UNIQUE, "orderId" TEXT NOT NULL REFERENCES online_orders(id),
 recipient TEXT NOT NULL, subject TEXT NOT NULL, html TEXT NOT NULL, kind TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'pending', attempts INTEGER NOT NULL DEFAULT 0,
 "providerId" TEXT NOT NULL DEFAULT '', error TEXT NOT NULL DEFAULT '',
 "nextAttemptAt" TEXT NOT NULL, "lockedUntil" TEXT, "firstAttemptAt" TEXT,
 "createdAt" TEXT NOT NULL, "updatedAt" TEXT NOT NULL
);
CREATE INDEX order_email_due ON order_email_outbox(status,"nextAttemptAt");
CREATE TABLE resend_webhook_events (id TEXT PRIMARY KEY, "providerId" TEXT NOT NULL, type TEXT NOT NULL, "occurredAt" TEXT NOT NULL, "receivedAt" TEXT NOT NULL);
CREATE INDEX resend_event_provider ON resend_webhook_events("providerId");
CREATE TABLE store_price_campaigns (
 id TEXT PRIMARY KEY, name TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'scheduled',
 "startsAt" TEXT NOT NULL, "endsAt" TEXT NOT NULL, "createdBy" TEXT NOT NULL REFERENCES users(id),
 "createdAt" TEXT NOT NULL, "updatedAt" TEXT NOT NULL, error TEXT NOT NULL DEFAULT ''
);
CREATE TABLE store_price_campaign_items (
 id TEXT PRIMARY KEY, "campaignId" TEXT NOT NULL REFERENCES store_price_campaigns(id),
 "variantId" TEXT NOT NULL REFERENCES variants(id), "originalOnlinePrice" INTEGER,
 "originalPrice" INTEGER NOT NULL, "referencePrice" INTEGER NOT NULL, "campaignPrice" INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'scheduled', "appliedAt" TEXT,
 UNIQUE("campaignId","variantId")
);
CREATE INDEX price_campaign_variant ON store_price_campaign_items("variantId",status);

CREATE TABLE product_images (id TEXT PRIMARY KEY, "productId" TEXT NOT NULL REFERENCES products(id), mime TEXT NOT NULL, "contentBase64" TEXT NOT NULL, alt TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1, "createdBy" TEXT NOT NULL REFERENCES users(id), "createdAt" TEXT NOT NULL);
CREATE UNIQUE INDEX product_primary_image ON product_images("productId") WHERE active=1;
