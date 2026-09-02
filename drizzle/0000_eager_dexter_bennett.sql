CREATE TABLE `audit_log` (
	`id` text PRIMARY KEY NOT NULL,
	`actorId` text NOT NULL,
	`action` text NOT NULL,
	`entityId` text NOT NULL,
	`before` text,
	`after` text,
	`createdAt` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `brands` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `brands_name_unique` ON `brands` (`name`);--> statement-breakpoint
CREATE TABLE `cash_movements` (
	`id` text PRIMARY KEY NOT NULL,
	`sessionId` text,
	`kind` text NOT NULL,
	`amount` integer NOT NULL,
	`methodId` text NOT NULL,
	`reference` text NOT NULL,
	`actorId` text NOT NULL,
	`createdAt` text NOT NULL,
	FOREIGN KEY (`sessionId`) REFERENCES `cash_sessions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `cash_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`openedBy` text NOT NULL,
	`opening` integer NOT NULL,
	`openedAt` text NOT NULL,
	`closedAt` text,
	`counted` integer,
	`expected` integer,
	`difference` integer
);
--> statement-breakpoint
CREATE TABLE `categories` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `categories_name_unique` ON `categories` (`name`);--> statement-breakpoint
CREATE TABLE `customers` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`surname` text NOT NULL,
	`phone` text NOT NULL,
	`email` text DEFAULT '' NOT NULL,
	`birthday` text,
	`points` integer DEFAULT 0 NOT NULL,
	`createdAt` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `customer_phone` ON `customers` (`phone`);--> statement-breakpoint
CREATE TABLE `expenses` (
	`id` text PRIMARY KEY NOT NULL,
	`category` text NOT NULL,
	`description` text NOT NULL,
	`amount` integer NOT NULL,
	`date` text NOT NULL,
	`methodId` text NOT NULL,
	`actorId` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `inventory_count_items` (
	`id` text PRIMARY KEY NOT NULL,
	`countId` text NOT NULL,
	`variantId` text NOT NULL,
	`expected` integer NOT NULL,
	`counted` integer NOT NULL,
	FOREIGN KEY (`countId`) REFERENCES `inventory_counts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`variantId`) REFERENCES `variants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `inventory_counts` (
	`id` text PRIMARY KEY NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`actorId` text NOT NULL,
	`createdAt` text NOT NULL,
	`approvedAt` text
);
--> statement-breakpoint
CREATE TABLE `loyalty_transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`customerId` text NOT NULL,
	`points` integer NOT NULL,
	`reason` text NOT NULL,
	`reference` text NOT NULL,
	`createdAt` text NOT NULL,
	FOREIGN KEY (`customerId`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `payment_methods` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`surchargeBps` integer DEFAULT 0 NOT NULL,
	`commissionBps` integer DEFAULT 0 NOT NULL,
	`days` integer DEFAULT 0 NOT NULL,
	`installments` integer DEFAULT 1 NOT NULL,
	`active` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `payables` (
	`id` text PRIMARY KEY NOT NULL,
	`description` text NOT NULL,
	`supplierId` text,
	`amount` integer NOT NULL,
	`dueAt` text NOT NULL,
	`kind` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`reference` text DEFAULT '' NOT NULL,
	FOREIGN KEY (`supplierId`) REFERENCES `suppliers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `payments` (
	`id` text PRIMARY KEY NOT NULL,
	`saleId` text NOT NULL,
	`methodId` text NOT NULL,
	`amount` integer NOT NULL,
	`commission` integer NOT NULL,
	`net` integer NOT NULL,
	`dueAt` text NOT NULL,
	`reference` text DEFAULT '' NOT NULL,
	FOREIGN KEY (`saleId`) REFERENCES `sales`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`methodId`) REFERENCES `payment_methods`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `products` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`category` text NOT NULL,
	`brand` text DEFAULT 'FRAGUAN' NOT NULL,
	`season` text DEFAULT 'Esenciales 2026' NOT NULL,
	`image` text DEFAULT '' NOT NULL,
	`supplierId` text,
	`active` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`supplierId`) REFERENCES `suppliers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `promotions` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`percent` integer NOT NULL,
	`methodId` text,
	`startsAt` text NOT NULL,
	`endsAt` text NOT NULL,
	`active` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`methodId`) REFERENCES `payment_methods`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "promotion_percent" CHECK("promotions"."percent" BETWEEN 1 AND 90)
);
--> statement-breakpoint
CREATE TABLE `purchase_items` (
	`id` text PRIMARY KEY NOT NULL,
	`purchaseId` text NOT NULL,
	`variantId` text NOT NULL,
	`quantity` integer NOT NULL,
	`cost` integer NOT NULL,
	`received` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`purchaseId`) REFERENCES `purchases`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`variantId`) REFERENCES `variants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `purchases` (
	`id` text PRIMARY KEY NOT NULL,
	`supplierId` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`total` integer NOT NULL,
	`createdAt` text NOT NULL,
	`dueAt` text NOT NULL,
	`actorId` text NOT NULL,
	FOREIGN KEY (`supplierId`) REFERENCES `suppliers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `refunds` (
	`id` text PRIMARY KEY NOT NULL,
	`saleId` text NOT NULL,
	`amount` integer NOT NULL,
	`reason` text NOT NULL,
	`actorId` text NOT NULL,
	`createdAt` text NOT NULL,
	FOREIGN KEY (`saleId`) REFERENCES `sales`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `one_full_refund` ON `refunds` (`saleId`);--> statement-breakpoint
CREATE TABLE `sale_items` (
	`id` text PRIMARY KEY NOT NULL,
	`saleId` text NOT NULL,
	`variantId` text NOT NULL,
	`name` text NOT NULL,
	`color` text NOT NULL,
	`size` text NOT NULL,
	`quantity` integer NOT NULL,
	`price` integer NOT NULL,
	`cost` integer NOT NULL,
	`refunded` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`saleId`) REFERENCES `sales`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`variantId`) REFERENCES `variants`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "item_quantity" CHECK("sale_items"."quantity" > 0),
	CONSTRAINT "refund_quantity" CHECK("sale_items"."refunded" BETWEEN 0 AND "sale_items"."quantity")
);
--> statement-breakpoint
CREATE INDEX `sale_items_sale` ON `sale_items` (`saleId`);--> statement-breakpoint
CREATE TABLE `sales` (
	`id` text PRIMARY KEY NOT NULL,
	`ticket` integer NOT NULL,
	`sellerId` text NOT NULL,
	`customerId` text,
	`subtotal` integer NOT NULL,
	`discount` integer NOT NULL,
	`total` integer NOT NULL,
	`promotionId` text,
	`status` text DEFAULT 'confirmed' NOT NULL,
	`idempotencyKey` text NOT NULL,
	`requestHash` text NOT NULL,
	`createdAt` text NOT NULL,
	FOREIGN KEY (`sellerId`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`customerId`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`promotionId`) REFERENCES `promotions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sales_ticket_unique` ON `sales` (`ticket`);--> statement-breakpoint
CREATE UNIQUE INDEX `sales_idempotencyKey_unique` ON `sales` (`idempotencyKey`);--> statement-breakpoint
CREATE INDEX `sales_seller_date` ON `sales` (`sellerId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `sales_date` ON `sales` (`createdAt`);--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `stock_movements` (
	`id` text PRIMARY KEY NOT NULL,
	`variantId` text NOT NULL,
	`quantity` integer NOT NULL,
	`before` integer NOT NULL,
	`after` integer NOT NULL,
	`reason` text NOT NULL,
	`actorId` text NOT NULL,
	`reference` text DEFAULT '' NOT NULL,
	`createdAt` text NOT NULL,
	FOREIGN KEY (`variantId`) REFERENCES `variants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `movements_variant_date` ON `stock_movements` (`variantId`,`createdAt`);--> statement-breakpoint
CREATE TABLE `suppliers` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`phone` text DEFAULT '' NOT NULL,
	`email` text DEFAULT '' NOT NULL,
	`terms` text DEFAULT '' NOT NULL,
	`active` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`role` text NOT NULL,
	`active` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE TABLE `variants` (
	`id` text PRIMARY KEY NOT NULL,
	`productId` text NOT NULL,
	`sku` text NOT NULL,
	`barcode` text NOT NULL,
	`color` text NOT NULL,
	`size` text NOT NULL,
	`price` integer NOT NULL,
	`cost` integer NOT NULL,
	`stock` integer DEFAULT 0 NOT NULL,
	`minimum` integer DEFAULT 3 NOT NULL,
	FOREIGN KEY (`productId`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "stock_nonnegative" CHECK("variants"."stock" >= 0),
	CONSTRAINT "price_positive" CHECK("variants"."price" > 0),
	CONSTRAINT "cost_nonnegative" CHECK("variants"."cost" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `variants_sku_unique` ON `variants` (`sku`);--> statement-breakpoint
CREATE UNIQUE INDEX `variants_barcode_unique` ON `variants` (`barcode`);--> statement-breakpoint
CREATE UNIQUE INDEX `variant_combination` ON `variants` (`productId`,`color`,`size`);--> statement-breakpoint
CREATE TABLE `withdrawals` (
	`id` text PRIMARY KEY NOT NULL,
	`person` text NOT NULL,
	`amount` integer NOT NULL,
	`reason` text NOT NULL,
	`methodId` text NOT NULL,
	`actorId` text NOT NULL,
	`createdAt` text NOT NULL
);
--> statement-breakpoint
CREATE TRIGGER stock_movement_guard BEFORE INSERT ON stock_movements BEGIN
 SELECT CASE WHEN NEW.before != (SELECT stock FROM variants WHERE id=NEW.variantId) OR NEW.after != NEW.before+NEW.quantity OR NEW.after < 0 THEN RAISE(ABORT,'stock_conflict') END;
END;
--> statement-breakpoint
CREATE TRIGGER stock_movement_apply AFTER INSERT ON stock_movements BEGIN
 UPDATE variants SET stock=NEW.after WHERE id=NEW.variantId;
END;
--> statement-breakpoint
CREATE TRIGGER sale_item_guard BEFORE INSERT ON sale_items BEGIN
 SELECT CASE WHEN NEW.quantity > (SELECT stock FROM variants WHERE id=NEW.variantId) THEN RAISE(ABORT,'insufficient_stock') END;
 SELECT CASE WHEN NEW.price != (SELECT price FROM variants WHERE id=NEW.variantId) OR NEW.cost != (SELECT cost FROM variants WHERE id=NEW.variantId) THEN RAISE(ABORT,'price_changed') END;
END;
--> statement-breakpoint
CREATE TRIGGER sale_item_stock AFTER INSERT ON sale_items BEGIN
 INSERT INTO stock_movements (id,variantId,quantity,before,after,reason,actorId,reference,createdAt)
 SELECT NEW.id,NEW.variantId,-NEW.quantity,v.stock,v.stock-NEW.quantity,'Venta',s.sellerId,s.id,s.createdAt FROM variants v JOIN sales s ON s.id=NEW.saleId WHERE v.id=NEW.variantId;
END;
--> statement-breakpoint
CREATE UNIQUE INDEX one_open_cash_session ON cash_sessions ((1)) WHERE closedAt IS NULL;
--> statement-breakpoint
CREATE TRIGGER purchase_received_once BEFORE UPDATE OF status ON purchases WHEN OLD.status='received' BEGIN SELECT RAISE(ABORT,'already_received'); END;
--> statement-breakpoint
CREATE TRIGGER payable_paid_once BEFORE UPDATE OF status ON payables WHEN OLD.status='paid' BEGIN SELECT RAISE(ABORT,'already_paid'); END;
--> statement-breakpoint
CREATE TRIGGER count_approved_once BEFORE UPDATE OF status ON inventory_counts WHEN OLD.status='approved' BEGIN SELECT RAISE(ABORT,'already_approved'); END;
--> statement-breakpoint
CREATE TRIGGER cash_movement_open BEFORE INSERT ON cash_movements WHEN NEW.sessionId IS NOT NULL AND (SELECT closedAt FROM cash_sessions WHERE id=NEW.sessionId) IS NOT NULL BEGIN SELECT RAISE(ABORT,'cash_closed'); END;
