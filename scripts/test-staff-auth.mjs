import assert from 'node:assert/strict';
import { pbkdf2Sync, randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

// Exercise the production implementations with isolated, disposable secrets.
const workerEnv =
  'data:text/javascript;base64,' +
  Buffer.from('export const env = process.env;').toString('base64');
async function load(file) {
  const source = readFileSync(new URL('../' + file, import.meta.url), 'utf8')
    .replace("'cloudflare:workers'", JSON.stringify(workerEnv))
    .replaceAll('import.meta.env.DEV', 'false');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ES2022,
    },
  });
  return import(
    'data:text/javascript;base64,' + Buffer.from(outputText).toString('base64')
  );
}
const savedHash = process.env.INTERNAL_PASSWORD_HASH;
const savedSecret = process.env.INTERNAL_SESSION_SECRET;
try {
  const password = randomBytes(24).toString('hex');
  const salt = randomBytes(16).toString('hex');
  const hash = pbkdf2Sync(password, salt, 600000, 32, 'sha256').toString('hex');
  process.env.INTERNAL_PASSWORD_HASH = `pbkdf2-sha256:600000:${salt}:${hash}`;
  process.env.INTERNAL_SESSION_SECRET = randomBytes(32).toString('base64');
  const auth = await load('lib/internal-password.ts');
  const sessions = await load('lib/internal-session.ts');
  assert.equal(auth.internalPasswordConfigured(), true);
  assert.equal(await auth.verifyInternalPassword(password), true);
  assert.equal(
    await auth.verifyInternalPassword(password + 'incorrect'),
    false,
  );
  const identity = {
    userId: 'staff-test',
    email: 'staff@example.test',
    displayName: 'Test',
    fullName: 'Test',
  };
  const token = await sessions.createInternalSession(identity);
  const cookie = sessions.internalSessionSetCookie(token, true);
  assert.match(cookie, /HttpOnly; SameSite=Strict; Priority=High; Secure$/);
  assert.deepEqual(await sessions.verifyInternalSession(cookie), identity);
  const [payload, signature] = token.split('.');
  const tamperedPayload = JSON.parse(
    Buffer.from(payload, 'base64url').toString(),
  );
  tamperedPayload.email = 'other@example.test';
  const forged =
    Buffer.from(JSON.stringify(tamperedPayload)).toString('base64url') +
    '.' +
    signature;
  assert.equal(
    await sessions.verifyInternalSession(`fraguan_internal_session=${forged}`),
    null,
  );
  assert.equal(
    await sessions.verifyInternalSession('fraguan_internal_session=malformed'),
    null,
  );
  process.env.INTERNAL_SESSION_SECRET = randomBytes(32).toString('base64');
  assert.equal(
    await sessions.verifyInternalSession(cookie),
    null,
    'Rotated secret must invalidate prior sessions',
  );
  delete process.env.INTERNAL_SESSION_SECRET;
  assert.equal(sessions.internalSessionsConfigured(), false);
  assert.equal(
    await sessions.verifyInternalSession(cookie),
    null,
    'No development fallback in production',
  );
  delete process.env.INTERNAL_PASSWORD_HASH;
  assert.equal(auth.internalPasswordConfigured(), false);
  assert.equal(await auth.verifyInternalPassword(password), false);
  process.env.INTERNAL_PASSWORD_HASH = 'invalid';
  assert.equal(auth.internalPasswordConfigured(), false);
  console.log('Staff password/session security checks passed.');
} finally {
  if (savedHash === undefined) delete process.env.INTERNAL_PASSWORD_HASH;
  else process.env.INTERNAL_PASSWORD_HASH = savedHash;
  if (savedSecret === undefined) delete process.env.INTERNAL_SESSION_SECRET;
  else process.env.INTERNAL_SESSION_SECRET = savedSecret;
}
