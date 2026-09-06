CREATE TABLE bank_accounts (
  id text PRIMARY KEY NOT NULL,
  name text NOT NULL,
  bank text NOT NULL,
  alias text NOT NULL DEFAULT '',
  opening integer NOT NULL DEFAULT 0,
  active integer NOT NULL DEFAULT 1,
  createdAt text NOT NULL
);
--> statement-breakpoint
CREATE TABLE bank_entries (
  id text PRIMARY KEY NOT NULL,
  accountId text NOT NULL REFERENCES bank_accounts(id),
  amount integer NOT NULL CHECK(amount<>0),
  description text NOT NULL,
  reference text NOT NULL UNIQUE,
  occurredAt text NOT NULL,
  reconciledAt text,
  statementReference text,
  actorId text NOT NULL REFERENCES users(id),
  createdAt text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX bank_statement_unique ON bank_entries(accountId,statementReference) WHERE statementReference IS NOT NULL;
--> statement-breakpoint
CREATE TABLE checks (
  id text PRIMARY KEY NOT NULL,
  number text NOT NULL,
  bank text NOT NULL,
  type text NOT NULL CHECK(type IN ('paper','echeq')),
  direction text NOT NULL CHECK(direction IN ('issued','received')),
  party text NOT NULL,
  amount integer NOT NULL CHECK(amount>0),
  issuedAt text NOT NULL,
  dueAt text NOT NULL,
  accountId text NOT NULL REFERENCES bank_accounts(id),
  status text NOT NULL CHECK(status IN ('issued','received','deposited','cleared','rejected','cancelled')),
  version integer NOT NULL DEFAULT 0,
  createdAt text NOT NULL,
  UNIQUE(bank,number,direction)
);
--> statement-breakpoint
CREATE TABLE check_events (
  id text PRIMARY KEY NOT NULL,
  checkId text NOT NULL REFERENCES checks(id),
  fromStatus text NOT NULL,
  toStatus text NOT NULL,
  version integer NOT NULL,
  reason text NOT NULL,
  actorId text NOT NULL REFERENCES users(id),
  createdAt text NOT NULL,
  UNIQUE(checkId,version)
);
--> statement-breakpoint
CREATE TRIGGER check_transition_guard BEFORE INSERT ON check_events BEGIN
  SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM checks WHERE id=NEW.checkId AND status=NEW.fromStatus AND version=NEW.version) THEN RAISE(ABORT,'check_changed') END;
END;
--> statement-breakpoint
CREATE TABLE club_rewards (
  id text PRIMARY KEY NOT NULL,
  name text NOT NULL,
  description text NOT NULL,
  points integer NOT NULL CHECK(points>0),
  active integer NOT NULL DEFAULT 1,
  createdAt text NOT NULL
);
--> statement-breakpoint
CREATE TABLE club_redemptions (
  id text PRIMARY KEY NOT NULL,
  customerId text NOT NULL REFERENCES customers(id),
  rewardId text NOT NULL REFERENCES club_rewards(id),
  points integer NOT NULL CHECK(points>0),
  rewardName text NOT NULL,
  status text NOT NULL DEFAULT 'reserved' CHECK(status IN ('reserved','delivered','cancelled')),
  idempotencyKey text NOT NULL UNIQUE,
  actorId text NOT NULL REFERENCES users(id),
  createdAt text NOT NULL
);
--> statement-breakpoint
CREATE TRIGGER redemption_guard BEFORE INSERT ON club_redemptions BEGIN
  SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM customers WHERE id=NEW.customerId AND active=1 AND points>=NEW.points) THEN RAISE(ABORT,'insufficient_points') END;
  SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM club_rewards WHERE id=NEW.rewardId AND active=1 AND points=NEW.points) THEN RAISE(ABORT,'reward_changed') END;
END;
--> statement-breakpoint
CREATE TRIGGER redemption_apply AFTER INSERT ON club_redemptions BEGIN
  UPDATE customers SET points=points-NEW.points WHERE id=NEW.customerId;
END;
--> statement-breakpoint
CREATE TRIGGER redemption_cancel AFTER UPDATE OF status ON club_redemptions WHEN NEW.status='cancelled' AND OLD.status='reserved' BEGIN
  UPDATE customers SET points=points+NEW.points WHERE id=NEW.customerId;
END;
