ALTER TABLE products ADD COLUMN internalCode text NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE products ADD COLUMN subcategory text NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE products ADD COLUMN collection text NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE products ADD COLUMN location text NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE products ADD COLUMN updatedAt text;
--> statement-breakpoint
ALTER TABLE products ADD COLUMN archivedAt text;
--> statement-breakpoint
CREATE UNIQUE INDEX products_internal_code_unique ON products(internalCode) WHERE internalCode<>'';
--> statement-breakpoint
ALTER TABLE products DROP COLUMN image;
--> statement-breakpoint
ALTER TABLE variants ADD COLUMN ideal integer NOT NULL DEFAULT 6;
--> statement-breakpoint
ALTER TABLE variants ADD COLUMN entryAt text NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE variants ADD COLUMN updatedAt text;
--> statement-breakpoint
ALTER TABLE customers ADD COLUMN whatsapp text NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE customers ADD COLUMN locality text NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE customers ADD COLUMN usualSizes text NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE customers ADD COLUMN notes text NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE customers ADD COLUMN active integer NOT NULL DEFAULT 1;
--> statement-breakpoint
ALTER TABLE customers ADD COLUMN updatedAt text;
--> statement-breakpoint
ALTER TABLE customers ADD COLUMN archivedAt text;
--> statement-breakpoint
ALTER TABLE suppliers ADD COLUMN company text NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE suppliers ADD COLUMN contact text NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE suppliers ADD COLUMN whatsapp text NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE suppliers ADD COLUMN brands text NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE suppliers ADD COLUMN discountBps integer NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE suppliers ADD COLUMN paymentDays integer NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE suppliers ADD COLUMN notes text NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE suppliers ADD COLUMN updatedAt text;
--> statement-breakpoint
ALTER TABLE suppliers ADD COLUMN archivedAt text;
