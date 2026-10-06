import { db, id, now, one, statement, auditStatement } from '@/db/queries';
import { Actor, requirePermission, AppError } from './auth';
import { z } from 'zod';
import { text, money, positiveMoney } from './validation';
import { resolveVariantCodes } from './variant-codes';
const methodFields = z
  .object({
    name: text,
    surchargeBps: z.number().int().min(0).max(10000),
    commissionBps: z.number().int().min(0).max(10000),
    days: z.number().int().min(0).max(365),
    installments: z.number().int().min(1).max(24),
  })
  .strict();

export async function createMethod(a: Actor, raw: unknown) {
  requirePermission(a, 'settings');
  const x = methodFields.parse(raw),
    key = id();
  await db().batch([
    statement(
      'INSERT INTO payment_methods(id,name,surchargeBps,commissionBps,days,installments) VALUES (?,?,?,?,?,?)',
      key,
      x.name,
      x.surchargeBps,
      x.commissionBps,
      x.days,
      x.installments,
    ),
    auditStatement(a.id, 'Crear medio de pago', key, null, x),
  ]);
  return { ok: true, id: key };
}

export async function setMethodActive(a: Actor, raw: unknown) {
  requirePermission(a, 'settings');
  const x = z.object({ id: text, active: z.boolean() }).strict().parse(raw);
  if (['cash', 'store_credit', 'cashback'].includes(x.id))
    throw new AppError(
      400,
      'Los medios de efectivo y saldos internos deben conservarse disponibles.',
    );
  const before = await one(
    'SELECT id,active FROM payment_methods WHERE id=?',
    x.id,
  );
  if (!before) throw new AppError(404, 'Medio de pago no encontrado.');
  await db().batch([
    statement(
      'UPDATE payment_methods SET active=? WHERE id=?',
      x.active ? 1 : 0,
      x.id,
    ),
    auditStatement(a.id, 'Disponibilidad de medio de pago', x.id, before, x),
  ]);
  return { ok: true };
}

export async function configureMethod(a: Actor, raw: unknown) {
  requirePermission(a, 'settings');
  const x = methodFields.extend({ id: text }).parse(raw);
  const before = await one(
    'SELECT id,name,surchargeBps,commissionBps,days,installments FROM payment_methods WHERE id=?',
    x.id,
  );
  if (!before) throw new AppError(404, 'Medio de pago no encontrado.');
  if (
    ['store_credit', 'cashback'].includes(x.id) &&
    (x.surchargeBps !== 0 ||
      x.commissionBps !== 0 ||
      x.days !== 0 ||
      x.installments !== 1)
  )
    throw new AppError(
      400,
      'Los saldos internos no admiten recargos, comisiones, cuotas ni plazos de acreditación.',
    );
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
      sku: z.string().trim().max(200).default(''),
      barcode: z.string().trim().max(200).default(''),
      color: text,
      size: text,
      price: positiveMoney,
      cost: money,
      stock: z.number().int().min(0).max(100000),
      minimum: z.number().int().min(0).max(1000),
      ideal: z.number().int().min(0).max(100000).default(6),
      entryAt: z.union([z.iso.date(), z.literal('')]).default(''),
    })
    .strict()
    .parse(raw);
  if (x.ideal < x.minimum)
    throw new AppError(400, 'El stock ideal no puede ser menor al mínimo.');
  if (
    !(await one('SELECT id FROM products WHERE id=? AND active=1', x.productId))
  )
    throw new AppError(404, 'Producto no encontrado.');
  const key = id();
  const codes = await resolveVariantCodes(x);
  await db().batch([
    statement(
      `INSERT INTO variants(id,productId,sku,barcode,color,size,price,cost,minimum,
              ideal,entryAt,updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      key,
      x.productId,
      codes.sku,
      codes.barcode,
      x.color,
      x.size,
      x.price,
      x.cost,
      x.minimum,
      x.ideal,
      x.entryAt,
      now(),
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
    auditStatement(a.id, 'Crear variante', key, null, { ...x, ...codes }),
  ]);
  return { ok: true, id: key };
}
