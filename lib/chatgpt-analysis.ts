import { z } from 'zod';
import { one, rows } from '@/db/queries';
import { Actor, AppError } from './auth';
import { getBusinessReport } from './reporting';

const sectionNames = [
  'sales',
  'profitability',
  'products',
  'categoriesBrands',
  'stockRotation',
  'sizesColors',
  'paymentMethods',
  'discountsPromotions',
  'customers',
  'daysHours',
  'branches',
] as const;

const inputSchema = z
  .object({
    from: z.iso.date(),
    to: z.iso.date(),
    comparison: z.enum([
      'previous_period',
      'previous_week',
      'previous_month',
      'same_period_previous_month',
      'none',
    ]),
    sections: z.array(z.enum(sectionNames)).min(1).max(sectionNames.length),
  })
  .strict();

export type ChatGPTAnalysisInput = z.infer<typeof inputSchema>;
type Row = Record<string, any>;
type Period = { from: string; to: string; days: number };

const AR_TZ = 'America/Argentina/Cordoba';
const dayMs = 86_400_000;

function addDays(date: string, days: number) {
  const value = new Date(`${date}T12:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function daysBetween(from: string, to: string) {
  return (
    Math.round(
      (Date.parse(`${to}T12:00:00.000Z`) -
        Date.parse(`${from}T12:00:00.000Z`)) /
        dayMs,
    ) + 1
  );
}

function shiftMonth(date: string, amount: number) {
  const [year, month, day] = date.split('-').map(Number);
  const target = new Date(Date.UTC(year, month - 1 + amount, 1, 12));
  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0, 12),
  ).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  return target.toISOString().slice(0, 10);
}

export function comparisonPeriod(
  from: string,
  to: string,
  kind: ChatGPTAnalysisInput['comparison'],
): Period | null {
  const days = daysBetween(from, to);
  if (kind === 'none') return null;
  if (kind === 'previous_period') {
    const previousTo = addDays(from, -1);
    return { from: addDays(previousTo, -(days - 1)), to: previousTo, days };
  }
  if (kind === 'previous_week')
    return { from: addDays(from, -7), to: addDays(to, -7), days };
  if (kind === 'same_period_previous_month') {
    const comparisonFrom = shiftMonth(from, -1);
    return {
      from: comparisonFrom,
      to: addDays(comparisonFrom, days - 1),
      days,
    };
  }
  const anchor = new Date(`${from.slice(0, 7)}-01T12:00:00.000Z`);
  anchor.setUTCMonth(anchor.getUTCMonth() - 1);
  const previousFrom = anchor.toISOString().slice(0, 10);
  return { from: previousFrom, to: addDays(previousFrom, days - 1), days };
}

function argentinaBounds(period: Period) {
  return [
    new Date(`${period.from}T00:00:00-03:00`).toISOString(),
    new Date(`${addDays(period.to, 1)}T00:00:00-03:00`).toISOString(),
  ];
}

function number(value: unknown) {
  return Number(value ?? 0);
}

function money(value: unknown) {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(number(value) / 100);
}

function percentFromBps(value: unknown) {
  return `${(number(value) / 100).toLocaleString('es-AR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 2,
  })}%`;
}

function humanDate(value: string) {
  return new Intl.DateTimeFormat('es-AR', {
    timeZone: AR_TZ,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(`${value}T12:00:00.000Z`));
}

function argentinaToday() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: AR_TZ }).format(
    new Date(),
  );
}

function variation(
  current: number,
  previous: number | null,
  formatter: (value: number) => string = (value) => String(value),
) {
  if (previous == null) return formatter(current);
  const absolute = current - previous;
  if (previous === 0)
    return `${formatter(current)} (variación absoluta: ${formatter(absolute)}; variación porcentual: ${current === 0 ? '0,0%' : 'No comparable: el período anterior fue cero'})`;
  return `${formatter(current)} (variación absoluta: ${formatter(absolute)}; ${percentFromBps(Math.round((absolute * 10000) / previous))})`;
}

function line(name: string, value: unknown) {
  return `- ${name}: ${String(value)}`;
}

function topLines(items: Row[], render: (item: Row) => string) {
  return items.length
    ? items
        .slice(0, 10)
        .map((item) => `- ${render(item)}`)
        .join('\n')
    : '- Sin datos suficientes.';
}

function dateKey(value: string) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: AR_TZ }).format(
    new Date(value),
  );
}

function hourKey(value: string) {
  return new Intl.DateTimeFormat('es-AR', {
    timeZone: AR_TZ,
    hour: '2-digit',
    hour12: false,
  }).format(new Date(value));
}

function sectionEnabled(
  input: ChatGPTAnalysisInput,
  name: (typeof sectionNames)[number],
) {
  return input.sections.includes(name);
}

export async function generateChatGPTAnalysis(actor: Actor, raw: unknown) {
  if (actor.role !== 'ADMIN') throw new AppError(403, 'Acceso denegado.');
  const input = inputSchema.parse(raw);
  if (input.to < input.from)
    throw new AppError(400, 'La fecha final debe ser posterior a la inicial.');
  if (input.to > argentinaToday())
    throw new AppError(400, 'La fecha final no puede estar en el futuro.');
  const days = daysBetween(input.from, input.to);
  if (days > 366)
    throw new AppError(400, 'El análisis admite hasta 366 días por consulta.');
  const period: Period = { from: input.from, to: input.to, days };
  const compared = comparisonPeriod(input.from, input.to, input.comparison);
  const report = await getBusinessReport(actor, {
    from: input.from,
    to: input.to,
    comparisonFrom: compared?.from,
    comparisonTo: compared?.to,
  });
  const [fromIso, throughIso] = argentinaBounds(period);
  const comparedBounds = compared ? argentinaBounds(compared) : null;

  const [
    sales,
    previousSales,
    refunds,
    returnedProducts,
    variants,
    sizesColors,
    identifiedSales,
  ] = await Promise.all([
    rows<Row>(
      `SELECT status,subtotal,discount,total,customerId,createdAt,
              total-COALESCE((SELECT SUM(amount) FROM refunds WHERE saleId=sales.id),0) AS netTotal
           FROM sales WHERE createdAt>=? AND createdAt<?`,
      fromIso,
      throughIso,
    ),
    comparedBounds
      ? rows<Row>(
          `SELECT status,subtotal,discount,total,createdAt
             FROM sales WHERE createdAt>=? AND createdAt<?`,
          comparedBounds[0],
          comparedBounds[1],
        )
      : Promise.resolve([]),
    one<Row>(
      `SELECT COUNT(*) AS operations,COALESCE(SUM(amount),0) AS amountMinor
           FROM refunds WHERE createdAt>=? AND createdAt<?`,
      fromIso,
      throughIso,
    ),
    rows<Row>(
      `SELECT p.name,SUM(ri.quantity) AS units,SUM(ri.amount) AS amountMinor
           FROM refund_items ri JOIN refunds r ON r.id=ri.refundId
           JOIN variants v ON v.id=ri.variantId JOIN products p ON p.id=v.productId
          WHERE r.createdAt>=? AND r.createdAt<?
          GROUP BY p.id,p.name ORDER BY units DESC LIMIT 10`,
      fromIso,
      throughIso,
    ),
    rows<Row>(
      `SELECT v.id,p.name,p.category,p.brand,v.color,v.size,v.stock,v.minimum,
                v.ideal,v.cost,v.entryAt,
                MAX(CASE WHEN s.status IN ('confirmed','partially_refunded')
                          AND si.quantity>si.refunded THEN s.createdAt END) AS lastSaleAt,
                COALESCE(SUM(CASE WHEN s.status IN ('confirmed','partially_refunded')
                                   AND s.createdAt>=? AND s.createdAt<?
                                  THEN si.quantity-si.refunded ELSE 0 END),0) AS periodUnits
           FROM variants v JOIN products p ON p.id=v.productId
           LEFT JOIN sale_items si ON si.variantId=v.id
           LEFT JOIN sales s ON s.id=si.saleId
          WHERE p.active=1
          GROUP BY v.id,p.name,p.category,p.brand,v.color,v.size,v.stock,v.minimum,
                   v.ideal,v.cost,v.entryAt`,
      fromIso,
      throughIso,
    ),
    rows<Row>(
      `SELECT si.size,si.color,SUM(si.quantity-si.refunded) AS units
           FROM sale_items si JOIN sales s ON s.id=si.saleId
          WHERE s.status IN ('confirmed','partially_refunded')
            AND s.createdAt>=? AND s.createdAt<? AND si.quantity>si.refunded
          GROUP BY si.size,si.color ORDER BY units DESC LIMIT 50`,
      fromIso,
      throughIso,
    ),
    rows<Row>(
      `SELECT customerId,
              total-COALESCE((SELECT SUM(amount) FROM refunds WHERE saleId=sales.id),0) AS total,
              createdAt
           FROM sales
          WHERE customerId IS NOT NULL
            AND status IN ('confirmed','partially_refunded')
          ORDER BY customerId,createdAt`,
    ),
  ]);

  const validSales = sales.filter((sale) =>
    ['confirmed', 'partially_refunded'].includes(sale.status),
  );
  const validPreviousSales = previousSales.filter((sale) =>
    ['confirmed', 'partially_refunded'].includes(sale.status),
  );
  const cancelledSales = sales.filter((sale) => sale.status === 'cancelled');
  const fullyRefundedSales = sales.filter((sale) => sale.status === 'refunded');
  const grossMinor = validSales.reduce(
    (sum, sale) => sum + number(sale.subtotal),
    0,
  );
  const previousGrossMinor = validPreviousSales.reduce(
    (sum, sale) => sum + number(sale.subtotal),
    0,
  );
  const discountsMinor = validSales.reduce(
    (sum, sale) => sum + number(sale.discount),
    0,
  );
  const previousDiscountsMinor = validPreviousSales.reduce(
    (sum, sale) => sum + number(sale.discount),
    0,
  );
  const unitsPerTicket = report.current.tickets
    ? report.current.units / report.current.tickets
    : null;

  const hourTotals = new Map<string, { tickets: number; total: number }>();
  for (const sale of validSales) {
    const hour = hourKey(sale.createdAt);
    const current = hourTotals.get(hour) ?? { tickets: 0, total: 0 };
    current.tickets += 1;
    current.total += number(sale.netTotal);
    hourTotals.set(hour, current);
  }
  const daysWithSales = new Set(
    validSales.map((sale) => dateKey(sale.createdAt)),
  );
  const zeroDays = Array.from({ length: days }, (_, index) =>
    addDays(input.from, index),
  ).filter((day) => !daysWithSales.has(day));

  const currentProducts: Row[] = (report.breakdowns.products as Row[]).map(
    (product) => {
      const profit = number(product.revenueMinor) - number(product.costMinor);
      return {
        ...product,
        profitMinor: profit,
        resultMinor: profit - number(product.commissionMinor),
        marginBps: number(product.revenueMinor)
          ? Math.round((profit * 10000) / number(product.revenueMinor))
          : 0,
      };
    },
  );
  const reliableMargin = currentProducts.filter(
    (product) => number(product.units) >= 3,
  );
  const lowSampleProducts = currentProducts.filter(
    (product) => number(product.units) < 3,
  );

  const riskStock: Row[] = variants
    .map((variant): Row => {
      const daily = number(variant.periodUnits) / days;
      return {
        ...variant,
        coverageDays: daily > 0 ? number(variant.stock) / daily : null,
      };
    })
    .filter(
      (variant) =>
        variant.stock > 0 &&
        variant.coverageDays != null &&
        variant.coverageDays <= 14,
    )
    .sort((a, b) => number(a.coverageDays) - number(b.coverageDays));
  const immobile = variants
    .filter((variant) => variant.stock > 0 && number(variant.periodUnits) === 0)
    .sort(
      (a, b) =>
        number(b.stock) * number(b.cost) - number(a.stock) * number(a.cost),
    );
  const stockCapital = variants.reduce(
    (sum, variant) => sum + number(variant.stock) * number(variant.cost),
    0,
  );
  const stockCostsReliable = variants.every(
    (variant) => number(variant.stock) <= 0 || number(variant.cost) > 0,
  );
  const missingVariants = variants.filter(
    (variant) => number(variant.stock) === 0,
  );

  const customerMap = new Map<string, Row[]>();
  for (const sale of identifiedSales) {
    const list = customerMap.get(sale.customerId) ?? [];
    list.push(sale);
    customerMap.set(sale.customerId, list);
  }
  const periodCustomers = [...customerMap.values()].filter((history) =>
    history.some(
      (sale) => sale.createdAt >= fromIso && sale.createdAt < throughIso,
    ),
  );
  let newCustomers = 0;
  let recurrentCustomers = 0;
  let returningCustomers = 0;
  let identifiedRevenue = 0;
  let identifiedOrders = 0;
  const gaps: number[] = [];
  for (const history of periodCustomers) {
    const current = history.filter(
      (sale) => sale.createdAt >= fromIso && sale.createdAt < throughIso,
    );
    const before = history.filter((sale) => sale.createdAt < fromIso);
    if (!before.length) newCustomers += 1;
    else {
      recurrentCustomers += 1;
      returningCustomers += 1;
    }
    identifiedOrders += current.length;
    identifiedRevenue += current.reduce(
      (sum, sale) => sum + number(sale.total),
      0,
    );
    for (let index = 1; index < history.length; index += 1)
      gaps.push(
        (Date.parse(history[index].createdAt) -
          Date.parse(history[index - 1].createdAt)) /
          dayMs,
      );
  }

  const paymentMethods = (report.breakdowns.paymentMethods as Row[]).map(
    (method) => {
      const share = report.current.revenueMinor
        ? number(method.revenueMinor) / report.current.revenueMinor
        : 0;
      const tickets = number(method.tickets);
      const estimatedCost = Math.round(report.current.costMinor * share);
      return {
        ...method,
        shareBps: Math.round(share * 10000),
        averageTicketMinor: tickets
          ? Math.round(number(method.revenueMinor) / tickets)
          : 0,
        estimatedDiscountMinor: Math.round(discountsMinor * share),
        estimatedResultMinor:
          number(method.revenueMinor) -
          number(method.commissionMinor) -
          estimatedCost,
      };
    },
  );

  const quality: string[] = [];
  if (!validSales.length)
    quality.push('No hubo ventas válidas en el período analizado.');
  if (!compared)
    quality.push('El usuario eligió generar el informe sin comparación.');
  if (lowSampleProducts.length)
    quality.push(
      `${lowSampleProducts.length} productos tuvieron menos de 3 unidades vendidas; no se los clasificó por margen.`,
    );
  quality.push(
    'El costo de mercadería usa el costo histórico guardado en cada línea de venta.',
  );
  quality.push(
    'La facturación neta asigna a la venta las devoluciones registradas para esa operación; las devoluciones ocurridas dentro del período también se informan por separado.',
  );
  if (!stockCostsReliable)
    quality.push(
      'Hay variantes con stock y costo igual a cero; no se informó capital inmovilizado porque los costos no son confiables para todo el inventario.',
    );
  quality.push(
    'La asignación de costo por medio de pago es estimada proporcionalmente cuando un ticket combina medios.',
  );
  quality.push(
    'Las cuotas no se guardan como dato histórico de cada pago; sólo existe la configuración actual del medio y por eso no se exportó una cantidad de cuotas.',
  );
  quality.push(
    'El sistema actual no posee entidades de sucursales; no se generó una comparación por sucursal.',
  );
  quality.push(
    'La antigüedad de stock se aproxima con la fecha de ingreso de la variante cuando está informada.',
  );

  const analysis = {
    input,
    period,
    compared,
    report,
    sales: {
      grossMinor,
      previousGrossMinor,
      discountsMinor,
      previousDiscountsMinor,
      refunds,
      cancelledSales,
      fullyRefundedSales,
      unitsPerTicket,
      zeroDays,
      hourTotals,
    },
    products: {
      currentProducts,
      reliableMargin,
      lowSampleProducts,
      returnedProducts,
    },
    stock: {
      variants,
      riskStock,
      immobile,
      stockCapital,
      stockCostsReliable,
      missingVariants,
    },
    sizesColors,
    paymentMethods,
    customers: {
      newCustomers,
      recurrentCustomers,
      returningCustomers,
      identifiedRevenue,
      identifiedOrders,
      gaps,
      periodCustomers: periodCustomers.length,
    },
    quality,
  };
  const generatedAt = new Intl.DateTimeFormat('es-AR', {
    timeZone: AR_TZ,
    dateStyle: 'short',
    timeStyle: 'medium',
  }).format(new Date());
  const text = buildChatGPTAnalysisText(analysis, generatedAt);
  return { generatedAt, period, comparisonPeriod: compared, text };
}

function buildChatGPTAnalysisText(data: any, generatedAt: string) {
  const {
    input,
    period,
    compared,
    report,
    sales,
    products,
    stock,
    sizesColors,
    paymentMethods,
    customers,
    quality,
  } = data;
  const sections: string[] = [];
  if (sectionEnabled(input, 'sales')) {
    sections.push(`Resumen de ventas
${line('Facturación bruta exacta antes de descuentos', variation(sales.grossMinor, compared ? sales.previousGrossMinor : null, money))}
${line('Facturación neta efectiva exacta', variation(report.current.revenueMinor, compared ? report.previous.revenueMinor : null, money))}
${line('Operaciones válidas', variation(report.current.tickets, compared ? report.previous.tickets : null))}
${line('Unidades vendidas netas', variation(report.current.units, compared ? report.previous.units : null))}
${line('Ticket promedio', variation(report.current.averageTicketMinor, compared ? report.previous.averageTicketMinor : null, money))}
${line('Unidades promedio por operación', sales.unitsPerTicket == null ? 'Sin datos suficientes' : sales.unitsPerTicket.toLocaleString('es-AR', { maximumFractionDigits: 2 }))}
${line('Devoluciones registradas durante el período', `${number(sales.refunds?.operations)} operaciones por ${money(sales.refunds?.amountMinor)}`)}
${line('Ventas totalmente devueltas originadas en el período', sales.fullyRefundedSales.length)}
${line('Anulaciones originadas en el período', sales.cancelledSales.length)}`);
  }
  if (sectionEnabled(input, 'profitability')) {
    const grossProfitMinor =
      report.current.revenueMinor - report.current.costMinor;
    const previousGrossProfitMinor =
      report.previous.revenueMinor - report.previous.costMinor;
    const grossMarginBps = report.current.revenueMinor
      ? Math.round((grossProfitMinor * 10000) / report.current.revenueMinor)
      : 0;
    sections.push(`Rentabilidad
${line('Costo de mercadería vendida exacto e histórico', variation(report.current.costMinor, compared ? report.previous.costMinor : null, money))}
${line('Ganancia bruta después del costo de mercadería', variation(grossProfitMinor, compared ? previousGrossProfitMinor : null, money))}
${line('Margen bruto', percentFromBps(grossMarginBps))}
${line('Margen bruto promedio por operación', report.current.tickets ? money(Math.round(grossProfitMinor / report.current.tickets)) : 'Sin datos suficientes')}
${line('Descuentos otorgados', variation(sales.discountsMinor, compared ? sales.previousDiscountsMinor : null, money))}
${line('Comisiones de medios de pago', money(report.current.commissionMinor))}
${line('Resultado comercial estimado después de descuentos y comisiones', money(report.current.grossProfitMinor))}`);
  }
  if (sectionEnabled(input, 'products')) {
    sections.push(`Productos
Más vendidos por unidades:
${topLines(
  [...products.currentProducts].sort((a, b) => b.units - a.units),
  (p) => `${p.name}: ${p.units} u.`,
)}
Mayor facturación:
${topLines(
  [...products.currentProducts].sort((a, b) => b.revenueMinor - a.revenueMinor),
  (p) => `${p.name}: ${money(p.revenueMinor)}`,
)}
Mayor margen, solo con muestra mínima de 3 unidades:
${topLines(
  [...products.reliableMargin].sort((a, b) => b.marginBps - a.marginBps),
  (p) => `${p.name}: ${percentFromBps(p.marginBps)} (${p.units} u.)`,
)}
Menor margen, solo con muestra mínima de 3 unidades:
${topLines(
  [...products.reliableMargin].sort((a, b) => a.marginBps - b.marginBps),
  (p) => `${p.name}: ${percentFromBps(p.marginBps)} (${p.units} u.)`,
)}
Productos devueltos durante el período:
${topLines(products.returnedProducts, (p) => `${p.name}: ${p.units} u. por ${money(p.amountMinor)}`)}
Productos sin ventas:
${topLines(report.productsWithoutSales, (p) => `${p.name} (${p.category}); última venta: ${p.lastSaleAt ? humanDate(p.lastSaleAt.slice(0, 10)) : 'sin venta histórica'}`)}
Productos con pocos datos:
${topLines(products.lowSampleProducts, (p) => `${p.name}: ${p.units} u.; no clasificar todavía por margen`)}`);
  }
  if (sectionEnabled(input, 'categoriesBrands')) {
    sections.push(`Productos, categorías y marcas
Categorías:
${topLines(report.breakdowns.categories, (x) => `${x.name}: ${x.units} u. y ${money(x.revenueMinor)}`)}
Marcas:
${topLines(report.breakdowns.brands, (x) => `${x.name}: ${x.units} u. y ${money(x.revenueMinor)}`)}`);
  }
  if (sectionEnabled(input, 'stockRotation')) {
    const stockWithAge = stock.variants
      .filter((variant: Row) => variant.stock > 0 && variant.entryAt)
      .map((variant: Row) => ({
        ...variant,
        ageDays: Math.max(
          0,
          daysBetween(variant.entryAt.slice(0, 10), argentinaToday()),
        ),
      }))
      .sort((a: Row, b: Row) => b.ageDays - a.ageDays);
    sections.push(`Stock y rotación
${line('Stock actual total', `${stock.variants.reduce((sum: number, v: Row) => sum + number(v.stock), 0)} unidades (exacto al generar)`)}
${line('Capital estimado inmovilizado a costo actual', stock.stockCostsReliable ? `${money(stock.stockCapital)} (estimado; puede diferir del costo histórico de compra)` : 'No disponible: existen costos de inventario sin valor confiable')}
Stock bajo:
${topLines(
  stock.variants.filter((v: Row) => v.stock > 0 && v.stock <= v.minimum),
  (v) =>
    `${v.name} / ${v.color} / ${v.size}: ${v.stock} u.; mínimo ${v.minimum}`,
)}
Agotados:
${topLines(stock.missingVariants, (v) => `${v.name} / ${v.color} / ${v.size}`)}
Riesgo de agotarse según ritmo del período:
${topLines(stock.riskStock, (v) => `${v.name} / ${v.color} / ${v.size}: cobertura estimada ${v.coverageDays.toLocaleString('es-AR', { maximumFractionDigits: 1 })} días`)}
Sin rotación en el período:
${topLines(stock.immobile, (v) => `${v.name} / ${v.color} / ${v.size}: ${v.stock} u.; última venta ${v.lastSaleAt ? humanDate(v.lastSaleAt.slice(0, 10)) : 'no registrada'}`)}
Mayor antigüedad aproximada del stock, según fecha de ingreso disponible:
${topLines(stockWithAge, (v) => `${v.name} / ${v.color} / ${v.size}: ${v.ageDays} días, ${v.stock} u.`)}
Reposición sugerida, estimación basada en venta real:
${topLines(stock.riskStock, (v) => `${v.name} / ${v.color} / ${v.size}: evaluar reponer hasta ${v.ideal} u.; no liquidar sin revisar antigüedad y muestra`)}`);
  }
  if (sectionEnabled(input, 'sizesColors')) {
    sections.push(`Talles y colores
Combinaciones vendidas:
${topLines(sizesColors, (x) => `Talle ${x.size}, color ${x.color}: ${x.units} u.`)}
Talles y colores faltantes:
${topLines(stock.missingVariants, (v) => `${v.name}: talle ${v.size}, color ${v.color}`)}`);
  }
  if (sectionEnabled(input, 'paymentMethods')) {
    sections.push(`Medios de pago
${topLines(paymentMethods, (x) => `${x.name}: ${money(x.revenueMinor)}, participación ${percentFromBps(x.shareBps)}, ticket promedio asignado ${money(x.averageTicketMinor)}, descuento estimado ${money(x.estimatedDiscountMinor)}, comisión ${money(x.commissionMinor)}, resultado estimado ${money(x.estimatedResultMinor)}`)}
- El ticket promedio y el margen exactos por medio no están disponibles cuando una operación combina medios; la asignación de costos se marca como estimada.`);
  }
  if (sectionEnabled(input, 'discountsPromotions')) {
    sections.push(`Descuentos y promociones
${line('Descuento total otorgado', money(sales.discountsMinor))}
${topLines(report.breakdowns.promotions, (x) => `${x.name}: ${x.tickets} operaciones, facturación ${money(x.revenueMinor)}, descuento ${money(x.grantedDiscountMinor)}, ticket promedio ${x.tickets ? money(Math.round(x.revenueMinor / x.tickets)) : 'Sin datos suficientes'}, margen resultante ${money(x.grossProfitMinor)}`)}
- Comparación con ventas sin promoción: No disponible con significancia estadística automática; requiere controlar mezcla de productos, fechas y tamaño de muestra.`);
  }
  if (sectionEnabled(input, 'customers')) {
    const recurrenceBps = customers.periodCustomers
      ? Math.round(
          (customers.recurrentCustomers * 10000) / customers.periodCustomers,
        )
      : null;
    const averageGap = customers.gaps.length
      ? customers.gaps.reduce((a: number, b: number) => a + b, 0) /
        customers.gaps.length
      : null;
    sections.push(`Clientes (datos agregados y anónimos)
${line('Clientes identificados', customers.periodCustomers)}
${line('Clientes nuevos', customers.newCustomers)}
${line('Clientes recurrentes', customers.recurrentCustomers)}
${line('Tasa de recurrencia', recurrenceBps == null ? 'Sin datos suficientes' : percentFromBps(recurrenceBps))}
${line('Clientes que volvieron a comprar', customers.returningCustomers)}
${line('Promedio de compra identificada', customers.identifiedOrders ? money(Math.round(customers.identifiedRevenue / customers.identifiedOrders)) : 'Sin datos suficientes')}
${line('Días promedio entre compras', averageGap == null ? 'Sin datos suficientes' : averageGap.toLocaleString('es-AR', { maximumFractionDigits: 1 }))}
- No se incluyeron nombres, DNI, teléfonos, direcciones, correos ni identificadores de clientes.`);
  }
  if (sectionEnabled(input, 'daysHours')) {
    sections.push(`Días y horarios
Ventas por día:
${topLines(report.trend, (x) => `${humanDate(x.date)}: ${money(x.revenueMinor)} en ${x.tickets} operaciones`)}
Ventas por franja horaria:
${topLines(
  [...sales.hourTotals.entries()]
    .sort((a: any, b: any) => b[1].total - a[1].total)
    .map(([hour, value]: any) => ({ hour, ...value })),
  (x) =>
    `${x.hour}:00 a ${x.hour}:59: ${money(x.total)} en ${x.tickets} operaciones`,
)}
${line('Días sin ventas', sales.zeroDays.length ? sales.zeroDays.map(humanDate).join(', ') : 'Ninguno')}`);
  }
  if (sectionEnabled(input, 'branches'))
    sections.push(
      'Sucursales\n- No disponible: el modelo actual no contiene entidades de sucursales.',
    );

  return `Quiero que actúes como analista comercial y estratégico de FRAGUAN, una tienda física de indumentaria masculina para jóvenes y adultos ubicada en Isla Verde, Córdoba, Argentina.

Analizá los datos internos incluidos al final y cruzalos con información actualizada del contexto argentino.

Antes de responder, buscá información reciente y confiable sobre:

* Ventas minoristas.
* Sector textil e indumentaria.
* Inflación general.
* Variación de precios de prendas de vestir y calzado.
* Poder adquisitivo y comportamiento del consumidor.
* Medios de pago, reintegros y planes de cuotas.
* Tipo de cambio, importaciones y costos mayoristas.
* Tendencias de indumentaria masculina.
* Estacionalidad, clima y fechas comerciales.
* Comercio electrónico, redes sociales y tecnología retail.

Priorizá fuentes oficiales y argentinas como INDEC, CAME, BCRA, Banco Nación, Bancor, cámaras empresariales y proveedores de medios de pago. Indicá la fecha y la fuente de cada dato externo relevante.

No inventes información ni modifiques los cálculos proporcionados. Diferenciá claramente:

* Hechos confirmados por los datos.
* Interpretaciones razonables.
* Posibles causas no comprobadas.
* Información insuficiente.

No afirmes que un acontecimiento externo causó un resultado de FRAGUAN si solamente existe una coincidencia.

Entregá:

1. Resumen ejecutivo de hasta cinco puntos.
2. Principales cambios en ventas, margen, ticket, productos, stock, clientes y medios de pago.
3. Comparación de FRAGUAN con el contexto argentino.
4. Productos o categorías para reponer, vigilar o impulsar.
5. Alertas sobre margen, descuentos, stock inmovilizado y faltantes.
6. Tres acciones concretas para la próxima semana.
7. Conclusión con estado general (favorable, estable, atención o crítico), principal oportunidad, principal riesgo y decisión prioritaria.

Para cada recomendación indicá qué hacer, por qué hacerlo, qué indicador controlar y cuándo evaluar el resultado.

DATOS INTERNOS DE FRAGUAN

Fecha de generación: ${generatedAt} (Argentina)

Período analizado: ${humanDate(period.from)} a ${humanDate(period.to)} (${period.days} días)

Período comparativo: ${compared ? `${humanDate(compared.from)} a ${humanDate(compared.to)} (${compared.days} días)` : 'Sin comparación'}

${sections.join('\n\n')}

Observaciones sobre la calidad de los datos
${quality.map((item: string) => `- ${item}`).join('\n')}`;
}
