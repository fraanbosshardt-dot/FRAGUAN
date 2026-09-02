import {
  sqliteTable as table,
  text,
  integer,
  uniqueIndex,
  index,
  check,
} from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
export const users = table('users', {
  id: text().primaryKey(),
  email: text().notNull().unique(),
  name: text().notNull(),
  role: text().notNull(),
  active: integer().notNull().default(1),
});
export const settings = table('settings', {
  key: text().primaryKey(),
  value: text().notNull(),
});
export const categories = table('categories', {
  id: text().primaryKey(),
  name: text().notNull().unique(),
});
export const brands = table('brands', {
  id: text().primaryKey(),
  name: text().notNull().unique(),
});
export const suppliers = table('suppliers', {
  id: text().primaryKey(),
  name: text().notNull(),
  phone: text().notNull().default(''),
  email: text().notNull().default(''),
  terms: text().notNull().default(''),
  active: integer().notNull().default(1),
});
export const products = table('products', {
  id: text().primaryKey(),
  name: text().notNull(),
  category: text().notNull(),
  brand: text().notNull().default('FRAGUAN'),
  season: text().notNull().default('Esenciales 2026'),
  image: text().notNull().default(''),
  supplierId: text().references(() => suppliers.id),
  active: integer().notNull().default(1),
});
export const variants = table(
  'variants',
  {
    id: text().primaryKey(),
    productId: text()
      .notNull()
      .references(() => products.id),
    sku: text().notNull().unique(),
    barcode: text().notNull().unique(),
    color: text().notNull(),
    size: text().notNull(),
    price: integer().notNull(),
    cost: integer().notNull(),
    stock: integer().notNull().default(0),
    minimum: integer().notNull().default(3),
  },
  (t) => [
    uniqueIndex('variant_combination').on(t.productId, t.color, t.size),
    check('stock_nonnegative', sql`${t.stock} >= 0`),
    check('price_positive', sql`${t.price} > 0`),
    check('cost_nonnegative', sql`${t.cost} >= 0`),
  ],
);
export const customers = table(
  'customers',
  {
    id: text().primaryKey(),
    name: text().notNull(),
    surname: text().notNull(),
    phone: text().notNull(),
    email: text().notNull().default(''),
    birthday: text(),
    points: integer().notNull().default(0),
    createdAt: text().notNull(),
  },
  (t) => [index('customer_phone').on(t.phone)],
);
export const methods = table('payment_methods', {
  id: text().primaryKey(),
  name: text().notNull(),
  surchargeBps: integer().notNull().default(0),
  commissionBps: integer().notNull().default(0),
  days: integer().notNull().default(0),
  installments: integer().notNull().default(1),
  active: integer().notNull().default(1),
});
export const promotions = table(
  'promotions',
  {
    id: text().primaryKey(),
    name: text().notNull(),
    percent: integer().notNull(),
    methodId: text().references(() => methods.id),
    startsAt: text().notNull(),
    endsAt: text().notNull(),
    active: integer().notNull().default(1),
  },
  (t) => [check('promotion_percent', sql`${t.percent} BETWEEN 1 AND 90`)],
);
export const sales = table(
  'sales',
  {
    id: text().primaryKey(),
    ticket: integer().notNull().unique(),
    sellerId: text()
      .notNull()
      .references(() => users.id),
    customerId: text().references(() => customers.id),
    subtotal: integer().notNull(),
    discount: integer().notNull(),
    total: integer().notNull(),
    promotionId: text().references(() => promotions.id),
    status: text().notNull().default('confirmed'),
    idempotencyKey: text().notNull().unique(),
    requestHash: text().notNull(),
    createdAt: text().notNull(),
  },
  (t) => [
    index('sales_seller_date').on(t.sellerId, t.createdAt),
    index('sales_date').on(t.createdAt),
  ],
);
export const saleItems = table(
  'sale_items',
  {
    id: text().primaryKey(),
    saleId: text()
      .notNull()
      .references(() => sales.id),
    variantId: text()
      .notNull()
      .references(() => variants.id),
    name: text().notNull(),
    color: text().notNull(),
    size: text().notNull(),
    quantity: integer().notNull(),
    price: integer().notNull(),
    cost: integer().notNull(),
    refunded: integer().notNull().default(0),
  },
  (t) => [
    check('item_quantity', sql`${t.quantity} > 0`),
    check('refund_quantity', sql`${t.refunded} BETWEEN 0 AND ${t.quantity}`),
    index('sale_items_sale').on(t.saleId),
  ],
);
export const payments = table('payments', {
  id: text().primaryKey(),
  saleId: text()
    .notNull()
    .references(() => sales.id),
  methodId: text()
    .notNull()
    .references(() => methods.id),
  amount: integer().notNull(),
  commission: integer().notNull(),
  net: integer().notNull(),
  dueAt: text().notNull(),
  reference: text().notNull().default(''),
});
export const stockMovements = table(
  'stock_movements',
  {
    id: text().primaryKey(),
    variantId: text()
      .notNull()
      .references(() => variants.id),
    quantity: integer().notNull(),
    before: integer().notNull(),
    after: integer().notNull(),
    reason: text().notNull(),
    actorId: text().notNull(),
    reference: text().notNull().default(''),
    createdAt: text().notNull(),
  },
  (t) => [index('movements_variant_date').on(t.variantId, t.createdAt)],
);
export const cashSessions = table('cash_sessions', {
  id: text().primaryKey(),
  openedBy: text().notNull(),
  opening: integer().notNull(),
  openedAt: text().notNull(),
  closedAt: text(),
  counted: integer(),
  expected: integer(),
  difference: integer(),
});
export const cashMovements = table('cash_movements', {
  id: text().primaryKey(),
  sessionId: text().references(() => cashSessions.id),
  kind: text().notNull(),
  amount: integer().notNull(),
  methodId: text().notNull(),
  reference: text().notNull(),
  actorId: text().notNull(),
  createdAt: text().notNull(),
});
export const loyaltyTransactions = table('loyalty_transactions', {
  id: text().primaryKey(),
  customerId: text()
    .notNull()
    .references(() => customers.id),
  points: integer().notNull(),
  reason: text().notNull(),
  reference: text().notNull(),
  createdAt: text().notNull(),
});
export const expenses = table('expenses', {
  id: text().primaryKey(),
  category: text().notNull(),
  description: text().notNull(),
  amount: integer().notNull(),
  date: text().notNull(),
  methodId: text().notNull(),
  actorId: text().notNull(),
});
export const purchases = table('purchases', {
  id: text().primaryKey(),
  supplierId: text()
    .notNull()
    .references(() => suppliers.id),
  status: text().notNull().default('draft'),
  total: integer().notNull(),
  createdAt: text().notNull(),
  dueAt: text().notNull(),
  actorId: text().notNull(),
});
export const purchaseItems = table('purchase_items', {
  id: text().primaryKey(),
  purchaseId: text()
    .notNull()
    .references(() => purchases.id),
  variantId: text()
    .notNull()
    .references(() => variants.id),
  quantity: integer().notNull(),
  cost: integer().notNull(),
  received: integer().notNull().default(0),
});
export const payables = table('payables', {
  id: text().primaryKey(),
  description: text().notNull(),
  supplierId: text().references(() => suppliers.id),
  amount: integer().notNull(),
  dueAt: text().notNull(),
  kind: text().notNull(),
  status: text().notNull().default('pending'),
  reference: text().notNull().default(''),
});
export const withdrawals = table('withdrawals', {
  id: text().primaryKey(),
  person: text().notNull(),
  amount: integer().notNull(),
  reason: text().notNull(),
  methodId: text().notNull(),
  actorId: text().notNull(),
  createdAt: text().notNull(),
});
export const refunds = table(
  'refunds',
  {
    id: text().primaryKey(),
    saleId: text()
      .notNull()
      .references(() => sales.id),
    amount: integer().notNull(),
    reason: text().notNull(),
    actorId: text().notNull(),
    createdAt: text().notNull(),
  },
  (t) => [uniqueIndex('one_full_refund').on(t.saleId)],
);
export const inventoryCounts = table('inventory_counts', {
  id: text().primaryKey(),
  status: text().notNull().default('draft'),
  actorId: text().notNull(),
  createdAt: text().notNull(),
  approvedAt: text(),
});
export const inventoryCountItems = table('inventory_count_items', {
  id: text().primaryKey(),
  countId: text()
    .notNull()
    .references(() => inventoryCounts.id),
  variantId: text()
    .notNull()
    .references(() => variants.id),
  expected: integer().notNull(),
  counted: integer().notNull(),
});
export const audit = table('audit_log', {
  id: text().primaryKey(),
  actorId: text().notNull(),
  action: text().notNull(),
  entityId: text().notNull(),
  before: text(),
  after: text(),
  createdAt: text().notNull(),
});
