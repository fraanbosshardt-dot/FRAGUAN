ALTER TABLE `customer_cashback`
  ADD COLUMN `refundId` text REFERENCES `refunds`(`id`);
--> statement-breakpoint
CREATE INDEX `customer_cashback_refund` ON `customer_cashback` (`refundId`);
