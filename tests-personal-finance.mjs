import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
const origin = 'http://localhost:3000';
const headers = {
  Cookie: '__sites_local_auth=1',
  Origin: origin,
  'Content-Type': 'application/json',
};
const root = resolve('.wrangler/state/v3/d1/miniflare-D1DatabaseObject');
const file = readdirSync(root).find(
  (name) => name.endsWith('.sqlite') && name !== 'metadata.sqlite',
);
const database = new DatabaseSync(resolve(root, file));
const role = database
  .prepare("SELECT role FROM users WHERE id='local_seedy'")
  .get().role;
const stored = database
  .prepare("SELECT value FROM settings WHERE key='personal-finance'")
  .get()?.value;
const pin = await fetch(origin + '/api/admin-pin', {
  method: 'POST',
  headers,
  body: JSON.stringify({ pin: '197313' }),
});
headers.Cookie += `; ${pin.headers.get('set-cookie').split(';', 1)[0]}`;
try {
  database
    .prepare("UPDATE users SET role='ADMIN' WHERE id='local_seedy'")
    .run();
  const response = await fetch(origin + '/api/personal-finance', { headers });
  assert.equal(response.status, 200);
  const config = await response.json();
  assert.equal(config.availableMinor, 2500000000);
  assert(config.debts.length >= 16);
  assert(
    config.debts.some(
      (d) => d.id === 'credicuotas' && d.payoffMinor === 330263500,
    ),
  );
  const saved = await fetch(origin + '/api/personal-finance', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      ...config,
      availableMinor: 2400000000,
      businessIncomeMinor: 45000000,
      debts: config.debts.map((debt) =>
        debt.id === 'brubank-1' ? { ...debt, status: 'paid' } : debt,
      ),
    }),
  });
  const savedText = await saved.text();
  assert.equal(saved.status, 200, savedText);
  const savedConfig = JSON.parse(savedText);
  assert.equal(savedConfig.businessIncomeMinor, 45000000);
  assert.equal(
    savedConfig.debts.find((debt) => debt.id === 'brubank-1').status,
    'paid',
  );
  database
    .prepare("UPDATE users SET role='VENDEDOR' WHERE id='local_seedy'")
    .run();
  assert.equal(
    (await fetch(origin + '/api/personal-finance', { headers })).status,
    403,
  );
  console.log(
    'PASS: centro financiero privado, flujos, pagos, persistencia y bloqueo al vendedor.',
  );
} finally {
  database.prepare("UPDATE users SET role=? WHERE id='local_seedy'").run(role);
  if (stored)
    database
      .prepare("UPDATE settings SET value=? WHERE key='personal-finance'")
      .run(stored);
  else
    database.prepare("DELETE FROM settings WHERE key='personal-finance'").run();
  database.close();
}
