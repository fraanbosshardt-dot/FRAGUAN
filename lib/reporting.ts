import { z } from 'zod';
import { one, rows } from '@/db/queries';
import { Actor, AppError, requirePermission } from './auth';

const filtersSchema = z
  .object({
    from: z.iso.date(),
    to: z.iso.date(),
    sellerId: z.string().trim().min(1).max(128).optional(),
    category: z.string().trim().min(1).max(100).optional(),
    brand: z.string().trim().min(1).max(100).optional(),
    supplierId: z.string().trim().min(1).max(128).optional(),
    methodId: z.string().trim().min(1).max(128).optional(),
  })
  .strict();
export type BusinessReportFilters = z.infer<typeof filtersSchema>;

function dateAtArgentinaMidnight(date: string) {
  return `${date}T00:00:00-03:00`;
}

function addDays(date: string, days: number) {
  const value = new Date(`${date}T12:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function daysBetween(from: string, to: string) {
  return (
    (Date.parse(`${to}T12:00:00.000Z`) - Date.parse(`${from}T12:00:00.000Z`)) /
      86400000 +
    1
  );
}

function comparisonValue(current: number, previous: number) {
  return {
    current,
    previous,
    change: current - previous,
    changeBps:
      previous === 0
        ? current === 0
          ? 0
          : null
        : Math.round(((current - previous) * 10000) / previous),
  };
}

function saleConditions(
  filters: BusinessReportFilters,
  from: string,
  throughExclusive: string,
) {
  const clauses = [
    "s.status IN ('confirmed','partially_refunded')",
    's.createdAt>=?',
    's.createdAt<?',
  ];
  const values: unknown[] = [
    dateAtArgentinaMidnight(from),
    dateAtArgentinaMidnight(throughExclusive),
  ];
  if (filters.sellerId) {
    clauses.push('s.sellerId=?');
    values.push(filters.sellerId);
  }
  if (filters.methodId) {
    clauses.push(
      'EXISTS(SELECT 1 FROM payments filter_payment WHERE filter_payment.saleId=s.id AND filter_payment.methodId=?)',
    );
    values.push(filters.methodId);
  }
  if (filters.category || filters.brand || filters.supplierId) {
    const productClauses = [
      'filter_item.saleId=s.id',
      'filter_item.quantity>filter_item.refunded',
    ];
    if (filters.category) {
      productClauses.push('filter_product.category=?');
      values.push(filters.category);
    }
    if (filters.brand) {
      productClauses.push('filter_product.brand=?');
      values.push(filters.brand);
    }
    if (filters.supplierId) {
      productClauses.push('filter_product.supplierId=?');
      values.push(filters.supplierId);
    }
    clauses.push(
      `EXISTS(
        SELECT 1
          FROM sale_items filter_item
          JOIN variants filter_variant ON filter_variant.id=filter_item.variantId
          JOIN products filter_product ON filter_product.id=filter_variant.productId
         WHERE ${productClauses.join(' AND ')}
      )`,
    );
  }
  return { sql: clauses.join(' AND '), values };
}

function productConditions(filters: BusinessReportFilters, alias: string) {
  const clauses: string[] = [];
  const values: unknown[] = [];
  if (filters.category) {
    clauses.push(`${alias}.category=?`);
    values.push(filters.category);
  }
  if (filters.brand) {
    clauses.push(`${alias}.brand=?`);
    values.push(filters.brand);
  }
  if (filters.supplierId) {
    clauses.push(`${alias}.supplierId=?`);
    values.push(filters.supplierId);
  }
  return { clauses, values };
}

/**
 * Canonical line-level view for every commercial report total. Discounts,
 * surcharges, refunds and commissions are allocated in integer cents. The last
 * retained line receives the rounding remainder, so unfiltered lines reconcile
 * exactly with each sale.
 */
function lineFacts(
  filters: BusinessReportFilters,
  from: string,
  throughExclusive: string,
) {
  const sales = saleConditions(filters, from, throughExclusive);
  const products = productConditions(filters, 'line_facts');
  return {
    values: [...sales.values, ...products.values],
    sql: `
      WITH refund_totals AS (
        SELECT saleId,SUM(amount) AS refundedMinor
          FROM refunds
         GROUP BY saleId
      ),
      payment_totals AS (
        SELECT saleId,SUM(commission) AS commissionMinor
          FROM payments
         GROUP BY saleId
      ),
      eligible_sales AS (
        SELECT s.id,s.sellerId,s.customerId,s.total,s.createdAt,
               s.total-COALESCE(refund_totals.refundedMinor,0) AS netRevenueMinor,
               CASE
                 WHEN s.total>0 THEN CAST(
                   COALESCE(payment_totals.commissionMinor,0)
                   *(s.total-COALESCE(refund_totals.refundedMinor,0))/s.total
                   AS INTEGER
                 )
                 ELSE 0
               END AS netCommissionMinor
          FROM sales s
          LEFT JOIN refund_totals ON refund_totals.saleId=s.id
          LEFT JOIN payment_totals ON payment_totals.saleId=s.id
         WHERE ${sales.sql}
      ),
      raw_lines AS (
        SELECT eligible_sales.id AS saleId,eligible_sales.sellerId,
               eligible_sales.customerId,eligible_sales.createdAt,
               eligible_sales.total AS originalSaleTotalMinor,
               eligible_sales.netRevenueMinor,
               eligible_sales.netCommissionMinor,
               item.id AS saleItemId,item.variantId,
               item.quantity-item.refunded AS units,
               item.cost*(item.quantity-item.refunded) AS costMinor,
               item.price*(item.quantity-item.refunded) AS retainedGrossMinor,
               product.id AS productId,product.name AS productName,
               product.category,product.brand,product.supplierId,
               COALESCE(supplier.name,'Sin proveedor') AS supplierName,
               user.id AS sellerIdValue,user.name AS sellerName,
               SUM(item.price*(item.quantity-item.refunded)) OVER (
                 PARTITION BY eligible_sales.id
               ) AS saleRetainedGrossMinor,
               ROW_NUMBER() OVER (
                 PARTITION BY eligible_sales.id ORDER BY item.rowid DESC
               ) AS allocationRank
          FROM eligible_sales
          JOIN sale_items item ON item.saleId=eligible_sales.id
          JOIN variants variant ON variant.id=item.variantId
          JOIN products product ON product.id=variant.productId
          LEFT JOIN suppliers supplier ON supplier.id=product.supplierId
          JOIN users user ON user.id=eligible_sales.sellerId
         WHERE item.quantity>item.refunded
      ),
      base_lines AS (
        SELECT raw_lines.*,
               CASE
                 WHEN saleRetainedGrossMinor>0 THEN CAST(
                   netRevenueMinor*retainedGrossMinor/saleRetainedGrossMinor
                   AS INTEGER
                 )
                 ELSE 0
               END AS baseRevenueMinor,
               CASE
                 WHEN saleRetainedGrossMinor>0 THEN CAST(
                   netCommissionMinor*retainedGrossMinor/saleRetainedGrossMinor
                   AS INTEGER
                 )
                 ELSE 0
               END AS baseCommissionMinor
          FROM raw_lines
      ),
      line_facts AS (
        SELECT base_lines.*,
               baseRevenueMinor+CASE
                 WHEN allocationRank=1 THEN netRevenueMinor-SUM(baseRevenueMinor) OVER (
                   PARTITION BY saleId
                 )
                 ELSE 0
               END AS revenueMinor,
               baseCommissionMinor+CASE
                 WHEN allocationRank=1 THEN netCommissionMinor-SUM(baseCommissionMinor) OVER (
                   PARTITION BY saleId
                 )
                 ELSE 0
               END AS commissionMinor
          FROM base_lines
      ),
      report_lines AS (
        SELECT *
          FROM line_facts
         ${products.clauses.length ? `WHERE ${products.clauses.join(' AND ')}` : ''}
      )`,
  };
}

type Metrics = {
  revenueMinor: number;
  tickets: number;
  units: number;
  costMinor: number;
  commissionMinor: number;
  grossProfitMinor: number;
  marginBps: number;
  averageTicketMinor: number;
  newCustomers: number;
  repeatCustomers: number;
};

async function periodMetrics(
  filters: BusinessReportFilters,
  from: string,
  throughExclusive: string,
): Promise<Metrics> {
  const facts = lineFacts(filters, from, throughExclusive);
  const customerWhere = saleConditions(filters, from, throughExclusive);
  const [base, customers] = await Promise.all([
    one<Record<string, unknown>>(
      `${facts.sql}
       SELECT COALESCE(SUM(revenueMinor),0) AS revenueMinor,
              COUNT(DISTINCT saleId) AS tickets,
              COALESCE(SUM(units),0) AS units,
              COALESCE(SUM(costMinor),0) AS costMinor,
              COALESCE(SUM(commissionMinor),0) AS commissionMinor
         FROM report_lines`,
      ...facts.values,
    ),
    one<Record<string, unknown>>(
      `SELECT
         COALESCE(SUM(CASE WHEN customer_period.firstPurchase>=? THEN 1 ELSE 0 END),0) AS newCustomers,
         COALESCE(SUM(CASE WHEN customer_period.purchasesBefore>0 THEN 1 ELSE 0 END),0) AS repeatCustomers
       FROM (
         SELECT s.customerId,
                (SELECT MIN(first_sale.createdAt)
                   FROM sales first_sale
                  WHERE first_sale.customerId=s.customerId
                    AND first_sale.status IN ('confirmed','partially_refunded')) AS firstPurchase,
                (SELECT COUNT(*)
                   FROM sales previous_sale
                  WHERE previous_sale.customerId=s.customerId
                    AND previous_sale.status IN ('confirmed','partially_refunded')
                    AND previous_sale.createdAt<?) AS purchasesBefore
           FROM sales s
          WHERE ${customerWhere.sql} AND s.customerId IS NOT NULL
          GROUP BY s.customerId
       ) customer_period`,
      dateAtArgentinaMidnight(from),
      dateAtArgentinaMidnight(from),
      ...customerWhere.values,
    ),
  ]);
  const revenue = Number(base?.revenueMinor ?? 0);
  const cost = Number(base?.costMinor ?? 0);
  const commission = Number(base?.commissionMinor ?? 0);
  const tickets = Number(base?.tickets ?? 0);
  const grossProfit = revenue - cost - commission;
  return {
    revenueMinor: revenue,
    tickets,
    units: Number(base?.units ?? 0),
    costMinor: cost,
    commissionMinor: commission,
    grossProfitMinor: grossProfit,
    marginBps: revenue ? Math.round((grossProfit * 10000) / revenue) : 0,
    averageTicketMinor: tickets ? Math.round(revenue / tickets) : 0,
    newCustomers: Number(customers?.newCustomers ?? 0),
    repeatCustomers: Number(customers?.repeatCustomers ?? 0),
  };
}

function productsWithoutSalesQuery(filters: BusinessReportFilters) {
  const candidates = productConditions(filters, 'product');
  const saleClauses = [
    'variant.productId=product.id',
    "sale.status IN ('confirmed','partially_refunded')",
    'item.quantity>item.refunded',
    'sale.createdAt>=?',
    'sale.createdAt<?',
  ];
  const saleValues: unknown[] = [];
  if (filters.sellerId) {
    saleClauses.push('sale.sellerId=?');
    saleValues.push(filters.sellerId);
  }
  if (filters.methodId) {
    saleClauses.push(
      'EXISTS(SELECT 1 FROM payments filter_payment WHERE filter_payment.saleId=sale.id AND filter_payment.methodId=?)',
    );
    saleValues.push(filters.methodId);
  }
  return {
    sql: `SELECT product.id,product.name,product.category,product.brand,
                 (SELECT MAX(history_sale.createdAt)
                    FROM variants history_variant
                    JOIN sale_items history_item ON history_item.variantId=history_variant.id
                    JOIN sales history_sale ON history_sale.id=history_item.saleId
                   WHERE history_variant.productId=product.id
                     AND history_item.quantity>history_item.refunded
                     AND history_sale.status IN ('confirmed','partially_refunded')) AS lastSaleAt
            FROM products product
           WHERE product.active=1
             ${candidates.clauses.length ? `AND ${candidates.clauses.join(' AND ')}` : ''}
             AND NOT EXISTS(
               SELECT 1
                 FROM variants variant
                 JOIN sale_items item ON item.variantId=variant.id
                 JOIN sales sale ON sale.id=item.saleId
                WHERE ${saleClauses.join(' AND ')}
             )
           ORDER BY product.name
           LIMIT 100`,
    candidateValues: candidates.values,
    saleValues,
  };
}

export async function getBusinessReport(actor: Actor, raw: unknown) {
  requirePermission(actor, 'reports');
  const filters = filtersSchema.parse(raw);
  if (filters.to < filters.from)
    throw new AppError(400, 'La fecha final debe ser posterior a la inicial.');
  const length = daysBetween(filters.from, filters.to);
  if (length > 731)
    throw new AppError(400, 'El reporte admite hasta dos años por consulta.');
  const throughExclusive = addDays(filters.to, 1);
  const previousTo = addDays(filters.from, -1);
  const previousFrom = addDays(previousTo, -(length - 1));
  const [current, previous] = await Promise.all([
    periodMetrics(filters, filters.from, throughExclusive),
    periodMetrics(filters, previousFrom, filters.from),
  ]);
  const facts = lineFacts(filters, filters.from, throughExclusive);
  const noSales = productsWithoutSalesQuery(filters);
  const noSalesValues = [
    ...noSales.candidateValues,
    dateAtArgentinaMidnight(filters.from),
    dateAtArgentinaMidnight(throughExclusive),
    ...noSales.saleValues,
  ];
  const [
    trend,
    byProduct,
    byCategory,
    byBrand,
    bySupplier,
    bySeller,
    byPayment,
    stagnantProducts,
  ] = await Promise.all([
    rows(
      `${facts.sql}
       SELECT date(createdAt,'-3 hours') AS date,
              SUM(revenueMinor) AS revenueMinor,
              COUNT(DISTINCT saleId) AS tickets
         FROM report_lines
        GROUP BY date(createdAt,'-3 hours')
        ORDER BY date`,
      ...facts.values,
    ),
    rows(
      `${facts.sql}
       SELECT productId AS id,productName AS name,SUM(units) AS units,
              SUM(revenueMinor) AS revenueMinor,SUM(costMinor) AS costMinor,
              SUM(commissionMinor) AS commissionMinor
         FROM report_lines
        GROUP BY productId,productName
        ORDER BY revenueMinor DESC
        LIMIT 100`,
      ...facts.values,
    ),
    rows(
      `${facts.sql}
       SELECT category AS name,SUM(units) AS units,SUM(revenueMinor) AS revenueMinor
         FROM report_lines
        GROUP BY category
        ORDER BY revenueMinor DESC`,
      ...facts.values,
    ),
    rows(
      `${facts.sql}
       SELECT brand AS name,SUM(units) AS units,SUM(revenueMinor) AS revenueMinor
         FROM report_lines
        GROUP BY brand
        ORDER BY revenueMinor DESC`,
      ...facts.values,
    ),
    rows(
      `${facts.sql}
       SELECT supplierId AS id,supplierName AS name,SUM(units) AS units,
              SUM(revenueMinor) AS revenueMinor
         FROM report_lines
        GROUP BY supplierId,supplierName
        ORDER BY revenueMinor DESC`,
      ...facts.values,
    ),
    rows(
      `${facts.sql}
       SELECT sellerIdValue AS id,sellerName AS name,
              COUNT(DISTINCT saleId) AS tickets,SUM(revenueMinor) AS revenueMinor
         FROM report_lines
        GROUP BY sellerIdValue,sellerName
        ORDER BY revenueMinor DESC`,
      ...facts.values,
    ),
    rows(
      `${facts.sql},
       report_sales AS (
         SELECT saleId,MAX(originalSaleTotalMinor) AS originalSaleTotalMinor,
                SUM(revenueMinor) AS reportRevenueMinor,
                SUM(commissionMinor) AS reportCommissionMinor
           FROM report_lines
          GROUP BY saleId
       ),
       raw_payment_allocations AS (
         SELECT report_sales.saleId,payment.methodId,method.name,
                report_sales.reportRevenueMinor,report_sales.reportCommissionMinor,
                payment.amount,payment.commission,
                SUM(payment.commission) OVER (PARTITION BY report_sales.saleId) AS saleCommissionMinor,
                ROW_NUMBER() OVER (
                  PARTITION BY report_sales.saleId ORDER BY payment.rowid DESC
                ) AS allocationRank,
                CASE
                  WHEN report_sales.originalSaleTotalMinor>0 THEN CAST(
                    report_sales.reportRevenueMinor*payment.amount/report_sales.originalSaleTotalMinor
                    AS INTEGER
                  )
                  ELSE 0
                END AS baseRevenueMinor
           FROM report_sales
           JOIN payments payment ON payment.saleId=report_sales.saleId
           JOIN payment_methods method ON method.id=payment.methodId
       ),
       payment_allocations AS (
         SELECT raw_payment_allocations.*,
                baseRevenueMinor+CASE
                  WHEN allocationRank=1 THEN reportRevenueMinor-SUM(baseRevenueMinor) OVER (
                    PARTITION BY saleId
                  )
                  ELSE 0
                END AS revenueMinor,
                CASE
                  WHEN saleCommissionMinor>0 THEN CAST(
                    reportCommissionMinor*commission/saleCommissionMinor AS INTEGER
                  )
                  ELSE 0
                END AS allocatedCommissionMinor
           FROM raw_payment_allocations
       ),
       final_payment_allocations AS (
         SELECT payment_allocations.*,
                allocatedCommissionMinor+CASE
                  WHEN allocationRank=1 THEN reportCommissionMinor-SUM(allocatedCommissionMinor) OVER (
                    PARTITION BY saleId
                  )
                  ELSE 0
                END AS commissionMinor
           FROM payment_allocations
       )
       SELECT methodId AS id,name,SUM(revenueMinor) AS revenueMinor,
              SUM(commissionMinor) AS commissionMinor
         FROM final_payment_allocations
        GROUP BY methodId,name
        ORDER BY revenueMinor DESC`,
      ...facts.values,
    ),
    rows(noSales.sql, ...noSalesValues),
  ]);
  return {
    period: { from: filters.from, to: filters.to, days: length },
    previousPeriod: { from: previousFrom, to: previousTo, days: length },
    filters,
    current,
    previous,
    comparison: Object.fromEntries(
      Object.keys(current).map((key) => [
        key,
        comparisonValue(
          current[key as keyof Metrics],
          previous[key as keyof Metrics],
        ),
      ]),
    ),
    trend,
    breakdowns: {
      products: byProduct,
      categories: byCategory,
      brands: byBrand,
      suppliers: bySupplier,
      sellers: bySeller,
      paymentMethods: byPayment,
    },
    productsWithoutSales: stagnantProducts,
  };
}
