CREATE UNIQUE INDEX payables_reference_unique ON payables(reference) WHERE reference<>'';
--> statement-breakpoint
CREATE TABLE recurring_expenses (
  id text PRIMARY KEY NOT NULL,
  description text NOT NULL,
  category text NOT NULL,
  amount integer NOT NULL,
  frequency text NOT NULL,
  interval integer NOT NULL DEFAULT 1,
  startsOn text NOT NULL,
  endsOn text,
  supplierId text,
  methodId text,
  active integer NOT NULL DEFAULT 1,
  createdBy text NOT NULL,
  createdAt text NOT NULL,
  updatedAt text NOT NULL,
  FOREIGN KEY (supplierId) REFERENCES suppliers(id),
  FOREIGN KEY (createdBy) REFERENCES users(id),
  CONSTRAINT recurring_amount_positive CHECK(amount>0),
  CONSTRAINT recurring_frequency CHECK(frequency IN ('weekly','monthly')),
  CONSTRAINT recurring_interval_positive CHECK(interval>0)
);
--> statement-breakpoint
CREATE TABLE financial_obligations (
  id text PRIMARY KEY NOT NULL,
  description text NOT NULL,
  supplierId text,
  total integer NOT NULL,
  installmentCount integer NOT NULL,
  firstDueOn text NOT NULL,
  intervalMonths integer NOT NULL DEFAULT 1,
  kind text NOT NULL DEFAULT 'Cuota',
  status text NOT NULL DEFAULT 'active',
  createdBy text NOT NULL,
  createdAt text NOT NULL,
  FOREIGN KEY (supplierId) REFERENCES suppliers(id),
  FOREIGN KEY (createdBy) REFERENCES users(id),
  CONSTRAINT obligation_total_positive CHECK(total>0),
  CONSTRAINT obligation_installments_positive CHECK(installmentCount>0),
  CONSTRAINT obligation_interval_positive CHECK(intervalMonths>0)
);
--> statement-breakpoint
CREATE TABLE obligation_installments (
  id text PRIMARY KEY NOT NULL,
  obligationId text NOT NULL,
  number integer NOT NULL,
  amount integer NOT NULL,
  dueOn text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  payableId text NOT NULL,
  paidAt text,
  FOREIGN KEY (obligationId) REFERENCES financial_obligations(id),
  FOREIGN KEY (payableId) REFERENCES payables(id),
  CONSTRAINT installment_amount_positive CHECK(amount>0),
  UNIQUE(obligationId,number),
  UNIQUE(payableId)
);
--> statement-breakpoint
CREATE TRIGGER obligation_installment_paid AFTER UPDATE OF status ON payables
WHEN NEW.status='paid' AND OLD.status<>'paid'
BEGIN
  UPDATE obligation_installments SET status='paid',paidAt=datetime('now') WHERE payableId=NEW.id;
  UPDATE financial_obligations SET status='paid'
   WHERE id IN (SELECT obligationId FROM obligation_installments WHERE payableId=NEW.id)
     AND NOT EXISTS (
       SELECT 1 FROM obligation_installments oi
       WHERE oi.obligationId=financial_obligations.id AND oi.status<>'paid'
     );
END;
