import { z } from 'zod';
import { Actor, AppError, requirePermission } from './auth';
import { auditStatement, db, one, rows, statement } from '@/db/queries';
import { getBusinessReport } from './reporting';
export async function sellerCommissions(a: Actor, from: string, to: string) {
  requirePermission(a, 'seller-commissions');
  const report = await getBusinessReport(a, { from, to });
  const users = await rows<{ id: string; name: string; value: string | null }>(
    "SELECT u.id,u.name,s.value FROM users u LEFT JOIN settings s ON s.key='seller-commission:'||u.id ORDER BY u.name",
  );
  return {
    from,
    to,
    canConfigure: a.role === 'ADMIN',
    sellers: users.map((u) => {
      const sold = report.breakdowns.sellers.find((s) => s.id === u.id);
      const revenue = Number(sold?.revenueMinor ?? 0),
        bps = Number(u.value ?? 0);
      return {
        id: u.id,
        name: u.name,
        tickets: Number(sold?.tickets ?? 0),
        revenue,
        rate: bps / 100,
        estimatedCommission: Math.floor((revenue * bps) / 10000),
      };
    }),
  };
}
export async function configureSellerCommission(a: Actor, raw: unknown) {
  requirePermission(a, 'users');
  const input = z
    .object({ id: z.string().min(1), rate: z.number().min(0).max(100) })
    .strict()
    .parse(raw);
  if (!(await one('SELECT id FROM users WHERE id=?', input.id)))
    throw new AppError(404, 'Usuario no encontrado.');
  const bps = Math.round(input.rate * 100);
  const key = `seller-commission:${input.id}`;
  const before = await one('SELECT value FROM settings WHERE key=?', key);
  await db().batch([
    statement(
      'INSERT INTO settings(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value',
      key,
      String(bps),
    ),
    auditStatement(a.id, 'Configurar comisión de vendedor', input.id, before, {
      basis: 'ventas netas de devoluciones',
      bps,
    }),
  ]);
  return { ok: true };
}
