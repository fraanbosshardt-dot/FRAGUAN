CREATE TABLE `credit_usages` (
  `id` text PRIMARY KEY NOT NULL,
  `creditId` text NOT NULL,
  `saleId` text NOT NULL,
  `amount` integer NOT NULL,
  `createdAt` text NOT NULL,
  FOREIGN KEY (`creditId`) REFERENCES `customer_credits`(`id`),
  FOREIGN KEY (`saleId`) REFERENCES `sales`(`id`),
  CHECK (`amount` > 0)
);
--> statement-breakpoint
CREATE TRIGGER `credit_usage_guard` BEFORE INSERT ON `credit_usages` BEGIN
 SELECT CASE WHEN NEW.amount > (SELECT balance FROM customer_credits WHERE id=NEW.creditId AND status='active') THEN RAISE(ABORT,'insufficient_credit') END;
END;
--> statement-breakpoint
CREATE TRIGGER `credit_usage_apply` AFTER INSERT ON `credit_usages` BEGIN
 UPDATE customer_credits SET balance=balance-NEW.amount,status=CASE WHEN balance-NEW.amount=0 THEN 'used' ELSE 'active' END WHERE id=NEW.creditId;
END;
--> statement-breakpoint
CREATE TRIGGER `refund_item_guard` BEFORE INSERT ON `refund_items` BEGIN
 SELECT CASE WHEN NEW.quantity > (SELECT quantity-refunded FROM sale_items WHERE id=NEW.saleItemId) THEN RAISE(ABORT,'already_refunded') END;
END;
--> statement-breakpoint
INSERT OR IGNORE INTO `payment_methods` (`id`,`name`,`surchargeBps`,`commissionBps`,`days`,`installments`,`active`) VALUES ('store_credit','Saldo a favor',0,0,0,1,1);
