import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

const origin = 'http://localhost:3000';
const headers = {
  Cookie: '__sites_local_auth=1',
  Origin: origin,
  'Content-Type': 'application/json',
};

async function request(path, body) {
  const response = await fetch(`${origin}/api/${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: response.status, body: await response.json() };
}

function sql(command) {
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
      command,
    ],
    { stdio: 'pipe' },
  );
}

assert.equal((await request('session')).body.user.id, 'local_seedy');
const pin = await fetch(origin + '/api/admin-pin', { method: 'POST', headers, body: JSON.stringify({ pin: '197313' }) });
assert.equal(pin.status, 200);
headers.Cookie += '; ' + pin.headers.get('set-cookie').split(';', 1)[0];
const initial = await request('customer-intelligence-config');
assert.equal(initial.status, 200);
const updated = await request('customer-intelligence-config', {
  loyalty: {
    evaluationWindowDays: 180,
    thresholds: {
      Silver: { minSpendMinor: 1_000_000, minPurchases: 2, minPoints: 100 },
      Gold: { minSpendMinor: 2_000_000, minPurchases: 4, minPoints: 250 },
      Black: { minSpendMinor: 4_000_000, minPurchases: 8, minPoints: 500 },
    },
  },
});
assert.equal(updated.status, 200, JSON.stringify(updated.body));
assert.equal(updated.body.loyalty.evaluationWindowDays, 180);
assert.equal(updated.body.loyalty.thresholds.Gold.minPoints, 250);
const insights = await request('customer-intelligence');
assert.equal(insights.status, 200);
assert.equal(
  insights.body.config.loyalty.thresholds.Black.minSpendMinor,
  4_000_000,
);

sql("UPDATE users SET role='VENDEDOR' WHERE id='local_seedy'");
try {
  assert.equal((await request('customer-intelligence-config')).status, 403);
  assert.equal(
    (
      await request('customer-intelligence-config', {
        loyalty: { evaluationWindowDays: 30 },
      })
    ).status,
    403,
  );
} finally {
  sql("UPDATE users SET role='ADMIN' WHERE id='local_seedy'");
  sql("DELETE FROM settings WHERE key='customerIntelligence'");
}
console.log(
  'PASS: Club FRAGUAN thresholds persist, feed insights, and remain admin-only.',
);
