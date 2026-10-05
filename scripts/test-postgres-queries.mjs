import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const moduleUrl = (source) =>
  'data:text/javascript;base64,' + Buffer.from(source).toString('base64');
const source = readFileSync(
  new URL('../db/queries.ts', import.meta.url),
  'utf8',
)
  .replace(
    "'cloudflare:workers'",
    JSON.stringify(moduleUrl('export const env = {};')),
  )
  .replace(
    "'pg'",
    JSON.stringify(
      moduleUrl(
        'export class Pool {} export const types = {setTypeParser(){}};',
      ),
    ),
  );
const { outputText } = ts.transpileModule(source, {
  compilerOptions: {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ES2022,
  },
});
const { postgresSql } = await import(moduleUrl(outputText));
assert.equal(
  postgresSql(
    'SELECT p.id,v.productId FROM products p JOIN variants v ON p.id=v.productId ORDER BY p.rowid,v.rowid',
  ),
  'SELECT p.id,v."productId" FROM products p JOIN variants v ON p.id=v."productId" ORDER BY p.id,v.id',
);
assert.equal(
  postgresSql(
    "SELECT 'rowid' AS label FROM sale_items WHERE saleId=? ORDER BY rowid",
  ),
  'SELECT \'rowid\' AS label FROM sale_items WHERE "saleId"=$1 ORDER BY id',
);
assert.equal(
  postgresSql(
    'SELECT id FROM customer_cashback ORDER BY createdAt DESC,ROWID DESC LIMIT 250',
  ),
  'SELECT id FROM customer_cashback ORDER BY "createdAt" DESC,id DESC LIMIT 250',
);
assert.equal(
  postgresSql("SELECT 'don''t replace rowid or ?' FROM products WHERE id=?"),
  "SELECT 'don''t replace rowid or ?' FROM products WHERE id=$1",
);
console.log(
  'PostgreSQL query checks passed: stable staff ordering, parameters and untouched string literals.',
);
