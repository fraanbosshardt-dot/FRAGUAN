import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const loadedModule = { exports: {} };
vm.runInNewContext(
  ts.transpileModule(readFileSync('lib/store-reservation.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText,
  { module: loadedModule, exports: loadedModule.exports },
);
const { reservationSeconds, reviewReservedItems } = loadedModule.exports;
test('vencimiento absoluto no se reinicia; vuelve de pestaña suspendida y no acepta fecha inválida', () => {
  const expiry = '2026-10-07T20:00:00.000Z';
  assert.equal(
    reservationSeconds(expiry, Date.parse('2026-10-07T19:30:00.000Z')),
    1800,
  );
  assert.equal(
    reservationSeconds(expiry, Date.parse('2026-10-07T19:59:59.001Z')),
    1,
  );
  assert.equal(
    reservationSeconds(expiry, Date.parse('2026-10-07T20:05:00.000Z')),
    0,
  );
  assert.equal(reservationSeconds('invalid', Date.now()), null);
});
test('retomar usa disponibilidad y precio actuales sin inventar variantes ni stock', () => {
  const catalog = {
    products: [
      {
        id: 'p',
        name: 'Camisa',
        slug: 'camisa',
        variants: [
          {
            id: 'v',
            stock: 2,
            price: 12000,
            color: 'Azul',
            size: 'L',
            sku: '1',
            barcode: '1',
          },
          { id: 'sold', stock: 0, price: 10000 },
        ],
      },
    ],
  };
  const result = reviewReservedItems(
    [
      { variantId: 'v', productName: 'Camisa', quantity: 4, unitPrice: 10000 },
      {
        variantId: 'sold',
        productName: 'Agotada',
        quantity: 1,
        unitPrice: 10000,
      },
      {
        variantId: 'removed',
        productName: 'Retirada',
        quantity: 1,
        unitPrice: 10000,
      },
    ],
    catalog,
  );
  assert.equal(result.restored.length, 1);
  assert.equal(result.restored[0].quantity, 2);
  assert.equal(result.restored[0].price, 12000);
  assert.equal(result.notices.length, 4);
});
