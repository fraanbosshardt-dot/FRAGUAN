ALTER TABLE promotions ADD COLUMN ruleJson text NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE sales ADD COLUMN couponCode text NOT NULL DEFAULT '';
--> statement-breakpoint
CREATE TABLE sale_discounts (
  id text PRIMARY KEY NOT NULL,
  saleId text NOT NULL,
  promotionId text NOT NULL,
  name text NOT NULL,
  kind text NOT NULL,
  amount integer NOT NULL,
  createdAt text NOT NULL,
  FOREIGN KEY (saleId) REFERENCES sales(id),
  FOREIGN KEY (promotionId) REFERENCES promotions(id),
  CONSTRAINT sale_discount_positive CHECK(amount > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX sale_discount_once ON sale_discounts(saleId, promotionId);
--> statement-breakpoint
CREATE INDEX sale_discounts_promotion ON sale_discounts(promotionId, createdAt);
