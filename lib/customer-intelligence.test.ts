import assert from 'node:assert/strict';
import test from 'node:test';
import {
  calculateLoyaltyLevel,
  classifyCustomer,
  resolveCustomerIntelligenceConfig,
} from './customer-intelligence';
import type { CustomerActivitySnapshot } from './customer-intelligence';

const AS_OF = '2026-09-04T12:00:00.000Z';

function activity(
  overrides: Partial<CustomerActivitySnapshot> = {},
): CustomerActivitySnapshot {
  return {
    createdAt: '2025-01-01T12:00:00.000Z',
    firstPurchaseAt: '2025-02-01T12:00:00.000Z',
    lastPurchaseAt: '2026-09-01T12:00:00.000Z',
    purchaseCount: 6,
    lifetimeSpendMinor: 80_000_000,
    purchasesInSegmentWindow: 6,
    spendInSegmentWindowMinor: 80_000_000,
    purchasesInLoyaltyWindow: 6,
    spendInLoyaltyWindowMinor: 80_000_000,
    points: 800,
    ...overrides,
  };
}

void test('segmentación aplica VIP, Frecuente, Nuevo y Activo', () => {
  assert.equal(classifyCustomer(activity(), {}, AS_OF), 'VIP');
  assert.equal(
    classifyCustomer(
      activity({
        purchaseCount: 4,
        purchasesInSegmentWindow: 4,
        spendInSegmentWindowMinor: 20_000_000,
      }),
      {},
      AS_OF,
    ),
    'Frecuente',
  );
  assert.equal(
    classifyCustomer(
      activity({
        createdAt: '2026-08-20T12:00:00.000Z',
        firstPurchaseAt: null,
        lastPurchaseAt: null,
        purchaseCount: 0,
        lifetimeSpendMinor: 0,
        purchasesInSegmentWindow: 0,
        spendInSegmentWindowMinor: 0,
        purchasesInLoyaltyWindow: 0,
        spendInLoyaltyWindowMinor: 0,
        points: 0,
      }),
      {},
      AS_OF,
    ),
    'Nuevo',
  );
  assert.equal(
    classifyCustomer(
      activity({
        purchaseCount: 2,
        purchasesInSegmentWindow: 2,
        spendInSegmentWindowMinor: 10_000_000,
      }),
      {},
      AS_OF,
    ),
    'Activo',
  );
});

void test('inactividad prevalece sobre el valor histórico', () => {
  assert.equal(
    classifyCustomer(
      activity({ lastPurchaseAt: '2026-06-20T12:00:00.000Z' }),
      {},
      AS_OF,
    ),
    'En riesgo',
  );
  assert.equal(
    classifyCustomer(
      activity({ lastPurchaseAt: '2026-04-01T12:00:00.000Z' }),
      {},
      AS_OF,
    ),
    'Inactivo',
  );
  assert.equal(
    classifyCustomer(
      activity({ lastPurchaseAt: '2025-12-01T12:00:00.000Z' }),
      {},
      AS_OF,
    ),
    'Perdido',
  );
});

void test('niveles usan el gasto móvil y aceptan condiciones configurables', () => {
  assert.equal(calculateLoyaltyLevel(activity()), 'Gold');
  assert.equal(
    calculateLoyaltyLevel(activity({ spendInLoyaltyWindowMinor: 120_000_000 })),
    'Black',
  );
  assert.equal(
    calculateLoyaltyLevel(activity(), {
      loyalty: {
        thresholds: {
          Gold: { minPurchases: 8 },
          Black: { minPurchases: 10 },
        },
      },
    }),
    'Silver',
  );
});

void test('configuración rechaza umbrales contradictorios', () => {
  assert.throws(
    () =>
      resolveCustomerIntelligenceConfig({
        segmentation: { inactiveAfterDays: 30, atRiskAfterDays: 60 },
      }),
    RangeError,
  );
  assert.throws(
    () =>
      resolveCustomerIntelligenceConfig({
        loyalty: {
          thresholds: { Black: { minSpendMinor: 10_000_000 } },
        },
      }),
    RangeError,
  );
});
