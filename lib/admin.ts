import {
  db,
  id,
  now,
  one,
  rows,
  statement,
  auditStatement,
} from '@/db/queries';
import { Actor, AppError, requirePermission } from './auth';
import { compareDashboardPeriod, dashboardSql } from './dashboard-metrics';
import * as v from './validation';
import { z } from 'zod';
async function cashEntry(
  a: Actor,
  kind: string,
  amount: number,
  method: string,
  reference: string,
) {
  const session = await one<{ id: string }>(
    'SELECT id FROM cash_sessions WHERE closedAt IS NULL',
  );
  if (!session) throw new AppError(409, 'Primero abrí la caja.');
  if (
    !(await one(
      'SELECT id FROM payment_methods WHERE id=? AND active=1',
      method,
    ))
  )
    throw new AppError(400, 'Medio de pago inválido.');
  return statement(
    'INSERT INTO cash_movements(id,sessionId,kind,amount,methodId,reference,actorId,createdAt) VALUES (?,?,?,?,?,?,?,?)',
    id(),
    session.id,
    kind,
    amount,
    method,
    reference,
    a.id,
    now(),
  );
}
export async function adminWrite(resource: string, a: Actor, raw: unknown) {
  requirePermission(a, resource);
  const key = id(),
    date = now();
  let commands: D1PreparedStatement[] = [];
  if (resource === 'products') {
    const x = v.productInput.parse(raw);
    if (x.ideal < x.minimum)
      throw new AppError(400, 'El stock ideal no puede ser menor al mínimo.');
    if (
      x.supplierId &&
      !(await one(
        'SELECT id FROM suppliers WHERE id=? AND active=1',
        x.supplierId,
      ))
    )
      throw new AppError(400, 'Proveedor inválido.');
    commands = [
      statement(
        `INSERT INTO products(id,name,internalCode,category,subcategory,brand,season,
                collection,location,supplierId,updatedAt)
         VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
        key,
        x.name,
        x.internalCode,
        x.category,
        x.subcategory,
        x.brand,
        x.season,
        x.collection,
        x.location,
        x.supplierId || null,
        date,
      ),
      statement(
        `INSERT INTO variants(id,productId,sku,barcode,color,size,price,cost,minimum,
                ideal,entryAt,updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
        `${key}-v`,
        key,
        x.sku,
        x.barcode,
        x.color,
        x.size,
        x.price,
        x.cost,
        x.minimum,
        x.ideal,
        x.entryAt,
        date,
      ),
      statement(
        'INSERT INTO stock_movements(id,variantId,quantity,before,after,reason,actorId,reference,createdAt) VALUES (?,?,?,?,?,?,?,?,?)',
        id(),
        `${key}-v`,
        x.stock,
        0,
        x.stock,
        'Ingreso inicial',
        a.id,
        key,
        date,
      ),
    ];
  } else if (resource === 'stock') {
    const x = z
      .object({
        variantId: v.text,
        quantity: z.number().int().min(-100000).max(100000),
        reason: z.string().trim().min(5).max(200),
      })
      .strict()
      .parse(raw);
    if (!x.quantity)
      throw new AppError(400, 'Ingresá una diferencia distinta de cero.');
    commands = [
      statement(
        'INSERT INTO stock_movements(id,variantId,quantity,before,after,reason,actorId,reference,createdAt) SELECT ?,id,?,stock,stock+?,?,?,?,? FROM variants WHERE id=?',
        key,
        x.quantity,
        x.quantity,
        x.reason,
        a.id,
        key,
        date,
        x.variantId,
      ),
    ];
  } else if (resource === 'suppliers') {
    const x = v.supplierInput.parse(raw);
    commands = [
      statement(
        `INSERT INTO suppliers(id,name,company,contact,phone,whatsapp,email,brands,terms,
                discountBps,paymentDays,notes,updatedAt)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        key,
        x.name,
        x.company,
        x.contact,
        x.phone,
        x.whatsapp,
        x.email,
        x.brands,
        x.terms,
        x.discountBps,
        x.paymentDays,
        x.notes,
        date,
      ),
    ];
  } else if (resource === 'expenses') {
    const x = v.expenseInput.parse(raw);
    commands = [
      statement(
        'INSERT INTO expenses(id,category,description,amount,date,methodId,actorId) VALUES (?,?,?,?,?,?,?)',
        key,
        x.category,
        x.description,
        x.amount,
        x.date,
        x.methodId,
        a.id,
      ),
      await cashEntry(a, 'Gasto', -x.amount, x.methodId, key),
    ];
  } else if (resource === 'withdrawals') {
    const x = v.withdrawalInput.parse(raw);
    commands = [
      statement(
        'INSERT INTO withdrawals(id,person,amount,reason,methodId,actorId,createdAt) VALUES (?,?,?,?,?,?,?)',
        key,
        x.person,
        x.amount,
        x.reason,
        x.methodId,
        a.id,
        date,
      ),
      await cashEntry(a, 'Retiro', -x.amount, x.methodId, key),
    ];
  } else if (resource === 'payables') {
    const x = v.payableInput.parse(raw);
    commands = [
      statement(
        'INSERT INTO payables(id,description,amount,dueAt,kind,supplierId) VALUES (?,?,?,?,?,?)',
        key,
        x.description,
        x.amount,
        x.dueAt,
        x.kind,
        x.supplierId,
      ),
    ];
  } else if (resource === 'purchases') {
    const x = v.purchaseInput.parse(raw);
    const total = x.items.reduce((n, i) => n + i.quantity * i.cost, 0);
    commands = [
      statement(
        'INSERT INTO purchases(id,supplierId,total,createdAt,dueAt,actorId) VALUES (?,?,?,?,?,?)',
        key,
        x.supplierId,
        total,
        date,
        x.dueAt,
        a.id,
      ),
    ];
    for (const i of x.items)
      commands.push(
        statement(
          'INSERT INTO purchase_items(id,purchaseId,variantId,quantity,cost) VALUES (?,?,?,?,?)',
          id(),
          key,
          i.variantId,
          i.quantity,
          i.cost,
        ),
      );
  } else if (resource === 'promotions') {
    const x = v.promotionInput.parse(raw);
    if (x.endsAt < x.startsAt)
      throw new AppError(400, 'Revisá la vigencia de la promoción.');
    const scope = {
      ...(x.category ? { categories: [x.category] } : {}),
      ...(x.brand ? { brands: [x.brand] } : {}),
    };
    const schedule = {
      ...(x.daysOfWeek?.length ? { daysOfWeek: x.daysOfWeek } : {}),
      ...(x.dailyStart && x.dailyEnd
        ? { dailyStart: x.dailyStart, dailyEnd: x.dailyEnd }
        : {}),
      timeZoneOffsetMinutes: -180,
    };
    const conditions = {
      ...(x.couponCode ? { couponCodes: [x.couponCode] } : {}),
      ...(x.customerLevel ? { customerLevels: [x.customerLevel] } : {}),
      ...(x.birthday
        ? {
            birthday: {
              daysBefore: x.birthdayDays,
              daysAfter: x.birthdayDays,
            },
          }
        : {}),
      ...(Object.keys(schedule).length > 1 ? { schedule } : {}),
    };
    const rule = {
      kind: x.kind,
      priority: x.priority,
      exclusive: x.exclusive,
      ...(x.kind === 'percentage' || x.kind === 'second_unit_percentage'
        ? { percentBps: x.percent! * 100 }
        : {}),
      ...(x.kind === 'fixed_amount' ? { amountCents: x.amount! } : {}),
      ...(x.kind === 'two_for_one' || x.kind === 'second_unit_percentage'
        ? { groupBy: x.groupBy }
        : {}),
      ...(Object.keys(scope).length ? { scope } : {}),
      ...(Object.keys(conditions).length ? { conditions } : {}),
    };
    commands = [
      statement(
        'INSERT INTO promotions(id,name,percent,methodId,startsAt,endsAt,ruleJson) VALUES (?,?,?,?,?,?,?)',
        key,
        x.name,
        Math.min(x.percent ?? 1, 90),
        x.methodId,
        x.startsAt,
        x.endsAt,
        JSON.stringify(rule),
      ),
    ];
  } else if (resource === 'users') {
    const x = v.userInput.parse(raw);
    commands = [
      statement(
        'INSERT INTO users(id,email,name,role) VALUES (?,?,?,?)',
        key,
        x.email.toLowerCase(),
        x.name,
        x.role,
      ),
    ];
  } else if (resource === 'inventory') {
    const x = z
      .object({
        items: z
          .array(
            z
              .object({
                variantId: v.text,
                counted: z.number().int().min(0).max(100000),
              })
              .strict(),
          )
          .min(1)
          .max(100),
      })
      .strict()
      .parse(raw);
    if (new Set(x.items.map((i) => i.variantId)).size !== x.items.length)
      throw new AppError(400, 'No repitas variantes.');
    commands = [
      statement(
        'INSERT INTO inventory_counts(id,actorId,createdAt) VALUES (?,?,?)',
        key,
        a.id,
        date,
      ),
    ];
    for (const i of x.items) {
      if (!(await one('SELECT id FROM variants WHERE id=?', i.variantId)))
        throw new AppError(400, 'Variante no encontrada.');
      commands.push(
        statement(
          'INSERT INTO inventory_count_items(id,countId,variantId,expected,counted) SELECT ?,?,id,stock,? FROM variants WHERE id=?',
          id(),
          key,
          i.counted,
          i.variantId,
        ),
      );
    }
  } else throw new AppError(403, 'Acceso denegado.');
  commands.push(auditStatement(a.id, `Crear ${resource}`, key, null, raw));
  await db().batch(commands);
  return { id: key, ok: true };
}
export async function adminAction(a: Actor, raw: unknown) {
  const input = z
    .object({
      action: z.enum([
        'open-cash',
        'close-cash',
        'receive-purchase',
        'pay-payable',
        'approve-count',
        'set-price',
        'disable-user',
        'toggle-promotion',
        'set-recent-days',
      ]),
      id: v.text.optional(),
      amount: v.money.optional(),
      cost: v.money.optional(),
      reason: z.string().max(200).optional(),
      methodId: v.text.optional(),
    })
    .strict()
    .parse(raw);
  let commands: D1PreparedStatement[] = [];
  const date = now(),
    key = id();
  if (input.action === 'open-cash') {
    requirePermission(a, 'cash');
    commands = [
      statement(
        'INSERT INTO cash_sessions(id,openedBy,opening,openedAt) VALUES (?,?,?,?)',
        key,
        a.id,
        v.money.parse(input.amount),
        date,
      ),
    ];
  } else if (input.action === 'close-cash') {
    requirePermission(a, 'cash');
    const session = await one<{ id: string; opening: number }>(
      'SELECT id,opening FROM cash_sessions WHERE closedAt IS NULL',
    );
    if (!session) throw new AppError(409, 'No hay una caja abierta.');
    const counted = v.money.parse(input.amount);
    commands = [
      statement(
        "UPDATE cash_sessions SET closedAt=?,counted=?,expected=opening+(SELECT COALESCE(SUM(amount),0) FROM cash_movements WHERE sessionId=? AND methodId='cash'),difference=?-opening-(SELECT COALESCE(SUM(amount),0) FROM cash_movements WHERE sessionId=? AND methodId='cash') WHERE id=? AND closedAt IS NULL",
        date,
        counted,
        session.id,
        counted,
        session.id,
        session.id,
      ),
    ];
  } else if (input.action === 'receive-purchase') {
    requirePermission(a, 'purchases');
    const p = await one<{
      id: string;
      supplierId: string;
      total: number;
      dueAt: string;
      status: string;
    }>(
      'SELECT id,supplierId,total,dueAt,status FROM purchases WHERE id=?',
      input.id,
    );
    if (!p || p.status !== 'draft')
      throw new AppError(409, 'La compra ya fue recibida.');
    commands = [
      statement("UPDATE purchases SET status='received' WHERE id=?", p.id),
      statement(
        'INSERT INTO payables(id,description,supplierId,amount,dueAt,kind,reference) VALUES (?,?,?,?,?,?,?)',
        key,
        'Compra recibida',
        p.supplierId,
        p.total,
        p.dueAt,
        'Proveedor',
        p.id,
      ),
    ];
    for (const item of await rows<{
      variantId: string;
      quantity: number;
      cost: number;
    }>(
      'SELECT variantId,quantity,cost FROM purchase_items WHERE purchaseId=?',
      p.id,
    )) {
      commands.push(
        statement(
          'INSERT INTO stock_movements(id,variantId,quantity,before,after,reason,actorId,reference,createdAt) SELECT ?,id,?,stock,stock+?,?,?,?,? FROM variants WHERE id=?',
          id(),
          item.quantity,
          item.quantity,
          'Compra recibida',
          a.id,
          p.id,
          date,
          item.variantId,
        ),
        statement(
          'UPDATE variants SET cost=? WHERE id=?',
          item.cost,
          item.variantId,
        ),
      );
    }
    commands.push(
      statement(
        'UPDATE purchase_items SET received=quantity WHERE purchaseId=?',
        p.id,
      ),
    );
  } else if (input.action === 'pay-payable') {
    requirePermission(a, 'payables');
    if (
      await one(
        "SELECT id FROM checks WHERE payableId=? AND status IN ('issued','deposited')",
        input.id,
      )
    )
      throw new AppError(
        409,
        'Esta cuenta tiene un cheque pendiente. Registrá su débito o cancelación en Bancos y cheques.',
      );
    const p = await one<{ id: string; amount: number; status: string }>(
      'SELECT id,amount,status FROM payables WHERE id=?',
      input.id,
    );
    if (!p || p.status !== 'pending')
      throw new AppError(409, 'La cuenta ya fue pagada.');
    commands = [
      statement("UPDATE payables SET status='paid' WHERE id=?", p.id),
      await cashEntry(
        a,
        'Pago de cuenta',
        -p.amount,
        v.text.parse(input.methodId),
        p.id,
      ),
    ];
  } else if (input.action === 'approve-count') {
    requirePermission(a, 'inventory');
    const c = await one<{ status: string }>(
      'SELECT status FROM inventory_counts WHERE id=?',
      input.id,
    );
    if (!c || c.status !== 'draft')
      throw new AppError(409, 'El conteo ya fue aprobado.');
    commands = [
      statement(
        "UPDATE inventory_counts SET status='approved',approvedAt=? WHERE id=?",
        date,
        input.id,
      ),
    ];
    commands.push(
      statement(
        `INSERT INTO stock_movements(id,variantId,quantity,before,after,reason,actorId,reference,createdAt)
         SELECT lower(hex(randomblob(16))),variantId,counted-expected,expected,counted,'Inventario aprobado',?,?,?
         FROM inventory_count_items WHERE countId=?`,
        a.id,
        input.id,
        date,
        input.id,
      ),
    );
  } else if (input.action === 'set-price') {
    requirePermission(a, 'products');
    if (a.role === 'STOCK') throw new AppError(403, 'Acceso denegado.');
    const amount = v.positiveMoney.parse(input.amount),
      cost = v.money.parse(input.cost);
    const before = await one(
      'SELECT price,cost FROM variants WHERE id=?',
      input.id,
    );
    if (!before) throw new AppError(404, 'Variante no encontrada.');
    commands = [
      statement(
        'UPDATE variants SET price=?,cost=? WHERE id=?',
        amount,
        cost,
        input.id,
      ),
      auditStatement(a.id, 'Precio anterior', input.id!, before, {
        price: amount,
        cost,
      }),
    ];
  } else if (input.action === 'disable-user') {
    requirePermission(a, 'users');
    if (input.id === a.id)
      throw new AppError(400, 'No podés desactivar tu propia cuenta.');
    commands = [statement('UPDATE users SET active=0 WHERE id=?', input.id)];
  } else if (input.action === 'toggle-promotion') {
    requirePermission(a, 'promotions');
    commands = [
      statement('UPDATE promotions SET active=1-active WHERE id=?', input.id),
    ];
  } else if (input.action === 'set-recent-days') {
    requirePermission(a, 'settings');
    const days = z.number().int().min(1).max(90).parse(input.amount);
    commands = [
      statement(
        'UPDATE settings SET value=? WHERE key=?',
        String(days),
        'recentDays',
      ),
    ];
  }
  commands.push(
    auditStatement(a.id, input.action, input.id ?? key, null, input),
  );
  await db().batch(commands);
  return { ok: true };
}
export async function dashboard() {
  const asOf = now();
  const [
    total,
    monthStats,
    today,
    previousMonth,
    previousDay,
    costs,
    fees,
    expenses,
    inventory,
    trend,
    best,
    byPayment,
    sellers,
  ] = await Promise.all([
    one(dashboardSql.total),
    one(dashboardSql.month, asOf, asOf),
    one(dashboardSql.today, asOf),
    one(dashboardSql.previousMonth, asOf, asOf, asOf, asOf),
    one(dashboardSql.previousDay, asOf),
    one(dashboardSql.costs),
    one(dashboardSql.fees),
    one(dashboardSql.expenses),
    one(dashboardSql.inventory),
    rows(dashboardSql.trend),
    rows(dashboardSql.best),
    rows(dashboardSql.byPayment),
    rows(dashboardSql.sellers),
  ]);
  return {
    total,
    month: monthStats,
    today,
    costs,
    fees,
    expenses,
    inventory,
    trend: trend.reverse(),
    best,
    byPayment,
    sellers,
    comparison: {
      today: compareDashboardPeriod(today, previousDay),
      month: compareDashboardPeriod(monthStats, previousMonth),
    },
  };
}
