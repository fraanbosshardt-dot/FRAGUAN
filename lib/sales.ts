import {
  db,
  id,
  now,
  one,
  rows,
  statement,
  auditStatement,
} from '@/db/queries';
import { Actor, AppError, can } from './auth';
import { saleInput, quoteInput } from './validation';
import { z } from 'zod';
type Variant = {
  id: string;
  name: string;
  color: string;
  size: string;
  price: number;
  cost: number;
  stock: number;
};
type Method = {
  id: string;
  name: string;
  surchargeBps: number;
  commissionBps: number;
  days: number;
  installments: number;
};
export async function quote(raw: unknown) {
  const data = quoteInput.parse(raw);
  const unique = new Set(data.items.map((x) => x.variantId));
  if (unique.size !== data.items.length)
    throw new AppError(400, 'Agrupá las cantidades por variante.');
  const items = [];
  let subtotal = 0;
  for (const line of data.items) {
    const v = await one<Variant>(
      'SELECT v.id,p.name,v.color,v.size,v.price,v.cost,v.stock FROM variants v JOIN products p ON p.id=v.productId WHERE v.id=? AND p.active=1',
      line.variantId,
    );
    if (!v || v.stock < line.quantity)
      throw new AppError(409, 'Una variante no tiene stock suficiente.');
    items.push({ ...v, quantity: line.quantity });
    subtotal += v.price * line.quantity;
  }
  let discount = 0;
  if (data.promotionId) {
    const p = await one<{ percent: number; methodId: string | null }>(
      'SELECT percent,methodId FROM promotions WHERE id=? AND active=1 AND startsAt<=? AND endsAt>=?',
      data.promotionId,
      now().slice(0, 10),
      now().slice(0, 10),
    );
    if (
      !p ||
      (p.methodId && data.payments.some((x) => x.methodId !== p.methodId))
    )
      throw new AppError(
        403,
        'La promoción no está autorizada para este pago.',
      );
    discount = Math.floor((subtotal * p.percent) / 100);
  }
  const base = subtotal - discount;
  if (data.payments.reduce((n, p) => n + p.baseMinor, 0) !== base)
    throw new AppError(
      400,
      'La suma de los pagos debe cubrir el total de la venta.',
    );
  if (
    data.customerId &&
    !(await one('SELECT id FROM customers WHERE id=?', data.customerId))
  )
    throw new AppError(400, 'Cliente inválido.');
  const payments = [];
  for (const p of data.payments) {
    const m = await one<Method>(
      'SELECT id,name,surchargeBps,commissionBps,days,installments FROM payment_methods WHERE id=? AND active=1',
      p.methodId,
    );
    if (!m) throw new AppError(400, 'Medio de pago no disponible.');
    const amount =
      p.baseMinor + Math.floor((p.baseMinor * m.surchargeBps + 5000) / 10000);
    const commission = Math.floor((amount * m.commissionBps + 5000) / 10000);
    if (p.methodId === 'cash' && (p.receivedMinor ?? 0) < amount)
      throw new AppError(400, 'El efectivo recibido es insuficiente.');
    payments.push({
      ...m,
      amount,
      commission,
      net: amount - commission,
      reference: p.reference ?? '',
      change: p.methodId === 'cash' ? (p.receivedMinor ?? 0) - amount : 0,
      dueAt: new Date(Date.now() + m.days * 86400000).toISOString(),
    });
  }
  const total = payments.reduce((n, p) => n + p.amount, 0);
  if (!Number.isSafeInteger(total))
    throw new AppError(400, 'Importe fuera de rango.');
  return { data, items, payments, subtotal, discount, total };
}
export function publicQuote(q: Awaited<ReturnType<typeof quote>>) {
  return {
    subtotal: q.subtotal,
    discount: q.discount,
    total: q.total,
    payments: q.payments.map((p) => ({
      methodId: p.id,
      name: p.name,
      amount: p.amount,
      installments: p.installments,
      change: p.change,
    })),
  };
}
export async function saleDetail(a: Actor, saleId: string) {
  const s = await one<{
    id: string;
    sellerId: string;
    createdAt: string;
    [key: string]: unknown;
  }>(
    'SELECT s.id,s.ticket,s.sellerId,s.createdAt,s.subtotal,s.discount,s.total,s.status,c.name AS customerName,c.surname AS customerSurname,u.name AS sellerName FROM sales s LEFT JOIN customers c ON c.id=s.customerId JOIN users u ON u.id=s.sellerId WHERE s.id=?',
    saleId,
  );
  const recent = Number(
    (
      await one<{ value: string }>(
        'SELECT value FROM settings WHERE key=?',
        'recentDays',
      )
    )?.value || 0,
  );
  if (
    !s ||
    (!can(a, 'sales') &&
      (s.sellerId !== a.id ||
        recent <= 0 ||
        Date.parse(s.createdAt) < Date.now() - recent * 86400000))
  )
    throw new AppError(403, 'Acceso denegado.');
  const items = await rows(
    'SELECT id,variantId,name,color,size,quantity,price,refunded FROM sale_items WHERE saleId=?',
    saleId,
  );
  const payments = await rows(
    'SELECT p.amount,p.reference,m.name FROM payments p JOIN payment_methods m ON m.id=p.methodId WHERE p.saleId=?',
    saleId,
  );
  return { ...s, items, payments };
}
export async function confirmSale(a: Actor, raw: unknown) {
  const data = saleInput.parse(raw);
  const hash = Array.from(
    new Uint8Array(
      await crypto.subtle.digest(
        'SHA-256',
        new TextEncoder().encode(JSON.stringify(data)),
      ),
    ),
  )
    .map((x) => x.toString(16).padStart(2, '0'))
    .join('');
  const previous = await one<{
    id: string;
    requestHash: string;
    sellerId: string;
  }>(
    'SELECT id,requestHash,sellerId FROM sales WHERE idempotencyKey=?',
    data.idempotencyKey,
  );
  if (previous) {
    if (previous.sellerId !== a.id || previous.requestHash !== hash)
      throw new AppError(409, 'La operación ya existe con otros datos.');
    return saleDetail(a, previous.id);
  }
  const { idempotencyKey, ...input } = data;
  const q = await quote(input);
  const session = await one<{ id: string }>(
    'SELECT id FROM cash_sessions WHERE closedAt IS NULL',
  );
  if (!session)
    throw new AppError(
      409,
      'La caja está cerrada. Pedí a un responsable que la abra.',
    );
  const saleId = id(),
    date = now();
  const commands = [
    statement(
      'INSERT INTO sales(id,ticket,sellerId,customerId,subtotal,discount,total,promotionId,idempotencyKey,requestHash,createdAt) VALUES (?,(SELECT COALESCE(MAX(ticket),0)+1 FROM sales),?,?,?,?,?,?,?,?,?)',
      saleId,
      a.id,
      data.customerId,
      q.subtotal,
      q.discount,
      q.total,
      data.promotionId,
      idempotencyKey,
      hash,
      date,
    ),
  ];
  for (const item of q.items)
    commands.push(
      statement(
        'INSERT INTO sale_items(id,saleId,variantId,name,color,size,quantity,price,cost) VALUES (?,?,?,?,?,?,?,?,?)',
        id(),
        saleId,
        item.id,
        item.name,
        item.color,
        item.size,
        item.quantity,
        item.price,
        item.cost,
      ),
    );
  for (const payment of q.payments) {
    commands.push(
      statement(
        'INSERT INTO payments(id,saleId,methodId,amount,commission,net,dueAt,reference) VALUES (?,?,?,?,?,?,?,?)',
        id(),
        saleId,
        payment.id,
        payment.amount,
        payment.commission,
        payment.net,
        payment.dueAt,
        payment.reference,
      ),
    );
    commands.push(
      statement(
        'INSERT INTO cash_movements(id,sessionId,kind,amount,methodId,reference,actorId,createdAt) VALUES (?,?,?,?,?,?,?,?)',
        id(),
        session.id,
        'Venta',
        payment.amount,
        payment.id,
        saleId,
        a.id,
        date,
      ),
    );
  }
  if (data.customerId) {
    const points = Math.floor(q.total / 100000);
    commands.push(
      statement(
        'UPDATE customers SET points=points+? WHERE id=?',
        points,
        data.customerId,
      ),
      statement(
        'INSERT INTO loyalty_transactions(id,customerId,points,reason,reference,createdAt) VALUES (?,?,?,?,?,?)',
        id(),
        data.customerId,
        points,
        'Venta',
        saleId,
        date,
      ),
    );
  }
  commands.push(
    auditStatement(a.id, 'Venta confirmada', saleId, null, { total: q.total }),
  );
  try {
    await db().batch(commands);
  } catch (e) {
    const duplicate = await one<{
      id: string;
      sellerId: string;
      requestHash: string;
    }>(
      'SELECT id,sellerId,requestHash FROM sales WHERE idempotencyKey=?',
      idempotencyKey,
    );
    if (duplicate?.sellerId === a.id && duplicate.requestHash === hash)
      return saleDetail(a, duplicate.id);
    throw e;
  }
  return saleDetail(a, saleId);
}
export async function refundSale(a: Actor, raw: unknown) {
  const v = z
    .object({ saleId: z.string(), reason: z.string().trim().min(5).max(200) })
    .strict()
    .parse(raw);
  const s = await one<{
    id: string;
    total: number;
    customerId: string | null;
    status: string;
  }>('SELECT id,total,customerId,status FROM sales WHERE id=?', v.saleId);
  if (!s || s.status !== 'confirmed')
    throw new AppError(409, 'La venta no admite otra devolución.');
  const session = await one<{ id: string }>(
    'SELECT id FROM cash_sessions WHERE closedAt IS NULL',
  );
  if (!session)
    throw new AppError(409, 'Abrí la caja antes de registrar la devolución.');
  const refundId = id(),
    date = now();
  const commands = [
    statement(
      'INSERT INTO refunds(id,saleId,amount,reason,actorId,createdAt) VALUES (?,?,?,?,?,?)',
      refundId,
      s.id,
      s.total,
      v.reason,
      a.id,
      date,
    ),
    statement("UPDATE sales SET status='refunded' WHERE id=?", s.id),
  ];
  const items = await rows<{ variantId: string; quantity: number }>(
    'SELECT variantId,quantity FROM sale_items WHERE saleId=?',
    s.id,
  );
  for (const i of items)
    commands.push(
      statement(
        'INSERT INTO stock_movements(id,variantId,quantity,before,after,reason,actorId,reference,createdAt) SELECT ?,id,?,stock,stock+?,?,?,?,? FROM variants WHERE id=?',
        id(),
        i.quantity,
        i.quantity,
        'Devolución',
        a.id,
        refundId,
        date,
        i.variantId,
      ),
    );
  commands.push(
    statement('UPDATE sale_items SET refunded=quantity WHERE saleId=?', s.id),
  );
  const payments = await rows<{ methodId: string; amount: number }>(
    'SELECT methodId,amount FROM payments WHERE saleId=?',
    s.id,
  );
  for (const p of payments)
    commands.push(
      statement(
        'INSERT INTO cash_movements(id,sessionId,kind,amount,methodId,reference,actorId,createdAt) VALUES (?,?,?,?,?,?,?,?)',
        id(),
        session.id,
        'Devolución',
        -p.amount,
        p.methodId,
        refundId,
        a.id,
        date,
      ),
    );
  if (s.customerId) {
    const points = Math.floor(s.total / 100000);
    commands.push(
      statement(
        'UPDATE customers SET points=points-? WHERE id=?',
        points,
        s.customerId,
      ),
      statement(
        'INSERT INTO loyalty_transactions(id,customerId,points,reason,reference,createdAt) VALUES (?,?,?,?,?,?)',
        id(),
        s.customerId,
        -points,
        'Devolución',
        refundId,
        date,
      ),
    );
  }
  commands.push(auditStatement(a.id, 'Devolución total', refundId, null, v));
  await db().batch(commands);
  return { ok: true };
}
