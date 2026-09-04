import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const source = readFileSync(
  new URL('./lib/stock-replenishment.ts', import.meta.url),
  'utf8',
);
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
    esModuleInterop: true,
  },
  fileName: 'stock-replenishment.ts',
  reportDiagnostics: true,
});
const errors = (compiled.diagnostics ?? []).filter(
  (diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error,
);
assert.deepEqual(
  errors.map((diagnostic) =>
    ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'),
  ),
  [],
  'stock-replenishment.ts must transpile without syntax errors',
);

class AppError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const queryCalls = [];
const sourceRows = [
  {
    variantId: 'variant-out',
    productId: 'product-shirt',
    productName: 'Camisa Oxford',
    category: 'Camisas',
    brand: 'FRAGUAN',
    sku: 'FR-CAM-CE-L',
    barcode: '200000000001',
    color: 'Celeste',
    size: 'L',
    availableUnits: 0,
    minimumUnits: 3,
    soldUnitsWindow: 30,
    lastSaleAt: '2026-09-03T15:00:00.000Z',
    supplierId: 'supplier-1',
    supplierName: 'Textiles del Sur',
  },
  {
    variantId: 'variant-low-demand',
    productId: 'product-jean',
    productName: 'Jean Slim',
    category: 'Jeans',
    brand: 'FRAGUAN',
    sku: 'FR-JEA-AZ-42',
    barcode: '200000000002',
    color: 'Azul',
    size: '42',
    availableUnits: 10,
    minimumUnits: 3,
    soldUnitsWindow: 15,
    lastSaleAt: '2026-09-02T15:00:00.000Z',
    supplierId: null,
    supplierName: null,
  },
  {
    variantId: 'variant-healthy',
    productId: 'product-polo',
    productName: 'Chomba Classic',
    category: 'Chombas',
    brand: 'FRAGUAN',
    sku: 'FR-CHO-NE-M',
    barcode: '200000000003',
    color: 'Negro',
    size: 'M',
    availableUnits: 100,
    minimumUnits: 3,
    soldUnitsWindow: 30,
    lastSaleAt: '2026-09-01T15:00:00.000Z',
    supplierId: 'supplier-1',
    supplierName: 'Textiles del Sur',
  },
  {
    variantId: 'variant-low-minimum',
    productId: 'product-sweater',
    productName: 'Buzo Essential',
    category: 'Buzos',
    brand: 'FRAGUAN',
    sku: 'FR-BUZ-AR-S',
    barcode: '200000000004',
    color: 'Arena',
    size: 'S',
    availableUnits: 2,
    minimumUnits: 3,
    soldUnitsWindow: 0,
    lastSaleAt: null,
    supplierId: null,
    supplierName: null,
  },
];

async function query(sql, ...values) {
  queryCalls.push({ sql, values });
  return sourceRows;
}

const moduleRecord = { exports: {} };
vm.runInNewContext(compiled.outputText, {
  exports: moduleRecord.exports,
  module: moduleRecord,
  require(specifier) {
    if (specifier === '@/db/queries') return { rows: query };
    if (specifier === './auth') return { AppError };
    throw new Error(`Unexpected import: ${specifier}`);
  },
});
const {
  buildStockReplenishmentReport,
  calculateStockReplenishment,
  getStockReplenishment,
  resolveStockReplenishmentConfig,
} = moduleRecord.exports;

assert.equal(typeof calculateStockReplenishment, 'function');
assert.equal(typeof buildStockReplenishmentReport, 'function');
assert.equal(typeof getStockReplenishment, 'function');

const config = resolveStockReplenishmentConfig();
assert.deepEqual(
  { ...config },
  {
    velocityWindowDays: 30,
    leadTimeDays: 14,
    safetyStockDays: 7,
    targetCoverageDays: 45,
    minimumOrderQuantity: 1,
  },
);

const outOfStock = calculateStockReplenishment(sourceRows[0]);
assert.equal(outOfStock.velocity.dailyUnits, 1);
assert.equal(outOfStock.stock.coverageDays, 0);
assert.equal(outOfStock.stock.reorderPointUnits, 21);
assert.equal(outOfStock.stock.targetUnits, 45);
assert.equal(outOfStock.recommendation.status, 'sin_stock');
assert.equal(outOfStock.recommendation.severity, 'critical');
assert.equal(outOfStock.recommendation.suggestedOrderUnits, 45);
assert.deepEqual(
  { ...outOfStock.supplier },
  { id: 'supplier-1', name: 'Textiles del Sur' },
);

const lowDemand = calculateStockReplenishment(sourceRows[1]);
assert.equal(lowDemand.velocity.dailyUnits, 0.5);
assert.equal(lowDemand.stock.coverageDays, 20);
assert.equal(lowDemand.stock.reorderPointUnits, 11);
assert.equal(lowDemand.stock.targetUnits, 23);
assert.equal(lowDemand.recommendation.status, 'bajo_stock');
assert.equal(lowDemand.recommendation.suggestedOrderUnits, 13);
assert.equal(lowDemand.supplier, null);

const noRecentSales = calculateStockReplenishment(sourceRows[3]);
assert.equal(noRecentSales.velocity.dailyUnits, 0);
assert.equal(noRecentSales.stock.coverageDays, null);
assert.equal(noRecentSales.stock.reorderPointUnits, 3);
assert.equal(noRecentSales.stock.targetUnits, 6);
assert.equal(noRecentSales.recommendation.status, 'bajo_stock');
assert.equal(noRecentSales.recommendation.suggestedOrderUnits, 4);

const report = buildStockReplenishmentReport(sourceRows, {
  asOf: '2026-09-04T15:00:00.000Z',
});
assert.equal(report.generatedAt, '2026-09-04T15:00:00.000Z');
assert.equal(report.windowStart, '2026-08-05T15:00:00.000Z');
assert.deepEqual(
  { ...report.summary },
  {
    totalVariants: 4,
    outOfStock: 1,
    lowStock: 2,
    healthy: 1,
    suggestedOrderUnits: 62,
    variantsWithSupplier: 2,
    variantsWithoutSupplier: 2,
  },
);
assert.deepEqual(
  Array.from(report.items, (item) => item.variantId),
  [
    'variant-out',
    'variant-low-demand',
    'variant-low-minimum',
    'variant-healthy',
  ],
);
assert.deepEqual(
  Array.from(report.alerts, (item) => item.variantId),
  ['variant-out', 'variant-low-demand', 'variant-low-minimum'],
);

const admin = {
  id: 'admin-1',
  email: 'admin@example.com',
  name: 'Admin',
  role: 'ADMIN',
  active: 1,
};
const fromD1 = await getStockReplenishment(
  admin,
  { asOf: '2026-09-04T15:00:00.000Z' },
  query,
);
assert.equal(fromD1.summary.totalVariants, 4);
assert.equal(queryCalls.length, 1);
assert.match(queryCalls[0].sql, /FROM variants v/);
assert.match(queryCalls[0].sql, /JOIN products p/);
assert.match(queryCalls[0].sql, /LEFT JOIN suppliers supplier/);
assert.match(queryCalls[0].sql, /JOIN sale_items si/);
assert.match(queryCalls[0].sql, /si\.quantity - si\.refunded/);
assert.deepEqual(Array.from(queryCalls[0].values), [
  '2026-08-05T15:00:00.000Z',
  '2026-09-04T15:00:00.000Z',
]);
assert.doesNotMatch(queryCalls[0].sql, /\bcost\b/i);

const serialized = JSON.stringify(fromD1);
assert.doesNotMatch(
  serialized,
  /"(?:cost|costo|margin|margen|markup|profit|ganancia)"/i,
  'The report contract must never expose internal financial fields.',
);
assert.doesNotMatch(serialized, /"image"|"photo"|"foto"/i);

let sellerQueryCalled = false;
await assert.rejects(
  () =>
    getStockReplenishment({ ...admin, role: 'VENDEDOR' }, {}, async () => {
      sellerQueryCalled = true;
      return sourceRows;
    }),
  (error) => error instanceof AppError && error.status === 403,
);
assert.equal(
  sellerQueryCalled,
  false,
  'Access must be rejected before D1 runs.',
);

assert.throws(
  () => resolveStockReplenishmentConfig({ velocityWindowDays: 0 }),
  (error) => error instanceof AppError && error.status === 400,
);
assert.throws(
  () =>
    resolveStockReplenishmentConfig({
      leadTimeDays: 20,
      safetyStockDays: 10,
      targetCoverageDays: 29,
    }),
  (error) => error instanceof AppError && error.status === 400,
);
assert.throws(
  () =>
    calculateStockReplenishment({
      ...sourceRows[0],
      availableUnits: -1,
    }),
  (error) => error instanceof AppError && error.status === 500,
);

console.log('Stock replenishment tests passed.');
