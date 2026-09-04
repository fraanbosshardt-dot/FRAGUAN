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
import { money, positiveMoney, text } from './validation';

const purchaseLine = z
  .object({
    variantId: text,
    quantity: z.number().int().min(1).max(10000),
    cost: money,
    discount: money.default(0),
  })
  .strict();
const createInput = z
  .object({
    supplierId: text,
    dueAt: z.iso.date(),
    items: z.array(purchaseLine).min(1).max(100),
    discount: money.default(0),
    tax: money.default(0),
    shipping: money.default(0),
    paymentMethod: z
      .string()
      .trim()
      .min(1)
      .max(100)
      .default('cuenta_corriente'),
    supplierReference: z.string().trim().max(100).default(''),
    notes: z.string().trim().max(1000).default(''),
    idempotencyKey: z.string().uuid().optional(),
  })
  .strict();
const transitionInput = z
  .object({
    purchaseId: text,
    action: z.enum(['send', 'confirm']),
  })
  .strict();
const receiptInput = z
  .object({
    purchaseId: text,
    items: z
      .array(
        z
          .object({
            purchaseItemId: text,
            quantity: z.number().int().min(1).max(10000),
          })
          .strict(),
      )
      .min(1)
      .max(100),
    notes: z.string().trim().max(1000).default(''),
    idempotencyKey: z.string().uuid(),
  })
  .strict();

async function hash(value: unknown) {
  return Array.from(
    new Uint8Array(
      await crypto.subtle.digest(
        'SHA-256',
        new TextEncoder().encode(JSON.stringify(value)),
      ),
    ),
  )
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function addMoney(total: number, amount: number) {
  const result = total + amount;
  if (!Number.isSafeInteger(result))
    throw new AppError(400, 'El total de la compra está fuera de rango.');
  return result;
}

export async function getPurchaseOrder(actor: Actor, purchaseId: string) {
  requirePermission(actor, 'purchases');
  const purchase = await one<Record<string, any>>(
    `SELECT p.*,s.name AS supplier
       FROM purchases p JOIN suppliers s ON s.id=p.supplierId
      WHERE p.id=?`,
    purchaseId,
  );
  if (!purchase) throw new AppError(404, 'Orden de compra no encontrada.');
  const [items, receipts] = await Promise.all([
    rows(
      `SELECT pi.id,pi.variantId,pr.name,pr.category,v.color,v.size,v.sku,
              pi.quantity,pi.received,pi.cost,pi.discount
         FROM purchase_items pi
         JOIN variants v ON v.id=pi.variantId
         JOIN products pr ON pr.id=v.productId
        WHERE pi.purchaseId=? ORDER BY pi.rowid`,
      purchaseId,
    ),
    rows(
      `SELECT r.id,r.subtotal,r.notes,r.createdAt,u.name AS receivedBy,
              COALESCE(SUM(ri.quantity),0) AS units
         FROM purchase_receipts r JOIN users u ON u.id=r.actorId
         LEFT JOIN purchase_receipt_items ri ON ri.receiptId=r.id
        WHERE r.purchaseId=? GROUP BY r.id ORDER BY r.createdAt DESC`,
      purchaseId,
    ),
  ]);
  return { ...purchase, items, receipts };
}

export async function createPurchaseOrder(actor: Actor, raw: unknown) {
  requirePermission(actor, 'purchases');
  const input = createInput.parse(raw);
  if (
    new Set(input.items.map((item) => item.variantId)).size !==
    input.items.length
  )
    throw new AppError(400, 'Agrupá las cantidades por variante.');
  if (
    !(await one(
      'SELECT id FROM suppliers WHERE id=? AND active=1',
      input.supplierId,
    ))
  )
    throw new AppError(400, 'Proveedor inválido.');
  const idempotencyKey = input.idempotencyKey ?? crypto.randomUUID();
  const requestHash = await hash({ ...input, idempotencyKey });
  const previous = await one<{ id: string; requestHash: string }>(
    'SELECT id,requestHash FROM purchases WHERE idempotencyKey=?',
    idempotencyKey,
  );
  if (previous) {
    if (previous.requestHash !== requestHash)
      throw new AppError(409, 'La orden ya existe con otros datos.');
    return getPurchaseOrder(actor, previous.id);
  }
  let subtotal = 0;
  let itemDiscount = 0;
  for (const item of input.items) {
    if (!(await one('SELECT id FROM variants WHERE id=?', item.variantId)))
      throw new AppError(400, 'Una variante de la compra no existe.');
    const gross = item.quantity * item.cost;
    if (!Number.isSafeInteger(gross) || item.discount > gross)
      throw new AppError(400, 'Revisá el descuento de una línea.');
    subtotal = addMoney(subtotal, gross);
    itemDiscount = addMoney(itemDiscount, item.discount);
  }
  const discount = addMoney(input.discount, itemDiscount);
  if (discount > subtotal)
    throw new AppError(400, 'El descuento supera el subtotal.');
  const total = addMoney(
    addMoney(subtotal - discount, input.tax),
    input.shipping,
  );
  if (total <= 0)
    throw new AppError(400, 'El total de la compra debe ser positivo.');
  const purchaseId = id();
  const createdAt = now();
  const commands: D1PreparedStatement[] = [
    statement(
      `INSERT INTO purchases(
        id,supplierId,status,subtotal,discount,tax,shipping,total,paymentMethod,
        supplierReference,notes,idempotencyKey,requestHash,createdAt,updatedAt,dueAt,actorId
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      purchaseId,
      input.supplierId,
      'draft',
      subtotal,
      discount,
      input.tax,
      input.shipping,
      total,
      input.paymentMethod,
      input.supplierReference,
      input.notes,
      idempotencyKey,
      requestHash,
      createdAt,
      createdAt,
      input.dueAt,
      actor.id,
    ),
  ];
  for (const item of input.items)
    commands.push(
      statement(
        'INSERT INTO purchase_items(id,purchaseId,variantId,quantity,cost,discount) VALUES (?,?,?,?,?,?)',
        id(),
        purchaseId,
        item.variantId,
        item.quantity,
        item.cost,
        item.discount,
      ),
    );
  commands.push(
    auditStatement(actor.id, 'Crear orden de compra', purchaseId, null, {
      supplierId: input.supplierId,
      total,
      lines: input.items.length,
    }),
  );
  await db().batch(commands);
  return getPurchaseOrder(actor, purchaseId);
}

export async function transitionPurchaseOrder(actor: Actor, raw: unknown) {
  requirePermission(actor, 'purchases');
  const input = transitionInput.parse(raw);
  const purchase = await one<{
    id: string;
    supplierId: string;
    status: string;
    total: number;
    dueAt: string;
  }>(
    'SELECT id,supplierId,status,total,dueAt FROM purchases WHERE id=?',
    input.purchaseId,
  );
  if (!purchase) throw new AppError(404, 'Orden de compra no encontrada.');
  const expected = input.action === 'send' ? 'draft' : 'sent';
  const target = input.action === 'send' ? 'sent' : 'confirmed';
  if (purchase.status !== expected)
    throw new AppError(
      409,
      'La orden cambió de estado. Actualizá la pantalla.',
    );
  const changedAt = now();
  const commands: D1PreparedStatement[] = [
    statement(
      `UPDATE purchases SET status=?,updatedAt=?,${
        target === 'sent' ? 'sentAt' : 'confirmedAt'
      }=? WHERE id=? AND status=?`,
      target,
      changedAt,
      changedAt,
      purchase.id,
      expected,
    ),
  ];
  if (target === 'confirmed') {
    const payable = await one<{ id: string; status: string }>(
      'SELECT id,status FROM payables WHERE purchaseId=?',
      purchase.id,
    );
    if (payable) {
      if (payable.status !== 'pending')
        throw new AppError(409, 'La obligación de esta compra ya fue pagada.');
      commands.push(
        statement(
          'UPDATE payables SET amount=?,dueAt=?,supplierId=?,description=? WHERE id=?',
          purchase.total,
          purchase.dueAt,
          purchase.supplierId,
          'Orden de compra confirmada',
          payable.id,
        ),
      );
    } else
      commands.push(
        statement(
          'INSERT INTO payables(id,description,supplierId,amount,dueAt,kind,reference,purchaseId) VALUES (?,?,?,?,?,?,?,?)',
          id(),
          'Orden de compra confirmada',
          purchase.supplierId,
          purchase.total,
          purchase.dueAt,
          'Proveedor',
          purchase.id,
          purchase.id,
        ),
      );
  }
  commands.push(
    auditStatement(
      actor.id,
      `Compra ${target}`,
      purchase.id,
      { status: expected },
      { status: target },
    ),
  );
  await db().batch(commands);
  return getPurchaseOrder(actor, purchase.id);
}

export async function receivePurchaseOrder(actor: Actor, raw: unknown) {
  requirePermission(actor, 'purchases');
  const input = receiptInput.parse(raw);
  if (
    new Set(input.items.map((item) => item.purchaseItemId)).size !==
    input.items.length
  )
    throw new AppError(400, 'No repitas líneas en una recepción.');
  const requestHash = await hash(input);
  const previous = await one<{
    id: string;
    purchaseId: string;
    requestHash: string;
  }>(
    'SELECT id,purchaseId,requestHash FROM purchase_receipts WHERE idempotencyKey=?',
    input.idempotencyKey,
  );
  if (previous) {
    if (
      previous.purchaseId !== input.purchaseId ||
      previous.requestHash !== requestHash
    )
      throw new AppError(409, 'La recepción ya existe con otros datos.');
    return getPurchaseOrder(actor, previous.purchaseId);
  }
  const purchase = await one<{ id: string; status: string }>(
    'SELECT id,status FROM purchases WHERE id=?',
    input.purchaseId,
  );
  if (
    !purchase ||
    !['confirmed', 'partially_received'].includes(purchase.status)
  )
    throw new AppError(409, 'La orden todavía no admite recepción.');
  const selectedLines = [];
  let subtotal = 0;
  for (const requested of input.items) {
    const line = await one<{
      id: string;
      purchaseId: string;
      variantId: string;
      quantity: number;
      received: number;
      cost: number;
      stock: number;
    }>(
      `SELECT pi.id,pi.purchaseId,pi.variantId,pi.quantity,pi.received,pi.cost,v.stock
         FROM purchase_items pi JOIN variants v ON v.id=pi.variantId WHERE pi.id=?`,
      requested.purchaseItemId,
    );
    if (
      !line ||
      line.purchaseId !== purchase.id ||
      requested.quantity > line.quantity - line.received
    )
      throw new AppError(409, 'Revisá las cantidades pendientes de recibir.');
    subtotal = addMoney(subtotal, requested.quantity * line.cost);
    selectedLines.push({ ...line, receive: requested.quantity });
  }
  if (subtotal <= 0)
    throw new AppError(400, 'La recepción debe tener un valor positivo.');
  const receiptId = id();
  const createdAt = now();
  const commands: D1PreparedStatement[] = [
    statement(
      'INSERT INTO purchase_receipts(id,purchaseId,actorId,subtotal,notes,idempotencyKey,requestHash,createdAt) VALUES (?,?,?,?,?,?,?,?)',
      receiptId,
      purchase.id,
      actor.id,
      subtotal,
      input.notes,
      input.idempotencyKey,
      requestHash,
      createdAt,
    ),
  ];
  for (const line of selectedLines) {
    commands.push(
      statement(
        'INSERT INTO purchase_receipt_items(id,receiptId,purchaseItemId,variantId,quantity,unitCost,beforeStock,afterStock) VALUES (?,?,?,?,?,?,?,?)',
        id(),
        receiptId,
        line.id,
        line.variantId,
        line.receive,
        line.cost,
        line.stock,
        line.stock + line.receive,
      ),
      statement(
        'INSERT INTO stock_movements(id,variantId,quantity,before,after,reason,actorId,reference,createdAt) VALUES (?,?,?,?,?,?,?,?,?)',
        id(),
        line.variantId,
        line.receive,
        line.stock,
        line.stock + line.receive,
        'Recepción de compra',
        actor.id,
        receiptId,
        createdAt,
      ),
      statement(
        'UPDATE variants SET cost=? WHERE id=?',
        line.cost,
        line.variantId,
      ),
    );
  }
  commands.push(
    auditStatement(actor.id, 'Recepción de compra', receiptId, null, {
      purchaseId: purchase.id,
      items: input.items,
    }),
  );
  await db().batch(commands);
  return getPurchaseOrder(actor, purchase.id);
}
