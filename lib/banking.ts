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
  const [accounts, entries] = await Promise.all([
    rows(
      'SELECT a.id,a.name,a.bank,a.alias,a.active,a.opening+COALESCE(SUM(e.amount),0) AS balance FROM bank_accounts a LEFT JOIN bank_entries e ON e.accountId=a.id GROUP BY a.id ORDER BY a.name',
    ),
    rows(
      'SELECT e.*,a.name AS account FROM bank_entries e JOIN bank_accounts a ON a.id=e.accountId ORDER BY e.occurredAt DESC,e.createdAt DESC LIMIT 250',
    ),
  ]);
  return { accounts, entries };
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
  if (input.action === 'entry') {
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
