import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import { test } from 'node:test';
import ts from 'typescript';

const require = createRequire(import.meta.url);
function client(fetch) {
  const loaded = { exports: {} };
  const compiled = ts.transpileModule(readFileSync('lib/store-client.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  vm.runInNewContext(compiled.outputText, { module: loaded, exports: loaded.exports, require, fetch, Headers, Intl });
  return loaded.exports;
}

test('concurrent catalog readers share one request; later reads receive updated prices', async () => {
  let calls = 0, finish;
  const api = client(() => { calls++; return new Promise(resolve => { finish = resolve; }); });
  const first = api.loadStoreCatalog(), second = api.loadStoreCatalog();
  assert.equal(calls, 1);
  finish(new Response(JSON.stringify({ products: [{ price: 100 }] })));
  assert.equal((await first).products[0].price, 100);
  assert.equal((await second).products[0].price, 100);
  const later = api.loadStoreCatalog();
  assert.equal(calls, 2);
  finish(new Response(JSON.stringify({ products: [{ price: 200 }] })));
  assert.equal((await later).products[0].price, 200);
});

test('failed catalog requests can be retried', async () => {
  let calls = 0;
  const api = client(async () => {
    calls++;
    return new Response(JSON.stringify(calls === 1 ? { error: 'Temporal' } : { products: [] }), { status: calls === 1 ? 503 : 200 });
  });
  await assert.rejects(api.loadStoreCatalog(), /Temporal/);
  assert.equal((await api.loadStoreCatalog()).products.length, 0);
  assert.equal(calls, 2);
});
