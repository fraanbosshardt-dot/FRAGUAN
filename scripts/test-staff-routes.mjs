import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { pbkdf2Sync, randomBytes } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';

// Start the actual Node production build with test-only secrets, no database.
const origin = 'http://127.0.0.1:3001';
const publicOrigin = 'https://www.fraguan.com';
const salt = randomBytes(16).toString('hex');
const hash = pbkdf2Sync(
  randomBytes(24).toString('hex'),
  salt,
  600000,
  32,
  'sha256',
).toString('hex');
const server = spawn(process.execPath, ['.output/server/index.mjs'], {
  stdio: 'ignore',
  env: {
    ...process.env,
    HOST: '127.0.0.1',
    PORT: '3001',
    NODE_ENV: 'production',
    DATABASE_URL: '',
    FRAGUAN_API_ORIGIN: '',
    SITE_ORIGIN: publicOrigin,
    INTERNAL_AUTH_TRUST_PROXY: 'false',
    INTERNAL_SESSION_SECRET: randomBytes(32).toString('base64'),
    INTERNAL_PASSWORD_HASH: `pbkdf2-sha256:600000:${salt}:${hash}`,
  },
});
const get = (path, headers = {}) =>
  fetch(origin + path, { redirect: 'manual', headers });
const post = (path, body, site = publicOrigin) =>
  fetch(origin + path, {
    method: 'POST',
    redirect: 'manual',
    headers: { 'Content-Type': 'application/json', Origin: site },
    body: JSON.stringify(body),
  });
try {
  let ready = false;
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await get('/acceso');
      if (response.ok) {
        ready = true;
        break;
      }
    } catch {}
    await delay(250);
  }
  assert.equal(ready, true, 'Production server did not start');
  for (const page of ['/pos', '/admin-access', '/admin/dashboard']) {
    const response = await get(page);
    assert.equal(
      response.status,
      307,
      `${page} must redirect unauthenticated users`,
    );
    assert.match(response.headers.get('location') ?? '', /^\/(acceso|admin)/);
  }
  const adminEntry = await get('/admin');
  assert.equal(adminEntry.status, 200, 'Unified admin entry must render login');
  const adminHtml = await adminEntry.text();
  assert.match(adminHtml, /Ingresá a Administración/);
  assert.match(adminHtml, /current-password/);
  assert.equal(
    (await get('/admin/products')).headers.get('location'),
    '/admin?returnTo=%2Fadmin%2Fproducts',
  );
  assert.equal(
    (
      await get('/admin-access?returnTo=https%3A%2F%2Foutside.example.test')
    ).headers.get('location'),
    '/admin',
  );
  const spoof = {
    'oai-authenticated-user-id': 'local_seedy',
    'oai-authenticated-user-email': 'seedy@sites.test',
    'x-forwarded-host': 'localhost',
    'x-forwarded-proto': 'http',
  };
  for (const resource of [
    'session',
    'catalog',
    'dashboard',
    'users',
    'settings',
  ]) {
    assert.equal((await get('/api/' + resource)).status, 401, resource);
    assert.equal(
      (await get('/api/' + resource, spoof)).status,
      401,
      `${resource}: spoofed identity`,
    );
  }
  const invalidLogin = {
    action: 'password',
    email: 'staff@example.test',
    password: 'incorrect-password-for-test',
  };
  assert.equal((await post('/api/internal-auth', invalidLogin)).status, 401);
  assert.equal(
    (
      await post(
        '/api/internal-auth',
        invalidLogin,
        'https://outside.example.test',
      )
    ).status,
    403,
  );
  assert.equal((await post('/api/admin-pin', { pin: '123456' })).status, 401);
  assert.equal((await post('/api/setup', { demo: false })).status, 401);
  const logout = await post('/api/internal-auth', { action: 'logout' });
  assert.equal(logout.status, 200);
  assert.equal(
    logout.headers.getSetCookie().length,
    2,
    'Both staff and PIN cookies must be cleared',
  );
  for (const cookie of logout.headers.getSetCookie())
    assert.match(cookie, /Max-Age=0/);
  const loginHtml = await (await get('/acceso')).text();
  assert.match(loginHtml, /current-password/);
  console.log(
    'Production staff route checks passed: redirects, denied APIs, spoofed headers, Origin and logout.',
  );
} finally {
  server.kill();
}
