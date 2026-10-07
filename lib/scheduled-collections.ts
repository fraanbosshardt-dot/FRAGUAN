import { Actor, requirePermission } from './auth';
import { rows, one } from '@/db/queries';
import { argentinaDay } from './business-date';

export function settlementCutoff(value: string | Date = new Date()) {
  return new Date(`${argentinaDay(value)}T23:59:59.999-03:00`).toISOString();
}
export async function scheduledCollections(a: Actor) {
  requirePermission(a, 'banking');
  const cutoff = settlementCutoff();
  const base = `FROM payments p JOIN sales s ON s.id=p.saleId JOIN payment_methods m ON m.id=p.methodId
    WHERE p.methodId NOT IN ('cash','store_credit','cashback')`;
  const columns = `SELECT p.id,p.saleId,p.amount,p.commission,p.net,p.dueAt,p.destination,
    m.name AS method,s.ticket,s.channel,s.createdAt,s.status AS saleStatus`;
  const [pending, available, totals] = await Promise.all([
    rows(
      `${columns} ${base} AND p.dueAt>? ORDER BY p.dueAt,p.id LIMIT 1000`,
      cutoff,
    ),
    rows(
      `${columns} ${base} AND p.dueAt<=? ORDER BY p.dueAt DESC,p.id LIMIT 250`,
      cutoff,
    ),
    one(
      `SELECT COALESCE(SUM(CASE WHEN p.dueAt>? THEN p.net ELSE 0 END),0) AS pendingNet,
      COALESCE(SUM(CASE WHEN p.dueAt>? THEN 1 ELSE 0 END),0) AS pendingCount,
      COALESCE(SUM(CASE WHEN p.dueAt<=? THEN 1 ELSE 0 END),0) AS availableCount
      ${base}`,
      cutoff,
      cutoff,
      cutoff,
    ),
  ]);
  return { pending, available, totals, asOf: argentinaDay() };
}
