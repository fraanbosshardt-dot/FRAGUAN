import { z } from 'zod';
import { Actor, AppError, requirePermission } from './auth';
import {
  auditStatement,
  db,
  id,
  now,
  one,
  rows,
  statement,
} from '@/db/queries';
import { positiveMoney, text } from './validation';
export async function banking(a: Actor) {
  requirePermission(a, 'banking');
  const [accounts, entries, checks, payables, events] = await Promise.all([
    rows(
      'SELECT a.id,a.name,a.bank,a.alias,a.active,a.opening+COALESCE(SUM(e.amount),0) AS balance FROM bank_accounts a LEFT JOIN bank_entries e ON e.accountId=a.id GROUP BY a.id ORDER BY a.name',
    ),
    rows(
      'SELECT e.*,a.name AS account FROM bank_entries e JOIN bank_accounts a ON a.id=e.accountId ORDER BY e.occurredAt DESC,e.createdAt DESC LIMIT 250',
    ),
    rows(
      'SELECT c.*,a.name AS account FROM checks c JOIN bank_accounts a ON a.id=c.accountId ORDER BY c.dueAt,c.createdAt',
    ),
    rows(
      "SELECT id,description,amount FROM payables WHERE status='pending' AND NOT EXISTS(SELECT 1 FROM checks WHERE payableId=payables.id AND status NOT IN ('cancelled','rejected')) ORDER BY dueAt",
    ),
    rows(
      'SELECT e.id,c.number,e.fromStatus,e.toStatus,e.reason,e.createdAt,u.name AS actor FROM check_events e JOIN checks c ON c.id=e.checkId JOIN users u ON u.id=e.actorId ORDER BY e.createdAt DESC LIMIT 250',
    ),
  ]);
  return { accounts, entries, checks, payables, events };
}
export async function bankingWrite(a: Actor, raw: unknown) {
  requirePermission(a, 'banking');
  const input = z
    .discriminatedUnion('action', [
      z
        .object({
          action: z.literal('account'),
          name: text,
          bank: text,
          alias: z.string().trim().max(100).default(''),
          opening: z.number().int().min(-100000000000).max(100000000000),
        })
        .strict(),
      z
        .object({
          action: z.literal('entry'),
          accountId: text,
          direction: z.enum(['in', 'out']),
          amount: positiveMoney,
          description: text,
          occurredAt: z.iso.date(),
          reference: z.uuid(),
        })
        .strict(),
      z
        .object({
          action: z.literal('reconcile'),
          id: text,
          statementReference: text,
          amount: z.number().int(),
          occurredAt: z.iso.date(),
        })
        .strict(),
      z
        .object({
          action: z.literal('check'),
          number: text,
          bank: text,
          type: z.enum(['paper', 'echeq']),
          direction: z.enum(['issued', 'received']),
          party: text,
          amount: positiveMoney,
          issuedAt: z.iso.date(),
          dueAt: z.iso.date(),
          accountId: text,
          payableId: z
            .string()
            .transform((v) => (v === 'none' ? null : v || null))
            .nullable()
            .default(null),
        })
        .strict(),
      z
        .object({
          action: z.literal('transition'),
          id: text,
          status: z.enum(['deposited', 'cleared', 'rejected', 'cancelled']),
          reason: text,
        })
        .strict(),
    ])
    .parse(raw);
  const key = id(),
    date = now();
  const commands: D1PreparedStatement[] = [];
  if (input.action === 'account')
    commands.push(
      statement(
        'INSERT INTO bank_accounts(id,name,bank,alias,opening,createdAt) VALUES (?,?,?,?,?,?)',
        key,
        input.name,
        input.bank,
        input.alias,
        input.opening,
        date,
      ),
    );
  if (input.action === 'entry' || input.action === 'check') {
    if (
      !(await one(
        'SELECT id FROM bank_accounts WHERE id=? AND active=1',
        input.accountId,
      ))
    )
      throw new AppError(400, 'Cuenta no disponible.');
  }
  if (input.action === 'entry') {
    const previous = await one<{
      accountId: string;
      amount: number;
      description: string;
      occurredAt: string;
    }>(
      'SELECT accountId,amount,description,occurredAt FROM bank_entries WHERE reference=?',
      input.reference,
    );
    const amount = input.amount * (input.direction === 'in' ? 1 : -1);
    if (previous) {
      if (
        previous.accountId !== input.accountId ||
        previous.amount !== amount ||
        previous.description !== input.description ||
        previous.occurredAt !== input.occurredAt
      )
        throw new AppError(
          409,
          'La referencia ya corresponde a otro movimiento.',
        );
      return { ok: true };
    }
    commands.push(
      statement(
        'INSERT INTO bank_entries(id,accountId,amount,description,reference,occurredAt,actorId,createdAt) VALUES (?,?,?,?,?,?,?,?)',
        key,
        input.accountId,
        amount,
        input.description,
        input.reference,
        input.occurredAt,
        a.id,
        date,
      ),
    );
  }
  if (input.action === 'reconcile') {
    const entry = await one<{
      amount: number;
      occurredAt: string;
      reconciledAt: string | null;
    }>(
      'SELECT amount,occurredAt,reconciledAt FROM bank_entries WHERE id=?',
      input.id,
    );
    if (
      !entry ||
      entry.reconciledAt ||
      entry.amount !== input.amount ||
      entry.occurredAt !== input.occurredAt
    )
      throw new AppError(
        409,
        'El importe y la fecha del extracto deben coincidir con un movimiento pendiente.',
      );
    commands.push(
      statement(
        'UPDATE bank_entries SET reconciledAt=?,statementReference=? WHERE id=? AND reconciledAt IS NULL',
        date,
        input.statementReference,
        input.id,
      ),
    );
  }
  if (input.action === 'check') {
    if (input.dueAt < input.issuedAt)
      throw new AppError(
        400,
        'El vencimiento no puede ser anterior a la emisión.',
      );
    commands.push(
      statement(
        'INSERT INTO checks(id,number,bank,type,direction,party,amount,issuedAt,dueAt,accountId,status,createdAt,payableId) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)',
        key,
        input.number,
        input.bank,
        input.type,
        input.direction,
        input.party,
        input.amount,
        input.issuedAt,
        input.dueAt,
        input.accountId,
        input.direction,
        date,
        input.payableId,
      ),
    );
  }
  if (input.action === 'transition') {
    const check = await one<{
      id: string;
      status: string;
      version: number;
      direction: string;
      amount: number;
      accountId: string;
      number: string;
      dueAt: string;
      payableId: string | null;
    }>('SELECT * FROM checks WHERE id=?', input.id);
    if (!check) throw new AppError(404, 'Cheque no encontrado.');
    const allowed: Record<string, string[]> = {
      issued: ['cleared', 'rejected', 'cancelled'],
      received: ['deposited', 'cancelled'],
      deposited: ['cleared', 'rejected'],
      rejected: ['cancelled'],
      cleared: [],
      cancelled: [],
    };
    if (!allowed[check.status]?.includes(input.status))
      throw new AppError(409, 'Transición de cheque no permitida.');
    const today = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Argentina/Cordoba',
    }).format(new Date());
    if (input.status === 'cleared' && check.dueAt > today)
      throw new AppError(409, 'El cheque todavía no venció.');
    commands.push(
      statement(
        'INSERT INTO check_events(id,checkId,fromStatus,toStatus,version,reason,actorId,createdAt) VALUES (?,?,?,?,?,?,?,?)',
        key,
        check.id,
        check.status,
        input.status,
        check.version,
        input.reason,
        a.id,
        date,
      ),
      statement(
        'UPDATE checks SET status=?,version=version+1 WHERE id=?',
        input.status,
        check.id,
      ),
    );
    if (input.status === 'cleared') {
      commands.push(
        statement(
          'INSERT INTO bank_entries(id,accountId,amount,description,reference,occurredAt,actorId,createdAt) VALUES (?,?,?,?,?,?,?,?)',
          id(),
          check.accountId,
          check.amount * (check.direction === 'received' ? 1 : -1),
          `Cheque ${check.number}`,
          `check:${check.id}`,
          today,
          a.id,
          date,
        ),
      );
      if (check.payableId)
        commands.push(
          statement(
            "UPDATE payables SET status='paid' WHERE id=? AND status='pending'",
            check.payableId,
          ),
        );
    }
  }
  commands.push(
    auditStatement(
      a.id,
      `Bancos: ${input.action}`,
      'id' in input ? input.id : key,
      null,
      input,
    ),
  );
  await db().batch(commands);
  return { ok: true, id: key };
}
