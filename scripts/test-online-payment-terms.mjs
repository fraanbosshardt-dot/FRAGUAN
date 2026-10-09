import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import ts from 'typescript';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
const module = { exports: {} };
new Function('exports', ts.transpileModule(readFileSync('lib/online-payment-terms.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText)(module.exports);
const paidAt = '2026-10-08T15:00:00.000Z';
assert.deepEqual(module.exports.onlinePaymentAmounts(900000, { commissionBps: 339, days: 18 }, paidAt), {
  commission: 30510, net: 869490, dueAt: '2026-10-26T15:00:00.000Z',
});
assert.deepEqual(module.exports.onlinePaymentAmounts(10000, { commissionBps: 0, days: 0 }, paidAt), {
  commission: 0, net: 10000, dueAt: paidAt,
});
const db = new DatabaseSync(':memory:');
db.exec(`CREATE TABLE payment_methods(id TEXT PRIMARY KEY,name TEXT,surchargeBps INTEGER,commissionBps INTEGER,days INTEGER,installments INTEGER,active INTEGER,destination TEXT);
INSERT INTO payment_methods VALUES('credit','Crédito',0,440,10,1,1,'Mercado Pago');`);
const migration = readFileSync('drizzle/0028_online_checkout_terms.sql', 'utf8');
db.exec(migration);
assert.deepEqual({ ...db.prepare("SELECT commissionBps,days,active FROM payment_methods WHERE id='online-mp'").get() }, { commissionBps: 339, days: 18, active: 0 });
assert.deepEqual({ ...db.prepare("SELECT commissionBps,days FROM payment_methods WHERE id='credit'").get() }, { commissionBps: 440, days: 10 });
assert.equal(db.prepare("SELECT COUNT(*) AS n FROM payment_methods WHERE active=1 AND id='online-mp'").get().n, 0);
db.exec("UPDATE payment_methods SET commissionBps=200 WHERE id='online-mp'");
db.exec(migration);
assert.equal(db.prepare("SELECT commissionBps FROM payment_methods WHERE id='online-mp'").get().commissionBps, 200);
db.close();
const { PGlite } = await import(pathToFileURL(resolve('outputs/pg-stock-tests/node_modules/@electric-sql/pglite/dist/index.js')).href);
const pg = new PGlite();
try {
  await pg.exec('CREATE TABLE payment_methods(id TEXT PRIMARY KEY,name TEXT,"surchargeBps" INTEGER,"commissionBps" INTEGER,days INTEGER,installments INTEGER,active INTEGER,destination TEXT)');
  await pg.exec(readFileSync('drizzle-postgres/0009_online_checkout_terms.sql', 'utf8'));
  const terms = (await pg.query("SELECT * FROM payment_methods WHERE id='online-mp'")).rows[0];
  assert.equal(terms.commissionBps, 339);
  assert.equal(terms.days, 18);
  assert.equal(terms.active, 0);
} finally { await pg.close(); }
console.log('PASS: comisión web 3,39%, plazo 18 días, transferencia inmediata, Point separado y configuración editable preservada.');
