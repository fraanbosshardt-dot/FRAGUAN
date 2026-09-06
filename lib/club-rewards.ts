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
import { text } from './validation';
export async function clubRewards(a: Actor) {
  requirePermission(a, 'club-rewards');
  const [rewards, redemptions, customers] = await Promise.all([
    rows('SELECT * FROM club_rewards ORDER BY active DESC,name'),
    rows(
      "SELECT r.*,c.name||' '||c.surname AS customer FROM club_redemptions r JOIN customers c ON c.id=r.customerId ORDER BY r.createdAt DESC LIMIT 250",
    ),
    rows(
      "SELECT id,name||' '||surname AS name,phone,points FROM customers WHERE active=1 ORDER BY name,surname",
    ),
  ]);
  return { rewards, redemptions, customers };
}
export async function clubRewardWrite(a: Actor, raw: unknown) {
  requirePermission(a, 'club-rewards');
  const input = z
    .discriminatedUnion('action', [
      z
        .object({
          action: z.literal('reward'),
          name: text,
          description: text,
          points: z.number().int().positive().max(1000000),
        })
        .strict(),
      z.object({ action: z.literal('toggle'), id: text }).strict(),
      z
        .object({
          action: z.literal('redeem'),
          customerId: text,
          rewardId: text,
          idempotencyKey: z.string().uuid(),
        })
        .strict(),
      z.object({ action: z.literal('deliver'), id: text }).strict(),
      z.object({ action: z.literal('cancel'), id: text }).strict(),
    ])
    .parse(raw);
  const key = id(),
    date = now();
  const commands: D1PreparedStatement[] = [];
  if (input.action === 'reward')
    commands.push(
      statement(
        'INSERT INTO club_rewards(id,name,description,points,createdAt) VALUES (?,?,?,?,?)',
        key,
        input.name,
        input.description,
        input.points,
        date,
      ),
    );
  if (input.action === 'toggle')
    commands.push(
      statement('UPDATE club_rewards SET active=1-active WHERE id=?', input.id),
    );
  if (input.action === 'redeem') {
    const prior = await one<{
      id: string;
      customerId: string;
      rewardId: string;
    }>(
      'SELECT id,customerId,rewardId FROM club_redemptions WHERE idempotencyKey=?',
      input.idempotencyKey,
    );
    if (prior) {
      if (
        prior.customerId !== input.customerId ||
        prior.rewardId !== input.rewardId
      )
        throw new AppError(409, 'La solicitud ya corresponde a otro canje.');
      return { ok: true, id: prior.id };
    }
    const reward = await one<{ name: string; points: number }>(
      'SELECT name,points FROM club_rewards WHERE id=? AND active=1',
      input.rewardId,
    );
    const customer = await one<{ points: number }>(
      'SELECT points FROM customers WHERE id=? AND active=1',
      input.customerId,
    );
    if (!reward || !customer || customer.points < reward.points)
      throw new AppError(
        409,
        'Revisá el beneficio y los puntos disponibles del cliente.',
      );
    commands.push(
      statement(
        'INSERT INTO club_redemptions(id,customerId,rewardId,points,rewardName,idempotencyKey,actorId,createdAt) VALUES (?,?,?,?,?,?,?,?)',
        key,
        input.customerId,
        input.rewardId,
        reward.points,
        reward.name,
        input.idempotencyKey,
        a.id,
        date,
      ),
      statement(
        'INSERT INTO loyalty_transactions(id,customerId,points,reason,reference,createdAt) VALUES (?,?,?,?,?,?)',
        id(),
        input.customerId,
        -reward.points,
        `Canje: ${reward.name}`,
        key,
        date,
      ),
    );
  }
  if (input.action === 'deliver' || input.action === 'cancel') {
    const redemption = await one<{
      status: string;
      customerId: string;
      points: number;
    }>(
      'SELECT status,customerId,points FROM club_redemptions WHERE id=?',
      input.id,
    );
    if (!redemption || redemption.status !== 'reserved')
      throw new AppError(409, 'El canje ya fue entregado o cancelado.');
    commands.push(
      statement(
        "UPDATE club_redemptions SET status=? WHERE id=? AND status='reserved'",
        input.action === 'deliver' ? 'delivered' : 'cancelled',
        input.id,
      ),
    );
    if (input.action === 'cancel')
      commands.push(
        statement(
          "INSERT INTO loyalty_transactions(id,customerId,points,reason,reference,createdAt) SELECT ?,customerId,points,'Canje cancelado',id,? FROM club_redemptions WHERE id=? AND status='cancelled' AND NOT EXISTS(SELECT 1 FROM loyalty_transactions WHERE reference=? AND reason='Canje cancelado')",
          id(),
          date,
          input.id,
          input.id,
        ),
      );
  }
  commands.push(
    auditStatement(
      a.id,
      `Club: ${input.action}`,
      'id' in input ? input.id : key,
      null,
      input,
    ),
  );
  await db().batch(commands);
  return { ok: true, id: key };
}
