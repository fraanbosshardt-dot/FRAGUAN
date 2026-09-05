import {
  actor,
  identity,
  can,
  requirePermission,
  protectWrite,
  reply,
  fail,
  AppError,
} from '@/lib/auth';
import {
  one,
  rows,
  statement,
  db,
  id,
  now,
  auditStatement,
} from '@/db/queries';
import { setup } from '@/lib/seed';
import { customerInput } from '@/lib/validation';
import {
  confirmSale,
  quote,
  publicQuote,
  saleDetail,
  priceCart,
} from '@/lib/sales';
import { createRefundAuthorization, refundPartial } from '@/lib/returns';
import { adminWrite, adminAction, dashboard } from '@/lib/admin';
import { z } from 'zod';
import { configureMethod, addVariant } from '@/lib/configuration';
import { getCashFlow } from '@/lib/cashflow';
import {
  getCustomerInsights,
  getCustomerIntelligence,
} from '@/lib/customer-intelligence';
import { getStockReplenishment } from '@/lib/stock-replenishment';
import {
  createPurchaseOrder,
  getPurchaseOrder,
  receivePurchaseOrder,
  transitionPurchaseOrder,
} from '@/lib/purchase-operations';
import { getBusinessReport } from '@/lib/reporting';
import {
  createInstallmentObligation,
  createRecurringExpense,
  getPlannedFinancialCalendar,
  listFinancialPlans,
  materializeFinancialPlan,
  toggleRecurringExpense,
} from '@/lib/financial-planning';
import {
  listAdminCustomers,
  listAdminProducts,
  listAdminSuppliers,
  setMasterRecordActive,
  updateCustomer,
  updateProduct,
  updateSupplier,
  updateVariant,
} from '@/lib/master-data';
import { importProducts, productImportTemplate } from '@/lib/product-import';
export const dynamic = 'force-dynamic';
function promotionRule(value: unknown) {
  if (typeof value !== 'string' || !value) return {} as Record<string, any>;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, any>)
      : {};
  } catch {
    return {} as Record<string, any>;
  }
}
export async function GET(
  req: Request,
  { params }: { params: Promise<{ resource: string }> },
) {
  try {
    const { resource } = await params;
    const url = new URL(req.url);
    if (resource === 'session') {
      const u = await identity();
      const configured = await one(
        'SELECT value FROM settings WHERE key=?',
        'owner',
      );
      if (!configured) return reply({ needsSetup: true, name: u.displayName });
      const a = await actor();
      return reply({
        user: a,
        demo:
          (
            await one<{ value: string }>(
              'SELECT value FROM settings WHERE key=?',
              'demo',
            )
          )?.value === '1',
        permissions: [
          'pos',
          'dashboard',
          'products',
          'stock',
          'replenishment',
          'customers',
          'sales',
          'suppliers',
          'purchases',
          'cash',
          'cash-flow',
          'financial-calendar',
          'expenses',
          'payables',
          'withdrawals',
          'promotions',
          'reports',
          'inventory',
          'insights',
          'customer-intelligence',
          'customer-credits',
          'users',
          'audit',
          'settings',
        ].filter((p) => can(a, p)),
      });
    }
    const a = await actor();
    if (resource === 'catalog') {
      requirePermission(a, 'pos');
      return reply(
        await rows(
          'SELECT v.id,v.productId,p.name,p.category,p.brand,v.sku,v.barcode,v.color,v.size,v.price,v.stock FROM variants v JOIN products p ON p.id=v.productId WHERE p.active=1 ORDER BY p.rowid,v.rowid',
        ),
      );
    }
    if (resource === 'methods') {
      requirePermission(a, 'pos');
      return reply(
        await rows(
          'SELECT id,name,surchargeBps,installments FROM payment_methods WHERE active=1',
        ),
      );
    }
    if (resource === 'offers') {
      requirePermission(a, 'pos');
      const offers = await rows<Record<string, any>>(
        'SELECT id,name,percent,methodId,ruleJson FROM promotions WHERE active=1 AND startsAt<=? AND endsAt>=?',
        now().slice(0, 10),
        now().slice(0, 10),
      );
      return reply(
        offers.map(({ ruleJson, ...offer }) => {
          const rule = promotionRule(ruleJson);
          return {
            ...offer,
            kind: rule.kind ?? 'percentage',
            exclusive: Boolean(rule.exclusive),
          };
        }),
      );
    }
    if (resource === 'customers') {
      requirePermission(a, 'customers');
      const q = url.searchParams.get('q')?.slice(0, 100) ?? '';
      if (a.role === 'VENDEDOR' || a.role === 'CAJA') {
        if (q.length < 2) return reply([]);
        return reply(
          await rows(
            "SELECT id,name,surname,phone FROM customers WHERE active=1 AND (name||' '||surname LIKE ? OR phone LIKE ?) LIMIT 15",
            `%${q}%`,
            `%${q}%`,
          ),
        );
      }
      return reply(await listAdminCustomers(a, q));
    }
    if (resource === 'customer-credits') {
      requirePermission(a, 'customer-credits');
      const customerId = url.searchParams.get('customerId');
      return reply(
        await rows(
          `SELECT cc.id,cc.customerId,c.name AS customerName,c.surname AS customerSurname,
            cc.originalSaleId,cc.amount,cc.balance,cc.status,cc.expiresAt,cc.createdAt
           FROM customer_credits cc JOIN customers c ON c.id=cc.customerId
           WHERE (? IS NULL OR cc.customerId=?) ORDER BY cc.createdAt DESC LIMIT 250`,
          customerId,
          customerId,
        ),
      );
    }
    if (resource === 'customer-credit-balance') {
      requirePermission(a, 'pos');
      const customerId = url.searchParams.get('customerId')?.slice(0, 128);
      if (!customerId) throw new AppError(400, 'Cliente inválido.');
      const credit = await one<{ balance: number }>(
        "SELECT COALESCE(SUM(balance),0) AS balance FROM customer_credits WHERE customerId=? AND status='active' AND balance>0 AND (expiresAt IS NULL OR expiresAt>=?)",
        customerId,
        now(),
      );
      return reply({ balance: Number(credit?.balance ?? 0) });
    }
    if (resource === 'sales') {
      if (!can(a, 'sales') && !can(a, 'own-sales'))
        throw new AppError(403, 'Acceso denegado.');
      if (url.searchParams.has('id'))
        return reply(await saleDetail(a, url.searchParams.get('id')!));
      if (can(a, 'sales'))
        return reply(
          await rows(
            'SELECT s.id,s.ticket,s.total,s.createdAt,s.status,u.name AS sellerName,c.name AS customerName FROM sales s JOIN users u ON u.id=s.sellerId LEFT JOIN customers c ON c.id=s.customerId ORDER BY s.createdAt DESC LIMIT 200',
          ),
        );
      const days = Number(
        (
          await one<{ value: string }>(
            'SELECT value FROM settings WHERE key=?',
            'recentDays',
          )
        )?.value || 0,
      );
      if (!days)
        throw new AppError(403, 'Consulta de ventas recientes deshabilitada.');
      return reply(
        await rows(
          'SELECT id,ticket,total,createdAt,status FROM sales WHERE sellerId=? AND createdAt>=? ORDER BY createdAt DESC LIMIT 50',
          a.id,
          new Date(Date.now() - days * 86400000).toISOString(),
        ),
      );
    }
    if (resource === 'cash-flow') {
      requirePermission(a, 'reports');
      return reply(await getCashFlow());
    }
    if (resource === 'customer-intelligence') {
      const customerId = url.searchParams.get('id');
      return reply(
        customerId
          ? await getCustomerIntelligence(a, customerId)
          : await getCustomerInsights(a),
      );
    }
    if (resource === 'replenishment')
      return reply(await getStockReplenishment(a));
    if (resource === 'financial-calendar') {
      requirePermission(a, 'cash-flow');
      const horizonDays = Number(url.searchParams.get('days') ?? 60);
      return reply(await getPlannedFinancialCalendar(a, horizonDays));
    }
    if (resource === 'financial-plans')
      return reply(await listFinancialPlans(a));
    if (resource === 'product-import-template')
      return reply(await productImportTemplate(a));
    if (resource === 'reports') {
      const today = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Argentina/Buenos_Aires',
      }).format(new Date());
      const optional = (key: string) => url.searchParams.get(key) || undefined;
      return reply(
        await getBusinessReport(a, {
          from: url.searchParams.get('from') ?? `${today.slice(0, 7)}-01`,
          to: url.searchParams.get('to') ?? today,
          sellerId: optional('sellerId'),
          category: optional('category'),
          brand: optional('brand'),
          supplierId: optional('supplierId'),
          methodId: optional('methodId'),
        }),
      );
    }
    requirePermission(a, resource);
    if (['dashboard', 'insights'].includes(resource))
      return reply(await dashboard());
    if (resource === 'products' || resource === 'stock')
      return reply(
        await listAdminProducts(
          a,
          resource === 'products' &&
            url.searchParams.get('includeArchived') === '1',
        ),
      );
    if (resource === 'suppliers')
      return reply(
        await listAdminSuppliers(
          a,
          url.searchParams.get('includeArchived') === '1',
        ),
      );
    if (resource === 'purchases') {
      if (url.searchParams.has('id'))
        return reply(await getPurchaseOrder(a, url.searchParams.get('id')!));
      return reply(
        await rows(
          `SELECT p.id,s.name AS supplier,p.total,p.subtotal,p.discount,p.tax,p.shipping,
                  p.status,p.createdAt,p.dueAt,p.paymentMethod,p.supplierReference,
                  COUNT(pi.id) AS lines,COALESCE(SUM(pi.quantity),0) AS units,
                  COALESCE(SUM(pi.received),0) AS receivedUnits
             FROM purchases p JOIN suppliers s ON s.id=p.supplierId
             LEFT JOIN purchase_items pi ON pi.purchaseId=p.id
            GROUP BY p.id ORDER BY p.createdAt DESC`,
        ),
      );
    }
    if (resource === 'expenses')
      return reply(
        await rows(
          'SELECT id,category,description,amount,date,methodId FROM expenses ORDER BY date DESC',
        ),
      );
    if (resource === 'withdrawals')
      return reply(
        await rows(
          'SELECT id,person,amount,reason,methodId,createdAt FROM withdrawals ORDER BY createdAt DESC',
        ),
      );
    if (resource === 'payables')
      return reply(
        await rows(
          'SELECT p.id,p.description,p.amount,p.dueAt,p.kind,p.status,p.purchaseId,s.name AS supplier FROM payables p LEFT JOIN suppliers s ON s.id=p.supplierId ORDER BY p.dueAt',
        ),
      );
    if (resource === 'promotions') {
      const promotions = await rows<Record<string, any>>(
        'SELECT id,name,percent,methodId,startsAt,endsAt,active,ruleJson FROM promotions ORDER BY startsAt DESC',
      );
      return reply(
        promotions.map(({ ruleJson, ...promotion }) => {
          const rule = promotionRule(ruleJson);
          return {
            ...promotion,
            kind: rule.kind ?? 'percentage',
            amount: rule.amountCents ?? 0,
            percent:
              rule.percentBps === undefined
                ? promotion.percent
                : rule.percentBps / 100,
            scope:
              [
                ...(rule.scope?.categories ?? []),
                ...(rule.scope?.brands ?? []),
              ].join(', ') || 'Toda la tienda',
            condition: rule.conditions?.couponCodes?.length
              ? 'Cupón'
              : rule.conditions?.birthday
                ? 'Cumpleaños'
                : rule.conditions?.customerLevels?.join(', ') ||
                  (promotion.methodId ? 'Medio de pago' : 'Sin condición'),
            priority: rule.priority ?? 0,
            exclusive: Boolean(rule.exclusive),
          };
        }),
      );
    }
    if (resource === 'users')
      return reply(await rows('SELECT id,name,email,role,active FROM users'));
    if (resource === 'audit')
      return reply(
        await rows(
          'SELECT l.id,u.name AS actor,l.action,l.entityId,l.before,l.after,l.createdAt FROM audit_log l LEFT JOIN users u ON u.id=l.actorId ORDER BY l.createdAt DESC LIMIT 200',
        ),
      );
    if (resource === 'inventory')
      return reply(
        await rows(
          'SELECT c.id,c.status,c.createdAt,c.approvedAt,COUNT(i.id) AS variants,SUM(i.counted-i.expected) AS difference FROM inventory_counts c LEFT JOIN inventory_count_items i ON i.countId=c.id GROUP BY c.id ORDER BY c.createdAt DESC',
        ),
      );
    if (resource === 'cash') {
      const session = await one(
        'SELECT id,opening,openedAt,closedAt,counted,expected,difference FROM cash_sessions ORDER BY openedAt DESC LIMIT 1',
      );
      return reply({
        session,
        movements: await rows(
          'SELECT id,kind,amount,methodId,reference,createdAt FROM cash_movements WHERE sessionId=? ORDER BY createdAt DESC',
          session?.id ?? '',
        ),
        balance: await one(
          "SELECT COALESCE(SUM(amount),0) AS amount FROM cash_movements WHERE sessionId=? AND methodId='cash'",
          session?.id ?? '',
        ),
      });
    }
    if (resource === 'settings')
      return reply({
        recentDays: Number(
          (
            await one<{ value: string }>(
              'SELECT value FROM settings WHERE key=?',
              'recentDays',
            )
          )?.value ?? 0,
        ),
        methods: await rows(
          'SELECT id,name,surchargeBps,commissionBps,days,installments FROM payment_methods',
        ),
      });
    throw new AppError(403, 'Acceso denegado.');
  } catch (e) {
    return fail(e);
  }
}
export async function POST(
  req: Request,
  { params }: { params: Promise<{ resource: string }> },
) {
  try {
    protectWrite(req);
    const { resource } = await params;
    const body = await req.json();
    if (resource === 'setup') {
      const x = z.object({ demo: z.boolean() }).strict().parse(body);
      return reply(await setup(x.demo), 201);
    }
    const a = await actor();
    if (resource === 'customers') {
      requirePermission(a, 'customers');
      const x = customerInput.parse(body),
        key = id();
      await db().batch([
        statement(
          'INSERT INTO customers(id,name,surname,phone,createdAt) VALUES (?,?,?,?,?)',
          key,
          x.name,
          x.surname,
          x.phone,
          now(),
        ),
        auditStatement(a.id, 'Crear cliente', key),
      ]);
      return reply({ id: key, ...x }, 201);
    }
    if (resource === 'quote') {
      requirePermission(a, 'pos');
      return reply(publicQuote(await quote(body)));
    }
    if (resource === 'pricing') {
      requirePermission(a, 'pos');
      return reply(await priceCart(body));
    }
    if (resource === 'sales') {
      requirePermission(a, 'pos');
      return reply(await confirmSale(a, body), 201);
    }
    if (resource === 'purchases')
      return reply(await createPurchaseOrder(a, body), 201);
    if (resource === 'purchase-transitions')
      return reply(await transitionPurchaseOrder(a, body));
    if (resource === 'purchase-receipts')
      return reply(await receivePurchaseOrder(a, body));
    if (resource === 'recurring-expenses')
      return reply(await createRecurringExpense(a, body), 201);
    if (resource === 'installment-obligations')
      return reply(await createInstallmentObligation(a, body), 201);
    if (resource === 'materialize-financial')
      return reply(await materializeFinancialPlan(a, body));
    if (resource === 'toggle-recurring')
      return reply(await toggleRecurringExpense(a, body));
    if (resource === 'update-product')
      return reply(await updateProduct(a, body));
    if (resource === 'update-variant')
      return reply(await updateVariant(a, body));
    if (resource === 'update-customer')
      return reply(await updateCustomer(a, body));
    if (resource === 'update-supplier')
      return reply(await updateSupplier(a, body));
    if (resource === 'set-master-active')
      return reply(await setMasterRecordActive(a, body));
    if (resource === 'product-import')
      return reply(await importProducts(a, body));
    if (resource === 'refunds') {
      return reply(await refundPartial(a, body));
    }
    if (resource === 'refund-authorizations')
      return reply(await createRefundAuthorization(a, body), 201);
    if (resource === 'actions') return reply(await adminAction(a, body));
    if (resource === 'configure-method')
      return reply(await configureMethod(a, body));
    if (resource === 'variants') return reply(await addVariant(a, body), 201);
    return reply(await adminWrite(resource, a, body), 201);
  } catch (e) {
    return fail(e);
  }
}
