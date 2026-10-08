import assert from 'node:assert/strict';
import {
  ownsStoreOrder,
  onlineReservationMinutes,
} from '../lib/store-order-access.ts';
const owner = {
  customerId: 'owner',
  email: 'owner@example.invalid',
  emailVerified: 1,
};
const guestOrder = { customerId: null, email: ' OWNER@example.invalid ' };
assert.equal(ownsStoreOrder(owner, guestOrder), true);
assert.equal(ownsStoreOrder({ ...owner, emailVerified: 0 }, guestOrder), false);
assert.equal(
  ownsStoreOrder({ ...owner, email: 'other@example.invalid' }, guestOrder),
  false,
);
assert.equal(ownsStoreOrder(null, guestOrder), false);
assert.equal(
  ownsStoreOrder(owner, { customerId: 'another-owner', email: owner.email }),
  false,
);
assert.equal(
  ownsStoreOrder(
    { ...owner, emailVerified: 0 },
    { customerId: 'owner', email: 'other@example.invalid' },
  ),
  true,
);
assert.equal(onlineReservationMinutes('transfer'), 10);
assert.equal(onlineReservationMinutes('card'), 30);
console.log('Order ownership and reservation checks passed');
import {
  fulfillmentLabels,
  fulfillmentStep,
} from '../lib/store-order-status.ts';
assert.equal(fulfillmentLabels.delivered, 'Entregado');
assert.equal(fulfillmentLabels.ready_pickup, 'Listo para retirar');
assert.equal(fulfillmentStep('delivered'), 3);
assert.equal(fulfillmentStep('ready_pickup'), 2);
assert.equal(fulfillmentStep('unfulfilled'), 0);
console.log('Order tracking states passed');
