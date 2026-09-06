ALTER TABLE checks ADD COLUMN payableId text REFERENCES payables(id);
--> statement-breakpoint
CREATE UNIQUE INDEX check_payable_once ON checks(payableId) WHERE payableId IS NOT NULL AND status NOT IN ('cancelled','rejected');
--> statement-breakpoint
CREATE TRIGGER check_payable_guard BEFORE INSERT ON checks WHEN NEW.payableId IS NOT NULL BEGIN
  SELECT CASE WHEN NEW.direction<>'issued' OR NOT EXISTS(SELECT 1 FROM payables WHERE id=NEW.payableId AND status='pending' AND amount=NEW.amount) THEN RAISE(ABORT,'invalid_check_payable') END;
END;
--> statement-breakpoint
CREATE TRIGGER payable_check_guard BEFORE UPDATE OF status ON payables WHEN NEW.status='paid' BEGIN
  SELECT CASE WHEN OLD.status='paid' THEN RAISE(ABORT,'already_paid') END;
  SELECT CASE WHEN EXISTS(SELECT 1 FROM checks WHERE payableId=NEW.id AND status IN ('issued','deposited')) THEN RAISE(ABORT,'settle_check_first') END;
END;
