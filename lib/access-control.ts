import { z } from 'zod';
import { Actor, AppError, requirePermission } from './auth';
import { auditStatement, db, one, rows, statement } from '@/db/queries';
export const configurablePermissions = [
  'pos',
  'customers',
  'own-sales',
  'sales',
  'dashboard',
  'products',
  'stock',
  'replenishment',
  'suppliers',
  'purchases',
  'expenses',
  'payables',
  'cash',
  'cash-flow',
  'financial-calendar',
  'promotions',
  'reports',
  'refunds',
  'inventory',
  'insights',
  'customer-intelligence',
  'customer-credits',
  'banking',
  'club-rewards',
  'communications',
  'seller-commissions',
] as const;
export async function listAccess(a: Actor) {
  requirePermission(a, 'access');
  const users = await rows<{
    id: string;
    name: string;
    role: string;
    value: string | null;
  }>(
    "SELECT u.id,u.name,u.role,s.value FROM users u LEFT JOIN settings s ON s.key='access:'||u.id ORDER BY u.name",
  );
  return {
    permissions: configurablePermissions,
    users: users.map(({ value, ...u }) => ({
      ...u,
      denied: value ? JSON.parse(value) : [],
    })),
  };
}
export async function saveAccess(a: Actor, raw: unknown) {
  requirePermission(a, 'access');
  const input = z
    .object({
      userId: z.string().min(1),
      denied: z
        .array(z.enum(configurablePermissions))
        .max(configurablePermissions.length),
    })
    .strict()
    .parse(raw);
  const user = await one<{ role: string }>(
    'SELECT role FROM users WHERE id=?',
    input.userId,
  );
  if (!user) throw new AppError(404, 'Usuario no encontrado.');
  if (user.role === 'ADMIN' || input.userId === a.id)
    throw new AppError(400, 'La administración conserva acceso completo.');
  const key = `access:${input.userId}`;
  const before = await one('SELECT value FROM settings WHERE key=?', key);
  await db().batch([
    statement(
      'INSERT INTO settings(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value',
      key,
      JSON.stringify([...new Set(input.denied)]),
    ),
    auditStatement(a.id, 'Configurar permisos', input.userId, before, input),
  ]);
  return { ok: true };
}
