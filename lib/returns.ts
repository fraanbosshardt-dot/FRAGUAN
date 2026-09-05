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
import { Actor, AppError, can } from './auth';
import { readCustomerIntelligenceConfig } from './customer-intelligence';

const refundRequest = z
  .object({
    saleId: z.string().min(1),
    reason: z.string().trim().min(5).max(200),
    method: z.enum(['original', 'credit']).default('original'),
    items: z
      .array(
        z
          .object({
            saleItemId: z.string().min(1),
            quantity: z.number().int().min(1).max(100),
          })
          .strict(),
      )
      .max(100)
      .optional(),
    authorizationToken: z.string().uuid().optional(),
  })
  .strict();

type Sale = {
  id: string;
  total: number;
  subtotal: number;
  customerId: string | null;
  status: string;
};
type Item = {
  id: string;
  variantId: string;
  name: string;
  color: string;
  size: string;
  quantity: number;
  refunded: number;
  price: number;
};
const digest = async (value: string) =>
  Array.from(
    new Uint8Array(
      await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)),
    ),
  )
    .map((x) => x.toString(16).padStart(2, '0'))
    .join('');

export async function createRefundAuthorization(actor: Actor, raw: unknown) {
  if (!can(actor, 'refunds')) throw new AppError(403, 'Acceso denegado.');
  const input = z
    .object({
      saleId: z.string().min(1),
      maxAmount: z.number().int().positive().max(100000000000),
    })
    .strict()
    .parse(raw);
  const sale = await one<{ id: string; total: number }>(
    'SELECT id,total FROM sales WHERE id=?',
    input.saleId,
  );
  if (!sale) throw new AppError(404, 'Venta no encontrada.');
  const token = crypto.randomUUID(),
    authorizationId = id(),
    createdAt = now();
  await db().batch([
    statement(
      'INSERT INTO manager_authorizations(id,tokenHash,action,saleId,maxAmount,authorizedBy,expiresAt,createdAt) VALUES (?,?,?,?,?,?,?,?)',
      authorizationId,
      await digest(token),
      'refund',
      sale.id,
      Math.min(input.maxAmount, sale.total),
      actor.id,
      new Date(Date.now() + 10 * 60_000).toISOString(),
      createdAt,
    ),
    auditStatement(actor.id, 'Autorizar devolución', authorizationId, null, {
      saleId: sale.id,
      maxAmount: Math.min(input.maxAmount, sale.total),
      expiresInMinutes: 10,
    }),
  ]);
  return {
    token,
    expiresAt: new Date(Date.now() + 10 * 60_000).toISOString(),
    maxAmount: Math.min(input.maxAmount, sale.total),
  };
}

export async function refundPartial(actor: Actor, raw: unknown) {
  const input = refundRequest.parse(raw),
    sale = await one<Sale>(
      'SELECT id,total,subtotal,customerId,status FROM sales WHERE id=?',
      input.saleId,
    );
  if (!sale || !['confirmed', 'partially_refunded'].includes(sale.status))
    throw new AppError(409, 'La venta no admite otra devolución.');
  const allItems = await rows<Item>(
    'SELECT id,variantId,name,color,size,quantity,refunded,price FROM sale_items WHERE saleId=? ORDER BY rowid',
    sale.id,
  );
  if (!allItems.length) throw new AppError(409, 'La venta no tiene artículos.');
  const requested = new Map(
    input.items?.map((x) => [x.saleItemId, x.quantity]) ??
      allItems
        .filter((x) => x.refunded < x.quantity)
        .map((x) => [x.id, x.quantity - x.refunded]),
  );
  if (!requested.size)
    throw new AppError(409, 'No hay unidades disponibles para devolver.');
  let selectedGross = 0;
  for (const [itemId, quantity] of requested) {
    const line = allItems.find((x) => x.id === itemId);
    if (!line || quantity > line.quantity - line.refunded)
      throw new AppError(409, 'Revisá las cantidades a devolver.');
    selectedGross += line.price * quantity;
  }
  const allAfter = allItems.every(
    (line) => line.refunded + (requested.get(line.id) ?? 0) === line.quantity,
  );
  const previous = Number(
    (
      await one<{ total: number }>(
        'SELECT COALESCE(SUM(amount),0) AS total FROM refunds WHERE saleId=?',
        sale.id,
      )
    )?.total ?? 0,
  );
  const amount = allAfter
    ? sale.total - previous
    : Math.floor((sale.total * selectedGross) / sale.subtotal);
  if (amount <= 0)
    throw new AppError(409, 'El importe a devolver no es válido.');
  let authorizationId: string | null = null;
  if (!can(actor, 'refunds')) {
    if (!input.authorizationToken)
      throw new AppError(
        403,
        'Esta devolución requiere autorización de gerente.',
      );
    const authorization = await one<{ id: string }>(
      'SELECT id FROM manager_authorizations WHERE tokenHash=? AND action=? AND saleId=? AND maxAmount>=? AND usedAt IS NULL AND expiresAt>=?',
      await digest(input.authorizationToken),
      'refund',
      sale.id,
      amount,
      now(),
    );
    if (!authorization)
      throw new AppError(403, 'La autorización no es válida o venció.');
    authorizationId = authorization.id;
  }
  if (input.method === 'credit' && !sale.customerId)
    throw new AppError(
      400,
      'Para emitir saldo a favor primero identificá al cliente.',
    );
  const paymentAllocations: Array<{ methodId: string; amount: number }> = [];
  if (input.method === 'original') {
    const payments = await rows<{ methodId: string; amount: number }>(
      'SELECT methodId,SUM(amount) AS amount FROM payments WHERE saleId=? GROUP BY methodId ORDER BY methodId',
      sale.id,
    );
    let remainingToAllocate = amount;
    for (const payment of payments) {
      const alreadyReturned =
        payment.methodId === 'store_credit'
          ? Number(
              (
                await one<{ total: number }>(
                  "SELECT COALESCE(SUM(creditIssued),0) AS total FROM refunds WHERE saleId=? AND method='original'",
                  sale.id,
                )
              )?.total ?? 0,
            )
          : payment.methodId === 'cashback'
            ? Number(
                (
                  await one<{ total: number }>(
                    'SELECT COALESCE(SUM(amount),0) AS total FROM customer_cashback WHERE saleId=? AND refundId IS NOT NULL',
                    sale.id,
                  )
                )?.total ?? 0,
              )
            : Number(
                (
                  await one<{ total: number }>(
                    "SELECT COALESCE(-SUM(cm.amount),0) AS total FROM cash_movements cm JOIN refunds r ON r.id=cm.reference WHERE r.saleId=? AND cm.kind='Devolución' AND cm.methodId=?",
                    sale.id,
                    payment.methodId,
                  )
                )?.total ?? 0,
              );
      const capacity = Math.max(0, payment.amount - alreadyReturned);
      const proportional = allAfter
        ? capacity
        : Math.floor((amount * payment.amount) / sale.total);
      const part = Math.min(capacity, proportional, remainingToAllocate);
      if (part)
        paymentAllocations.push({ methodId: payment.methodId, amount: part });
      remainingToAllocate -= part;
    }
    if (remainingToAllocate > 0) {
      for (const payment of payments) {
        const allocation = paymentAllocations.find(
          (entry) => entry.methodId === payment.methodId,
        );
        const used = allocation?.amount ?? 0;
        const alreadyReturned =
          payment.methodId === 'store_credit'
            ? Number(
                (
                  await one<{ total: number }>(
                    "SELECT COALESCE(SUM(creditIssued),0) AS total FROM refunds WHERE saleId=? AND method='original'",
                    sale.id,
                  )
                )?.total ?? 0,
              )
            : payment.methodId === 'cashback'
              ? Number(
                  (
                    await one<{ total: number }>(
                      'SELECT COALESCE(SUM(amount),0) AS total FROM customer_cashback WHERE saleId=? AND refundId IS NOT NULL',
                      sale.id,
                    )
                  )?.total ?? 0,
                )
              : Number(
                  (
                    await one<{ total: number }>(
                      "SELECT COALESCE(-SUM(cm.amount),0) AS total FROM cash_movements cm JOIN refunds r ON r.id=cm.reference WHERE r.saleId=? AND cm.kind='Devolución' AND cm.methodId=?",
                      sale.id,
                      payment.methodId,
                    )
                  )?.total ?? 0,
                );
        const extra = Math.min(
          remainingToAllocate,
          Math.max(0, payment.amount - alreadyReturned - used),
        );
        if (extra) {
          if (allocation) allocation.amount += extra;
          else
            paymentAllocations.push({
              methodId: payment.methodId,
              amount: extra,
            });
          remainingToAllocate -= extra;
        }
        if (!remainingToAllocate) break;
      }
    }
    if (remainingToAllocate)
      throw new AppError(
        409,
        'El importe supera los cobros disponibles para reintegrar.',
      );
  }
  const creditIssued =
    input.method === 'credit'
      ? amount
      : paymentAllocations
          .filter((payment) => payment.methodId === 'store_credit')
          .reduce((total, payment) => total + payment.amount, 0);
  const requiresCashSession =
    input.method === 'original' &&
    paymentAllocations.some(
      (payment) => !['store_credit', 'cashback'].includes(payment.methodId),
    );
  const session = requiresCashSession
    ? await one<{ id: string }>(
        'SELECT id FROM cash_sessions WHERE closedAt IS NULL',
      )
    : null;
  if (requiresCashSession && !session)
    throw new AppError(409, 'Abrí la caja antes de registrar el reintegro.');
  const refundId = id(),
    createdAt = now(),
    commands: D1PreparedStatement[] = [];
  if (authorizationId)
    commands.push(
      statement(
        'UPDATE manager_authorizations SET usedAt=? WHERE id=? AND usedAt IS NULL',
        createdAt,
        authorizationId,
      ),
    );
  commands.push(
    statement(
      'INSERT INTO refunds(id,saleId,amount,reason,actorId,method,creditIssued,authorizationId,createdAt) VALUES (?,?,?,?,?,?,?,?,?)',
      refundId,
      sale.id,
      amount,
      input.reason,
      actor.id,
      input.method,
      creditIssued,
      authorizationId,
      createdAt,
    ),
  );
  let allocatedLineAmount = 0;
  const requestedEntries = [...requested.entries()];
  for (let index = 0; index < requestedEntries.length; index++) {
    const [itemId, quantity] = requestedEntries[index];
    const line = allItems.find((x) => x.id === itemId)!;
    const lineAmount =
      index === requestedEntries.length - 1
        ? amount - allocatedLineAmount
        : Math.floor((amount * (line.price * quantity)) / selectedGross);
    allocatedLineAmount += lineAmount;
    commands.push(
      statement(
        'INSERT INTO refund_items(id,refundId,saleItemId,variantId,quantity,amount) VALUES (?,?,?,?,?,?)',
        id(),
        refundId,
        line.id,
        line.variantId,
        quantity,
        lineAmount,
      ),
      statement(
        'UPDATE sale_items SET refunded=refunded+? WHERE id=? AND refunded+?<=quantity',
        quantity,
        line.id,
        quantity,
      ),
      statement(
        'INSERT INTO stock_movements(id,variantId,quantity,before,after,reason,actorId,reference,createdAt) SELECT ?,id,?,stock,stock+?,?,?,?,? FROM variants WHERE id=?',
        id(),
        quantity,
        quantity,
        'Devolución',
        actor.id,
        refundId,
        createdAt,
        line.variantId,
      ),
    );
  }
  commands.push(
    statement(
      'UPDATE sales SET status=? WHERE id=?',
      allAfter ? 'refunded' : 'partially_refunded',
      sale.id,
    ),
  );
  if (input.method === 'credit')
    commands.push(
      statement(
        'INSERT INTO customer_credits(id,customerId,originalSaleId,refundId,amount,balance,expiresAt,createdAt) VALUES (?,?,?,?,?,?,?,?)',
        id(),
        sale.customerId,
        sale.id,
        refundId,
        amount,
        amount,
        new Date(Date.now() + 365 * 86400000).toISOString(),
        createdAt,
      ),
    );
  else {
    for (const payment of paymentAllocations) {
      if (payment.methodId === 'store_credit') {
        if (!sale.customerId)
          throw new AppError(
            409,
            'La venta con saldo a favor no tiene cliente.',
          );
        commands.push(
          statement(
            'INSERT INTO customer_credits(id,customerId,originalSaleId,refundId,amount,balance,expiresAt,createdAt) VALUES (?,?,?,?,?,?,?,?)',
            id(),
            sale.customerId,
            sale.id,
            refundId,
            payment.amount,
            payment.amount,
            new Date(Date.now() + 365 * 86400000).toISOString(),
            createdAt,
          ),
        );
      } else if (payment.methodId === 'cashback') {
        if (!sale.customerId)
          throw new AppError(409, 'La venta con cashback no tiene cliente.');
        const config = await readCustomerIntelligenceConfig();
        commands.push(
          statement(
            'INSERT INTO customer_cashback(id,customerId,saleId,amount,balance,expiresAt,createdAt,refundId) VALUES (?,?,?,?,?,?,?,?)',
            id(),
            sale.customerId,
            sale.id,
            payment.amount,
            payment.amount,
            new Date(
              Date.parse(createdAt) +
                config.loyalty.cashbackExpiryDays * 86400000,
            ).toISOString(),
            createdAt,
            refundId,
          ),
        );
      } else
        commands.push(
          statement(
            'INSERT INTO cash_movements(id,sessionId,kind,amount,methodId,reference,actorId,createdAt) VALUES (?,?,?,?,?,?,?,?)',
            id(),
            session!.id,
            'Devolución',
            -payment.amount,
            payment.methodId,
            refundId,
            actor.id,
            createdAt,
          ),
        );
    }
  }
  if (sale.customerId) {
    const earned = Number(
        (
          await one<{ points: number }>(
            'SELECT COALESCE(SUM(points),0) AS points FROM loyalty_transactions WHERE customerId=? AND reference=? AND points>0',
            sale.customerId,
            sale.id,
          )
        )?.points ?? 0,
      ),
      already = Number(
        (
          await one<{ points: number }>(
            'SELECT COALESCE(-SUM(lt.points),0) AS points FROM loyalty_transactions lt JOIN refunds r ON r.id=lt.reference WHERE r.saleId=? AND lt.points<0',
            sale.id,
          )
        )?.points ?? 0,
      ),
      target = allAfter
        ? earned
        : Math.floor((earned * (previous + amount)) / sale.total),
      reverse = Math.max(0, target - already);
    if (reverse)
      commands.push(
        statement(
          'UPDATE customers SET points=MAX(0,points-?) WHERE id=?',
          reverse,
          sale.customerId,
        ),
        statement(
          'INSERT INTO loyalty_transactions(id,customerId,points,reason,reference,createdAt) VALUES (?,?,?,?,?,?)',
          id(),
          sale.customerId,
          -reverse,
          'Devolución parcial',
          refundId,
          createdAt,
        ),
      );
    const rewards = await rows<{ id: string; amount: number }>(
      "SELECT id,amount FROM customer_cashback WHERE customerId=? AND saleId=? AND refundId IS NULL AND status='active' AND balance>0",
      sale.customerId,
      sale.id,
    );
    for (const reward of rewards) {
      // Reverse only this refund's increment; prior partial refunds already
      // removed their share. Restored payment balances are never earned rewards.
      const previousTarget = Math.floor(
        (reward.amount * previous) / sale.total,
      );
      const target = allAfter
        ? reward.amount
        : Math.floor((reward.amount * (previous + amount)) / sale.total);
      const reverse = Math.max(0, target - previousTarget);
      if (reverse)
        commands.push(
          statement(
            "UPDATE customer_cashback SET balance=MAX(0,balance-?),status=CASE WHEN balance<=? THEN 'used' ELSE 'active' END WHERE id=? AND refundId IS NULL AND status='active'",
            reverse,
            reverse,
            reward.id,
          ),
        );
    }
  }
  commands.push(
    auditStatement(actor.id, 'Devolución parcial', refundId, null, {
      saleId: sale.id,
      amount,
      method: input.method,
      items: [...requested.entries()],
    }),
  );
  await db().batch(commands);
  return {
    ok: true,
    id: refundId,
    amount,
    status: allAfter ? 'refunded' : 'partially_refunded',
    creditIssued,
  };
}
