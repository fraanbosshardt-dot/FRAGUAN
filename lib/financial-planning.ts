import { z } from 'zod';
import {
  auditStatement,
  db,
  id,
  now,
  one,
  rows,
  statement,
} from '@/db/queries';
import { Actor, AppError, requirePermission } from './auth';
import { positiveMoney, text } from './validation';
import {
  buildInstallmentPlan,
  expandRecurrence,
  readFinancialCalendarFromD1,
  type RecurringExpenseDefinition,
} from './financial-calendar';

const recurringInput = z
  .object({
    description: text,
    category: text,
    amount: positiveMoney,
    frequency: z.enum(['weekly', 'monthly']),
    interval: z.number().int().min(1).max(120).default(1),
    startsOn: z.iso.date(),
    endsOn: z.iso.date().nullable().default(null),
    supplierId: text.nullable().default(null),
    methodId: text.nullable().default(null),
  })
  .strict();
const obligationInput = z
  .object({
    description: text,
    supplierId: text.nullable().default(null),
    total: positiveMoney,
    installmentCount: z.number().int().min(1).max(600),
    firstDueOn: z.iso.date(),
    intervalMonths: z.number().int().min(1).max(120).default(1),
    kind: z
      .enum([
        'Proveedor',
        'Transferencia',
        'Cheque',
        'eCheq',
        'Servicio',
        'Cuota',
      ])
      .default('Cuota'),
  })
  .strict();

function addDays(date: string, days: number) {
  const value = new Date(`${date}T12:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}
function businessToday() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
  }).format(new Date());
}
async function validateSupplier(supplierId: string | null) {
  if (
    supplierId &&
    !(await one('SELECT id FROM suppliers WHERE id=? AND active=1', supplierId))
  )
    throw new AppError(400, 'Proveedor inválido.');
}

export async function listFinancialPlans(actor: Actor) {
  requirePermission(actor, 'cash-flow');
  const [recurring, obligations] = await Promise.all([
    rows(
      `SELECT r.*,s.name AS supplier
         FROM recurring_expenses r LEFT JOIN suppliers s ON s.id=r.supplierId
        ORDER BY r.active DESC,r.startsOn,r.description`,
    ),
    rows(
      `SELECT o.*,s.name AS supplier,
              COALESCE(SUM(CASE WHEN i.status='paid' THEN 1 ELSE 0 END),0) AS paidInstallments
         FROM financial_obligations o LEFT JOIN suppliers s ON s.id=o.supplierId
         LEFT JOIN obligation_installments i ON i.obligationId=o.id
        GROUP BY o.id ORDER BY o.createdAt DESC`,
    ),
  ]);
  return { recurring, obligations };
}

export async function createRecurringExpense(actor: Actor, raw: unknown) {
  requirePermission(actor, 'payables');
  const input = recurringInput.parse(raw);
  if (input.endsOn && input.endsOn < input.startsOn)
    throw new AppError(400, 'La fecha final es anterior al comienzo.');
  await validateSupplier(input.supplierId);
  const recurringId = id();
  const createdAt = now();
  await db().batch([
    statement(
      `INSERT INTO recurring_expenses(
        id,description,category,amount,frequency,interval,startsOn,endsOn,
        supplierId,methodId,createdBy,createdAt,updatedAt
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      recurringId,
      input.description,
      input.category,
      input.amount,
      input.frequency,
      input.interval,
      input.startsOn,
      input.endsOn,
      input.supplierId,
      input.methodId,
      actor.id,
      createdAt,
      createdAt,
    ),
    auditStatement(
      actor.id,
      'Crear gasto recurrente',
      recurringId,
      null,
      input,
    ),
  ]);
  await materializeFinancialPlan(actor, {
    throughOn: addDays(businessToday(), 365),
  });
  return { id: recurringId, ok: true };
}

export async function createInstallmentObligation(actor: Actor, raw: unknown) {
  requirePermission(actor, 'payables');
  const input = obligationInput.parse(raw);
  await validateSupplier(input.supplierId);
  const obligationId = id();
  const createdAt = now();
  const plan = buildInstallmentPlan({
    obligationId,
    totalMinor: input.total,
    installmentCount: input.installmentCount,
    firstDueOn: input.firstDueOn,
    intervalMonths: input.intervalMonths,
  });
  const commands: D1PreparedStatement[] = [
    statement(
      `INSERT INTO financial_obligations(
        id,description,supplierId,total,installmentCount,firstDueOn,
        intervalMonths,kind,createdBy,createdAt
      ) VALUES (?,?,?,?,?,?,?,?,?,?)`,
      obligationId,
      input.description,
      input.supplierId,
      input.total,
      input.installmentCount,
      input.firstDueOn,
      input.intervalMonths,
      input.kind,
      actor.id,
      createdAt,
    ),
  ];
  for (const installment of plan) {
    const payableId = id();
    commands.push(
      statement(
        'INSERT INTO payables(id,description,supplierId,amount,dueAt,kind,reference) VALUES (?,?,?,?,?,?,?)',
        payableId,
        `${input.description} · cuota ${installment.number}/${plan.length}`,
        input.supplierId,
        installment.amountMinor,
        installment.dueOn,
        input.kind,
        installment.reference,
      ),
      statement(
        'INSERT INTO obligation_installments(id,obligationId,number,amount,dueOn,payableId) VALUES (?,?,?,?,?,?)',
        id(),
        obligationId,
        installment.number,
        installment.amountMinor,
        installment.dueOn,
        payableId,
      ),
    );
  }
  commands.push(
    auditStatement(
      actor.id,
      'Crear obligación en cuotas',
      obligationId,
      null,
      input,
    ),
  );
  await db().batch(commands);
  return { id: obligationId, installments: plan.length, ok: true };
}

export async function materializeFinancialPlan(actor: Actor, raw: unknown) {
  requirePermission(actor, 'payables');
  const input = z.object({ throughOn: z.iso.date() }).strict().parse(raw);
  const definitions = await rows<Record<string, any>>(
    `SELECT id,description,category,amount,frequency,interval,startsOn,endsOn,supplierId
       FROM recurring_expenses WHERE active=1 AND startsOn<=?`,
    input.throughOn,
  );
  const existing = new Set(
    (
      await rows<{ reference: string }>(
        "SELECT reference FROM payables WHERE reference LIKE 'recurring:%'",
      )
    ).map((row) => row.reference),
  );
  const commands: D1PreparedStatement[] = [];
  let created = 0;
  for (const recurring of definitions) {
    const occurrences = expandRecurrence(recurring.frequency, {
      startsOn: recurring.startsOn,
      throughOn: input.throughOn,
      endsOn: recurring.endsOn,
      interval: recurring.interval,
    });
    for (const dueOn of occurrences) {
      const reference = `recurring:${recurring.id}:${dueOn}`;
      if (existing.has(reference)) continue;
      if (created >= 500)
        throw new AppError(400, 'El período genera demasiados vencimientos.');
      commands.push(
        statement(
          'INSERT INTO payables(id,description,supplierId,amount,dueAt,kind,reference) VALUES (?,?,?,?,?,?,?)',
          id(),
          recurring.description,
          recurring.supplierId,
          recurring.amount,
          dueOn,
          recurring.category || 'Gasto recurrente',
          reference,
        ),
      );
      existing.add(reference);
      created += 1;
    }
  }
  commands.push(
    auditStatement(actor.id, 'Generar vencimientos recurrentes', id(), null, {
      throughOn: input.throughOn,
      created,
    }),
  );
  await db().batch(commands);
  return { created, throughOn: input.throughOn };
}

export async function toggleRecurringExpense(actor: Actor, raw: unknown) {
  requirePermission(actor, 'payables');
  const input = z.object({ id: text }).strict().parse(raw);
  const recurring = await one<{ active: number }>(
    'SELECT active FROM recurring_expenses WHERE id=?',
    input.id,
  );
  if (!recurring) throw new AppError(404, 'Gasto recurrente no encontrado.');
  await db().batch([
    statement(
      'UPDATE recurring_expenses SET active=1-active,updatedAt=? WHERE id=?',
      now(),
      input.id,
    ),
    auditStatement(actor.id, 'Cambiar gasto recurrente', input.id, recurring, {
      active: recurring.active ? 0 : 1,
    }),
  ]);
  return { ok: true, active: recurring.active ? 0 : 1 };
}

export async function getPlannedFinancialCalendar(
  actor: Actor,
  horizonDays = 60,
) {
  requirePermission(actor, 'cash-flow');
  const recurringExpenses = await rows<RecurringExpenseDefinition>(
    `SELECT r.id,r.description,r.amount AS amountMinor,r.startsOn,r.frequency,
            r.interval,r.endsOn,r.category AS kind,r.supplierId,s.name AS supplierName
       FROM recurring_expenses r LEFT JOIN suppliers s ON s.id=r.supplierId
      WHERE r.active=1`,
  );
  return readFinancialCalendarFromD1({ recurringExpenses }, { horizonDays });
}
