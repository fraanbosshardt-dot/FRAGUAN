CREATE TRIGGER inventory_items_frozen_update
BEFORE UPDATE ON inventory_count_items
WHEN (SELECT status FROM inventory_counts WHERE id=OLD.countId) <> 'draft'
  OR (SELECT status FROM inventory_counts WHERE id=NEW.countId) <> 'draft'
BEGIN SELECT RAISE(ABORT,'inventory_already_approved'); END;

CREATE TRIGGER inventory_items_frozen_delete
BEFORE DELETE ON inventory_count_items
WHEN (SELECT status FROM inventory_counts WHERE id=OLD.countId) <> 'draft'
BEGIN SELECT RAISE(ABORT,'inventory_already_approved'); END;

CREATE TRIGGER inventory_items_frozen_insert
BEFORE INSERT ON inventory_count_items
WHEN (SELECT status FROM inventory_counts WHERE id=NEW.countId) <> 'draft'
BEGIN SELECT RAISE(ABORT,'inventory_already_approved'); END;
