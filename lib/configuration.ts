import { db, id, now, one, statement, auditStatement } from '@/db/queries';
import { Actor, requirePermission, AppError } from './auth';
import { z } from 'zod';
import { text, money, positiveMoney } from './validation';
export async function configureMethod(a: Actor, raw: unknown) {
  requirePermission(a, 'settings');
  const x = z
    .object({
      id: text,
      name: text,
      surchargeBps: z.number().int().min(0).max(10000),
      commissionBps: z.number().int().min(0).max(10000),
      days: z.number().int().min(0).max(365),
      installments: z.number().int().min(1).max(24),
    })
    .strict()
    .parse(raw);
  const before = await one(
    'SELECT id,name,surchargeBps,commissionBps,days,installments FROM payment_methods WHERE id=?',
    x.id,
  );
  if (!before) throw new AppError(404, 'Medio de pago no encontrado.');
  await db().batch([
    statement(
      'UPDATE payment_methods SET name=?,surchargeBps=?,commissionBps=?,days=?,installments=? WHERE id=?',
      x.name,
      x.surchargeBps,
      x.commissionBps,
      x.days,
      x.installments,
      x.id,
    ),
    auditStatement(a.id, 'Configurar medio de pago', x.id, before, x),
  ]);
  return { ok: true };
}
export async function addVariant(a: Actor, raw: unknown) {
  requirePermission(a, 'products');
  const x = z
    .object({
      productId: text,
      sku: text,
      barcode: text,
      color: text,
      size: text,
      price: positiveMoney,
      cost: money,
      stock: z.number().int().min(0).max(100000),
      minimum: z.number().int().min(0).max(1000),
    })
    .strict()
    .parse(raw);
  if (
    !(await one('SELECT id FROM products WHERE id=? AND active=1', x.productId))
  )
    throw new AppError(404, 'Producto no encontrado.');
  const key = id();
  await db().batch([
    statement(
      'INSERT INTO variants(id,productId,sku,barcode,color,size,price,cost,minimum) VALUES (?,?,?,?,?,?,?,?,?)',
      key,
      x.productId,
      x.sku,
      x.barcode,
      x.color,
      x.size,
      x.price,
      x.cost,
      x.minimum,
    ),
    statement(
      'INSERT INTO stock_movements(id,variantId,quantity,before,after,reason,actorId,reference,createdAt) VALUES (?,?,?,?,?,?,?,?,?)',
      id(),
      key,
      x.stock,
      0,
      x.stock,
      'Alta de variante',
      a.id,
      key,
      now(),
    ),
    auditStatement(a.id, 'Crear variante', key, null, x),
  ]);
  return { ok: true, id: key };
}
