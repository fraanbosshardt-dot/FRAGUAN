import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const nodeMajor = Number(process.versions.node.split('.')[0]);
if (
  nodeMajor === 22 &&
  !process.execArgv.includes('--experimental-strip-types')
) {
  execFileSync(
    process.execPath,
    ['--experimental-strip-types', fileURLToPath(import.meta.url)],
    { stdio: 'inherit' },
  );
  process.exit(0);
}

const { CommercialRuleValidationError, evaluateCommercialRules } =
  await import('./lib/commercial-rules.ts');

const context = {
  evaluatedAt: '2026-09-04T15:30:00-03:00',
  timeZoneOffsetMinutes: -180,
  paymentMethodIds: ['cash'],
  couponCode: ' cumple-20 '.trim(),
  customer: { level: 'Oro', birthDate: '1990-09-04' },
};

function promotion(overrides) {
  return {
    id: 'promotion',
    name: 'Promoción autorizada',
    authorized: true,
    active: true,
    kind: 'percentage',
    percentBps: 1000,
    ...overrides,
  };
}

function evaluate(items, promotions, suppliedContext = context) {
  return evaluateCommercialRules({
    items,
    promotions,
    context: suppliedContext,
  });
}

{
  const result = evaluate(
    [
      {
        id: 'jean',
        category: 'Pantalones',
        brand: 'FRAGUAN',
        unitPriceCents: 10_000,
        quantity: 1,
      },
      {
        id: 'remera',
        category: 'Remeras',
        brand: 'FRAGUAN',
        unitPriceCents: 5_000,
        quantity: 1,
      },
    ],
    [
      promotion({
        id: 'category-brand-20',
        percentBps: 2000,
        scope: { categories: ['pantalones'], brands: ['fraguan'] },
      }),
    ],
  );
  assert.equal(result.subtotalCents, 15_000);
  assert.equal(result.discountTotalCents, 2_000);
  assert.equal(result.totalCents, 13_000);
  assert.deepEqual(result.appliedDiscounts[0].items, [
    { itemId: 'jean', amountCents: 2_000, affectedQuantity: 1 },
  ]);
}

{
  const result = evaluate(
    [
      { id: 'a', unitPriceCents: 100, quantity: 1 },
      { id: 'b', unitPriceCents: 300, quantity: 1 },
    ],
    [
      promotion({
        id: 'fixed',
        kind: 'fixed_amount',
        amountCents: 250,
        percentBps: undefined,
      }),
    ],
  );
  assert.equal(result.discountTotalCents, 250);
  assert.deepEqual(
    result.items.map((item) => item.discountCents),
    [63, 187],
    'The fixed amount uses deterministic proportional allocation.',
  );
  const capped = evaluate(
    [{ id: 'only', unitPriceCents: 80, quantity: 1 }],
    [
      promotion({
        id: 'fixed-cap',
        kind: 'fixed_amount',
        amountCents: 500,
        percentBps: undefined,
      }),
    ],
  );
  assert.equal(capped.discountTotalCents, 80);
  assert.equal(capped.totalCents, 0);
}

{
  const line = [{ id: 'socks', unitPriceCents: 1_000, quantity: 5 }];
  const result = evaluate(line, [
    promotion({
      id: 'two-for-one',
      kind: 'two_for_one',
      percentBps: undefined,
    }),
  ]);
  assert.equal(result.discountTotalCents, 2_000);
  assert.equal(result.appliedDiscounts[0].items[0].affectedQuantity, 2);

  const mixed = evaluate(
    [
      { id: 'high', unitPriceCents: 3_000, quantity: 1 },
      { id: 'mid', unitPriceCents: 2_000, quantity: 1 },
      { id: 'low', unitPriceCents: 1_000, quantity: 1 },
    ],
    [
      promotion({
        id: 'two-for-one-cart',
        kind: 'two_for_one',
        groupBy: 'cart',
        percentBps: undefined,
      }),
    ],
  );
  assert.equal(
    mixed.discountTotalCents,
    2_000,
    'Each cart pair discounts its cheaper unit.',
  );
}

{
  const result = evaluate(
    [{ id: 'pair', unitPriceCents: 1_001, quantity: 4 }],
    [
      promotion({
        id: 'second-half',
        kind: 'second_unit_percentage',
        percentBps: 5000,
      }),
    ],
  );
  assert.equal(result.discountTotalCents, 1_001);
  assert.equal(result.appliedDiscounts[0].items[0].affectedQuantity, 2);
}

{
  const guarded = promotion({
    id: 'guarded',
    percentBps: 2500,
    scope: { categories: ['PANTALONES'], brands: ['FRAGUAN'] },
    conditions: {
      paymentMethodIds: ['cash'],
      couponCodes: ['CUMPLE-20'],
      customerLevels: ['ORO'],
      birthday: true,
      schedule: {
        startsAt: '2026-09-01T00:00:00-03:00',
        endsAt: '2026-09-05T00:00:00-03:00',
        daysOfWeek: [5],
        dailyStart: '09:00',
        dailyEnd: '18:00',
        timeZoneOffsetMinutes: -180,
      },
    },
  });
  const item = [
    {
      id: 'eligible',
      category: 'pantalones',
      brand: 'fraguan',
      unitPriceCents: 4_000,
      quantity: 1,
    },
  ];
  assert.equal(evaluate(item, [guarded]).discountTotalCents, 1_000);
  assert.equal(
    evaluate(item, [guarded], {
      ...context,
      paymentMethodIds: ['cash', 'credit'],
    }).discountTotalCents,
    0,
    'All methods in a split payment must be authorized.',
  );
  assert.equal(
    evaluate(item, [guarded], { ...context, couponCode: 'OTHER' })
      .discountTotalCents,
    0,
  );
  assert.equal(
    evaluate(item, [guarded], {
      ...context,
      customer: { level: 'Plata', birthDate: '1990-09-04' },
    }).discountTotalCents,
    0,
  );
}

{
  const overnight = promotion({
    id: 'friday-night',
    conditions: {
      schedule: {
        daysOfWeek: [5],
        dailyStart: '22:00',
        dailyEnd: '02:00',
        timeZoneOffsetMinutes: -180,
      },
    },
  });
  const item = [{ id: 'night-item', unitPriceCents: 1_000, quantity: 1 }];
  assert.equal(
    evaluate(item, [overnight], {
      evaluatedAt: '2026-09-05T01:00:00-03:00',
      timeZoneOffsetMinutes: -180,
    }).discountTotalCents,
    100,
    'The after-midnight part belongs to the day on which the overnight window began.',
  );
  assert.equal(
    evaluate(item, [overnight], {
      evaluatedAt: '2026-09-05T03:00:00-03:00',
      timeZoneOffsetMinutes: -180,
    }).discountTotalCents,
    0,
  );
}

{
  const items = [{ id: 'priority-item', unitPriceCents: 1_000, quantity: 1 }];
  const rules = [
    promotion({ id: 'later', priority: 10, percentBps: 5000 }),
    promotion({
      id: 'exclusive-first',
      priority: 20,
      exclusive: true,
      kind: 'fixed_amount',
      amountCents: 300,
      percentBps: undefined,
    }),
    promotion({ id: 'unauthorized', priority: 100, authorized: false }),
    promotion({ id: 'paused', priority: 100, active: false }),
  ];
  const forward = evaluate(items, rules);
  const reversed = evaluate(items, [...rules].reverse());
  assert.deepEqual(
    forward,
    reversed,
    'Rule order must not change a deterministic result.',
  );
  assert.equal(forward.discountTotalCents, 300);
  assert.deepEqual(
    forward.appliedDiscounts.map((discount) => discount.promotionId),
    ['exclusive-first'],
  );
}

{
  const items = [{ id: 'stack', unitPriceCents: 1_000, quantity: 1 }];
  const result = evaluate(items, [
    promotion({ id: 'first', priority: 30, percentBps: 1000 }),
    promotion({
      id: 'lower-exclusive',
      priority: 20,
      exclusive: true,
      kind: 'fixed_amount',
      amountCents: 500,
      percentBps: undefined,
    }),
    promotion({ id: 'second', priority: 10, percentBps: 1000 }),
  ]);
  assert.deepEqual(
    result.appliedDiscounts.map((discount) => discount.promotionId),
    ['first', 'second'],
    'A lower-priority exclusive rule cannot displace an already-applied rule.',
  );
  assert.equal(result.discountTotalCents, 190);
}

{
  const source = Object.freeze({
    items: Object.freeze([
      Object.freeze({ id: 'frozen', unitPriceCents: 999, quantity: 1 }),
    ]),
    promotions: Object.freeze([
      Object.freeze(promotion({ id: 'frozen-rule' })),
    ]),
    context: Object.freeze({ evaluatedAt: '2026-09-04T00:00:00Z' }),
  });
  const result = evaluateCommercialRules(source);
  assert.equal(result.discountTotalCents, 99);
  assert.equal(
    /cost/i.test(JSON.stringify(result)),
    false,
    'The result must not expose costs.',
  );
  assert.equal(
    result.appliedDiscounts.reduce(
      (sum, discount) => sum + discount.amountCents,
      0,
    ),
    result.discountTotalCents,
  );
  assert.equal(
    result.items.reduce((sum, item) => sum + item.discountCents, 0),
    result.discountTotalCents,
  );
}

function validationError(input, path) {
  assert.throws(
    () => evaluateCommercialRules(input),
    (error) =>
      error instanceof CommercialRuleValidationError && error.path === path,
  );
}

validationError(
  {
    items: [{ id: 'bad-money', unitPriceCents: 10.5, quantity: 1 }],
    promotions: [],
    context: { evaluatedAt: '2026-09-04T00:00:00Z' },
  },
  'input.items[0].unitPriceCents',
);
validationError(
  {
    items: [{ id: 'leak', unitPriceCents: 100, quantity: 1, costCents: 1 }],
    promotions: [],
    context: { evaluatedAt: '2026-09-04T00:00:00Z' },
  },
  'input.items[0].costCents',
);
validationError(
  {
    items: [{ id: 'valid', unitPriceCents: 100, quantity: 1 }],
    promotions: [],
    context: { evaluatedAt: '2026-09-04T00:00:00' },
  },
  'input.context.evaluatedAt',
);
validationError(
  {
    items: [{ id: 'valid', unitPriceCents: 100, quantity: 1 }],
    promotions: [promotion({ id: 'too-much', percentBps: 10_001 })],
    context: { evaluatedAt: '2026-09-04T00:00:00Z' },
  },
  'input.promotions[0].percentBps',
);

console.log(
  'PASS: commercial rules cover cents, percentage/fixed/2x1/second unit, scopes, payment, coupons, birthday, levels, schedules, priority, exclusivity and validation.',
);
