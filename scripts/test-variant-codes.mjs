import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const dataModule = (source) =>
  `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
let query = async () => null;
globalThis.__variantCodeTestQuery = (...args) => query(...args);
const source = readFileSync(
  new URL('../lib/variant-codes.ts', import.meta.url),
  'utf8',
)
  .replace(
    "'@/db/queries'",
    JSON.stringify(
      dataModule(
        'export const one=(...args)=>globalThis.__variantCodeTestQuery(...args);',
      ),
    ),
  )
  .replace(
    "'./auth'",
    JSON.stringify(
      dataModule(
        'export class AppError extends Error { constructor(status,message){super(message);this.status=status;} }',
      ),
    ),
  );
const { outputText } = ts.transpileModule(source, {
  compilerOptions: {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ES2022,
  },
});
const { generateVariantCodes, resolveVariantCodes } = await import(
  dataModule(outputText)
);
try {
  const codes = new Set();
  for (let index = 0; index < 1000; index++) {
    const result = generateVariantCodes();
    assert.match(result.barcode, /^20\d{10}$/);
    assert.equal(result.sku, `FG-${result.barcode}`);
    codes.add(result.barcode);
  }
  assert.equal(codes.size, 1000);
  let attempts = 0;
  query = async () => (++attempts === 1 ? { id: 'existing' } : null);
  const resolved = await resolveVariantCodes({});
  assert.equal(attempts, 2, 'An existing generated code must be retried');
  assert.match(resolved.barcode, /^20\d{10}$/);
  query = async () => null;
  assert.deepEqual(
    await resolveVariantCodes({ sku: 'OWN-SKU', barcode: '123456' }),
    { sku: 'OWN-SKU', barcode: '123456' },
  );
  query = async () => ({ id: 'existing' });
  await assert.rejects(
    resolveVariantCodes({ sku: 'OWN-SKU', barcode: '123456' }),
    (error) => error.status === 409,
  );
  await assert.rejects(
    resolveVariantCodes({}),
    (error) => error.status === 409,
  );
  console.log(
    'Variant codes: numeric labels, collision retry, supplied codes and uniqueness failure passed. Isolated query fixtures.',
  );
} finally {
  delete globalThis.__variantCodeTestQuery;
}
