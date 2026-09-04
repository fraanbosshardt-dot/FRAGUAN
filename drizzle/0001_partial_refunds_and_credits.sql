DROP INDEX IF EXISTS `one_full_refund`;
--> statement-breakpoint
ALTER TABLE `refunds` ADD `method` text DEFAULT 'original' NOT NULL;
--> statement-breakpoint
ALTER TABLE `refunds` ADD `creditIssued` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `refunds` ADD `authorizationId` text;
--> statement-breakpoint
CREATE UNIQUE INDEX `refund_authorization_once` ON `refunds` (`authorizationId`);
--> statement-breakpoint
CREATE TABLE `refund_items` (
  `id` text PRIMARY KEY NOT NULL,
  `refundId` text NOT NULL,
  `saleItemId` text NOT NULL,
  `variantId` text NOT NULL,
  `quantity` integer NOT NULL,
  `amount` integer NOT NULL,
  FOREIGN KEY (`refundId`) REFERENCES `refunds`(`id`),
  FOREIGN KEY (`saleItemId`) REFERENCES `sale_items`(`id`),
  FOREIGN KEY (`variantId`) REFERENCES `variants`(`id`),
  CHECK (`quantity` > 0),
  CHECK (`amount` >= 0)
);
--> statement-breakpoint
CREATE TABLE `customer_credits` (
  `id` text PRIMARY KEY NOT NULL,
  `customerId` text NOT NULL,
  `originalSaleId` text NOT NULL,
  `refundId` text NOT NULL,
  `amount` integer NOT NULL,
  `balance` integer NOT NULL,
  `status` text DEFAULT 'active' NOT NULL,
  `expiresAt` text,
  `createdAt` text NOT NULL,
  FOREIGN KEY (`customerId`) REFERENCES `customers`(`id`),
  FOREIGN KEY (`originalSaleId`) REFERENCES `sales`(`id`),
  FOREIGN KEY (`refundId`) REFERENCES `refunds`(`id`),
  CHECK (`amount` > 0),
  CHECK (`balance` >= 0 AND `balance` <= `amount`)
);
--> statement-breakpoint
CREATE INDEX `customer_credits_customer_status` ON `customer_credits` (`customerId`,`status`);
--> statement-breakpoint
CREATE TABLE `manager_authorizations` (
  `id` text PRIMARY KEY NOT NULL,
  `tokenHash` text NOT NULL UNIQUE,
  `action` text NOT NULL,
  `saleId` text NOT NULL,
  `maxAmount` integer NOT NULL,
  `authorizedBy` text NOT NULL,
  `expiresAt` text NOT NULL,
  `usedAt` text,
  `createdAt` text NOT NULL,
  FOREIGN KEY (`saleId`) REFERENCES `sales`(`id`),
  FOREIGN KEY (`authorizedBy`) REFERENCES `users`(`id`)
);
