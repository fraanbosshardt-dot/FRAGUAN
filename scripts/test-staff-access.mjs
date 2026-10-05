import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

let owner = { value: 'owner@example.test' };
let user = {
  id: 'existing-owner',
  email: owner.value,
  name: 'Owner',
  active: 1,
};
const calls = [];
globalThis.__staffAccessQuery = async (sql, ...values) => {
  calls.push({ sql, values });
  assert.match(
    sql,
    /^SELECT /,
    'Open mode must not create or change staff records',
  );
  return sql.includes('FROM settings') ? owner : user;
};
const queryModule =
  'data:text/javascript;base64,' +
  Buffer.from(
    'export const one = (...args) => globalThis.__staffAccessQuery(...args);',
  ).toString('base64');
const source = readFileSync(
  new URL('../lib/staff-access.ts', import.meta.url),
  'utf8',
).replace("'@/db/queries'", JSON.stringify(queryModule));
const { outputText } = ts.transpileModule(source, {
  compilerOptions: {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ES2022,
  },
});
const savedSurface = process.env.FRAGUAN_SURFACE;
const savedFlag = process.env.FRAGUAN_STAFF_OPEN_ACCESS;
try {
  const access = await import(
    'data:text/javascript;base64,' + Buffer.from(outputText).toString('base64')
  );
  process.env.FRAGUAN_SURFACE = 'business';
  process.env.FRAGUAN_STAFF_OPEN_ACCESS = 'false';
  assert.equal(await access.openStaffIdentity(), null);
  assert.equal(calls.length, 0, 'Closed mode must not impersonate the owner');
  process.env.FRAGUAN_STAFF_OPEN_ACCESS = 'true';
  process.env.FRAGUAN_SURFACE = 'store';
  assert.equal(
    await access.openStaffIdentity(),
    null,
    'Store-only deployment never opens staff access',
  );
  process.env.FRAGUAN_SURFACE = 'business';
  assert.deepEqual(await access.openStaffIdentity(), {
    userId: user.id,
    email: user.email,
    displayName: user.name,
    fullName: user.name,
  });
  assert.deepEqual(calls.at(-1).values, [owner.value]);
  user = { ...user, active: 0 };
  assert.equal(
    await access.openStaffIdentity(),
    null,
    'Inactive owner remains denied',
  );
  owner = null;
  assert.equal(
    await access.openStaffIdentity(),
    null,
    'No automatic owner or setup fallback',
  );
  console.log(
    'Temporary staff access checks passed: explicit flag, deployment surface and active existing owner.',
  );
} finally {
  delete globalThis.__staffAccessQuery;
  if (savedSurface === undefined) delete process.env.FRAGUAN_SURFACE;
  else process.env.FRAGUAN_SURFACE = savedSurface;
  if (savedFlag === undefined) delete process.env.FRAGUAN_STAFF_OPEN_ACCESS;
  else process.env.FRAGUAN_STAFF_OPEN_ACCESS = savedFlag;
}
