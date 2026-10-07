import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, mkdtempSync, unlinkSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { Worker } from 'node:worker_threads';
import vm from 'node:vm';
import ts from 'typescript';

// Capture the actual application allocation statements, without real DB access.
const loadedModule = { exports: {} };
vm.runInNewContext(
  ts.transpileModule(readFileSync('lib/document-numbers.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText,
  {
    module: loadedModule,
    exports: loadedModule.exports,
    require: () => ({ statement: (sql, ...args) => ({ sql, args }) }),
  },
);
const sale = loadedModule.exports.allocateDocumentNumber('sale');
const order = loadedModule.exports.allocateDocumentNumber('online_order');
const directory = mkdtempSync(join(tmpdir(), 'fraguan-number-test-'));
const file = join(directory, 'numbers.sqlite');
let sqlite;
try {
  sqlite = new DatabaseSync(file);
  sqlite.exec(
    "CREATE TABLE sales(id TEXT PRIMARY KEY,ticket INTEGER UNIQUE); CREATE TABLE online_orders(id TEXT PRIMARY KEY,orderNumber INTEGER UNIQUE); INSERT INTO sales VALUES ('existing',45); INSERT INTO online_orders VALUES ('existing',1050);",
  );
  sqlite.exec(readFileSync('drizzle/0025_atomic_document_numbers.sql', 'utf8'));
  sqlite.close();
  sqlite = null;
  const workerCode = `
    const {parentPort,workerData}=require('node:worker_threads');
    const {DatabaseSync}=require('node:sqlite');
    const db=new DatabaseSync(workerData.file);
    db.exec('PRAGMA busy_timeout=20000');
    try {
      for(let i=0;i<20;i++) {
        db.exec('BEGIN IMMEDIATE');
        db.prepare(workerData.sale.sql).run(...workerData.sale.args);
        db.prepare("INSERT INTO sales VALUES (?,(SELECT value FROM document_counters WHERE name='sale'))").run(workerData.id+'-'+i);
        db.prepare(workerData.order.sql).run(...workerData.order.args);
        db.prepare("INSERT INTO online_orders VALUES (?,(SELECT value FROM document_counters WHERE name='online_order'))").run(workerData.id+'-'+i);
        db.exec('COMMIT');
      }
      parentPort.postMessage('ok');
    } finally {db.close();}
  `;
  await Promise.all(
    Array.from(
      { length: 6 },
      (_, id) =>
        new Promise((resolve, reject) => {
          const worker = new Worker(workerCode, {
            eval: true,
            workerData: { file, sale, order, id },
          });
          worker.on('error', reject);
          worker.on('exit', (code) =>
            code ? reject(new Error('Worker exit ' + code)) : resolve(),
          );
        }),
    ),
  );
  sqlite = new DatabaseSync(file);
  assert.deepEqual(
    {
      ...sqlite
        .prepare('SELECT COUNT(*) AS count,MAX(ticket) AS maximum FROM sales')
        .get(),
    },
    { count: 121, maximum: 165 },
  );
  assert.deepEqual(
    {
      ...sqlite
        .prepare(
          'SELECT COUNT(*) AS count,MAX(orderNumber) AS maximum FROM online_orders',
        )
        .get(),
    },
    { count: 121, maximum: 1170 },
  );
  console.log(
    'SQLite: 6 conexiones concurrentes, 120 tickets y 120 pedidos únicos; históricos conservados.',
  );
} finally {
  sqlite?.close();
  unlinkSync(file);
  rmdirSync(directory);
}

const { PGlite } = await import(
  pathToFileURL(
    resolve(
      'outputs/pg-stock-tests/node_modules/@electric-sql/pglite/dist/index.js',
    ),
  ).href
);
const pg = new PGlite();
try {
  await pg.exec(
    "CREATE TABLE sales(id TEXT PRIMARY KEY,ticket BIGINT UNIQUE); CREATE TABLE online_orders(id TEXT PRIMARY KEY,\"orderNumber\" BIGINT UNIQUE); INSERT INTO sales VALUES ('existing',45); INSERT INTO online_orders VALUES ('existing',1050);",
  );
  await pg.exec(
    readFileSync('drizzle-postgres/0006_atomic_document_numbers.sql', 'utf8'),
  );
  const translate = (sql) =>
    sql
      .replaceAll('orderNumber', '"orderNumber"')
      .replace('WHERE name=?', 'WHERE name=$1');
  await pg.exec('BEGIN');
  await pg.query(translate(sale.sql), sale.args);
  await pg.exec('ROLLBACK');
  assert.equal(
    (await pg.query("SELECT value FROM document_counters WHERE name='sale'"))
      .rows[0].value,
    45,
  );
  for (let i = 0; i < 10; i++) {
    await pg.transaction(async (tx) => {
      await tx.query(translate(sale.sql), sale.args);
      await tx.query(
        "INSERT INTO sales VALUES ($1,(SELECT value FROM document_counters WHERE name='sale'))",
        ['sale-' + i],
      );
      await tx.query(translate(order.sql), order.args);
      await tx.query(
        "INSERT INTO online_orders VALUES ($1,(SELECT value FROM document_counters WHERE name='online_order'))",
        ['order-' + i],
      );
    });
  }
  assert.equal(
    (await pg.query('SELECT MAX(ticket) AS n FROM sales')).rows[0].n,
    55,
  );
  assert.equal(
    (await pg.query('SELECT MAX("orderNumber") AS n FROM online_orders'))
      .rows[0].n,
    1060,
  );
  console.log(
    'PostgreSQL (PGlite): migración, asignación y rollback correctos; no simula múltiples backends.',
  );
} finally {
  await pg.close();
}
