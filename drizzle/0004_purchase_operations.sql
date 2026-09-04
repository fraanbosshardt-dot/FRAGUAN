ALTER TABLE `purchases` ADD `subtotal` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `purchases` ADD `discount` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `purchases` ADD `tax` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `purchases` ADD `shipping` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `purchases` ADD `paymentMethod` text DEFAULT 'cuenta_corriente' NOT NULL;
--> statement-breakpoint
ALTER TABLE `purchases` ADD `supplierReference` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `purchases` ADD `notes` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `purchases` ADD `idempotencyKey` text;
--> statement-breakpoint
ALTER TABLE `purchases` ADD `requestHash` text;
--> statement-breakpoint
ALTER TABLE `purchases` ADD `updatedAt` text;
--> statement-breakpoint
ALTER TABLE `purchases` ADD `sentAt` text;
--> statement-breakpoint
ALTER TABLE `purchases` ADD `confirmedAt` text;
--> statement-breakpoint
ALTER TABLE `purchases` ADD `receivedAt` text;
--> statement-breakpoint
UPDATE `purchases` SET `subtotal`=`total`,`updatedAt`=`createdAt` WHERE `updatedAt` IS NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX `purchases_idempotency_unique` ON `purchases` (`idempotencyKey`) WHERE `idempotencyKey` IS NOT NULL;
--> statement-breakpoint
ALTER TABLE `purchase_items` ADD `discount` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `payables` ADD `purchaseId` text;
--> statement-breakpoint
UPDATE `payables` SET `purchaseId`=`reference`
WHERE `id` IN (
  SELECT MIN(pa.`id`)
  FROM `payables` pa
  INNER JOIN `purchases` po ON po.`id`=pa.`reference`
  WHERE pa.`kind`='Proveedor' AND pa.`reference`<>''
  GROUP BY pa.`reference`
);
--> statement-breakpoint
CREATE UNIQUE INDEX `payables_purchase_unique` ON `payables` (`purchaseId`) WHERE `purchaseId` IS NOT NULL;
--> statement-breakpoint
CREATE TABLE `purchase_receipts` (
  `id` text PRIMARY KEY NOT NULL,
  `purchaseId` text NOT NULL,
  `actorId` text NOT NULL,
  `subtotal` integer NOT NULL,
  `notes` text DEFAULT '' NOT NULL,
  `idempotencyKey` text NOT NULL,
  `requestHash` text NOT NULL,
  `createdAt` text NOT NULL,
  FOREIGN KEY (`purchaseId`) REFERENCES `purchases`(`id`),
  FOREIGN KEY (`actorId`) REFERENCES `users`(`id`),
  CHECK (`subtotal` > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `purchase_receipts_idempotency_unique` ON `purchase_receipts` (`idempotencyKey`);
--> statement-breakpoint
CREATE INDEX `purchase_receipts_purchase_date` ON `purchase_receipts` (`purchaseId`,`createdAt`);
--> statement-breakpoint
CREATE TABLE `purchase_receipt_items` (
  `id` text PRIMARY KEY NOT NULL,
  `receiptId` text NOT NULL,
  `purchaseItemId` text NOT NULL,
  `variantId` text NOT NULL,
  `quantity` integer NOT NULL,
  `unitCost` integer NOT NULL,
  `beforeStock` integer NOT NULL,
  `afterStock` integer NOT NULL,
  FOREIGN KEY (`receiptId`) REFERENCES `purchase_receipts`(`id`),
  FOREIGN KEY (`purchaseItemId`) REFERENCES `purchase_items`(`id`),
  FOREIGN KEY (`variantId`) REFERENCES `variants`(`id`),
  CHECK (`quantity` > 0),
  CHECK (`unitCost` >= 0),
  CHECK (`beforeStock` >= 0),
  CHECK (`afterStock` = `beforeStock` + `quantity`)
);
--> statement-breakpoint
CREATE INDEX `purchase_receipt_items_receipt` ON `purchase_receipt_items` (`receiptId`);
--> statement-breakpoint
CREATE INDEX `purchase_receipt_items_order_line` ON `purchase_receipt_items` (`purchaseItemId`);
--> statement-breakpoint
DROP TRIGGER IF EXISTS `purchase_received_once`;
--> statement-breakpoint
CREATE TRIGGER `purchase_financial_insert_guard` BEFORE INSERT ON `purchases`
WHEN NEW.`idempotencyKey` IS NOT NULL
BEGIN
  SELECT CASE WHEN
    NEW.`subtotal` < 0 OR NEW.`discount` < 0 OR NEW.`discount` > NEW.`subtotal` OR
    NEW.`tax` < 0 OR NEW.`shipping` < 0 OR NEW.`total` <= 0 OR
    NEW.`total` != NEW.`subtotal` - NEW.`discount` + NEW.`tax` + NEW.`shipping`
  THEN RAISE(ABORT,'invalid_purchase_totals') END;
  SELECT CASE WHEN NEW.`status` NOT IN ('draft','sent','confirmed','partially_received','received')
  THEN RAISE(ABORT,'invalid_purchase_status') END;
END;
--> statement-breakpoint
CREATE TRIGGER `purchase_financial_update_guard` BEFORE UPDATE OF `subtotal`,`discount`,`tax`,`shipping`,`total` ON `purchases`
WHEN NEW.`idempotencyKey` IS NOT NULL
BEGIN
  SELECT CASE WHEN
    NEW.`subtotal` < 0 OR NEW.`discount` < 0 OR NEW.`discount` > NEW.`subtotal` OR
    NEW.`tax` < 0 OR NEW.`shipping` < 0 OR NEW.`total` <= 0 OR
    NEW.`total` != NEW.`subtotal` - NEW.`discount` + NEW.`tax` + NEW.`shipping`
  THEN RAISE(ABORT,'invalid_purchase_totals') END;
END;
--> statement-breakpoint
CREATE TRIGGER `purchase_item_discount_guard` BEFORE INSERT ON `purchase_items`
WHEN (SELECT `idempotencyKey` FROM `purchases` WHERE `id`=NEW.`purchaseId`) IS NOT NULL
BEGIN
  SELECT CASE WHEN NEW.`quantity` <= 0 OR NEW.`cost` < 0 OR NEW.`discount` < 0 OR NEW.`discount` > NEW.`quantity` * NEW.`cost`
  THEN RAISE(ABORT,'invalid_purchase_item') END;
END;
--> statement-breakpoint
CREATE TRIGGER `purchase_status_transition_guard` BEFORE UPDATE OF `status` ON `purchases`
WHEN OLD.`status` <> NEW.`status` AND NOT (
  (OLD.`status`='draft' AND NEW.`status` IN ('sent','received')) OR
  (OLD.`status`='sent' AND NEW.`status` IN ('draft','confirmed')) OR
  (OLD.`status`='confirmed' AND NEW.`status` IN ('partially_received','received')) OR
  (OLD.`status`='partially_received' AND NEW.`status`='received')
)
BEGIN
  SELECT RAISE(ABORT,'invalid_purchase_status_transition');
END;
--> statement-breakpoint
CREATE TRIGGER `purchase_receipt_guard` BEFORE INSERT ON `purchase_receipts`
BEGIN
  SELECT CASE WHEN (SELECT `status` FROM `purchases` WHERE `id`=NEW.`purchaseId`) NOT IN ('confirmed','partially_received')
  THEN RAISE(ABORT,'purchase_not_receivable') END;
END;
--> statement-breakpoint
CREATE TRIGGER `purchase_receipt_item_guard` BEFORE INSERT ON `purchase_receipt_items`
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1
    FROM `purchase_items` pi
    INNER JOIN `purchase_receipts` pr ON pr.`purchaseId`=pi.`purchaseId`
    WHERE pr.`id`=NEW.`receiptId` AND pi.`id`=NEW.`purchaseItemId`
      AND pi.`variantId`=NEW.`variantId` AND pi.`cost`=NEW.`unitCost`
  ) THEN RAISE(ABORT,'invalid_purchase_receipt_item') END;
  SELECT CASE WHEN NEW.`quantity` > (
    SELECT pi.`quantity` - pi.`received` FROM `purchase_items` pi WHERE pi.`id`=NEW.`purchaseItemId`
  ) THEN RAISE(ABORT,'purchase_over_receipt') END;
  SELECT CASE WHEN NEW.`beforeStock` != (SELECT `stock` FROM `variants` WHERE `id`=NEW.`variantId`)
    OR NEW.`afterStock` != NEW.`beforeStock` + NEW.`quantity`
  THEN RAISE(ABORT,'stock_conflict') END;
END;
--> statement-breakpoint
CREATE TRIGGER `purchase_receipt_item_apply` AFTER INSERT ON `purchase_receipt_items`
BEGIN
  UPDATE `purchase_items`
  SET `received`=`received`+NEW.`quantity`
  WHERE `id`=NEW.`purchaseItemId`;

  UPDATE `purchases`
  SET
    `status`=CASE WHEN NOT EXISTS (
      SELECT 1 FROM `purchase_items`
      WHERE `purchaseId`=`purchases`.`id` AND `received` < `quantity`
    ) THEN 'received' ELSE 'partially_received' END,
    `updatedAt`=(SELECT `createdAt` FROM `purchase_receipts` WHERE `id`=NEW.`receiptId`),
    `receivedAt`=CASE WHEN NOT EXISTS (
      SELECT 1 FROM `purchase_items`
      WHERE `purchaseId`=`purchases`.`id` AND `received` < `quantity`
    ) THEN (SELECT `createdAt` FROM `purchase_receipts` WHERE `id`=NEW.`receiptId`) ELSE NULL END
  WHERE `id`=(SELECT `purchaseId` FROM `purchase_receipts` WHERE `id`=NEW.`receiptId`);
END;
