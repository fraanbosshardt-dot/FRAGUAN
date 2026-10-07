import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import ts from 'typescript';
const db = new DatabaseSync(':memory:');
db.exec(
  `CREATE TABLE payments(id TEXT,saleId TEXT,methodId TEXT,amount INTEGER,commission INTEGER,net INTEGER,dueAt TEXT,destination TEXT); CREATE TABLE sales(id TEXT,ticket INTEGER,channel TEXT,createdAt TEXT,status TEXT); CREATE TABLE payment_methods(id TEXT,name TEXT,days INTEGER);`,
);
for (const [id, name, days] of [
  ['debit', 'Débito', 2],
  ['credit', 'Crédito', 10],
  ['point-prepaid', 'Prepaga', 3],
  ['transfer', 'Transferencia', 0],
  ['cash', 'Efectivo', 0],
  ['store_credit', 'Saldo', 0],
])
  db.prepare('INSERT INTO payment_methods VALUES(?,?,?)').run(id, name, days);
const fixtures = [
  ['debit', '2026-10-09T15:00:00Z'],
  ['credit', '2026-10-17T15:00:00Z'],
  ['point-prepaid', '2026-10-10T15:00:00Z'],
  ['transfer', '2026-10-07T15:00:00Z'],
  ['cash', '2026-10-07T15:00:00Z'],
  ['store_credit', '2026-10-07T15:00:00Z'],
  ['debit', '2026-10-08T02:59:59.999Z'],
  ['debit', '2026-10-08T03:00:00Z'],
];
for (let i = 0; i < fixtures.length; i++) {
  db.prepare('INSERT INTO sales VALUES(?,?,?,?,?)').run(
    'sale' + i,
    i + 1,
    'pos',
    '2026-10-07T15:00:00Z',
    'confirmed',
  );
  db.prepare('INSERT INTO payments VALUES(?,?,?,?,?,?,?,?)').run(
    'payment' + i,
    'sale' + i,
    fixtures[i][0],
    10000,
    288,
    9712,
    fixtures[i][1],
    'Mercado Pago',
  );
}
const source = readFileSync('lib/scheduled-collections.ts', 'utf8');
const transpile = (s) =>
  ts.transpileModule(s, { compilerOptions: { target: ts.ScriptTarget.ES2022 } })
    .outputText;
const day = (value) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Cordoba',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(value ?? '2026-10-07T15:00:00Z'));
// Trusted local source, isolated test harness only.
// oxlint-disable-next-line typescript/no-implied-eval
const cutoff = new Function(
  'argentinaDay',
  transpile(
    source
      .slice(
        source.indexOf('export function settlementCutoff'),
        source.indexOf('export async function scheduledCollections'),
      )
      .replace('export ', ''),
  ) + ';return settlementCutoff;',
)(day);
assert.equal(cutoff('2026-10-08T02:30:00Z'), '2026-10-08T02:59:59.999Z');
assert.equal(cutoff('2026-10-08T03:00:00Z'), '2026-10-09T02:59:59.999Z');
// Trusted local source, isolated test harness only.
// oxlint-disable-next-line typescript/no-implied-eval
const load = new Function(
  'requirePermission',
  'settlementCutoff',
  'rows',
  'one',
  'argentinaDay',
  transpile(
    source
      .slice(source.indexOf('export async function scheduledCollections'))
      .replace('export ', ''),
  ) + ';return scheduledCollections;',
)(
  () => {},
  () => cutoff('2026-10-07T15:00:00Z'),
  async (sql, ...p) => db.prepare(sql).all(...p),
  async (sql, ...p) => db.prepare(sql).get(...p),
  day,
);
const result = await load({ role: 'ADMIN' });
assert.equal(result.pending.length, 4);
assert.equal(result.available.length, 2);
assert.equal(result.totals.pendingNet, 9712 * 4);
assert.ok(result.available.some((p) => p.method === 'Transferencia'));
assert.ok(
  ![...result.available, ...result.pending].some((p) =>
    ['Efectivo', 'Saldo'].includes(p.method),
  ),
);
db.exec('UPDATE payment_methods SET days=99');
assert.deepEqual((await load({ role: 'ADMIN' })).pending, result.pending);
console.log(
  'PASS: fecha argentina, plazos guardados, tarjetas automáticas, transferencia inmediata, efectivo excluido y consulta sin escrituras.',
);
