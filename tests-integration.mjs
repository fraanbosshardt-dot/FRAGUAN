import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
const origin = 'http://localhost:3000';
const headers = {
  Cookie: '__sites_local_auth=1',
  Origin: origin,
  'Content-Type': 'application/json',
};
async function request(path, body, extra = {}) {
  const r = await fetch(origin + '/api/' + path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { ...headers, ...extra },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await r.text();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = { error: text };
  }
  return {
    status: r.status,
    body: parsed,
    cache: r.headers.get('cache-control'),
    setCookie: r.headers.get('set-cookie'),
    retryAfter: r.headers.get('retry-after'),
  };
}
function sql(query) {
  execFileSync(
    process.execPath,
    [
      'node_modules/wrangler/bin/wrangler.js',
      'd1',
      'execute',
      'DB',
      '--local',
      '--config',
      'wrangler.local.jsonc',
      '--command',
      query,
    ],
    { stdio: 'pipe' },
  );
}
const session = await request('session');
assert.equal(session.status, 200);
assert.equal(
  session.body.user.id,
  'local_seedy',
  'Only run against the local demo fixture.',
);
const invalidGoogleLogin = await request('internal-auth', {
  action: 'google',
  credential: 'x'.repeat(100),
});
assert.equal(invalidGoogleLogin.status, 401);
const internalLogout = await request('internal-auth', { action: 'logout' });
assert.equal(internalLogout.status, 200);
assert.match(internalLogout.setCookie, /fraguan_internal_session=/);
assert.match(internalLogout.setCookie, /Max-Age=0/);
const wrongAdminPin = await request('admin-pin', { pin: '000000' });
assert.equal(wrongAdminPin.status, 403);
const lockedAdminApi = await request('dashboard');
assert.equal(lockedAdminApi.status, 403);
assert.match(lockedAdminApi.body.error, /PIN de Administración/);
assert.equal((await request('customers?q=Juan')).status, 403);
assert.equal((await request('sales')).status, 403);
const safePosCustomers = await request('customers?scope=pos&q=Juan');
assert.equal(safePosCustomers.status, 200);
if (safePosCustomers.body.length)
  assert.deepEqual(
    Object.keys(safePosCustomers.body[0]).sort(),
    ['id', 'name', 'surname', 'phone'].sort(),
  );
const safePosSales = await request('sales?scope=pos');
assert.equal(safePosSales.status, 200);
assert(safePosSales.body.every((x) => !('sellerName' in x)));
const correctAdminPin = await request('admin-pin', { pin: '197313' });
assert.equal(correctAdminPin.status, 200);
assert.match(correctAdminPin.setCookie, /fraguan_admin_access=/);
assert.match(correctAdminPin.setCookie, /HttpOnly/i);
assert.match(correctAdminPin.setCookie, /SameSite=Strict/i);
const lockedAdminPage = await fetch(origin + '/admin/dashboard', {
  headers: { Cookie: headers.Cookie },
  redirect: 'manual',
});
assert([302, 307, 308].includes(lockedAdminPage.status));
assert.match(lockedAdminPage.headers.get('location'), /admin-access/);
const adminCookie = correctAdminPin.setCookie.split(';', 1)[0];
const tamperedAdminCookie = `${adminCookie.slice(0, -1)}${adminCookie.endsWith('a') ? 'b' : 'a'}`;
assert.equal(
  (
    await request('dashboard', undefined, {
      Cookie: `${headers.Cookie}; ${tamperedAdminCookie}`,
    })
  ).status,
  403,
);
const tamperedAdminPage = await fetch(origin + '/admin/dashboard', {
  headers: { Cookie: `${headers.Cookie}; ${tamperedAdminCookie}` },
  redirect: 'manual',
});
assert([302, 307, 308].includes(tamperedAdminPage.status));
headers.Cookie = `${headers.Cookie}; ${adminCookie}`;
const unlockedAdminPage = await fetch(origin + '/admin/dashboard', {
  headers: { Cookie: headers.Cookie },
});
assert.equal(unlockedAdminPage.status, 200);
assert.match(await unlockedAdminPage.text(), /Vista general/);
const products = await request('catalog');
assert.equal(products.status, 200);
const allowed = [
  'id',
  'productId',
  'name',
  'category',
  'brand',
  'sku',
  'barcode',
  'color',
  'size',
  'price',
  'stock',
].sort();
assert.deepEqual(Object.keys(products.body[0]).sort(), allowed);
assert.match(products.cache, /no-store/);
const v = products.body.find((v) => v.stock >= 2);
assert(v);
const payload = {
  items: [{ variantId: v.id, quantity: 1 }],
  customerId: null,
  promotionId: null,
  payments: [{ methodId: 'cash', baseMinor: v.price, receivedMinor: v.price }],
  idempotencyKey: crypto.randomUUID(),
};
assert.equal((await request('sales', { ...payload, cost: 1 })).status, 400);
assert.equal(
  (
    await request('sales', {
      ...payload,
      payments: [{ methodId: 'cash', baseMinor: 1, receivedMinor: 1 }],
    })
  ).status,
  400,
);
assert.equal(
  (
    await request('sales', {
      ...payload,
      items: [{ variantId: v.id, quantity: 100 }],
    })
  ).status,
  409,
);
assert.equal(
  (await request('sales', payload, { Origin: 'https://untrusted.example' }))
    .status,
  403,
);
const sale = await request('sales', payload);
assert.equal(sale.status, 201, JSON.stringify(sale.body));
assert(!JSON.stringify(sale.body).includes('cost'));
const retry = await request('sales', payload);
assert.equal(retry.body.id, sale.body.id);
assert.equal(
  (await request('catalog')).body.find((x) => x.id === v.id).stock,
  v.stock - 1,
);
assert.equal(
  (
    await request('sales', {
      ...payload,
      payments: [
        { methodId: 'cash', baseMinor: v.price, receivedMinor: v.price + 100 },
      ],
    })
  ).status,
  409,
);
const other = (await request('sales')).body.find(
  (x) => x.sellerName === 'Lucas · Demo',
);
assert(other);
try {
  sql("UPDATE users SET role='VENDEDOR' WHERE id='local_seedy'");
  for (const path of [
    'dashboard',
    'products',
    'stock',
    'cash',
    'expenses',
    'payables',
    'withdrawals',
    'purchases',
    'suppliers',
    'reports',
    'users',
    'audit',
    'settings',
    'insights',
  ])
    assert.equal((await request(path)).status, 403, path);
  assert.equal((await request('sales?id=' + other.id)).status, 403);
  assert.equal((await request('sales?id=' + sale.body.id)).status, 200);
  const own = await request('sales');
  assert(own.body.every((x) => !('sellerName' in x)));
  assert.deepEqual((await request('customers')).body, []);
  const c = await request('customers?q=Juan');
  assert(c.body.length);
  assert.deepEqual(
    Object.keys(c.body[0]).sort(),
    ['id', 'name', 'surname', 'phone'].sort(),
  );
  assert.equal(
    (
      await request('refunds', {
        saleId: sale.body.id,
        reason: 'Prueba autorizada',
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await request('actions', {
        action: 'set-price',
        id: v.id,
        amount: 100,
        cost: 0,
      })
    ).status,
    403,
  );
  assert.equal((await request('catalog')).status, 200);
} finally {
  sql("UPDATE users SET role='ADMIN' WHERE id='local_seedy'");
}
const refund = await request('refunds', {
  saleId: sale.body.id,
  reason: 'Devolución de prueba de integración',
});
assert.equal(refund.status, 200, JSON.stringify(refund.body));
assert.equal(
  (await request('catalog')).body.find((x) => x.id === v.id).stock,
  v.stock,
);
assert.equal(
  (
    await request('refunds', {
      saleId: sale.body.id,
      reason: 'Repetición de prueba',
    })
  ).status,
  409,
);
const raceVariant = (await request('catalog')).body.find((x) => x.stock === 1);
assert(raceVariant);
const raceBody = () => ({
  items: [{ variantId: raceVariant.id, quantity: 1 }],
  customerId: null,
  promotionId: null,
  payments: [{ methodId: 'debit', baseMinor: raceVariant.price }],
  idempotencyKey: crypto.randomUUID(),
});
const races = await Promise.all([
  request('sales', raceBody()),
  request('sales', raceBody()),
]);
assert.deepEqual(
  races.map((x) => x.status).sort((a, b) => a - b),
  [201, 409],
);
assert.equal(
  (await request('catalog')).body.find((x) => x.id === raceVariant.id).stock,
  0,
);
await request('refunds', {
  saleId: races.find((x) => x.status === 201).body.id,
  reason: 'Restauración de prueba concurrente',
});
const oversizedPublicField = await request('store-shipping', {
  postalCode: '1'.repeat(500),
  subtotal: 1000,
  method: 'correo-argentino-home',
});
assert.equal(oversizedPublicField.status, 400);
const polluted = await fetch(origin + '/api/store-shipping', {
  method: 'POST',
  headers: { Origin: origin, 'Content-Type': 'application/json' },
  body: '{"postalCode":"2661","subtotal":1000,"method":"pickup","__proto__":{"admin":true}}',
});
assert.equal(polluted.status, 400);
const malformedWebhook = await fetch(origin + '/api/webhooks/bank', {
  method: 'POST',
  body: '{}',
});
assert.equal(malformedWebhook.status, 415);
const root = await fetch(origin + '/');
assert.equal(root.headers.get('x-frame-options'), 'DENY');
assert.equal(root.headers.get('x-content-type-options'), 'nosniff');
assert.match(root.headers.get('content-security-policy') ?? '', /frame-ancestors 'none'/);
const pinAttempts = [];
for (let index = 0; index < 9; index += 1)
  pinAttempts.push(
    await request('admin-pin', { pin: '000000' }, {
      'CF-Connecting-IP': '198.51.100.77',
    }),
  );
const blockedPin = pinAttempts.find((attempt) => attempt.status === 429);
assert(blockedPin);
assert(Number(blockedPin.retryAfter) > 0);
console.log(
  'PASS: RBAC, signed admin session, field allowlists, input limits, rate limits, security headers, origin checks, idempotency, refunds and concurrent stock transaction.',
);
