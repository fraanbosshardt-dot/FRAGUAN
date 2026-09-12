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
  company: text().notNull().default(''),
  contact: text().notNull().default(''),
  phone: text().notNull().default(''),
  whatsapp: text().notNull().default(''),
  email: text().notNull().default(''),
  brands: text().notNull().default(''),
  terms: text().notNull().default(''),
  discountBps: integer().notNull().default(0),
  paymentDays: integer().notNull().default(0),
  notes: text().notNull().default(''),
  active: integer().notNull().default(1),
  updatedAt: text(),
  archivedAt: text(),
});
export const products = table('products', {
  id: text().primaryKey(),
  name: text().notNull(),
  internalCode: text().notNull().default(''),
  category: text().notNull(),
  subcategory: text().notNull().default(''),
  brand: text().notNull().default('FRAGUAN'),
  season: text().notNull().default('Esenciales 2026'),
  collection: text().notNull().default(''),
  location: text().notNull().default(''),
  supplierId: text().references(() => suppliers.id),
  active: integer().notNull().default(1),
  updatedAt: text(),
  archivedAt: text(),
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
    onlinePrice: integer(),
    cost: integer().notNull(),
    stock: integer().notNull().default(0),
    minimum: integer().notNull().default(3),
    ideal: integer().notNull().default(6),
    entryAt: text().notNull().default(''),
    updatedAt: text(),
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
    whatsapp: text().notNull().default(''),
    locality: text().notNull().default(''),
    usualSizes: text().notNull().default(''),
    notes: text().notNull().default(''),
    points: integer().notNull().default(0),
    active: integer().notNull().default(1),
    createdAt: text().notNull(),
    updatedAt: text(),
    archivedAt: text(),
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
    ruleJson: text().notNull().default(''),
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
    couponCode: text().notNull().default(''),
    channel: text().notNull().default('pos'),
    onlineOrderId: text(),
    createdAt: text().notNull(),
  },
  (t) => [
    index('sales_seller_date').on(t.sellerId, t.createdAt),
    index('sales_date').on(t.createdAt),
  ],
);
export const saleDiscounts = table(
  'sale_discounts',
  {
    id: text().primaryKey(),
    saleId: text()
      .notNull()
      .references(() => sales.id),
    promotionId: text()
      .notNull()
      .references(() => promotions.id),
    name: text().notNull(),
    kind: text().notNull(),
    amount: integer().notNull(),
    createdAt: text().notNull(),
  },
  (t) => [
    uniqueIndex('sale_discount_once').on(t.saleId, t.promotionId),
    index('sale_discounts_promotion').on(t.promotionId, t.createdAt),
    check('sale_discount_positive', sql`${t.amount} > 0`),
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
    notes: text().notNull().default(''),
    locationId: text(),
    actorId: text().notNull(),
    reference: text().notNull().default(''),
    createdAt: text().notNull(),
  },
  (t) => [index('movements_variant_date').on(t.variantId, t.createdAt)],
);
export const stockLocations = table('stock_locations', {
  id: text().primaryKey(),
  name: text().notNull(),
  code: text().notNull().unique(),
  kind: text().notNull(),
  detail: text().notNull().default(''),
  priority: integer().notNull().default(100),
  active: integer().notNull().default(1),
  createdAt: text().notNull(),
});
export const variantLocationStock = table(
  'variant_location_stock',
  {
    variantId: text()
      .notNull()
      .references(() => variants.id),
    locationId: text()
      .notNull()
      .references(() => stockLocations.id),
    quantity: integer().notNull().default(0),
    updatedAt: text().notNull(),
  },
  (t) => [uniqueIndex('variant_location_unique').on(t.variantId, t.locationId)],
);
export const stockLocationMovements = table('stock_location_movements', {
  id: text().primaryKey(),
  stockMovementId: text()
    .notNull()
    .references(() => stockMovements.id),
  variantId: text()
    .notNull()
    .references(() => variants.id),
  locationId: text()
    .notNull()
    .references(() => stockLocations.id),
  quantity: integer().notNull(),
  before: integer().notNull(),
  after: integer().notNull(),
  createdAt: text().notNull(),
});
export const stockTransfers = table('stock_transfers', {
  id: text().primaryKey(),
  variantId: text()
    .notNull()
    .references(() => variants.id),
  fromLocationId: text()
    .notNull()
    .references(() => stockLocations.id),
  toLocationId: text()
    .notNull()
    .references(() => stockLocations.id),
  quantity: integer().notNull(),
  actorId: text()
    .notNull()
    .references(() => users.id),
  notes: text().notNull().default(''),
  createdAt: text().notNull(),
});
export const onlineProductProfiles = table('online_product_profiles', {
  productId: text()
    .primaryKey()
    .references(() => products.id),
  slug: text().notNull().unique(),
  shortDescription: text().notNull().default(''),
  description: text().notNull().default(''),
  material: text().notNull().default(''),
  care: text().notNull().default(''),
  fit: text().notNull().default('Regular'),
  section: text().notNull().default('Colección'),
  featured: integer().notNull().default(0),
  published: integer().notNull().default(1),
  sortOrder: integer().notNull().default(100),
  updatedAt: text().notNull(),
});
export const customerAccounts = table('customer_accounts', {
  id: text().primaryKey(),
  customerId: text()
    .notNull()
    .unique()
    .references(() => customers.id),
  email: text().notNull().unique(),
  passwordHash: text().notNull(),
  passwordSalt: text().notNull(),
  emailVerified: integer().notNull().default(0),
  marketingConsent: integer().notNull().default(0),
  authProvider: text().notNull().default('password'),
  googleSub: text(),
  createdAt: text().notNull(),
  lastLoginAt: text(),
});
export const customerSessions = table('customer_sessions', {
  id: text().primaryKey(),
  accountId: text()
    .notNull()
    .references(() => customerAccounts.id),
  tokenHash: text().notNull().unique(),
  expiresAt: text().notNull(),
  createdAt: text().notNull(),
});
export const onlineOrders = table('online_orders', {
  id: text().primaryKey(),
  orderNumber: integer().notNull().unique(),
  customerId: text().references(() => customers.id),
  email: text().notNull(),
  customerName: text().notNull(),
  phone: text().notNull(),
  document: text().notNull().default(''),
  status: text().notNull().default('awaiting_payment'),
  paymentStatus: text().notNull().default('pending'),
  paymentMethod: text().notNull(),
  fulfillmentStatus: text().notNull().default('unfulfilled'),
  subtotal: integer().notNull(),
  discount: integer().notNull().default(0),
  shipping: integer().notNull().default(0),
  total: integer().notNull(),
  shippingMethod: text().notNull(),
  postalCode: text().notNull(),
  address: text().notNull(),
  addressExtra: text().notNull().default(''),
  city: text().notNull(),
  province: text().notNull(),
  country: text().notNull().default('Argentina'),
  notes: text().notNull().default(''),
  couponCode: text().notNull().default(''),
  attributionJson: text().notNull().default(''),
  accessTokenHash: text().notNull(),
  transferReference: text().notNull().unique(),
  paymentReference: text().notNull().default(''),
  trackingNumber: text().notNull().default(''),
  expiresAt: text().notNull(),
  paidAt: text(),
  createdAt: text().notNull(),
  updatedAt: text().notNull(),
});
export const onlineReturnRequests = table('online_return_requests', {
  id: text().primaryKey(),
  code: text().notNull().unique(),
  orderId: text()
    .notNull()
    .references(() => onlineOrders.id),
  orderNumber: integer().notNull(),
  email: text().notNull(),
  customerName: text().notNull(),
  phone: text().notNull().default(''),
  kind: text().notNull(),
  reason: text().notNull(),
  detail: text().notNull().default(''),
  status: text().notNull().default('received'),
  createdAt: text().notNull(),
  updatedAt: text().notNull(),
});
export const onlineOrderItems = table('online_order_items', {
  id: text().primaryKey(),
  orderId: text()
    .notNull()
    .references(() => onlineOrders.id),
  variantId: text()
    .notNull()
    .references(() => variants.id),
  productName: text().notNull(),
  sku: text().notNull(),
  color: text().notNull(),
  size: text().notNull(),
  quantity: integer().notNull(),
  unitPrice: integer().notNull(),
  lineTotal: integer().notNull(),
});
export const stockReservations = table('stock_reservations', {
  id: text().primaryKey(),
  orderId: text()
    .notNull()
    .references(() => onlineOrders.id),
  variantId: text()
    .notNull()
    .references(() => variants.id),
  quantity: integer().notNull(),
  status: text().notNull().default('active'),
  expiresAt: text().notNull(),
  createdAt: text().notNull(),
});
export const onlineOrderEvents = table('online_order_events', {
  id: text().primaryKey(),
  orderId: text()
    .notNull()
    .references(() => onlineOrders.id),
  kind: text().notNull(),
  detail: text().notNull().default(''),
  actorId: text(),
  createdAt: text().notNull(),
});
export const onlinePaymentEvents = table('online_payment_events', {
  id: text().primaryKey(),
  provider: text().notNull(),
  providerEventId: text().notNull().unique(),
  orderId: text()
    .notNull()
    .references(() => onlineOrders.id),
  status: text().notNull(),
  amount: integer().notNull(),
  payload: text().notNull().default(''),
  createdAt: text().notNull(),
});

export const newsletterSubscribers = table('newsletter_subscribers', {
  id: text().primaryKey(),
  email: text().notNull().unique(),
  name: text().notNull().default(''),
  status: text().notNull().default('active'),
  source: text().notNull().default('storefront'),
  unsubscribeToken: text().notNull().unique(),
  createdAt: text().notNull(),
  updatedAt: text().notNull(),
  unsubscribedAt: text(),
});
export const newsletterCampaigns = table('newsletter_campaigns', {
  id: text().primaryKey(),
  subject: text().notNull(),
  preheader: text().notNull().default(''),
  content: text().notNull(),
  ctaLabel: text().notNull().default(''),
  ctaUrl: text().notNull().default(''),
  status: text().notNull().default('draft'),
  recipientCount: integer().notNull().default(0),
  sentCount: integer().notNull().default(0),
  failedCount: integer().notNull().default(0),
  createdBy: text()
    .notNull()
    .references(() => users.id),
  createdAt: text().notNull(),
  sentAt: text(),
});
export const emailDeliveries = table('email_deliveries', {
  id: text().primaryKey(),
  kind: text().notNull(),
  recipient: text().notNull(),
  orderId: text().references(() => onlineOrders.id),
  campaignId: text().references(() => newsletterCampaigns.id),
  providerId: text().notNull().default(''),
  status: text().notNull(),
  error: text().notNull().default(''),
  createdAt: text().notNull(),
});
export const storeEvents = table('store_events', {
  id: text().primaryKey(),
  sessionId: text().notNull(),
  customerId: text().references(() => customers.id),
  event: text().notNull(),
  path: text().notNull().default(''),
  productId: text().references(() => products.id),
  variantId: text().references(() => variants.id),
  orderId: text().references(() => onlineOrders.id),
  value: integer().notNull().default(0),
  source: text().notNull().default(''),
  medium: text().notNull().default(''),
  campaign: text().notNull().default(''),
  metadata: text().notNull().default(''),
  createdAt: text().notNull(),
});
export const abandonedCarts = table('abandoned_carts', {
  id: text().primaryKey(),
  sessionId: text().notNull().unique(),
  customerId: text().references(() => customers.id),
  email: text().notNull().default(''),
  cartJson: text().notNull(),
  subtotal: integer().notNull().default(0),
  status: text().notNull().default('active'),
  recoveryToken: text().notNull().unique(),
  source: text().notNull().default(''),
  campaign: text().notNull().default(''),
  lastActivityAt: text().notNull(),
  firstReminderAt: text(),
  secondReminderAt: text(),
  recoveredAt: text(),
  createdAt: text().notNull(),
  updatedAt: text().notNull(),
});
export const backInStockRequests = table('back_in_stock_requests', {
  id: text().primaryKey(),
  variantId: text()
    .notNull()
    .references(() => variants.id),
  email: text().notNull(),
  status: text().notNull().default('waiting'),
  source: text().notNull().default('product'),
  createdAt: text().notNull(),
  notifiedAt: text(),
});
export const productReviews = table('product_reviews', {
  id: text().primaryKey(),
  productId: text()
    .notNull()
    .references(() => products.id),
  customerId: text().references(() => customers.id),
  orderId: text().references(() => onlineOrders.id),
  email: text().notNull(),
  displayName: text().notNull(),
  rating: integer().notNull(),
  title: text().notNull().default(''),
  body: text().notNull(),
  status: text().notNull().default('pending'),
  verified: integer().notNull().default(0),
  createdAt: text().notNull(),
  updatedAt: text().notNull(),
});
export const customerAddresses = table('customer_addresses', {
  id: text().primaryKey(),
  customerId: text()
    .notNull()
    .references(() => customers.id),
  label: text().notNull().default('Casa'),
  recipient: text().notNull(),
  phone: text().notNull(),
  postalCode: text().notNull(),
  address: text().notNull(),
  addressExtra: text().notNull().default(''),
  city: text().notNull(),
  province: text().notNull(),
  country: text().notNull().default('Argentina'),
  isDefault: integer().notNull().default(0),
  createdAt: text().notNull(),
  updatedAt: text().notNull(),
});
export const marketingAutomationLog = table('marketing_automation_log', {
  id: text().primaryKey(),
  kind: text().notNull(),
  entityId: text().notNull(),
  recipient: text().notNull(),
  status: text().notNull(),
  detail: text().notNull().default(''),
  createdAt: text().notNull(),
});
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
  subtotal: integer().notNull().default(0),
  discount: integer().notNull().default(0),
  tax: integer().notNull().default(0),
  shipping: integer().notNull().default(0),
  total: integer().notNull(),
  paymentMethod: text().notNull().default('cuenta_corriente'),
  supplierReference: text().notNull().default(''),
  expectedAt: text(),
  carrier: text().notNull().default(''),
  trackingReference: text().notNull().default(''),
  deliveryAddress: text().notNull().default(''),
  paymentTerms: text().notNull().default(''),
  notes: text().notNull().default(''),
  idempotencyKey: text().unique(),
  requestHash: text(),
  createdAt: text().notNull(),
  updatedAt: text(),
  sentAt: text(),
  confirmedAt: text(),
  receivedAt: text(),
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
  discount: integer().notNull().default(0),
  received: integer().notNull().default(0),
});
export const purchaseReceipts = table(
  'purchase_receipts',
  {
    id: text().primaryKey(),
    purchaseId: text()
      .notNull()
      .references(() => purchases.id),
    actorId: text()
      .notNull()
      .references(() => users.id),
    subtotal: integer().notNull(),
    notes: text().notNull().default(''),
    idempotencyKey: text().notNull().unique(),
    requestHash: text().notNull(),
    createdAt: text().notNull(),
  },
  (t) => [
    index('purchase_receipts_purchase_date').on(t.purchaseId, t.createdAt),
  ],
);
export const purchaseReceiptItems = table(
  'purchase_receipt_items',
  {
    id: text().primaryKey(),
    receiptId: text()
      .notNull()
      .references(() => purchaseReceipts.id),
    purchaseItemId: text()
      .notNull()
      .references(() => purchaseItems.id),
    variantId: text()
      .notNull()
      .references(() => variants.id),
    quantity: integer().notNull(),
    unitCost: integer().notNull(),
    beforeStock: integer().notNull(),
    afterStock: integer().notNull(),
  },
  (t) => [
    index('purchase_receipt_items_receipt').on(t.receiptId),
    index('purchase_receipt_items_order_line').on(t.purchaseItemId),
  ],
);
export const payables = table('payables', {
  id: text().primaryKey(),
  description: text().notNull(),
  supplierId: text().references(() => suppliers.id),
  amount: integer().notNull(),
  dueAt: text().notNull(),
  kind: text().notNull(),
  status: text().notNull().default('pending'),
  reference: text().notNull().default(''),
  purchaseId: text().references(() => purchases.id),
});
export const recurringExpenses = table('recurring_expenses', {
  id: text().primaryKey(),
  description: text().notNull(),
  category: text().notNull(),
  amount: integer().notNull(),
  frequency: text().notNull(),
  interval: integer().notNull().default(1),
  startsOn: text().notNull(),
  endsOn: text(),
  supplierId: text().references(() => suppliers.id),
  methodId: text(),
  active: integer().notNull().default(1),
  createdBy: text()
    .notNull()
    .references(() => users.id),
  createdAt: text().notNull(),
  updatedAt: text().notNull(),
});
export const financialObligations = table('financial_obligations', {
  id: text().primaryKey(),
  description: text().notNull(),
  supplierId: text().references(() => suppliers.id),
  total: integer().notNull(),
  installmentCount: integer().notNull(),
  firstDueOn: text().notNull(),
  intervalMonths: integer().notNull().default(1),
  kind: text().notNull().default('Cuota'),
  status: text().notNull().default('active'),
  createdBy: text()
    .notNull()
    .references(() => users.id),
  createdAt: text().notNull(),
});
export const obligationInstallments = table(
  'obligation_installments',
  {
    id: text().primaryKey(),
    obligationId: text()
      .notNull()
      .references(() => financialObligations.id),
    number: integer().notNull(),
    amount: integer().notNull(),
    dueOn: text().notNull(),
    status: text().notNull().default('pending'),
    payableId: text()
      .notNull()
      .references(() => payables.id),
    paidAt: text(),
  },
  (t) => [
    uniqueIndex('obligation_installment_number').on(t.obligationId, t.number),
    uniqueIndex('obligation_installment_payable').on(t.payableId),
  ],
);
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
    method: text().notNull().default('original'),
    creditIssued: integer().notNull().default(0),
    authorizationId: text(),
    createdAt: text().notNull(),
  },
  (t) => [uniqueIndex('refund_authorization_once').on(t.authorizationId)],
);
export const refundItems = table('refund_items', {
  id: text().primaryKey(),
  refundId: text()
    .notNull()
    .references(() => refunds.id),
  saleItemId: text()
    .notNull()
    .references(() => saleItems.id),
  variantId: text()
    .notNull()
    .references(() => variants.id),
  quantity: integer().notNull(),
  amount: integer().notNull(),
});
export const customerCredits = table('customer_credits', {
  id: text().primaryKey(),
  customerId: text()
    .notNull()
    .references(() => customers.id),
  originalSaleId: text()
    .notNull()
    .references(() => sales.id),
  refundId: text()
    .notNull()
    .references(() => refunds.id),
  amount: integer().notNull(),
  balance: integer().notNull(),
  status: text().notNull().default('active'),
  expiresAt: text(),
  createdAt: text().notNull(),
});
export const creditUsages = table('credit_usages', {
  id: text().primaryKey(),
  creditId: text()
    .notNull()
    .references(() => customerCredits.id),
  saleId: text()
    .notNull()
    .references(() => sales.id),
  amount: integer().notNull(),
  createdAt: text().notNull(),
});
export const customerCashback = table('customer_cashback', {
  id: text().primaryKey(),
  customerId: text()
    .notNull()
    .references(() => customers.id),
  saleId: text()
    .notNull()
    .references(() => sales.id),
  amount: integer().notNull(),
  balance: integer().notNull(),
  status: text().notNull().default('active'),
  expiresAt: text(),
  createdAt: text().notNull(),
  refundId: text().references(() => refunds.id),
});
export const cashbackUsages = table('cashback_usages', {
  id: text().primaryKey(),
  cashbackId: text()
    .notNull()
    .references(() => customerCashback.id),
  saleId: text()
    .notNull()
    .references(() => sales.id),
  amount: integer().notNull(),
  createdAt: text().notNull(),
});
export const managerAuthorizations = table('manager_authorizations', {
  id: text().primaryKey(),
  tokenHash: text().notNull().unique(),
  action: text().notNull(),
  saleId: text()
    .notNull()
    .references(() => sales.id),
  maxAmount: integer().notNull(),
  authorizedBy: text()
    .notNull()
    .references(() => users.id),
  expiresAt: text().notNull(),
  usedAt: text(),
  createdAt: text().notNull(),
});
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
export const bankAccounts = table('bank_accounts', {
  id: text().primaryKey(),
  name: text().notNull(),
  bank: text().notNull(),
  alias: text().notNull().default(''),
  opening: integer().notNull().default(0),
  active: integer().notNull().default(1),
  createdAt: text().notNull(),
});
export const bankEntries = table(
  'bank_entries',
  {
    id: text().primaryKey(),
    accountId: text()
      .notNull()
      .references(() => bankAccounts.id),
    amount: integer().notNull(),
    description: text().notNull(),
    reference: text().notNull().unique(),
    occurredAt: text().notNull(),
    reconciledAt: text(),
    statementReference: text(),
    actorId: text()
      .notNull()
      .references(() => users.id),
    createdAt: text().notNull(),
  },
  (t) => [
    check('bank_entry_nonzero', sql`${t.amount} <> 0`),
    uniqueIndex('bank_statement_unique')
      .on(t.accountId, t.statementReference)
      .where(sql`${t.statementReference} IS NOT NULL`),
  ],
);
export const checks = table(
  'checks',
  {
    id: text().primaryKey(),
    number: text().notNull(),
    bank: text().notNull(),
    type: text().notNull(),
    direction: text().notNull(),
    party: text().notNull(),
    amount: integer().notNull(),
    issuedAt: text().notNull(),
    dueAt: text().notNull(),
    accountId: text()
      .notNull()
      .references(() => bankAccounts.id),
    status: text().notNull(),
    version: integer().notNull().default(0),
    payableId: text().references(() => payables.id),
    createdAt: text().notNull(),
  },
  (t) => [
    uniqueIndex('check_number_unique').on(t.bank, t.number, t.direction),
    check('check_positive', sql`${t.amount}>0`),
    uniqueIndex('check_payable_once')
      .on(t.payableId)
      .where(
        sql`${t.payableId} IS NOT NULL AND ${t.status} NOT IN ('cancelled','rejected')`,
      ),
  ],
);
export const checkEvents = table(
  'check_events',
  {
    id: text().primaryKey(),
    checkId: text()
      .notNull()
      .references(() => checks.id),
    fromStatus: text().notNull(),
    toStatus: text().notNull(),
    version: integer().notNull(),
    reason: text().notNull(),
    actorId: text()
      .notNull()
      .references(() => users.id),
    createdAt: text().notNull(),
  },
  (t) => [uniqueIndex('check_event_version').on(t.checkId, t.version)],
);
export const clubRewards = table(
  'club_rewards',
  {
    id: text().primaryKey(),
    name: text().notNull(),
    description: text().notNull(),
    points: integer().notNull(),
    active: integer().notNull().default(1),
    createdAt: text().notNull(),
  },
  (t) => [check('reward_points_positive', sql`${t.points}>0`)],
);
export const clubRedemptions = table(
  'club_redemptions',
  {
    id: text().primaryKey(),
    customerId: text()
      .notNull()
      .references(() => customers.id),
    rewardId: text()
      .notNull()
      .references(() => clubRewards.id),
    points: integer().notNull(),
    rewardName: text().notNull(),
    status: text().notNull().default('reserved'),
    idempotencyKey: text().notNull().unique(),
    actorId: text()
      .notNull()
      .references(() => users.id),
    createdAt: text().notNull(),
  },
  (t) => [check('redemption_points_positive', sql`${t.points}>0`)],
);
