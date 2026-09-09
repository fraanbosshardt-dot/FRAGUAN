import type { Actor } from './auth';

const DAY_MS = 86_400_000;

export const CUSTOMER_SEGMENTS = [
  'Nuevo',
  'Activo',
  'Frecuente',
  'VIP',
  'En riesgo',
  'Inactivo',
  'Perdido',
] as const;

export const LOYALTY_LEVELS = ['FRAGUAN', 'Silver', 'Gold', 'Black'] as const;

export type CustomerSegment = (typeof CUSTOMER_SEGMENTS)[number];
export type LoyaltyLevel = (typeof LOYALTY_LEVELS)[number];
export type PromotedLoyaltyLevel = Exclude<LoyaltyLevel, 'FRAGUAN'>;

export interface CustomerSegmentationConfig {
  /** Window used to decide whether a customer is Frecuente or VIP. */
  evaluationWindowDays: number;
  newCustomerDays: number;
  newCustomerMaxPurchases: number;
  frequentMinPurchases: number;
  vipMinPurchases: number;
  vipMinSpendMinor: number;
  atRiskAfterDays: number;
  atRiskMinLifetimePurchases: number;
  inactiveAfterDays: number;
  lostAfterDays: number;
}

export interface LoyaltyThreshold {
  minSpendMinor: number;
  minPurchases: number;
  minPoints: number;
}

export interface CustomerLoyaltyConfig {
  /** Rolling period used for spend and purchase conditions. */
  evaluationWindowDays: number;
  thresholds: Record<PromotedLoyaltyLevel, LoyaltyThreshold>;
  cashbackBps: Record<LoyaltyLevel, number>;
  cashbackExpiryDays: number;
  benefits: Record<LoyaltyLevel, string[]>;
}

export interface CustomerIntelligenceConfig {
  segmentation: CustomerSegmentationConfig;
  loyalty: CustomerLoyaltyConfig;
  historyLimit: number;
  topCustomerLimit: number;
}

type PartialThresholds = {
  [Level in PromotedLoyaltyLevel]?: Partial<LoyaltyThreshold>;
};

export interface CustomerIntelligenceConfigInput {
  segmentation?: Partial<CustomerSegmentationConfig>;
  loyalty?: {
    evaluationWindowDays?: number;
    thresholds?: PartialThresholds;
    cashbackBps?: Partial<Record<LoyaltyLevel, number>>;
    cashbackExpiryDays?: number;
    benefits?: Partial<Record<LoyaltyLevel, string[]>>;
  };
  historyLimit?: number;
  topCustomerLimit?: number;
}

/**
 * Monetary values use the application's minor-unit convention (centavos).
 * The suggested Gold threshold is ARS 500,000 during the last 365 days.
 */
export const DEFAULT_CUSTOMER_INTELLIGENCE_CONFIG: CustomerIntelligenceConfig =
  {
    segmentation: {
      evaluationWindowDays: 365,
      newCustomerDays: 30,
      newCustomerMaxPurchases: 1,
      frequentMinPurchases: 4,
      vipMinPurchases: 6,
      vipMinSpendMinor: 75_000_000,
      atRiskAfterDays: 60,
      atRiskMinLifetimePurchases: 3,
      inactiveAfterDays: 120,
      lostAfterDays: 240,
    },
    loyalty: {
      evaluationWindowDays: 365,
      thresholds: {
        Silver: {
          minSpendMinor: 20_000_000,
          minPurchases: 0,
          minPoints: 0,
        },
        Gold: {
          minSpendMinor: 50_000_000,
          minPurchases: 0,
          minPoints: 0,
        },
        Black: {
          minSpendMinor: 100_000_000,
          minPurchases: 0,
          minPoints: 0,
        },
      },
      cashbackBps: {
        FRAGUAN: 0,
        Silver: 0,
        Gold: 0,
        Black: 0,
      },
      cashbackExpiryDays: 365,
      benefits: {
        FRAGUAN: [],
        Silver: ['Acceso a promociones del Club'],
        Gold: ['Promociones exclusivas'],
        Black: [
          'Acceso anticipado',
          'Beneficio de cumpleaños',
        ],
      },
    },
    historyLimit: 50,
    topCustomerLimit: 10,
  };

export interface CustomerActivitySnapshot {
  createdAt: string;
  firstPurchaseAt: string | null;
  lastPurchaseAt: string | null;
  purchaseCount: number;
  lifetimeSpendMinor: number;
  purchasesInSegmentWindow: number;
  spendInSegmentWindowMinor: number;
  purchasesInLoyaltyWindow: number;
  spendInLoyaltyWindowMinor: number;
  points: number;
}

export interface CustomerMetrics extends CustomerActivitySnapshot {
  id: string;
  name: string;
  surname: string;
  phone: string;
  email: string;
  whatsapp: string;
  locality: string;
  usualSizes: string;
  notes: string;
  birthday: string | null;
  customerAgeDays: number;
  daysSinceLastPurchase: number | null;
  averageTicketMinor: number;
  averagePurchaseIntervalDays: number | null;
  segment: CustomerSegment;
  loyaltyLevel: LoyaltyLevel;
}

export interface CustomerSaleHistoryEntry {
  id: string;
  ticket: number;
  status: string;
  subtotalMinor: number;
  discountMinor: number;
  totalMinor: number;
  refundedMinor: number;
  netTotalMinor: number;
  units: number;
  retainedUnits: number;
  sellerName: string;
  createdAt: string;
}

export interface CustomerLoyaltyHistoryEntry {
  id: string;
  points: number;
  reason: string;
  reference: string;
  createdAt: string;
}

export interface CustomerIntelligence {
  asOf: string;
  config: CustomerIntelligenceConfig;
  metrics: CustomerMetrics;
  history: {
    sales: CustomerSaleHistoryEntry[];
    loyaltyTransactions: CustomerLoyaltyHistoryEntry[];
  };
}

export interface CustomerSegmentInsight {
  segment: CustomerSegment;
  customers: number;
  shareBps: number;
  lifetimeSpendMinor: number;
  spendInEvaluationWindowMinor: number;
}

export interface CustomerLevelInsight {
  level: LoyaltyLevel;
  customers: number;
  shareBps: number;
  lifetimeSpendMinor: number;
}

export interface CustomerInsights {
  asOf: string;
  config: CustomerIntelligenceConfig;
  customerCount: number;
  customersWithPurchases: number;
  repeatCustomers: number;
  repeatCustomerRateBps: number;
  purchaseCount: number;
  lifetimeRevenueMinor: number;
  evaluationWindowPurchaseCount: number;
  evaluationWindowRevenueMinor: number;
  averageTicketMinor: number;
  averageCustomerValueMinor: number;
  segments: CustomerSegmentInsight[];
  loyaltyLevels: CustomerLevelInsight[];
  topCustomers: Array<
    Pick<
      CustomerMetrics,
      | 'id'
      | 'name'
      | 'surname'
      | 'segment'
      | 'loyaltyLevel'
      | 'purchaseCount'
      | 'lifetimeSpendMinor'
      | 'spendInLoyaltyWindowMinor'
      | 'lastPurchaseAt'
    >
  >;
}

export interface CustomerIntelligenceQueryOptions {
  asOf?: Date | string | number;
  config?: CustomerIntelligenceConfigInput;
}

type NumericDatabaseValue = number | string | null;

interface CustomerActivityRow {
  id: string;
  name: string;
  surname: string;
  phone: string;
  email: string;
  whatsapp: string;
  locality: string;
  usualSizes: string;
  notes: string;
  birthday: string | null;
  points: NumericDatabaseValue;
  createdAt: string;
  purchaseCount: NumericDatabaseValue;
  lifetimeSpendMinor: NumericDatabaseValue;
  firstPurchaseAt: string | null;
  lastPurchaseAt: string | null;
  purchasesInSegmentWindow: NumericDatabaseValue;
  spendInSegmentWindowMinor: NumericDatabaseValue;
  purchasesInLoyaltyWindow: NumericDatabaseValue;
  spendInLoyaltyWindowMinor: NumericDatabaseValue;
}

interface SaleHistoryRow {
  id: string;
  ticket: NumericDatabaseValue;
  status: string;
  subtotalMinor: NumericDatabaseValue;
  discountMinor: NumericDatabaseValue;
  totalMinor: NumericDatabaseValue;
  refundedMinor: NumericDatabaseValue;
  netTotalMinor: NumericDatabaseValue;
  units: NumericDatabaseValue;
  retainedUnits: NumericDatabaseValue;
  sellerName: string;
  createdAt: string;
}

interface LoyaltyHistoryRow {
  id: string;
  points: NumericDatabaseValue;
  reason: string;
  reference: string;
  createdAt: string;
}

const CUSTOMER_ACTIVITY_SELECT = `
  SELECT
    c.id,
    c.name,
    c.surname,
    c.phone,
    c.email,
    c.whatsapp,
    c.locality,
    c.usualSizes,
    c.notes,
    c.birthday,
    c.points,
    c.createdAt,
    COUNT(s.id) AS purchaseCount,
    COALESCE(SUM(s.total), 0) AS lifetimeSpendMinor,
    MIN(s.createdAt) AS firstPurchaseAt,
    MAX(s.createdAt) AS lastPurchaseAt,
    COALESCE(SUM(CASE WHEN s.createdAt >= ? THEN 1 ELSE 0 END), 0)
      AS purchasesInSegmentWindow,
    COALESCE(SUM(CASE WHEN s.createdAt >= ? THEN s.total ELSE 0 END), 0)
      AS spendInSegmentWindowMinor,
    COALESCE(SUM(CASE WHEN s.createdAt >= ? THEN 1 ELSE 0 END), 0)
      AS purchasesInLoyaltyWindow,
    COALESCE(SUM(CASE WHEN s.createdAt >= ? THEN s.total ELSE 0 END), 0)
      AS spendInLoyaltyWindowMinor
  FROM customers c
  LEFT JOIN (
    SELECT
      sale.id,
      sale.customerId,
      sale.createdAt,
      sale.total - COALESCE(refund.refundedMinor, 0) AS total
    FROM sales sale
    LEFT JOIN (
      SELECT saleId, SUM(amount) AS refundedMinor
      FROM refunds
      GROUP BY saleId
    ) refund ON refund.saleId = sale.id
    WHERE sale.status IN ('confirmed', 'partially_refunded')
  ) s ON s.customerId = c.id
`;

const CUSTOMER_ACTIVITY_GROUP = `
  GROUP BY
    c.id,
    c.name,
    c.surname,
    c.phone,
    c.email,
    c.whatsapp,
    c.locality,
    c.usualSizes,
    c.notes,
    c.birthday,
    c.points,
    c.createdAt
`;

function checkedInteger(
  label: string,
  value: number,
  minimum = 0,
  maximum = Number.MAX_SAFE_INTEGER,
) {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum)
    throw new RangeError(
      `${label} debe ser un entero entre ${minimum} y ${maximum}.`,
    );
  return value;
}

function databaseInteger(label: string, value: NumericDatabaseValue) {
  const parsed = typeof value === 'number' ? value : Number(value ?? 0);
  if (!Number.isSafeInteger(parsed))
    throw new Error(`Dato inválido en la métrica ${label}.`);
  return parsed;
}

function databaseNonnegativeInteger(
  label: string,
  value: NumericDatabaseValue,
) {
  const parsed = databaseInteger(label, value);
  if (parsed < 0) throw new Error(`Dato negativo en la métrica ${label}.`);
  return parsed;
}

function dateMilliseconds(label: string, value: Date | string | number) {
  const milliseconds =
    value instanceof Date ? value.getTime() : new Date(value).getTime();
  if (!Number.isFinite(milliseconds))
    throw new RangeError(`${label} no es una fecha válida.`);
  return milliseconds;
}

function elapsedDays(since: string, asOfMilliseconds: number) {
  const sinceMilliseconds = dateMilliseconds('La fecha de actividad', since);
  return Math.max(
    0,
    Math.floor((asOfMilliseconds - sinceMilliseconds) / DAY_MS),
  );
}

function thresholdWithOverrides(
  level: PromotedLoyaltyLevel,
  input?: PartialThresholds,
): LoyaltyThreshold {
  return {
    ...DEFAULT_CUSTOMER_INTELLIGENCE_CONFIG.loyalty.thresholds[level],
    ...input?.[level],
  };
}

export function resolveCustomerIntelligenceConfig(
  input: CustomerIntelligenceConfigInput = {},
): CustomerIntelligenceConfig {
  const config: CustomerIntelligenceConfig = {
    segmentation: {
      ...DEFAULT_CUSTOMER_INTELLIGENCE_CONFIG.segmentation,
      ...input.segmentation,
    },
    loyalty: {
      evaluationWindowDays:
        input.loyalty?.evaluationWindowDays ??
        DEFAULT_CUSTOMER_INTELLIGENCE_CONFIG.loyalty.evaluationWindowDays,
      thresholds: {
        Silver: thresholdWithOverrides('Silver', input.loyalty?.thresholds),
        Gold: thresholdWithOverrides('Gold', input.loyalty?.thresholds),
        Black: thresholdWithOverrides('Black', input.loyalty?.thresholds),
      },
      cashbackBps: {
        ...DEFAULT_CUSTOMER_INTELLIGENCE_CONFIG.loyalty.cashbackBps,
        ...input.loyalty?.cashbackBps,
      },
      cashbackExpiryDays:
        input.loyalty?.cashbackExpiryDays ??
        DEFAULT_CUSTOMER_INTELLIGENCE_CONFIG.loyalty.cashbackExpiryDays,
      benefits: {
        ...DEFAULT_CUSTOMER_INTELLIGENCE_CONFIG.loyalty.benefits,
        ...input.loyalty?.benefits,
      },
    },
    historyLimit:
      input.historyLimit ?? DEFAULT_CUSTOMER_INTELLIGENCE_CONFIG.historyLimit,
    topCustomerLimit:
      input.topCustomerLimit ??
      DEFAULT_CUSTOMER_INTELLIGENCE_CONFIG.topCustomerLimit,
  };

  const segment = config.segmentation;
  checkedInteger(
    'segmentation.evaluationWindowDays',
    segment.evaluationWindowDays,
    1,
    3_650,
  );
  checkedInteger(
    'segmentation.newCustomerDays',
    segment.newCustomerDays,
    0,
    3_650,
  );
  checkedInteger(
    'segmentation.newCustomerMaxPurchases',
    segment.newCustomerMaxPurchases,
  );
  checkedInteger(
    'segmentation.frequentMinPurchases',
    segment.frequentMinPurchases,
    1,
  );
  checkedInteger(
    'segmentation.vipMinPurchases',
    segment.vipMinPurchases,
    segment.frequentMinPurchases,
  );
  checkedInteger('segmentation.vipMinSpendMinor', segment.vipMinSpendMinor);
  checkedInteger(
    'segmentation.atRiskAfterDays',
    segment.atRiskAfterDays,
    1,
    3_650,
  );
  checkedInteger(
    'segmentation.atRiskMinLifetimePurchases',
    segment.atRiskMinLifetimePurchases,
    1,
  );
  checkedInteger(
    'segmentation.inactiveAfterDays',
    segment.inactiveAfterDays,
    segment.atRiskAfterDays + 1,
    3_650,
  );
  checkedInteger(
    'segmentation.lostAfterDays',
    segment.lostAfterDays,
    segment.inactiveAfterDays + 1,
    7_300,
  );

  checkedInteger(
    'loyalty.evaluationWindowDays',
    config.loyalty.evaluationWindowDays,
    1,
    3_650,
  );
  for (const level of ['Silver', 'Gold', 'Black'] as const) {
    const threshold = config.loyalty.thresholds[level];
    checkedInteger(
      `loyalty.thresholds.${level}.minSpendMinor`,
      threshold.minSpendMinor,
    );
    checkedInteger(
      `loyalty.thresholds.${level}.minPurchases`,
      threshold.minPurchases,
    );
    checkedInteger(
      `loyalty.thresholds.${level}.minPoints`,
      threshold.minPoints,
    );
  }
  for (const level of LOYALTY_LEVELS) {
    checkedInteger(
      `loyalty.cashbackBps.${level}`,
      config.loyalty.cashbackBps[level],
      0,
      10_000,
    );
    if (!Array.isArray(config.loyalty.benefits[level]))
      throw new RangeError(`Los beneficios de ${level} deben ser una lista.`);
    if (config.loyalty.benefits[level].length > 10)
      throw new RangeError(`El nivel ${level} admite hasta 10 beneficios.`);
    if (
      config.loyalty.benefits[level].some(
        (benefit) => typeof benefit !== 'string' || benefit.trim().length > 200,
      )
    )
      throw new RangeError(`Los beneficios de ${level} no son válidos.`);
  }
  checkedInteger(
    'loyalty.cashbackExpiryDays',
    config.loyalty.cashbackExpiryDays,
    1,
    3_650,
  );
  for (const [lower, higher] of [
    ['Silver', 'Gold'],
    ['Gold', 'Black'],
  ] as const) {
    const low = config.loyalty.thresholds[lower];
    const high = config.loyalty.thresholds[higher];
    if (
      high.minSpendMinor < low.minSpendMinor ||
      high.minPurchases < low.minPurchases ||
      high.minPoints < low.minPoints
    )
      throw new RangeError(
        `Los requisitos de ${higher} deben ser iguales o mayores que los de ${lower}.`,
      );
  }
  checkedInteger('historyLimit', config.historyLimit, 1, 200);
  checkedInteger('topCustomerLimit', config.topCustomerLimit, 1, 100);

  return config;
}

function configInput(value: unknown): CustomerIntelligenceConfigInput {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('La configuración del Club debe ser un objeto.');
  }
  return value as CustomerIntelligenceConfigInput;
}

/** Loads the persisted Club FRAGUAN rules, falling back to safe defaults. */
export async function readCustomerIntelligenceConfig() {
  const { one } = await import('@/db/queries');
  const row = await one<{ value: string }>(
    'SELECT value FROM settings WHERE key=?',
    'customerIntelligence',
  );
  if (!row?.value) return resolveCustomerIntelligenceConfig();
  try {
    return resolveCustomerIntelligenceConfig(JSON.parse(row.value));
  } catch {
    throw new Error('La configuración del Club debe revisarse.');
  }
}

/** Persists configurable level conditions while preserving omitted settings. */
export async function saveCustomerIntelligenceConfig(
  actor: Actor,
  raw: unknown,
) {
  await requireCustomerIntelligenceAccess(actor);
  const input = configInput(raw);
  const current = await readCustomerIntelligenceConfig();
  const config = resolveCustomerIntelligenceConfig({
    segmentation: {
      ...current.segmentation,
      ...input.segmentation,
    },
    loyalty: {
      evaluationWindowDays:
        input.loyalty?.evaluationWindowDays ??
        current.loyalty.evaluationWindowDays,
      thresholds: {
        Silver: {
          ...current.loyalty.thresholds.Silver,
          ...input.loyalty?.thresholds?.Silver,
        },
        Gold: {
          ...current.loyalty.thresholds.Gold,
          ...input.loyalty?.thresholds?.Gold,
        },
        Black: {
          ...current.loyalty.thresholds.Black,
          ...input.loyalty?.thresholds?.Black,
        },
      },
      cashbackBps: {
        ...current.loyalty.cashbackBps,
        ...input.loyalty?.cashbackBps,
      },
      cashbackExpiryDays:
        input.loyalty?.cashbackExpiryDays ?? current.loyalty.cashbackExpiryDays,
      benefits: {
        ...current.loyalty.benefits,
        ...input.loyalty?.benefits,
      },
    },
    historyLimit: input.historyLimit ?? current.historyLimit,
    topCustomerLimit: input.topCustomerLimit ?? current.topCustomerLimit,
  });
  const { auditStatement, db, statement } = await import('@/db/queries');
  await db().batch([
    statement(
      'INSERT INTO settings(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value',
      'customerIntelligence',
      JSON.stringify(config),
    ),
    auditStatement(
      actor.id,
      'Configurar Club FRAGUAN',
      'customerIntelligence',
      current,
      config,
    ),
  ]);
  return config;
}

function resolvedAsOf(value?: Date | string | number) {
  const milliseconds = dateMilliseconds('asOf', value ?? new Date());
  return { milliseconds, iso: new Date(milliseconds).toISOString() };
}

function cutoffIso(asOfMilliseconds: number, days: number) {
  return new Date(asOfMilliseconds - days * DAY_MS).toISOString();
}

function classifyWithResolvedConfig(
  activity: CustomerActivitySnapshot,
  config: CustomerIntelligenceConfig,
  asOfMilliseconds: number,
): CustomerSegment {
  const customerAgeDays = elapsedDays(activity.createdAt, asOfMilliseconds);
  const daysWithoutPurchase = activity.lastPurchaseAt
    ? elapsedDays(activity.lastPurchaseAt, asOfMilliseconds)
    : customerAgeDays;

  // Dormancy takes precedence so a historically valuable customer is not
  // presented as VIP or Frecuente after ceasing to buy.
  if (daysWithoutPurchase >= config.segmentation.lostAfterDays)
    return 'Perdido';
  if (daysWithoutPurchase >= config.segmentation.inactiveAfterDays)
    return 'Inactivo';
  if (
    activity.lastPurchaseAt &&
    daysWithoutPurchase >= config.segmentation.atRiskAfterDays &&
    activity.purchaseCount >= config.segmentation.atRiskMinLifetimePurchases
  )
    return 'En riesgo';
  if (
    activity.purchasesInSegmentWindow >= config.segmentation.vipMinPurchases &&
    activity.spendInSegmentWindowMinor >= config.segmentation.vipMinSpendMinor
  )
    return 'VIP';
  if (
    activity.purchasesInSegmentWindow >=
    config.segmentation.frequentMinPurchases
  )
    return 'Frecuente';
  if (
    customerAgeDays <= config.segmentation.newCustomerDays &&
    activity.purchaseCount <= config.segmentation.newCustomerMaxPurchases
  )
    return 'Nuevo';
  return 'Activo';
}

export function classifyCustomer(
  activity: CustomerActivitySnapshot,
  input: CustomerIntelligenceConfigInput = {},
  asOf?: Date | string | number,
): CustomerSegment {
  return classifyWithResolvedConfig(
    activity,
    resolveCustomerIntelligenceConfig(input),
    resolvedAsOf(asOf).milliseconds,
  );
}

function levelWithResolvedConfig(
  activity: CustomerActivitySnapshot,
  config: CustomerIntelligenceConfig,
): LoyaltyLevel {
  for (const level of ['Black', 'Gold', 'Silver'] as const) {
    const threshold = config.loyalty.thresholds[level];
    if (
      activity.spendInLoyaltyWindowMinor >= threshold.minSpendMinor &&
      activity.purchasesInLoyaltyWindow >= threshold.minPurchases &&
      activity.points >= threshold.minPoints
    )
      return level;
  }
  return 'FRAGUAN';
}

export function calculateLoyaltyLevel(
  activity: CustomerActivitySnapshot,
  input: CustomerIntelligenceConfigInput = {},
): LoyaltyLevel {
  return levelWithResolvedConfig(
    activity,
    resolveCustomerIntelligenceConfig(input),
  );
}

function queryArguments(
  asOfMilliseconds: number,
  config: CustomerIntelligenceConfig,
) {
  const segmentCutoff = cutoffIso(
    asOfMilliseconds,
    config.segmentation.evaluationWindowDays,
  );
  const loyaltyCutoff = cutoffIso(
    asOfMilliseconds,
    config.loyalty.evaluationWindowDays,
  );
  return [segmentCutoff, segmentCutoff, loyaltyCutoff, loyaltyCutoff] as const;
}

function activityFromRow(row: CustomerActivityRow): CustomerActivitySnapshot {
  return {
    createdAt: row.createdAt,
    firstPurchaseAt: row.firstPurchaseAt,
    lastPurchaseAt: row.lastPurchaseAt,
    purchaseCount: databaseNonnegativeInteger(
      'purchaseCount',
      row.purchaseCount,
    ),
    lifetimeSpendMinor: databaseNonnegativeInteger(
      'lifetimeSpendMinor',
      row.lifetimeSpendMinor,
    ),
    purchasesInSegmentWindow: databaseNonnegativeInteger(
      'purchasesInSegmentWindow',
      row.purchasesInSegmentWindow,
    ),
    spendInSegmentWindowMinor: databaseNonnegativeInteger(
      'spendInSegmentWindowMinor',
      row.spendInSegmentWindowMinor,
    ),
    purchasesInLoyaltyWindow: databaseNonnegativeInteger(
      'purchasesInLoyaltyWindow',
      row.purchasesInLoyaltyWindow,
    ),
    spendInLoyaltyWindowMinor: databaseNonnegativeInteger(
      'spendInLoyaltyWindowMinor',
      row.spendInLoyaltyWindowMinor,
    ),
    points: databaseInteger('points', row.points),
  };
}

function metricsFromRow(
  row: CustomerActivityRow,
  config: CustomerIntelligenceConfig,
  asOfMilliseconds: number,
): CustomerMetrics {
  const activity = activityFromRow(row);
  const purchaseSpanDays =
    activity.purchaseCount > 1 &&
    activity.firstPurchaseAt &&
    activity.lastPurchaseAt
      ? elapsedDays(
          activity.firstPurchaseAt,
          dateMilliseconds('La última compra', activity.lastPurchaseAt),
        )
      : null;

  return {
    id: row.id,
    name: row.name,
    surname: row.surname,
    phone: row.phone,
    email: row.email,
    whatsapp: row.whatsapp,
    locality: row.locality,
    usualSizes: row.usualSizes,
    notes: row.notes,
    birthday: row.birthday,
    ...activity,
    customerAgeDays: elapsedDays(activity.createdAt, asOfMilliseconds),
    daysSinceLastPurchase: activity.lastPurchaseAt
      ? elapsedDays(activity.lastPurchaseAt, asOfMilliseconds)
      : null,
    averageTicketMinor: activity.purchaseCount
      ? Math.round(activity.lifetimeSpendMinor / activity.purchaseCount)
      : 0,
    averagePurchaseIntervalDays:
      purchaseSpanDays === null
        ? null
        : Math.round(purchaseSpanDays / (activity.purchaseCount - 1)),
    segment: classifyWithResolvedConfig(activity, config, asOfMilliseconds),
    loyaltyLevel: levelWithResolvedConfig(activity, config),
  };
}

async function requireCustomerIntelligenceAccess(actor: Actor) {
  // VENDEDOR and CAJA deliberately do not have `customer-intelligence`;
  // keeping this guard here prevents a future route from leaking CRM data.
  const { requirePermission } = await import('./auth');
  requirePermission(actor, 'customer-intelligence');
}

function validCustomerId(customerId: string) {
  if (typeof customerId !== 'string') return null;
  const normalized = customerId.trim();
  return normalized && normalized.length <= 128 ? normalized : null;
}

async function customerActivityRow(
  customerId: string,
  args: readonly [string, string, string, string],
) {
  const { one } = await import('@/db/queries');
  return one<CustomerActivityRow>(
    `${CUSTOMER_ACTIVITY_SELECT}
     WHERE c.id = ?
     ${CUSTOMER_ACTIVITY_GROUP}`,
    ...args,
    customerId,
  );
}

async function allCustomerActivityRows(
  args: readonly [string, string, string, string],
) {
  const { rows } = await import('@/db/queries');
  return rows<CustomerActivityRow>(
    `${CUSTOMER_ACTIVITY_SELECT}
     ${CUSTOMER_ACTIVITY_GROUP}`,
    ...args,
  );
}

async function customerSalesHistory(customerId: string, limit: number) {
  const { rows } = await import('@/db/queries');
  const result = await rows<SaleHistoryRow>(
    `SELECT
       s.id,
       s.ticket,
       s.status,
       s.subtotal AS subtotalMinor,
       s.discount AS discountMinor,
       s.total AS totalMinor,
       COALESCE(
         (SELECT SUM(refund.amount) FROM refunds refund WHERE refund.saleId = s.id),
         0
       ) AS refundedMinor,
       MAX(
         0,
         s.total - COALESCE(
           (SELECT SUM(refund.amount) FROM refunds refund WHERE refund.saleId = s.id),
           0
         )
       ) AS netTotalMinor,
       COALESCE(SUM(i.quantity), 0) AS units,
       COALESCE(SUM(i.quantity - i.refunded), 0) AS retainedUnits,
       u.name AS sellerName,
       s.createdAt
     FROM sales s
     JOIN users u ON u.id = s.sellerId
     LEFT JOIN sale_items i ON i.saleId = s.id
     WHERE s.customerId = ?
     GROUP BY
       s.id,
       s.ticket,
       s.status,
       s.subtotal,
       s.discount,
       s.total,
       u.name,
       s.createdAt
     ORDER BY s.createdAt DESC, s.ticket DESC
     LIMIT ?`,
    customerId,
    limit,
  );
  return result.map<CustomerSaleHistoryEntry>((sale) => ({
    id: sale.id,
    ticket: databaseNonnegativeInteger('ticket', sale.ticket),
    status: sale.status,
    subtotalMinor: databaseNonnegativeInteger(
      'subtotalMinor',
      sale.subtotalMinor,
    ),
    discountMinor: databaseNonnegativeInteger(
      'discountMinor',
      sale.discountMinor,
    ),
    totalMinor: databaseNonnegativeInteger('totalMinor', sale.totalMinor),
    refundedMinor: databaseNonnegativeInteger(
      'refundedMinor',
      sale.refundedMinor,
    ),
    netTotalMinor: databaseNonnegativeInteger(
      'netTotalMinor',
      sale.netTotalMinor,
    ),
    units: databaseNonnegativeInteger('units', sale.units),
    retainedUnits: databaseNonnegativeInteger(
      'retainedUnits',
      sale.retainedUnits,
    ),
    sellerName: sale.sellerName,
    createdAt: sale.createdAt,
  }));
}

async function customerLoyaltyHistory(customerId: string, limit: number) {
  const { rows } = await import('@/db/queries');
  const result = await rows<LoyaltyHistoryRow>(
    `SELECT id, points, reason, reference, createdAt
     FROM loyalty_transactions
     WHERE customerId = ?
     ORDER BY createdAt DESC, rowid DESC
     LIMIT ?`,
    customerId,
    limit,
  );
  return result.map<CustomerLoyaltyHistoryEntry>((transaction) => ({
    id: transaction.id,
    points: databaseInteger('loyalty points', transaction.points),
    reason: transaction.reason,
    reference: transaction.reference,
    createdAt: transaction.createdAt,
  }));
}

/**
 * Loads the complete administrative view for one customer. Access is checked
 * here as well as at the route boundary, so seller-facing APIs cannot reuse it.
 */
export async function getCustomerIntelligence(
  actor: Actor,
  customerId: string,
  options: CustomerIntelligenceQueryOptions = {},
): Promise<CustomerIntelligence> {
  await requireCustomerIntelligenceAccess(actor);
  const id = validCustomerId(customerId);
  const { AppError } = await import('./auth');
  if (!id) throw new AppError(400, 'Cliente inválido.');
  const config = resolveCustomerIntelligenceConfig(options.config);
  const asOf = resolvedAsOf(options.asOf);
  const activityRow = await customerActivityRow(
    id,
    queryArguments(asOf.milliseconds, config),
  );
  if (!activityRow) throw new AppError(404, 'Cliente no encontrado.');

  const [sales, loyaltyTransactions] = await Promise.all([
    customerSalesHistory(id, config.historyLimit),
    customerLoyaltyHistory(id, config.historyLimit),
  ]);

  return {
    asOf: asOf.iso,
    config,
    metrics: metricsFromRow(activityRow, config, asOf.milliseconds),
    history: { sales, loyaltyTransactions },
  };
}

function shareBps(count: number, total: number) {
  return total ? Math.round((count * 10_000) / total) : 0;
}

/** Returns portfolio-level CRM metrics for ADMIN and GERENTE roles. */
export async function getCustomerInsights(
  actor: Actor,
  options: CustomerIntelligenceQueryOptions = {},
): Promise<CustomerInsights> {
  await requireCustomerIntelligenceAccess(actor);
  const config = resolveCustomerIntelligenceConfig(options.config);
  const asOf = resolvedAsOf(options.asOf);
  const activityRows = await allCustomerActivityRows(
    queryArguments(asOf.milliseconds, config),
  );
  const customers = activityRows.map((row) =>
    metricsFromRow(row, config, asOf.milliseconds),
  );

  const buyers = customers.filter((customer) => customer.purchaseCount > 0);
  const repeatCustomers = buyers.filter(
    (customer) => customer.purchaseCount > 1,
  ).length;
  const purchaseCount = customers.reduce(
    (total, customer) => total + customer.purchaseCount,
    0,
  );
  const lifetimeRevenueMinor = customers.reduce(
    (total, customer) => total + customer.lifetimeSpendMinor,
    0,
  );
  const evaluationWindowPurchaseCount = customers.reduce(
    (total, customer) => total + customer.purchasesInSegmentWindow,
    0,
  );
  const evaluationWindowRevenueMinor = customers.reduce(
    (total, customer) => total + customer.spendInSegmentWindowMinor,
    0,
  );

  const segments = CUSTOMER_SEGMENTS.map<CustomerSegmentInsight>((segment) => {
    const members = customers.filter(
      (customer) => customer.segment === segment,
    );
    return {
      segment,
      customers: members.length,
      shareBps: shareBps(members.length, customers.length),
      lifetimeSpendMinor: members.reduce(
        (total, customer) => total + customer.lifetimeSpendMinor,
        0,
      ),
      spendInEvaluationWindowMinor: members.reduce(
        (total, customer) => total + customer.spendInSegmentWindowMinor,
        0,
      ),
    };
  });

  const loyaltyLevels = LOYALTY_LEVELS.map<CustomerLevelInsight>((level) => {
    const members = customers.filter(
      (customer) => customer.loyaltyLevel === level,
    );
    return {
      level,
      customers: members.length,
      shareBps: shareBps(members.length, customers.length),
      lifetimeSpendMinor: members.reduce(
        (total, customer) => total + customer.lifetimeSpendMinor,
        0,
      ),
    };
  });

  const topCustomers = [...customers]
    .sort(
      (left, right) =>
        right.spendInLoyaltyWindowMinor - left.spendInLoyaltyWindowMinor ||
        right.lifetimeSpendMinor - left.lifetimeSpendMinor ||
        left.id.localeCompare(right.id),
    )
    .slice(0, config.topCustomerLimit)
    .map((customer) => ({
      id: customer.id,
      name: customer.name,
      surname: customer.surname,
      segment: customer.segment,
      loyaltyLevel: customer.loyaltyLevel,
      purchaseCount: customer.purchaseCount,
      lifetimeSpendMinor: customer.lifetimeSpendMinor,
      spendInLoyaltyWindowMinor: customer.spendInLoyaltyWindowMinor,
      lastPurchaseAt: customer.lastPurchaseAt,
    }));

  return {
    asOf: asOf.iso,
    config,
    customerCount: customers.length,
    customersWithPurchases: buyers.length,
    repeatCustomers,
    repeatCustomerRateBps: shareBps(repeatCustomers, buyers.length),
    purchaseCount,
    lifetimeRevenueMinor,
    evaluationWindowPurchaseCount,
    evaluationWindowRevenueMinor,
    averageTicketMinor: purchaseCount
      ? Math.round(lifetimeRevenueMinor / purchaseCount)
      : 0,
    averageCustomerValueMinor: buyers.length
      ? Math.round(lifetimeRevenueMinor / buyers.length)
      : 0,
    segments,
    loyaltyLevels,
    topCustomers,
  };
}
