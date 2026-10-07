import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';
import { z } from 'zod';
const require = createRequire(import.meta.url);
const transpile = (source) => ts.transpileModule(source, {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const validationModule = {exports:{}};
new Function('require','module','exports',transpile(readFileSync('lib/validation.ts','utf8')))(require,validationModule,validationModule.exports);
const v = validationModule.exports;
const actor = {id:'owner',role:'ADMIN'};
let counter = 0, saved, fail = false;
const dependencies = {
  z,v,text:v.text,money:v.money,positiveMoney:v.positiveMoney,
  id:()=>`isolated-${++counter}`,now:()=> '2026-10-06T20:00:00Z',
  requirePermission:()=>{},AppError:class extends Error {},
  resolveVariantCodes:async()=>({sku:'FG-isolated',barcode:'200000000001'}),
  one:async()=>({name:'Producto existente'}),
  statement:(sql,...params)=>({sql,params}),
  auditStatement:(...params)=>({sql:'audit',params}),
  db:()=>({batch:async(commands)=>{if(fail) throw new Error('transaction failed');saved=commands;}}),
};
function load(path,name,end) {
  const source = readFileSync(path,'utf8');
  const start = source.indexOf(`export async function ${name}`);
  const fn = source.slice(start,end ? source.indexOf(end,start+1) : undefined).replace('export ','');
  return new Function(...Object.keys(dependencies),`${transpile(fn)};return ${name};`)(...Object.values(dependencies));
}
const createProduct = load('lib/admin.ts','adminWrite','export async function adminAction');
const addVariant = load('lib/configuration.ts','addVariant');
const input = {name:'Remera aislada',category:'Remeras',brand:'FRAGUAN',color:'Negro',size:'M',price:1500000,cost:500000,stock:2,minimum:0,ideal:6};
const result = await createProduct('products',actor,input);
const stored = saved.find(command=>command.sql.includes('INSERT INTO variants'));
assert.equal(result.variant.id,stored.params[0]);
assert.equal(result.variant.sku,stored.params[2]);
assert.equal(result.variant.barcode,stored.params[3]);
assert.equal(result.variant.price,stored.params[6]);
assert.equal(result.variant.name,input.name);
assert.equal(result.variant.stock,2);
const variantResult = await addVariant(actor,{productId:result.id,color:'Arena',size:'L',price:1600000,cost:500000,stock:3,minimum:0,ideal:6});
assert.equal(variantResult.variant.name,'Producto existente');
assert.equal(variantResult.variant.id,saved[0].params[0]);
assert.equal(variantResult.variant.barcode,saved[0].params[3]);
assert.equal(variantResult.variant.price,saved[0].params[6]);
fail = true;
await assert.rejects(createProduct('products',actor,input),/transaction failed/);
await assert.rejects(addVariant(actor,{productId:result.id,color:'Arena',size:'L',price:1600000,cost:500000,stock:3,minimum:0,ideal:6}),/transaction failed/);
console.log('Product labels: returned identity, codes and price match committed writes; failed transactions return no print result. Isolated fixtures.');
