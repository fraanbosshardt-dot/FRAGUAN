CREATE TABLE `customer_cashback` (
  `id` text PRIMARY KEY NOT NULL,
  `customerId` text NOT NULL,
  `saleId` text NOT NULL,
  `amount` integer NOT NULL,
  `balance` integer NOT NULL,
  `status` text DEFAULT 'active' NOT NULL,
  `expiresAt` text,
  `createdAt` text NOT NULL,
  FOREIGN KEY (`customerId`) REFERENCES `customers`(`id`),
  FOREIGN KEY (`saleId`) REFERENCES `sales`(`id`),
  CHECK (`amount` > 0),
  CHECK (`balance` >= 0 AND `balance` <= `amount`)
);
--> statement-breakpoint
CREATE INDEX `customer_cashback_customer_status`
  ON `customer_cashback` (`customerId`,`status`);
--> statement-breakpoint
CREATE TABLE `cashback_usages` (
  `id` text PRIMARY KEY NOT NULL,
  `cashbackId` text NOT NULL,
  `saleId` text NOT NULL,
  `amount` integer NOT NULL,
  `createdAt` text NOT NULL,
  FOREIGN KEY (`cashbackId`) REFERENCES `customer_cashback`(`id`),
  FOREIGN KEY (`saleId`) REFERENCES `sales`(`id`),
  CHECK (`amount` > 0)
);
--> statement-breakpoint
CREATE TRIGGER `cashback_usage_guard` BEFORE INSERT ON cashback_usages BEGIN
  SELECT CASE WHEN NEW.amount > (SELECT balance FROM customer_cashback WHERE id=NEW.cashbackId AND status='active') THEN RAISE(ABORT,'insufficient_cashback') END;
END;
--> statement-breakpoint
CREATE TRIGGER `cashback_usage_apply` AFTER INSERT ON cashback_usages BEGIN
  UPDATE customer_cashback
  SET balance=balance-NEW.amount,
      status=CASE WHEN balance-NEW.amount=0 THEN 'used' ELSE 'active' END
  WHERE id=NEW.cashbackId;
END;
--> statement-breakpoint
INSERT OR IGNORE INTO `payment_methods`
  (`id`,`name`,`surchargeBps`,`commissionBps`,`days`,`installments`,`active`)
VALUES ('cashback','Cashback FRAGUAN',0,0,0,1,1);
