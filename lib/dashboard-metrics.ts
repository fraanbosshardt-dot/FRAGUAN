const netSalesCte = `WITH refund_totals AS (
  SELECT saleId, SUM(amount) AS refunded
  FROM refunds
  GROUP BY saleId
), net_sales AS (
  SELECT s.*, MAX(0, s.total - COALESCE(r.refunded, 0)) AS netTotal
  FROM sales s
  LEFT JOIN refund_totals r ON r.saleId = s.id
  WHERE s.status IN ('confirmed', 'partially_refunded')
)`;

const summary = (where = '') => `${netSalesCte}
SELECT
  COALESCE(SUM(netTotal), 0) AS revenue,
  COUNT(*) AS tickets,
  CASE
    WHEN COUNT(*) = 0 THEN 0
    ELSE ROUND(SUM(netTotal) * 1.0 / COUNT(*))
  END AS average
FROM net_sales${where ? `\nWHERE ${where}` : ''}`;

/**
 * Dashboard queries share one definition of a valid sale: a confirmed sale or a
 * partially refunded sale, valued at the original total less every refund.
 * Fully refunded and cancelled sales do not count as tickets.
 */
export const dashboardSql = {
  total: summary(),
  month: summary(
    "date(createdAt, '-3 hours') >= date(?, '-3 hours', 'start of month') AND date(createdAt, '-3 hours') <= date(?, '-3 hours')",
  ),
  today: summary("date(createdAt, '-3 hours') = date(?, '-3 hours')"),
  previousDay: summary(
    "date(createdAt, '-3 hours') = date(?, '-3 hours', '-1 day')",
  ),
  previousMonth: `${netSalesCte}, previous_month_bounds AS (
  SELECT
    date(?, '-3 hours', 'start of month', '-1 month') AS startsOn,
    MIN(
      date(?, '-3 hours', 'start of month'),
      date(
        ?,
        '-3 hours',
        'start of month',
        '-1 month',
        '+' || CAST(strftime('%d', ?, '-3 hours') AS INTEGER) || ' days'
      )
    ) AS endsBefore
)
SELECT
  COALESCE(SUM(netTotal), 0) AS revenue,
  COUNT(*) AS tickets,
  CASE
    WHEN COUNT(*) = 0 THEN 0
    ELSE ROUND(SUM(netTotal) * 1.0 / COUNT(*))
  END AS average
FROM net_sales, previous_month_bounds
WHERE date(createdAt, '-3 hours') >= startsOn
  AND date(createdAt, '-3 hours') < endsBefore`,
  costs: `${netSalesCte}
SELECT
  COALESCE(SUM(i.cost * (i.quantity - i.refunded)), 0) AS cost,
  COALESCE(SUM(i.quantity - i.refunded), 0) AS units
FROM sale_items i
JOIN net_sales s ON s.id = i.saleId`,
  fees: `${netSalesCte}, payment_fees AS (
  SELECT saleId, SUM(commission) AS commission
  FROM payments
  GROUP BY saleId
)
SELECT COALESCE(SUM(
  CASE
    WHEN s.total <= 0 THEN 0
    ELSE ROUND(p.commission * s.netTotal * 1.0 / s.total)
  END
), 0) AS fees
FROM net_sales s
JOIN payment_fees p ON p.saleId = s.id`,
  expenses: 'SELECT COALESCE(SUM(amount),0) AS total FROM expenses',
  inventory:
    'SELECT SUM(stock) AS units,SUM(stock*cost) AS capital,SUM(stock*price) AS potential, SUM(CASE WHEN stock<=minimum THEN 1 ELSE 0 END) AS low FROM variants',
  trend: `${netSalesCte}
SELECT date(createdAt, '-3 hours') AS date, SUM(netTotal) AS total
FROM net_sales
GROUP BY date(createdAt, '-3 hours')
ORDER BY date DESC
LIMIT 30`,
  best: `${netSalesCte}, retained_sales AS (
  SELECT
    saleId,
    SUM(price * (quantity - refunded)) AS retainedGross
  FROM sale_items
  GROUP BY saleId
)
SELECT
  i.name,
  SUM(i.quantity - i.refunded) AS units,
  ROUND(SUM(
    CASE
      WHEN retained_sales.retainedGross <= 0 THEN 0
      ELSE s.netTotal * i.price * (i.quantity - i.refunded) * 1.0
        / retained_sales.retainedGross
    END
  )) AS total
FROM sale_items i
JOIN net_sales s ON s.id = i.saleId
JOIN retained_sales ON retained_sales.saleId = s.id
GROUP BY i.name
HAVING SUM(i.quantity - i.refunded) > 0
ORDER BY units DESC, total DESC
LIMIT 5`,
  byPayment: `${netSalesCte}
SELECT
  m.name,
  ROUND(SUM(
    CASE
      WHEN s.total <= 0 THEN 0
      ELSE p.amount * s.netTotal * 1.0 / s.total
    END
  )) AS total
FROM payments p
JOIN net_sales s ON s.id = p.saleId
JOIN payment_methods m ON m.id = p.methodId
GROUP BY m.id, m.name
ORDER BY total DESC, m.name`,
  sellers: `${netSalesCte}
SELECT u.name, COUNT(s.id) AS tickets, SUM(s.netTotal) AS total
FROM net_sales s
JOIN users u ON u.id = s.sellerId
GROUP BY u.id, u.name
ORDER BY total DESC`,
} as const;

export const dashboardPostgresSql = {
  ...dashboardSql,
  month: summary('createdAt>=? AND createdAt<?'),
  today: summary('createdAt>=? AND createdAt<?'),
  previousDay: summary('createdAt>=? AND createdAt<?'),
  previousMonth: summary('createdAt>=? AND createdAt<?'),
} as const;

type PeriodSummary = {
  revenue?: number | null;
  tickets?: number | null;
  average?: number | null;
};

function comparisonValue(
  currentRaw: number | null | undefined,
  previousRaw: number | null | undefined,
) {
  const current = Number(currentRaw ?? 0);
  const previous = Number(previousRaw ?? 0);
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

export function compareDashboardPeriod(
  current: PeriodSummary | null,
  previous: PeriodSummary | null,
) {
  return {
    revenue: comparisonValue(current?.revenue, previous?.revenue),
    tickets: comparisonValue(current?.tickets, previous?.tickets),
    average: comparisonValue(current?.average, previous?.average),
  };
}
