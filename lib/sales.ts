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
import {
  evaluateCommercialRules,
  type CommercialPromotion,
} from './commercial-rules';
import { calculateLoyaltyLevel } from './customer-intelligence';
type Variant = {
  id: string;
  name: string;
  color: string;
  size: string;
  price: number;
  cost: number;
  stock: number;
  category: string;
  brand: string;
};
type Method = {
  id: string;
  name: string;
  surchargeBps: number;
  commissionBps: number;
  days: number;
  installments: number;
};
type PromotionRow = {
  id: string;
  name: string;
  percent: number;
  methodId: string | null;
  startsAt: string;
  endsAt: string;
  active: number;
  ruleJson: string;
};
function nextDate(date: string) {
  const value = new Date(`${date}T12:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + 1);
  return value.toISOString().slice(0, 10);
}
function commercialPromotion(row: PromotionRow): CommercialPromotion {
  let stored: Record<string, any> = {};
  if (row.ruleJson) {
    try {
      stored = JSON.parse(row.ruleJson);
    } catch {
      throw new AppError(409, `La promoción “${row.name}” debe revisarse.`);
    }
  }
  const conditions = {
    ...(stored.conditions ?? {}),
    ...(row.methodId ? { paymentMethodIds: [row.methodId] } : {}),
    schedule: {
      ...(stored.conditions?.schedule ?? {}),
      startsAt: `${row.startsAt}T00:00:00-03:00`,
      endsAt: `${nextDate(row.endsAt)}T00:00:00-03:00`,
      timeZoneOffsetMinutes: -180,
    },
  };
  const legacy = !row.ruleJson
    ? { kind: 'percentage', percentBps: row.percent * 100 }
    : {};
  return {
    id: row.id,
    name: row.name,
    authorized: true,
    active: row.active === 1,
    ...legacy,
    ...stored,
    conditions,
  } as CommercialPromotion;
}
async function customerCommercialContext(customerId: string | null) {
  if (!customerId) return null;
  const cutoff = new Date(Date.now() - 365 * 86400000).toISOString();
  const customer = await one<{
    birthday: string | null;
    points: number;
    createdAt: string;
    purchases: number;
    spent: number;
  }>(
    `SELECT c.birthday,c.points,c.createdAt,
      COUNT(CASE WHEN s.id IS NOT NULL THEN 1 END) AS purchases,
      COALESCE(SUM(CASE WHEN s.id IS NOT NULL THEN s.total-COALESCE(r.refunded,0) ELSE 0 END),0) AS spent
     FROM customers c
     LEFT JOIN sales s ON s.customerId=c.id AND s.status IN ('confirmed','partially_refunded') AND s.createdAt>=?
     LEFT JOIN (SELECT saleId,SUM(amount) AS refunded FROM refunds GROUP BY saleId) r ON r.saleId=s.id
     WHERE c.id=? GROUP BY c.id`,
    cutoff,
    customerId,
  );
  if (!customer) throw new AppError(400, 'Cliente inválido.');
  return {
    level: calculateLoyaltyLevel({
      createdAt: customer.createdAt,
      firstPurchaseAt: null,
      lastPurchaseAt: null,
      purchaseCount: customer.purchases,
      lifetimeSpendMinor: customer.spent,
      purchasesInSegmentWindow: customer.purchases,
      spendInSegmentWindowMinor: customer.spent,
      purchasesInLoyaltyWindow: customer.purchases,
      spendInLoyaltyWindowMinor: customer.spent,
      points: customer.points,
    }),
    birthDate: customer.birthday ?? undefined,
  };
}
export async function quote(raw: unknown, pricingOnly = false): Promise<any> {
  const data = quoteInput.parse(raw);
  const unique = new Set(data.items.map((x) => x.variantId));
  if (unique.size !== data.items.length)
    throw new AppError(400, 'Agrupá las cantidades por variante.');
  const items = [];
  let subtotal = 0;
  for (const line of data.items) {
    const v = await one<Variant>(
      'SELECT v.id,p.name,p.category,p.brand,v.color,v.size,v.price,v.cost,v.stock FROM variants v JOIN products p ON p.id=v.productId WHERE v.id=? AND p.active=1',
      line.variantId,
    );
    if (!v || v.stock < line.quantity)
      throw new AppError(409, 'Una variante no tiene stock suficiente.');
    items.push({ ...v, quantity: line.quantity });
    subtotal += v.price * line.quantity;
  }
  const requestedPromotionIds = [
    ...(data.promotionId ? [data.promotionId] : []),
    ...(data.promotionIds ?? []),
  ].filter((value, index, values) => values.indexOf(value) === index);
  const activePromotionRows = await rows<PromotionRow>(
    'SELECT id,name,percent,methodId,startsAt,endsAt,active,ruleJson FROM promotions WHERE active=1 AND startsAt<=? AND endsAt>=?',
    now().slice(0, 10),
    now().slice(0, 10),
  );
  const allPromotions = activePromotionRows.map(commercialPromotion);
  const normalizedCoupon = data.couponCode?.trim().toLocaleLowerCase('es-AR');
  const promotions = allPromotions.filter((promotion) => {
    if (requestedPromotionIds.includes(promotion.id)) return true;
    const coupons = promotion.conditions?.couponCodes;
    return Boolean(
      normalizedCoupon &&
      coupons?.some(
        (coupon) => coupon.toLocaleLowerCase('es-AR') === normalizedCoupon,
      ),
    );
  });
  if (
    requestedPromotionIds.some(
      (promotionId) =>
        !promotions.some((promotion) => promotion.id === promotionId),
    )
  )
    throw new AppError(403, 'Una promoción no está autorizada o está vencida.');
  const commercialResult = evaluateCommercialRules({
    items: items.map((item) => ({
      id: item.id,
      category: item.category,
      brand: item.brand,
      unitPriceCents: item.price,
      quantity: item.quantity,
    })),
    promotions,
    context: {
      evaluatedAt: now(),
      timeZoneOffsetMinutes: -180,
      paymentMethodIds: data.payments.map((payment) => payment.methodId),
      couponCode: data.couponCode || undefined,
      customer: await customerCommercialContext(data.customerId),
    },
  });
  const appliedPromotionIds = new Set(
    commercialResult.appliedDiscounts.map((discount) => discount.promotionId),
  );
  if (
    requestedPromotionIds.some(
      (promotionId) => !appliedPromotionIds.has(promotionId),
    )
  )
    throw new AppError(
      403,
      'Una promoción no corresponde a los productos, cliente, horario o pago elegidos.',
    );
  if (data.couponCode && !commercialResult.appliedDiscounts.length)
    throw new AppError(403, 'El cupón no es válido para esta venta.');
  const discount = commercialResult.discountTotalCents;
  const base = subtotal - discount;
  if (pricingOnly)
    return {
      subtotal,
      discount,
      base,
      appliedDiscounts: commercialResult.appliedDiscounts,
    };
  if (data.payments.reduce((n, p) => n + p.baseMinor, 0) !== base)
    throw new AppError(
      400,
      'La suma de los pagos debe cubrir el total de la venta.',
    );
  if (data.payments.some((payment) => payment.methodId === 'store_credit')) {
    if (!data.customerId)
      throw new AppError(400, 'Seleccioná un cliente para usar saldo a favor.');
    const requestedCredit = data.payments
      .filter((payment) => payment.methodId === 'store_credit')
      .reduce((sum, payment) => sum + payment.baseMinor, 0);
    const availableCredit = Number(
      (
        await one<{ balance: number }>(
          "SELECT COALESCE(SUM(balance),0) AS balance FROM customer_credits WHERE customerId=? AND status='active' AND balance>0 AND (expiresAt IS NULL OR expiresAt>=?)",
          data.customerId,
          now(),
        )
      )?.balance ?? 0,
    );
    if (requestedCredit > availableCredit)
      throw new AppError(409, 'El cliente no tiene saldo a favor suficiente.');
  }
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
  return {
    data,
    items,
    payments,
    subtotal,
    discount,
    total,
    appliedDiscounts: commercialResult.appliedDiscounts,
  };
}
const pricingInput = z
  .object({
    items: saleInput.shape.items,
    customerId: saleInput.shape.customerId,
    promotionId: saleInput.shape.promotionId,
    promotionIds: saleInput.shape.promotionIds,
    couponCode: saleInput.shape.couponCode,
    methodIds: z.array(z.string().trim().min(1).max(200)).min(1).max(4),
  })
  .strict();
export async function priceCart(raw: unknown) {
  const data = pricingInput.parse(raw);
  const result = await quote(
    {
      items: data.items,
      customerId: data.customerId,
      promotionId: data.promotionId,
      promotionIds: data.promotionIds,
      couponCode: data.couponCode,
      payments: data.methodIds.map((methodId) => ({
        methodId,
        baseMinor: 1,
      })),
    },
    true,
  );
  return {
    subtotal: result.subtotal,
    discount: result.discount,
    base: result.base,
    appliedDiscounts: result.appliedDiscounts.map((discount: any) => ({
      promotionId: discount.promotionId,
      name: discount.promotionName,
      kind: discount.kind,
      amount: discount.amountCents,
    })),
  };
}
export function publicQuote(q: Awaited<ReturnType<typeof quote>>) {
  return {
    subtotal: q.subtotal,
    discount: q.discount,
    base: q.subtotal - q.discount,
    total: q.total,
    appliedDiscounts: q.appliedDiscounts.map((discount: any) => ({
      promotionId: discount.promotionId,
      name: discount.promotionName,
      kind: discount.kind,
      amount: discount.amountCents,
    })),
    payments: q.payments.map((p: any) => ({
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
      'INSERT INTO sales(id,ticket,sellerId,customerId,subtotal,discount,total,promotionId,couponCode,idempotencyKey,requestHash,createdAt) VALUES (?,(SELECT COALESCE(MAX(ticket),0)+1 FROM sales),?,?,?,?,?,?,?,?,?,?)',
      saleId,
      a.id,
      data.customerId,
      q.subtotal,
      q.discount,
      q.total,
      q.appliedDiscounts[0]?.promotionId ?? null,
      data.couponCode ?? '',
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
  for (const discount of q.appliedDiscounts)
    commands.push(
      statement(
        'INSERT INTO sale_discounts(id,saleId,promotionId,name,kind,amount,createdAt) VALUES (?,?,?,?,?,?,?)',
        id(),
        saleId,
        discount.promotionId,
        discount.promotionName,
        discount.kind,
        discount.amountCents,
        date,
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
    if (payment.id !== 'store_credit')
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
    else {
      let pending = payment.amount;
      const credits = await rows<{ id: string; balance: number }>(
        "SELECT id,balance FROM customer_credits WHERE customerId=? AND status='active' AND balance>0 AND (expiresAt IS NULL OR expiresAt>=?) ORDER BY createdAt,id",
        data.customerId,
        date,
      );
      for (const credit of credits) {
        const used = Math.min(pending, credit.balance);
        if (used > 0)
          commands.push(
            statement(
              'INSERT INTO credit_usages(id,creditId,saleId,amount,createdAt) VALUES (?,?,?,?,?)',
              id(),
              credit.id,
              saleId,
              used,
              date,
            ),
          );
        pending -= used;
        if (!pending) break;
      }
      if (pending)
        throw new AppError(409, 'El saldo a favor cambió. Revisá el cobro.');
    }
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
