import {
  actor,
  identity,
  can,
  requirePermission,
  protectWrite,
  readJsonBody,
  reply,
  fail,
  AppError,
} from '@/lib/auth';
import { forwardStoreApi } from '@/lib/store-api';
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
import { globalSearch } from '@/lib/global-search';
import { listAccess, saveAccess } from '@/lib/access-control';
import { banking, bankingWrite } from '@/lib/banking';
import { clubRewards, clubRewardWrite } from '@/lib/club-rewards';
import { inventoryDetail, editInventory } from '@/lib/inventory';
import { communicationSuggestions } from '@/lib/communications';
import {
  sellerCommissions,
  configureSellerCommission,
} from '@/lib/seller-commissions';
import { supplierHistory } from '@/lib/supplier-history';
import { argentinaDay } from '@/lib/business-date';
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
import {
  configureMethod,
  createMethod,
  setMethodActive,
  addVariant,
} from '@/lib/configuration';
import { consolidatedCashFlow } from '@/lib/consolidated-cashflow';
import {
  getCustomerInsights,
  getCustomerIntelligence,
  readCustomerIntelligenceConfig,
  saveCustomerIntelligenceConfig,
} from '@/lib/customer-intelligence';
import { getStockReplenishment } from '@/lib/stock-replenishment';
import {
  createPurchaseOrder,
  getPurchaseOrder,
  receivePurchaseOrder,
  transitionPurchaseOrder,
} from '@/lib/purchase-operations';
import { getBusinessReport } from '@/lib/reporting';
import { generateChatGPTAnalysis } from '@/lib/chatgpt-analysis';
import {
  getPersonalFinance,
  savePersonalFinance,
} from '@/lib/personal-finance';
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
import {
  adminPinSetCookie,
  createAdminPinToken,
  verifyAdminPin,
  verifyAdminPinRequest,
} from '@/lib/admin-pin';
import {
  clearGlobalRateLimit,
  clearRateLimit,
  enforceGlobalRateLimit,
  enforceRateLimit,
} from '@/lib/rate-limit';
import { storageOverview, storageWrite } from '@/lib/storage';
import {
  createOnlineOrder,
  createOnlineReturnRequest,
  listOnlineOrders,
  listPosOnlineOrders,
  listOnlineCatalog,
  onlineOrderWrite,
  posOnlineOrderWrite,
  onlineCatalogWrite,
  publicOnlineOrder,
  reportTransfer,
  shippingQuote,
  storeAccount,
  storeAccountWrite,
  storeCatalog,
  storeEmailVerification,
  storeProduct,
  quoteOnlineCoupon,
  quoteOnlineCheckout,
} from '@/lib/online-store';
import {
  newsletterOverview,
  sendNewsletterCampaign,
  subscribeNewsletter,
  unsubscribeNewsletter,
} from '@/lib/email';
import {
  moderateReview,
  publicProductReviews,
  recoverCart,
  requestBackInStock,
  runMarketingAutomations,
  storeGrowthDashboard,
  submitProductReview,
  trackStoreEvent,
} from '@/lib/store-growth';
import { env } from 'cloudflare:workers';
import { verifyGoogleIdToken } from '@/lib/google-token';
import { isOpenStaffAccess } from '@/lib/staff-access';
import {
  internalPasswordConfigured,
  verifyInternalPassword,
} from '@/lib/internal-password';
import {
  createInternalSession,
  internalSessionClearCookie,
  internalSessionSetCookie,
  internalSessionsConfigured,
} from '@/lib/internal-session';
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
const posReadResources = new Set([
  'catalog',
  'methods',
  'offers',
  'customer-credit-balance',
  'pos-online-orders',
]);
const posWriteResources = new Set([
  'customers',
  'quote',
  'pricing',
  'sales',
  'pos-online-orders',
  'refunds',
  'refund-authorizations',
]);
function enforcePublicLimit(req: Request, resource: string, body: unknown) {
  const input =
    body && typeof body === 'object'
      ? (body as Record<string, unknown>)
      : ({} as Record<string, unknown>);
  const action =
    typeof input.action === 'string' ? input.action.slice(0, 30) : '';
  const rules: Record<string, readonly [number, number]> = {
    'store-account': [12, 15 * 60_000],
    'store-checkout': [12, 10 * 60_000],
    'store-email-verification': [action === 'request' ? 5 : 12, 10 * 60_000],
    'store-transfer': [12, 60 * 60_000],
    'store-return-request': [6, 60 * 60_000],
    'store-newsletter': [8, 60 * 60_000],
    'store-review': [8, 60 * 60_000],
    'store-back-in-stock': [15, 60 * 60_000],
    'store-event': [180, 60_000],
    'store-shipping': [120, 60_000],
    'store-coupon': [120, 60_000],
    'store-checkout-quote': [120, 60_000],
  };
  const [limit, windowMs] = rules[resource] ?? [60, 60_000];
  enforceRateLimit(req, resource, limit, windowMs, action);
  const accountTarget =
    typeof input.email === 'string'
      ? input.email.trim().toLowerCase().slice(0, 254)
      : '';
  const globallyLimited = new Set([
    'store-account',
    'store-checkout',
    'store-email-verification',
    'store-newsletter',
    'store-back-in-stock',
    'store-review',
  ]);
  if (accountTarget && globallyLimited.has(resource))
    enforceGlobalRateLimit(
      `${resource}-account`,
      `${action}:${accountTarget}`,
      resource === 'store-account' ? 30 : 20,
      resource === 'store-account' ? 15 * 60_000 : 60 * 60_000,
    );
}
async function requireAdminPinForApi(
  req: Request,
  resource: string,
  posResources: Set<string>,
  a: { id: string; role: string },
  url?: URL,
) {
  const posScopedRead =
    req.method === 'GET' &&
    url?.searchParams.get('scope') === 'pos' &&
    (resource === 'customers' || resource === 'sales');
  if (
    ['ADMIN', 'GERENTE'].includes(a.role) &&
    !posResources.has(resource) &&
    !posScopedRead &&
    !(await verifyAdminPinRequest(req, a.id))
  )
    throw new AppError(403, 'Ingresá el PIN de Administración para continuar.');
}
export async function GET(
  req: Request,
  { params }: { params: Promise<{ resource: string }> },
) {
  try {
    const forwarded = await forwardStoreApi(req);
    if (forwarded) return forwarded;
    const { resource } = await params;
    const url = new URL(req.url);
    if (resource === 'store-health') {
      await one('SELECT 1 AS ok');
      return reply({ ok: true });
    }
    if (resource === 'store-order' || resource === 'store-recover-cart')
      enforceRateLimit(req, resource, 120, 60_000);
    if (resource === 'store-catalog')
      return reply(
        await storeCatalog(
          (url.searchParams.get('q') ?? '').slice(0, 100),
          (url.searchParams.get('section') ?? '').slice(0, 80),
        ),
      );
    if (resource === 'store-product')
      return reply(
        await storeProduct((url.searchParams.get('slug') ?? '').slice(0, 160)),
      );
    if (resource === 'store-reviews')
      return reply(
        await publicProductReviews(
          (url.searchParams.get('productId') ?? '').slice(0, 100),
        ),
      );
    if (resource === 'store-recover-cart')
      return reply(await recoverCart(url.searchParams.get('token') ?? ''));
    if (resource === 'store-account') return reply(await storeAccount(req));
    if (resource === 'store-order')
      return reply(
        await publicOnlineOrder(
          req,
          url.searchParams.get('id') ?? '',
          req.headers.get('x-order-token') ?? '',
        ),
      );
    if (resource === 'store-newsletter' && url.searchParams.has('unsubscribe'))
      return reply(
        await unsubscribeNewsletter(url.searchParams.get('unsubscribe') ?? ''),
      );
    if (resource === 'session') {
      const u = await identity();
      const configured = await one(
        'SELECT value FROM settings WHERE key=?',
        'owner',
      );
      if (!configured) return reply({ needsSetup: true, name: u.displayName });
      const a = await actor();
      return reply({
        openAccess: isOpenStaffAccess(),
        user: {
          id: a.id,
          email: a.email,
          name: a.name,
          role: a.role,
          active: a.active,
        },
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
          'storage',
          'replenishment',
          'customers',
          'sales',
          'suppliers',
          'purchases',
          'cash',
          'cash-flow',
          'personal-finance',
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
          'access',
          'banking',
          'club-rewards',
          'communications',
          'newsletter',
          'seller-commissions',
          'online-orders',
          'pos-online-orders',
          'online-catalog',
          'marketing',
        ].filter((p) => can(a, p)),
      });
    }
    const a = await actor();
    await requireAdminPinForApi(req, resource, posReadResources, a, url);
    if (resource === 'global-search')
      return reply(await globalSearch(a, url.searchParams.get('q') ?? ''));
    if (resource === 'access') return reply(await listAccess(a));
    if (resource === 'storage') return reply(await storageOverview(a));
    if (resource === 'online-orders')
      return reply(await listOnlineOrders(a, url.searchParams.get('id') ?? ''));
    if (resource === 'pos-online-orders')
      return reply(
        await listPosOnlineOrders(a, url.searchParams.get('id') ?? ''),
      );
    if (resource === 'online-catalog') return reply(await listOnlineCatalog(a));
    if (resource === 'newsletter') return reply(await newsletterOverview(a));
    if (resource === 'marketing') return reply(await storeGrowthDashboard(a));
    if (resource === 'communications')
      return reply(await communicationSuggestions(a));
    if (resource === 'supplier-history')
      return reply(await supplierHistory(a, url.searchParams.get('id') ?? ''));
    if (resource === 'seller-commissions') {
      const today = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Argentina/Cordoba',
      }).format(new Date());
      return reply(
        await sellerCommissions(
          a,
          url.searchParams.get('from') ?? `${today.slice(0, 7)}-01`,
          url.searchParams.get('to') ?? today,
        ),
      );
    }
    if (resource === 'inventory' && url.searchParams.has('id'))
      return reply(await inventoryDetail(a, url.searchParams.get('id')!));
    if (resource === 'banking') return reply(await banking(a));
    if (resource === 'club-rewards') return reply(await clubRewards(a));
    if (resource === 'catalog') {
      requirePermission(a, 'pos');
      return reply(
        await rows(
          'SELECT v.id,v.productId,p.name,p.category,p.brand,v.sku,v.barcode,v.color,v.size,v.price,v.stock FROM variants v JOIN products p ON p.id=v.productId WHERE p.active=1 ORDER BY p.name,p.id,v.sku',
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
        argentinaDay(),
        argentinaDay(),
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
      if (
        url.searchParams.get('scope') === 'pos' ||
        a.role === 'VENDEDOR' ||
        a.role === 'CAJA'
      ) {
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
      const cashback = await one<{ balance: number }>(
        "SELECT COALESCE(SUM(balance),0) AS balance FROM customer_cashback WHERE customerId=? AND status='active' AND balance>0 AND (expiresAt IS NULL OR expiresAt>=?)",
        customerId,
        now(),
      );
      return reply({
        balance: Number(credit?.balance ?? 0),
        cashbackBalance: Number(cashback?.balance ?? 0),
      });
    }
    if (resource === 'customer-cashback') {
      requirePermission(a, 'customer-intelligence');
      const customerId = url.searchParams.get('customerId');
      return reply(
        await rows(
          `SELECT cb.id,cb.customerId,c.name AS customerName,c.surname AS customerSurname,
            cb.saleId,s.ticket,cb.refundId,cb.amount,cb.balance,
            CASE WHEN cb.status='active' AND cb.expiresAt IS NOT NULL AND cb.expiresAt<?
              THEN 'expired' ELSE cb.status END AS status,cb.expiresAt,cb.createdAt
           FROM customer_cashback cb JOIN customers c ON c.id=cb.customerId
           JOIN sales s ON s.id=cb.saleId
           WHERE (? IS NULL OR cb.customerId=?)
           ORDER BY cb.createdAt DESC,cb.rowid DESC LIMIT 250`,
          now(),
          customerId,
          customerId,
        ),
      );
    }
    if (resource === 'sales') {
      if (!can(a, 'sales') && !can(a, 'own-sales'))
        throw new AppError(403, 'Acceso denegado.');
      const posScope = url.searchParams.get('scope') === 'pos';
      if (url.searchParams.has('id')) {
        const saleId = url.searchParams.get('id')!.slice(0, 128);
        if (posScope) {
          const ownSale = await one<{ id: string }>(
            'SELECT id FROM sales WHERE id=? AND sellerId=?',
            saleId,
            a.id,
          );
          if (!ownSale) throw new AppError(403, 'Acceso denegado.');
        }
        return reply(await saleDetail(a, saleId));
      }
      if (posScope && url.searchParams.get('today') === '1') {
        const day = new Date(Date.now() - 3 * 3600000)
          .toISOString()
          .slice(0, 10);
        const from = day + 'T03:00:00.000Z',
          to = new Date(Date.parse(from) + 86400000).toISOString();
        const sales = await rows(
          'SELECT id,ticket,total,createdAt,status FROM sales WHERE sellerId=? AND createdAt>=? AND createdAt<? ORDER BY createdAt DESC',
          a.id,
          from,
          to,
        );
        const payments = await rows(
          'SELECT m.name,SUM(p.amount) AS amount FROM payments p JOIN sales s ON s.id=p.saleId JOIN payment_methods m ON m.id=p.methodId WHERE s.sellerId=? AND s.createdAt>=? AND s.createdAt<? GROUP BY m.name',
          a.id,
          from,
          to,
        );
        return reply({ sales, payments });
      }
      if (posScope) {
        const days = Number(
          (
            await one<{ value: string }>(
              'SELECT value FROM settings WHERE key=?',
              'recentDays',
            )
          )?.value || 0,
        );
        if (!days)
          throw new AppError(
            403,
            'Consulta de ventas recientes deshabilitada.',
          );
        return reply(
          await rows(
            'SELECT id,ticket,total,createdAt,status FROM sales WHERE sellerId=? AND createdAt>=? ORDER BY createdAt DESC LIMIT 50',
            a.id,
            new Date(Date.now() - days * 86400000).toISOString(),
          ),
        );
      }
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
      requirePermission(a, 'cash-flow');
      return reply(await consolidatedCashFlow());
    }
    if (resource === 'personal-finance')
      return reply(await getPersonalFinance(a));
    if (resource === 'customer-intelligence') {
      requirePermission(a, 'customer-intelligence');
      const customerId = url.searchParams.get('id');
      const config = await readCustomerIntelligenceConfig();
      return reply(
        customerId
          ? await getCustomerIntelligence(a, customerId, { config })
          : await getCustomerInsights(a, { config }),
      );
    }
    if (resource === 'customer-intelligence-config') {
      requirePermission(a, 'customer-intelligence');
      return reply(await readCustomerIntelligenceConfig());
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
        timeZone: 'America/Argentina/Cordoba',
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
    if (resource === 'stock-movements') {
      requirePermission(a, 'stock');
      return reply(
        await rows(
          `SELECT m.id,m.createdAt,p.name,v.sku,v.color,v.size,m.quantity,m.before,m.after,
                m.reason,m.notes,m.reference,u.name AS actor,l.name AS location
           FROM stock_movements m JOIN variants v ON v.id=m.variantId
           JOIN products p ON p.id=v.productId JOIN users u ON u.id=m.actorId
           LEFT JOIN stock_locations l ON l.id=m.locationId
          ORDER BY m.createdAt DESC LIMIT 1000`,
        ),
      );
    }
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
                  COALESCE(pa.status,'not_registered') AS paymentStatus,
                  CASE WHEN p.status='received' AND pa.status='paid' THEN 'paid' ELSE p.status END AS completionStatus,
                  COUNT(pi.id) AS lines,COALESCE(SUM(pi.quantity),0) AS units,
                  COALESCE(SUM(pi.received),0) AS receivedUnits
             FROM purchases p JOIN suppliers s ON s.id=p.supplierId
             LEFT JOIN purchase_items pi ON pi.purchaseId=p.id
             LEFT JOIN payables pa ON pa.purchaseId=p.id
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
          'SELECT id,name,surchargeBps,commissionBps,days,installments,active FROM payment_methods',
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
    const forwarded = await forwardStoreApi(req);
    if (forwarded) return forwarded;
    const { resource } = await params;
    const publicResource = resource.startsWith('store-');
    const maxBytes = publicResource ? 32768 : 100000;
    protectWrite(req, maxBytes);
    const body = await readJsonBody(req, maxBytes);
    if (publicResource) enforcePublicLimit(req, resource, body);
    if (resource === 'store-account') {
      const result = await storeAccountWrite(req, body);
      const response = reply(result.data, 201);
      if (result.cookie) response.headers.append('Set-Cookie', result.cookie);
      return response;
    }
    if (resource === 'store-checkout')
      return reply(await createOnlineOrder(req, body), 201);
    if (resource === 'store-email-verification')
      return reply(await storeEmailVerification(req, body));
    if (resource === 'store-transfer')
      return reply(await reportTransfer(req, body));
    if (resource === 'store-return-request')
      return reply(await createOnlineReturnRequest(body), 201);
    if (resource === 'store-newsletter')
      return reply(await subscribeNewsletter(body), 201);
    if (resource === 'store-event')
      return reply(await trackStoreEvent(req, body), 201);
    if (resource === 'store-back-in-stock')
      return reply(await requestBackInStock(req, body), 201);
    if (resource === 'store-review')
      return reply(await submitProductReview(req, body), 201);
    if (resource === 'store-shipping') {
      const input = z
        .object({
          postalCode: z
            .string()
            .trim()
            .regex(/^\d{4}$/),
          subtotal: z.number().int().nonnegative().max(100000000000),
          method: z.enum(['correo-argentino-home', 'pickup']),
        })
        .strict()
        .parse(body);
      return reply(
        await shippingQuote(input.postalCode, input.subtotal, input.method),
      );
    }
    if (resource === 'store-coupon')
      return reply(await quoteOnlineCoupon(body));
    if (resource === 'store-checkout-quote')
      return reply(await quoteOnlineCheckout(body));
    if (resource === 'internal-auth') {
      const secure = new URL(req.url).protocol === 'https:';
      const input = z
        .object({
          action: z.enum(['google', 'password', 'logout']),
          credential: z.string().min(100).max(10000).optional(),
          email: z.email().max(254).optional(),
          password: z.string().min(12).max(128).optional(),
        })
        .strict()
        .parse(body);
      if (input.action === 'logout') {
        const response = reply({ ok: true });
        response.headers.append(
          'Set-Cookie',
          internalSessionClearCookie(secure),
        );
        response.headers.append(
          'Set-Cookie',
          `fraguan_admin_access=; Path=/; Max-Age=0; HttpOnly; SameSite=Strict${secure ? '; Secure' : ''}`,
        );
        return response;
      }
      if (input.action === 'password') {
        enforceRateLimit(req, 'internal-password-login', 8, 15 * 60_000);
        const email = input.email?.toLowerCase() ?? '';
        enforceGlobalRateLimit(
          'internal-password-account',
          email,
          20,
          15 * 60_000,
        );
        if (!internalPasswordConfigured() || !internalSessionsConfigured())
          throw new AppError(
            503,
            'El acceso del personal todavía no está configurado.',
          );
        const passwordValid = await verifyInternalPassword(
          input.password ?? '',
        );
        if (!passwordValid)
          throw new AppError(401, 'Email o contraseña incorrectos.');
        const owner = await one<{ value: string }>(
          'SELECT value FROM settings WHERE key=?',
          'owner',
        );
        const user = await one<{
          id: string;
          email: string;
          name: string;
          role: string;
          active: number;
        }>('SELECT id,email,name,role,active FROM users WHERE email=?', email);
        if (
          !owner ||
          owner.value.toLowerCase() !== email ||
          !user?.active ||
          user.role !== 'ADMIN'
        )
          throw new AppError(401, 'Email o contraseña incorrectos.');
        const token = await createInternalSession({
          userId: user.id,
          email: user.email,
          displayName: user.name,
          fullName: user.name,
        });
        clearGlobalRateLimit('internal-password-account', email);
        clearRateLimit(req, 'internal-password-login');
        const response = reply({ ok: true });
        response.headers.append(
          'Set-Cookie',
          internalSessionSetCookie(token, secure),
        );
        return response;
      }
      enforceRateLimit(req, 'internal-google-login', 10, 15 * 60_000);
      const runtime = env as unknown as Record<string, string | undefined>;
      const clientId = runtime.INTERNAL_GOOGLE_CLIENT_ID?.trim() ?? '';
      if (!clientId || !internalSessionsConfigured())
        throw new AppError(
          503,
          'El acceso interno con Google todavía no está configurado.',
        );
      const profile = input.credential
        ? await verifyGoogleIdToken(input.credential, clientId)
        : null;
      if (!profile)
        throw new AppError(401, 'No pudimos validar tu cuenta de Google.');
      enforceGlobalRateLimit(
        'internal-google-account',
        profile.email,
        20,
        15 * 60_000,
      );
      const internalUser = await one<{
        id: string;
        email: string;
        name: string;
        active: number;
      }>('SELECT id,email,name,active FROM users WHERE email=?', profile.email);
      const owner = await one<{ value: string }>(
        'SELECT value FROM settings WHERE key=?',
        'owner',
      );
      const bootstrapAllowed =
        !owner &&
        runtime.BOOTSTRAP_OWNER_EMAIL?.trim().toLowerCase() === profile.email;
      if (
        (!internalUser?.active && !bootstrapAllowed) ||
        internalUser?.active === 0
      )
        throw new AppError(
          403,
          'Esta cuenta no está habilitada para el sistema interno de FRAGUAN.',
        );
      const token = await createInternalSession({
        userId: profile.sub,
        email: profile.email,
        displayName: internalUser?.name || profile.name,
        fullName:
          internalUser?.name || `${profile.name} ${profile.surname}`.trim(),
      });
      clearGlobalRateLimit('internal-google-account', profile.email);
      const response = reply({ ok: true });
      response.headers.append(
        'Set-Cookie',
        internalSessionSetCookie(token, secure),
      );
      return response;
    }
    if (resource === 'setup') {
      const x = z.object({ demo: z.boolean() }).strict().parse(body);
      return reply(await setup(x.demo), 201);
    }
    if (resource === 'admin-pin') {
      const a = await actor();
      requirePermission(a, 'dashboard');
      enforceRateLimit(req, 'admin-pin', 8, 15 * 60_000, a.id);
      enforceGlobalRateLimit('admin-pin-account', a.id, 20, 15 * 60_000);
      const x = z
        .object({ pin: z.string().regex(/^\d{6}$/) })
        .strict()
        .parse(body);
      if (!(await verifyAdminPin(x.pin)))
        throw new AppError(403, 'PIN incorrecto.');
      clearRateLimit(req, 'admin-pin', a.id);
      clearGlobalRateLimit('admin-pin-account', a.id);
      const response = reply({ ok: true });
      response.headers.append(
        'Set-Cookie',
        adminPinSetCookie(
          await createAdminPinToken(a.id),
          new URL(req.url).protocol === 'https:',
        ),
      );
      return response;
    }
    const a = await actor();
    await requireAdminPinForApi(req, resource, posWriteResources, a);
    if (resource === 'chatgpt-analysis')
      return reply(await generateChatGPTAnalysis(a, body));
    if (resource === 'personal-finance')
      return reply(await savePersonalFinance(a, body));
    if (resource === 'storage') return reply(await storageWrite(a, body), 201);
    if (resource === 'online-orders')
      return reply(await onlineOrderWrite(a, body));
    if (resource === 'pos-online-orders')
      return reply(await posOnlineOrderWrite(a, body));
    if (resource === 'online-catalog')
      return reply(await onlineCatalogWrite(a, body));
    if (resource === 'newsletter')
      return reply(await sendNewsletterCampaign(a, body));
    if (resource === 'marketing') {
      const action = z
        .object({
          action: z.enum(['run-automations', 'moderate-review']),
          reviewId: z.string().optional(),
          status: z.enum(['published', 'rejected']).optional(),
        })
        .parse(body);
      return reply(
        action.action === 'run-automations'
          ? await runMarketingAutomations(a)
          : await moderateReview(a, {
              reviewId: action.reviewId,
              status: action.status,
            }),
      );
    }
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
    if (resource === 'customer-intelligence-config')
      return reply(await saveCustomerIntelligenceConfig(a, body));
    if (resource === 'refunds') {
      return reply(await refundPartial(a, body));
    }
    if (resource === 'refund-authorizations')
      return reply(await createRefundAuthorization(a, body), 201);
    if (resource === 'actions') return reply(await adminAction(a, body));
    if (resource === 'create-method')
      return reply(await createMethod(a, body), 201);
    if (resource === 'set-method-active')
      return reply(await setMethodActive(a, body));
    if (resource === 'configure-method')
      return reply(await configureMethod(a, body));
    if (resource === 'access') return reply(await saveAccess(a, body));
    if (resource === 'seller-commissions')
      return reply(await configureSellerCommission(a, body));
    if (resource === 'inventory-edit')
      return reply(await editInventory(a, body));
    if (resource === 'banking') return reply(await bankingWrite(a, body));
    if (resource === 'club-rewards')
      return reply(await clubRewardWrite(a, body));
    if (resource === 'variants') return reply(await addVariant(a, body), 201);
    return reply(await adminWrite(resource, a, body), 201);
  } catch (e) {
    return fail(e);
  }
}
