import { rows } from '@/db/queries';
import { AppError } from './auth';
import type { Actor } from './auth';

const DAY_MS = 86_400_000;

export const DEFAULT_STOCK_REPLENISHMENT_CONFIG = {
  velocityWindowDays: 30,
  leadTimeDays: 14,
  safetyStockDays: 7,
  targetCoverageDays: 45,
  minimumOrderQuantity: 1,
} as const;

export type StockAlertStatus = 'sin_stock' | 'bajo_stock' | 'saludable';
export type StockAlertSeverity = 'critical' | 'warning' | 'none';

export interface StockReplenishmentConfig {
  /** Number of completed calendar days used to estimate recent demand. */
  velocityWindowDays: number;
  /** Expected supplier delivery time. */
  leadTimeDays: number;
  /** Extra demand days protected against sales variability or delays. */
  safetyStockDays: number;
  /** Desired coverage after receiving the suggested order. */
  targetCoverageDays: number;
  /** Smallest useful order when a replenishment is recommended. */
  minimumOrderQuantity: number;
}

export type StockReplenishmentConfigInput = Partial<StockReplenishmentConfig>;

export interface StockReplenishmentSourceRow {
  variantId: string;
  productId: string;
  productName: string;
  category: string;
  brand: string;
  sku: string;
  barcode: string;
  color: string;
  size: string;
  availableUnits: number;
  minimumUnits: number;
  soldUnitsWindow: number;
  lastSaleAt: string | null;
  supplierId: string | null;
  supplierName: string | null;
}

export interface StockReplenishmentItem {
  variantId: string;
  productId: string;
  productName: string;
  category: string;
  brand: string;
  sku: string;
  barcode: string;
  color: string;
  size: string;
  supplier: { id: string; name: string | null } | null;
  velocity: {
    windowDays: number;
    soldUnits: number;
    dailyUnits: number;
    lastSaleAt: string | null;
  };
  stock: {
    availableUnits: number;
    minimumUnits: number;
    coverageDays: number | null;
    reorderPointUnits: number;
    targetUnits: number;
  };
  recommendation: {
    status: StockAlertStatus;
    severity: StockAlertSeverity;
    suggestedOrderUnits: number;
    reason: string;
  };
}

export interface StockReplenishmentReport {
  generatedAt: string;
  windowStart: string;
  config: StockReplenishmentConfig;
  summary: {
    totalVariants: number;
    outOfStock: number;
    lowStock: number;
    healthy: number;
    suggestedOrderUnits: number;
    variantsWithSupplier: number;
    variantsWithoutSupplier: number;
  };
  alerts: StockReplenishmentItem[];
  items: StockReplenishmentItem[];
}

export interface StockReplenishmentOptions {
  asOf?: string | Date;
  config?: StockReplenishmentConfigInput;
}

type QueryRows = <T = Record<string, unknown>>(
  sql: string,
  ...values: unknown[]
) => Promise<T[]>;

function boundedInteger(
  label: string,
  value: unknown,
  minimum: number,
  maximum: number,
) {
  if (
    !Number.isSafeInteger(value) ||
    Number(value) < minimum ||
    Number(value) > maximum
  )
    throw new AppError(
      400,
      `${label} debe ser un entero entre ${minimum} y ${maximum}.`,
    );
  return Number(value);
}

function nonnegativeDatabaseInteger(label: string, value: unknown) {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0)
    throw new AppError(500, `Dato inválido de inventario: ${label}.`);
  return value;
}

function requiredText(label: string, value: unknown) {
  if (typeof value !== 'string' || !value.trim())
    throw new AppError(500, `Dato inválido de inventario: ${label}.`);
  return value;
}

function nullableText(label: string, value: unknown) {
  if (value === null) return null;
  return requiredText(label, value);
}

function rounded(value: number, precision: number) {
  const factor = 10 ** precision;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function resolveAsOf(value?: string | Date) {
  const date = value === undefined ? new Date() : new Date(value);
  if (!Number.isFinite(date.getTime()))
    throw new AppError(400, 'La fecha de cálculo no es válida.');
  return date;
}

export function resolveStockReplenishmentConfig(
  input: StockReplenishmentConfigInput = {},
): StockReplenishmentConfig {
  const config: StockReplenishmentConfig = {
    velocityWindowDays: boundedInteger(
      'La ventana de velocidad',
      input.velocityWindowDays ??
        DEFAULT_STOCK_REPLENISHMENT_CONFIG.velocityWindowDays,
      1,
      365,
    ),
    leadTimeDays: boundedInteger(
      'El plazo de entrega',
      input.leadTimeDays ?? DEFAULT_STOCK_REPLENISHMENT_CONFIG.leadTimeDays,
      0,
      365,
    ),
    safetyStockDays: boundedInteger(
      'El stock de seguridad',
      input.safetyStockDays ??
        DEFAULT_STOCK_REPLENISHMENT_CONFIG.safetyStockDays,
      0,
      365,
    ),
    targetCoverageDays: boundedInteger(
      'La cobertura objetivo',
      input.targetCoverageDays ??
        DEFAULT_STOCK_REPLENISHMENT_CONFIG.targetCoverageDays,
      1,
      730,
    ),
    minimumOrderQuantity: boundedInteger(
      'La cantidad mínima de pedido',
      input.minimumOrderQuantity ??
        DEFAULT_STOCK_REPLENISHMENT_CONFIG.minimumOrderQuantity,
      1,
      100_000,
    ),
  };
  const protectedDays = config.leadTimeDays + config.safetyStockDays;
  if (config.targetCoverageDays < protectedDays)
    throw new AppError(
      400,
      'La cobertura objetivo debe incluir el plazo de entrega y el stock de seguridad.',
    );
  return config;
}

function normalizeSourceRow(
  row: StockReplenishmentSourceRow,
): StockReplenishmentSourceRow {
  const supplierId = nullableText('supplierId', row.supplierId);
  const supplierName = nullableText('supplierName', row.supplierName);
  return {
    variantId: requiredText('variantId', row.variantId),
    productId: requiredText('productId', row.productId),
    productName: requiredText('productName', row.productName),
    category: requiredText('category', row.category),
    brand: requiredText('brand', row.brand),
    sku: requiredText('sku', row.sku),
    barcode: requiredText('barcode', row.barcode),
    color: requiredText('color', row.color),
    size: requiredText('size', row.size),
    availableUnits: nonnegativeDatabaseInteger(
      'availableUnits',
      row.availableUnits,
    ),
    minimumUnits: nonnegativeDatabaseInteger('minimumUnits', row.minimumUnits),
    soldUnitsWindow: nonnegativeDatabaseInteger(
      'soldUnitsWindow',
      row.soldUnitsWindow,
    ),
    lastSaleAt:
      row.lastSaleAt === null
        ? null
        : requiredText('lastSaleAt', row.lastSaleAt),
    supplierId,
    supplierName: supplierId ? supplierName : null,
  };
}

/**
 * Converts one inventory/demand snapshot into an actionable recommendation.
 * This function is pure and deliberately has no commercial or financial fields.
 */
export function calculateStockReplenishment(
  source: StockReplenishmentSourceRow,
  configInput: StockReplenishmentConfigInput = {},
): StockReplenishmentItem {
  const config = resolveStockReplenishmentConfig(configInput);
  const row = normalizeSourceRow(source);
  const exactDailyVelocity = row.soldUnitsWindow / config.velocityWindowDays;
  const reorderPointUnits = Math.max(
    row.minimumUnits,
    Math.ceil(
      exactDailyVelocity * (config.leadTimeDays + config.safetyStockDays),
    ),
  );
  const targetUnits = Math.max(
    row.minimumUnits * 2,
    reorderPointUnits,
    Math.ceil(exactDailyVelocity * config.targetCoverageDays),
    config.minimumOrderQuantity,
  );
  const coverageDays = exactDailyVelocity
    ? rounded(row.availableUnits / exactDailyVelocity, 1)
    : null;

  let status: StockAlertStatus = 'saludable';
  let severity: StockAlertSeverity = 'none';
  let reason = 'El stock está por encima del punto de reposición.';
  if (row.availableUnits === 0) {
    status = 'sin_stock';
    severity = 'critical';
    reason = `Sin stock. Se vendieron ${row.soldUnitsWindow} unidades netas en los últimos ${config.velocityWindowDays} días.`;
  } else if (row.availableUnits <= reorderPointUnits) {
    status = 'bajo_stock';
    severity = 'warning';
    reason = exactDailyVelocity
      ? 'El stock disponible alcanzó el punto de reposición calculado.'
      : 'El stock disponible está en el mínimo configurado o por debajo.';
  }

  const shortfall = Math.max(0, targetUnits - row.availableUnits);
  const suggestedOrderUnits =
    status === 'saludable'
      ? 0
      : Math.max(config.minimumOrderQuantity, shortfall);

  return {
    variantId: row.variantId,
    productId: row.productId,
    productName: row.productName,
    category: row.category,
    brand: row.brand,
    sku: row.sku,
    barcode: row.barcode,
    color: row.color,
    size: row.size,
    supplier: row.supplierId
      ? { id: row.supplierId, name: row.supplierName }
      : null,
    velocity: {
      windowDays: config.velocityWindowDays,
      soldUnits: row.soldUnitsWindow,
      dailyUnits: rounded(exactDailyVelocity, 4),
      lastSaleAt: row.lastSaleAt,
    },
    stock: {
      availableUnits: row.availableUnits,
      minimumUnits: row.minimumUnits,
      coverageDays,
      reorderPointUnits,
      targetUnits,
    },
    recommendation: {
      status,
      severity,
      suggestedOrderUnits,
      reason,
    },
  };
}

function severityRank(severity: StockAlertSeverity) {
  if (severity === 'critical') return 0;
  if (severity === 'warning') return 1;
  return 2;
}

function compareItems(
  left: StockReplenishmentItem,
  right: StockReplenishmentItem,
) {
  return (
    severityRank(left.recommendation.severity) -
      severityRank(right.recommendation.severity) ||
    (left.stock.coverageDays ?? Number.POSITIVE_INFINITY) -
      (right.stock.coverageDays ?? Number.POSITIVE_INFINITY) ||
    right.velocity.dailyUnits - left.velocity.dailyUnits ||
    left.productName.localeCompare(right.productName) ||
    left.variantId.localeCompare(right.variantId)
  );
}

/** Builds and sorts a complete report from already aggregated source rows. */
export function buildStockReplenishmentReport(
  sourceRows: StockReplenishmentSourceRow[],
  options: StockReplenishmentOptions = {},
): StockReplenishmentReport {
  const config = resolveStockReplenishmentConfig(options.config);
  const asOf = resolveAsOf(options.asOf);
  const generatedAt = asOf.toISOString();
  const windowStart = new Date(
    asOf.getTime() - config.velocityWindowDays * DAY_MS,
  ).toISOString();
  const items = sourceRows
    .map((row) => calculateStockReplenishment(row, config))
    .sort(compareItems);
  const alerts = items.filter(
    (item) => item.recommendation.status !== 'saludable',
  );

  return {
    generatedAt,
    windowStart,
    config,
    summary: {
      totalVariants: items.length,
      outOfStock: items.filter(
        (item) => item.recommendation.status === 'sin_stock',
      ).length,
      lowStock: items.filter(
        (item) => item.recommendation.status === 'bajo_stock',
      ).length,
      healthy: items.filter(
        (item) => item.recommendation.status === 'saludable',
      ).length,
      suggestedOrderUnits: alerts.reduce(
        (total, item) => total + item.recommendation.suggestedOrderUnits,
        0,
      ),
      variantsWithSupplier: items.filter((item) => item.supplier).length,
      variantsWithoutSupplier: items.filter((item) => !item.supplier).length,
    },
    alerts,
    items,
  };
}

export function requireStockReplenishmentAccess(actor: Pick<Actor, 'role'>) {
  if (actor.role !== 'ADMIN' && actor.role !== 'GERENTE')
    throw new AppError(403, 'Acceso denegado.');
}

/**
 * Loads active variants, current stock, net units sold during the configured
 * window and the optional supplier from D1. Only ADMIN and GERENTE may call it.
 *
 * Recommended integration:
 * 1. Add a protected GET resource such as `stock-replenishment` and pass the
 *    authenticated Actor to this function.
 * 2. Render `alerts` in the administrative stock/purchases workspace and use
 *    `supplier` plus `suggestedOrderUnits` to prefill a draft purchase order.
 * 3. Keep the seller catalog on its existing allowlisted query. Do not reuse an
 *    administrative inventory response for POS, even though this report itself
 *    excludes internal financial fields.
 * 4. Persist store-specific lead/safety/coverage values in settings later and
 *    pass them as `options.config`; the defaults are intentionally conservative.
 */
export async function getStockReplenishment(
  actor: Actor,
  options: StockReplenishmentOptions = {},
  query: QueryRows = rows,
): Promise<StockReplenishmentReport> {
  requireStockReplenishmentAccess(actor);
  const config = resolveStockReplenishmentConfig(options.config);
  const asOf = resolveAsOf(options.asOf);
  const generatedAt = asOf.toISOString();
  const windowStart = new Date(
    asOf.getTime() - config.velocityWindowDays * DAY_MS,
  ).toISOString();
  const sourceRows = await query<StockReplenishmentSourceRow>(
    `SELECT
       v.id AS variantId,
       v.productId,
       p.name AS productName,
       p.category,
       p.brand,
       v.sku,
       v.barcode,
       v.color,
       v.size,
       v.stock AS availableUnits,
       v.minimum AS minimumUnits,
       COALESCE(SUM(
         CASE
           WHEN s.id IS NOT NULL AND si.quantity > si.refunded
             THEN si.quantity - si.refunded
           ELSE 0
         END
       ), 0) AS soldUnitsWindow,
       MAX(s.createdAt) AS lastSaleAt,
       p.supplierId,
       supplier.name AS supplierName
     FROM variants v
     JOIN products p ON p.id = v.productId
     LEFT JOIN suppliers supplier ON supplier.id = p.supplierId
     LEFT JOIN sale_items si ON si.variantId = v.id
     LEFT JOIN sales s
       ON s.id = si.saleId
      AND s.status IN ('confirmed', 'partially_refunded')
      AND s.createdAt >= ?
      AND s.createdAt <= ?
     WHERE p.active = 1
     GROUP BY
       v.id, v.productId, p.name, p.category, p.brand, v.sku, v.barcode,
       v.color, v.size, v.stock, v.minimum, p.supplierId, supplier.name
     ORDER BY p.name, v.color, v.size, v.id`,
    windowStart,
    generatedAt,
  );

  return buildStockReplenishmentReport(sourceRows, {
    asOf: generatedAt,
    config,
  });
}
