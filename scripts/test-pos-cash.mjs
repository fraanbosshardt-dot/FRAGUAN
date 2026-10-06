import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { z } from 'zod';

// Run the actual cash action branches with an isolated database double.
const source = readFileSync(
  new URL('../lib/admin.ts', import.meta.url),
  'utf8',
);
const actionSource = source.slice(
  source.indexOf('export async function adminAction('),
  source.indexOf('export async function dashboard('),
);
const validationSource = readFileSync(
  new URL('../lib/validation.ts', import.meta.url),
  'utf8',
).replace("'zod'", JSON.stringify(import.meta.resolve('zod')));
const moduleUrl = (source) =>
  'data:text/javascript;base64,' +
  Buffer.from(
    ts.transpileModule(source, {
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.ES2022,
      },
    }).outputText,
  ).toString('base64');
const validation = await import(moduleUrl(validationSource));
let active = null;
let batches = [];
let generated = 0;
let postgres = false;
let changes = 1;
globalThis.__cashTest = {
  z,
  v: validation,
  one: async () => active,
  statement: (sql, ...args) => ({ sql, args }),
  id: () => `generated-${++generated}`,
  now: () => '2026-10-06T22:00:00.000Z',
  usingPostgres: () => postgres,
  db: () => ({
    batch: async (commands) => {
      batches.push(commands);
      return [{ meta: { changes } }];
    },
  }),
  auditStatement: (actor, action, entity, before, after) => ({
    audit: { actor, action, entity, before, after },
  }),
  requirePermission: (actor, resource) => {
    if (actor.role !== 'ADMIN' && resource === 'cash')
      throw new Error('Acceso denegado.');
  },
};
const { adminAction } = await import(
  moduleUrl(
    `const {z,v,one,statement,id,now,db,auditStatement,requirePermission,usingPostgres}=globalThis.__cashTest; class AppError extends Error {constructor(status,message){super(message);this.status=status}}\n${actionSource}`,
  )
);
const owner = { id: 'real-owner-id', role: 'ADMIN' };
await adminAction(owner, { action: 'open-cash', amount: 20000 });
assert.equal(batches[0][0].args[1], owner.id);
assert.equal(batches[0][0].args[2], 20000);
assert.equal(batches[0][1].audit.entity, batches[0][0].args[0]);
active = { id: 'actual-cash-session', opening: 20000 };
await assert.rejects(
  () => adminAction(owner, { action: 'open-cash', amount: 0 }),
  /Ya hay una caja abierta/,
);
await assert.rejects(
  () =>
    adminAction(owner, {
      action: 'close-cash',
      amount: 0,
      id: 'stale-session',
    }),
  /La caja cambió/,
);
await assert.rejects(
  () =>
    adminAction(
      { id: 'seller', role: 'VENDEDOR' },
      { action: 'close-cash', amount: 0 },
    ),
  /Acceso denegado/,
);
assert.equal(batches.length, 1, 'Rejected actions must not write or audit');
await adminAction(owner, { action: 'close-cash', amount: 25000 });
assert.equal(
  batches[1][1].audit.entity,
  active.id,
  'Closure audit must identify the actual session, even without an input id',
);
assert.equal(batches[1][1].audit.actor, owner.id);
assert.equal(batches[1][1].audit.after.amount, 25000);
assert.match(batches[1][0].sql, /methodId='cash'/);
active = null;
await assert.rejects(
  () => adminAction(owner, { action: 'close-cash', amount: 0 }),
  /No hay una caja abierta/,
);
assert.equal(batches.length, 2);
postgres = true;
active = { id: 'postgres-session', opening: 0 };
await adminAction(owner, { action: 'close-cash', amount: 100 });
const atomic = batches[2][0];
assert.match(atomic.sql, /WITH closed AS/);
assert.match(atomic.sql, /FROM closed/);
assert.equal(atomic.args[7], owner.id);
assert.equal(JSON.parse(atomic.args[8]).id, active.id);
changes = 0;
await assert.rejects(
  () => adminAction(owner, { action: 'close-cash', amount: 100 }),
  /ya fue cerrada/,
);
delete globalThis.__cashTest;
console.log(
  'POS cash checks passed: opening actor, duplicate guard, stale session, permissions and closure audit linkage.',
);
