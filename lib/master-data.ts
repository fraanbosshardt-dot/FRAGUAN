import { z } from 'zod';
import { auditStatement, db, now, one, rows, statement } from '@/db/queries';
import { Actor, AppError, requirePermission } from './auth';
import { money, positiveMoney, text } from './validation';

const shortOptionalText = z.string().trim().max(200);
const longOptionalText = z.string().trim().max(1_500);
const email = z.union([z.email(), z.literal('')]);
const optionalDate = z.union([z.iso.date(), z.literal(''), z.null()]);
const optionalId = z.union([text, z.literal(''), z.null()]);

const productUpdateInput = z
  .object({
    id: text,
    name: text,
    internalCode: shortOptionalText,
    category: text,
    subcategory: shortOptionalText,
    brand: text,
    season: shortOptionalText,
    collection: shortOptionalText,
    location: shortOptionalText,
    supplierId: optionalId,
  })
  .strict();

const variantUpdateInput = z
  .object({
    id: text,
    sku: text,
    barcode: text,
    color: text,
    size: text,
    price: positiveMoney,
    onlinePrice: positiveMoney.optional(),
    cost: money,
    minimum: z.number().int().min(0).max(100_000),
    ideal: z.number().int().min(0).max(100_000),
    entryAt: z.union([z.iso.date(), z.literal('')]),
  })
  .strict();

const customerUpdateInput = z
  .object({
    id: text,
    name: text,
    surname: text,
    phone: z.string().trim().min(5).max(30),
    whatsapp: shortOptionalText.default(''),
    email,
    birthday: optionalDate,
    locality: shortOptionalText,
    usualSizes: shortOptionalText,
    notes: longOptionalText,
  })
  .strict();

const supplierUpdateInput = z
  .object({
    id: text,
    name: text,
    company: shortOptionalText,
    contact: shortOptionalText,
    phone: z.string().trim().max(30),
    whatsapp: z.string().trim().max(30).default(''),
    email,
    brands: shortOptionalText,
    terms: longOptionalText,
    discountBps: z.number().int().min(0).max(10_000),
    paymentDays: z.number().int().min(0).max(3_650),
    notes: longOptionalText,
  })
  .strict();

const archiveInput = z
  .object({
    entity: z.enum(['product', 'customer', 'supplier']),
    id: text,
    active: z.boolean(),
  })
  .strict();

async function ensureSupplier(supplierId: string | null) {
  if (!supplierId) return;
  if (!(await one('SELECT id FROM suppliers WHERE id=?', supplierId)))
    throw new AppError(400, 'Proveedor inválido.');
}

export async function listAdminProducts(actor: Actor, includeArchived = true) {
  requirePermission(actor, 'products');
  return rows(
    `SELECT v.id,v.productId,p.name,p.internalCode,p.category,p.subcategory,p.brand,
            p.season,p.collection,p.location,p.supplierId,s.name AS supplier,
            p.active,p.updatedAt,p.archivedAt,v.sku,v.barcode,v.color,v.size,
            v.price,v.onlinePrice,COALESCE(v.onlinePrice,v.price) AS effectiveOnlinePrice,
            v.cost,v.stock,v.minimum,v.ideal,v.entryAt,v.updatedAt AS variantUpdatedAt,
            CASE WHEN v.price>0 THEN ROUND((v.price-v.cost)*100.0/v.price,2) ELSE NULL END AS marginPercent,
            CASE WHEN v.cost>0 THEN ROUND((v.price-v.cost)*100.0/v.cost,2) ELSE NULL END AS markupPercent
       FROM variants v JOIN products p ON p.id=v.productId
       LEFT JOIN suppliers s ON s.id=p.supplierId
      WHERE (?=1 OR p.active=1)
      ORDER BY p.active DESC,p.rowid,v.rowid`,
    includeArchived ? 1 : 0,
  );
}

export async function listAdminCustomers(actor: Actor, query = '') {
  requirePermission(actor, 'customer-intelligence');
  const term = `%${query.slice(0, 100)}%`;
  return rows(
    `SELECT c.id,c.name,c.surname,c.phone,c.whatsapp,c.email,c.birthday,c.locality,
            c.usualSizes,c.notes,c.points,c.active,c.createdAt,c.updatedAt,c.archivedAt,
            COUNT(s.id) AS purchases,
            COALESCE(SUM(s.total-COALESCE(r.refunded,0)),0) AS spent,
            MAX(s.createdAt) AS lastPurchase
       FROM customers c
       LEFT JOIN sales s ON s.customerId=c.id
        AND s.status IN ('confirmed','partially_refunded')
       LEFT JOIN (SELECT saleId,SUM(amount) AS refunded FROM refunds GROUP BY saleId) r
        ON r.saleId=s.id
      WHERE c.name||' '||c.surname LIKE ? OR c.phone LIKE ? OR c.email LIKE ?
      GROUP BY c.id ORDER BY c.active DESC,c.createdAt DESC LIMIT 500`,
    term,
    term,
    term,
  );
}

export async function listAdminSuppliers(actor: Actor, includeArchived = true) {
  requirePermission(actor, 'suppliers');
  return rows(
    `SELECT s.id,s.name,s.company,s.contact,s.phone,s.whatsapp,s.email,s.brands,
            s.terms,s.discountBps,s.paymentDays,s.notes,s.active,s.updatedAt,s.archivedAt,
            COUNT(DISTINCT p.id) AS purchases,
            COALESCE(SUM(CASE WHEN p.status<>'draft' THEN p.total ELSE 0 END),0) AS purchased,
            MAX(CASE WHEN p.status<>'draft' THEN p.createdAt END) AS lastPurchase
       FROM suppliers s LEFT JOIN purchases p ON p.supplierId=s.id
      WHERE (?=1 OR s.active=1)
      GROUP BY s.id ORDER BY s.active DESC,s.name`,
    includeArchived ? 1 : 0,
  );
}

export async function updateProduct(actor: Actor, raw: unknown) {
  requirePermission(actor, 'products');
  const input = productUpdateInput.parse(raw);
  await ensureSupplier(input.supplierId || null);
  const before = await one(
    `SELECT id,name,internalCode,category,subcategory,brand,season,collection,
            location,supplierId,active FROM products WHERE id=?`,
    input.id,
  );
  if (!before) throw new AppError(404, 'Producto no encontrado.');
  const changedAt = now();
  await db().batch([
    statement(
      `UPDATE products SET name=?,internalCode=?,category=?,subcategory=?,brand=?,
              season=?,collection=?,location=?,supplierId=?,updatedAt=? WHERE id=?`,
      input.name,
      input.internalCode,
      input.category,
      input.subcategory,
      input.brand,
      input.season,
      input.collection,
      input.location,
      input.supplierId || null,
      changedAt,
      input.id,
    ),
    auditStatement(actor.id, 'Actualizar producto', input.id, before, input),
  ]);
  return { id: input.id, updatedAt: changedAt, ok: true };
}

export async function updateVariant(actor: Actor, raw: unknown) {
  requirePermission(actor, 'products');
  const input = variantUpdateInput.parse(raw);
  if (input.ideal < input.minimum)
    throw new AppError(400, 'El stock ideal no puede ser menor al mínimo.');
  const before = await one(
    `SELECT id,productId,sku,barcode,color,size,price,onlinePrice,cost,stock,minimum,ideal,entryAt
       FROM variants WHERE id=?`,
    input.id,
  );
  if (!before) throw new AppError(404, 'Variante no encontrada.');
  const changedAt = now();
  await db().batch([
    statement(
      `UPDATE variants SET sku=?,barcode=?,color=?,size=?,price=?,onlinePrice=?,cost=?,minimum=?,
              ideal=?,entryAt=?,updatedAt=? WHERE id=?`,
      input.sku,
      input.barcode,
      input.color,
      input.size,
      input.price,
      input.onlinePrice === undefined
        ? (before as { onlinePrice: number | null }).onlinePrice
        : input.onlinePrice,
      input.cost,
      input.minimum,
      input.ideal,
      input.entryAt,
      changedAt,
      input.id,
    ),
    auditStatement(actor.id, 'Actualizar variante', input.id, before, input),
  ]);
  return { id: input.id, updatedAt: changedAt, ok: true };
}

export async function updateCustomer(actor: Actor, raw: unknown) {
  requirePermission(actor, 'customer-intelligence');
  const input = customerUpdateInput.parse(raw);
  const before = await one(
    `SELECT id,name,surname,phone,whatsapp,email,birthday,locality,usualSizes,notes,active
       FROM customers WHERE id=?`,
    input.id,
  );
  if (!before) throw new AppError(404, 'Cliente no encontrado.');
  const changedAt = now();
  await db().batch([
    statement(
      `UPDATE customers SET name=?,surname=?,phone=?,whatsapp=?,email=?,birthday=?,
              locality=?,usualSizes=?,notes=?,updatedAt=? WHERE id=?`,
      input.name,
      input.surname,
      input.phone,
      input.whatsapp,
      input.email,
      input.birthday || null,
      input.locality,
      input.usualSizes,
      input.notes,
      changedAt,
      input.id,
    ),
    auditStatement(actor.id, 'Actualizar cliente', input.id, before, input),
  ]);
  return { id: input.id, updatedAt: changedAt, ok: true };
}

export async function updateSupplier(actor: Actor, raw: unknown) {
  requirePermission(actor, 'suppliers');
  const input = supplierUpdateInput.parse(raw);
  const before = await one(
    `SELECT id,name,company,contact,phone,whatsapp,email,brands,terms,discountBps,
            paymentDays,notes,active FROM suppliers WHERE id=?`,
    input.id,
  );
  if (!before) throw new AppError(404, 'Proveedor no encontrado.');
  const changedAt = now();
  await db().batch([
    statement(
      `UPDATE suppliers SET name=?,company=?,contact=?,phone=?,whatsapp=?,email=?,
              brands=?,terms=?,discountBps=?,paymentDays=?,notes=?,updatedAt=? WHERE id=?`,
      input.name,
      input.company,
      input.contact,
      input.phone,
      input.whatsapp,
      input.email,
      input.brands,
      input.terms,
      input.discountBps,
      input.paymentDays,
      input.notes,
      changedAt,
      input.id,
    ),
    auditStatement(actor.id, 'Actualizar proveedor', input.id, before, input),
  ]);
  return { id: input.id, updatedAt: changedAt, ok: true };
}

export async function setMasterRecordActive(actor: Actor, raw: unknown) {
  const input = archiveInput.parse(raw);
  const definitions = {
    product: { table: 'products', permission: 'products', label: 'producto' },
    customer: {
      table: 'customers',
      permission: 'customer-intelligence',
      label: 'cliente',
    },
    supplier: {
      table: 'suppliers',
      permission: 'suppliers',
      label: 'proveedor',
    },
  } as const;
  const definition = definitions[input.entity];
  requirePermission(actor, definition.permission);
  const before = await one<{ id: string; active: number }>(
    `SELECT id,active FROM ${definition.table} WHERE id=?`,
    input.id,
  );
  if (!before) throw new AppError(404, 'Registro no encontrado.');
  if (Boolean(before.active) === input.active)
    return { id: input.id, active: before.active, unchanged: true };
  const changedAt = now();
  await db().batch([
    statement(
      `UPDATE ${definition.table} SET active=?,archivedAt=?,updatedAt=? WHERE id=?`,
      input.active ? 1 : 0,
      input.active ? null : changedAt,
      changedAt,
      input.id,
    ),
    auditStatement(
      actor.id,
      input.active
        ? `Reactivar ${definition.label}`
        : `Archivar ${definition.label}`,
      input.id,
      before,
      { active: input.active },
    ),
  ]);
  return { id: input.id, active: input.active ? 1 : 0, ok: true };
}
