import assert from 'node:assert/strict';
import {
  assertTarget,
  planReset,
  prepareRealFraguan,
  ownerAccounts,
} from './prepare-real-fraguan.mjs';

const tables = [
  'users',
  'settings',
  'products',
  'sales',
  'payment_methods',
  'stock_locations',
];
const runtime = {
  FRAGUAN_REAL_OWNERS: JSON.stringify([
    { email: 'one@example.test', name: 'One' },
    { email: 'two@example.test', name: 'Two' },
  ]),
};
assert.throws(() => ownerAccounts({}));
assert.throws(() =>
  ownerAccounts({
    FRAGUAN_REAL_OWNERS: JSON.stringify([
      { email: 'one@example.test', name: 'One' },
      { email: 'one@example.test', name: 'Two' },
    ]),
  }),
);
assert.throws(() => assertTarget({ RAILWAY_PROJECT_ID: 'another-project' }));
assert.deepEqual(planReset(tables, new Set(tables)), ['products', 'sales']);
assert.throws(() => planReset([...tables, 'unrelated_data'], new Set(tables)));
let calls = [];
const client = {
  async query(sql) {
    calls.push(sql);
    if (sql.includes('pg_tables'))
      return { rows: tables.map((tablename) => ({ tablename })) };
    if (sql.startsWith('SELECT value')) return { rows: [] };
    return { rows: [{ n: sql.includes('fraguan_before_real_setup') ? 0 : 1 }] };
  },
};
await prepareRealFraguan(client, false);
assert.equal(calls.length, 2, 'Preview must never write');
calls = [];
await assert.rejects(
  prepareRealFraguan(client, true, runtime),
  /Respaldo incompleto/,
);
assert.equal(calls.at(-1), 'ROLLBACK');
assert.ok(
  !calls.some((sql) => sql.startsWith('TRUNCATE')),
  'An incomplete backup must prevent deletion',
);
calls = [];
client.query = async (sql) => {
  calls.push(sql);
  return {
    rows: sql.includes('pg_tables')
      ? tables.map((tablename) => ({ tablename }))
      : [{ value: 'done' }],
  };
};
await prepareRealFraguan(client, true);
assert.equal(calls.length, 2, 'Completed setup must be idempotent');
calls = [];
let truncated = false;
const writtenMethods = [];
client.query = async (sql, values) => {
  calls.push(sql);
  if (sql.includes('pg_tables'))
    return { rows: tables.map((tablename) => ({ tablename })) };
  if (sql.startsWith('SELECT value')) return { rows: [] };
  if (sql.startsWith('TRUNCATE')) truncated = true;
  if (sql.startsWith('INSERT INTO payment_methods'))
    writtenMethods.push(values);
  if (sql.startsWith('SELECT COUNT'))
    return { rows: [{ n: truncated && sql.includes('public.') ? 0 : 1 }] };
  return { rows: [] };
};
await prepareRealFraguan(client, true, runtime);
assert.equal(calls.at(-1), 'COMMIT');
const truncateAt = calls.findIndex((sql) => sql.startsWith('TRUNCATE'));
assert.equal(
  calls.slice(0, truncateAt).filter((sql) => sql.startsWith('CREATE TABLE'))
    .length,
  tables.length,
);
assert.ok(!calls[truncateAt].includes('CASCADE'));
assert.deepEqual(
  writtenMethods.map((values) => [values[0], values[2], values[3]]),
  [
    ['debit', 288, 2],
    ['credit', 440, 10],
    ['point-prepaid', 368, 3],
    ['point-pix', 340, 0],
  ],
);
console.log(
  'Reset target guards, read-only mode, backup failure rollback and idempotency passed. No database connection.',
);
