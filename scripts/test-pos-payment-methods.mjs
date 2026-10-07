import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { z } from 'zod';
const db = new DatabaseSync(':memory:');
db.exec(
  `CREATE TABLE payment_methods(id TEXT PRIMARY KEY,name TEXT,surchargeBps INTEGER,commissionBps INTEGER,days INTEGER,installments INTEGER,active INTEGER); CREATE TABLE payments(id TEXT PRIMARY KEY,methodId TEXT,amount INTEGER);`,
);
const insert = db.prepare(
  'INSERT INTO payment_methods VALUES(?,?,99,99,99,3,1)',
);
for (const id of [
  'cash',
  'transfer',
  'debit',
  'credit',
  'point-prepaid',
  'point-pix',
  'credit-3',
  'store_credit',
  'cashback',
])
  insert.run(id, id);
db.exec("INSERT INTO payments VALUES('historical','debit',12000)");
db.exec(readFileSync('drizzle/0023_pos_payment_destinations.sql', 'utf8'));
assert.deepEqual(
  db
    .prepare('SELECT id FROM payment_methods WHERE active=1 ORDER BY id')
    .all()
    .map((x) => x.id),
  ['cash', 'credit', 'debit', 'point-prepaid', 'transfer'],
);
for (const [id, rate, days, destination] of [
  ['cash', 0, 0, 'Caja'],
  ['transfer', 0, 0, 'Mercado Pago'],
  ['debit', 288, 2, 'Mercado Pago'],
  ['credit', 440, 10, 'Mercado Pago'],
  ['point-prepaid', 368, 3, 'Mercado Pago'],
]) {
  const m = db.prepare('SELECT * FROM payment_methods WHERE id=?').get(id);
  assert.equal(m.commissionBps, rate);
  assert.equal(m.days, days);
  assert.equal(m.destination, destination);
  assert.equal(m.installments, 1);
  assert.equal(m.surchargeBps, 0);
}
assert.equal(
  db.prepare("SELECT destination FROM payments WHERE id='historical'").get()
    .destination,
  '',
);
assert.equal(
  db.prepare("SELECT amount FROM payments WHERE id='historical'").get().amount,
  12000,
);
const source = readFileSync('lib/configuration.ts', 'utf8');
const extracted = source
  .slice(
    source.indexOf('const methodFields'),
    source.indexOf('export async function addVariant'),
  )
  .replaceAll('export async function', 'async function');
const js = ts.transpileModule(extracted, {
  compilerOptions: { target: ts.ScriptTarget.ES2022 },
}).outputText;
let commands;
// Trusted local source only; isolated test harness, no application eval.
// oxlint-disable-next-line typescript/no-implied-eval
const configure = new Function(
  'z',
  'text',
  'requirePermission',
  'one',
  'db',
  'statement',
  'auditStatement',
  'AppError',
  'id',
  js + '; return configureMethod;',
)(
  z,
  z.string().trim().min(1),
  () => {},
  async () => ({ id: 'debit' }),
  () => ({
    batch: async (x) => {
      commands = x;
    },
  }),
  (sql, ...params) => ({ sql, params }),
  () => ({ sql: 'audit' }),
  Error,
  () => 'new',
);
await configure(
  { id: 'owner' },
  {
    id: 'debit',
    name: 'Débito',
    surchargeBps: 0,
    commissionBps: 288,
    days: 2,
    installments: 1,
    destination: 'Mercado Pago',
  },
);
assert.equal(
  (commands[0].sql.match(/\?/g) || []).length,
  commands[0].params.length,
);
assert.equal(commands[0].params.at(-2), 'Mercado Pago');
assert.equal(commands[0].params.at(-1), 'debit');
console.log(
  'PASS: cuatro medios + prepaga, tasas/plazos, destinos editables, sin cuotas y sin alterar cobros históricos.',
);
