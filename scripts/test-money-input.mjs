import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

// Ejecuta el conversor real sin montar React ni consultar servicios externos.
const source = readFileSync('lib/client.ts', 'utf8');
const extracted = source.slice(
  source.indexOf('export const minor ='),
  source.indexOf('export function useSession'),
).replace('export const minor', 'const minor');
const js = ts.transpileModule(extracted, {
  compilerOptions: { target: ts.ScriptTarget.ES2022 },
}).outputText;
// oxlint-disable-next-line typescript/no-implied-eval
const minor = new Function(js + '; return minor;')();

// Al abrir una variante, los importes son números; al editarlos, son textos.
for (const [value, expected] of [
  [31499, 3149900],
  ['31499', 3149900],
  [37249.1, 3724910],
  ['37249,10', 3724910],
  [' 37249.10 ', 3724910],
  [0, 0],
  [0.01, 1],
]) assert.equal(minor(value), expected);

for (const value of [
  undefined, null, {}, [], true, NaN, Infinity, -1,
  '', '31.499,00', '1.234', 'precio',
]) assert.throws(() => minor(value), /importe válido/i);
assert.throws(() => minor('9007199254740991'), /fuera de rango/i);
console.log('PASS: importes precargados y editados conservan los centavos; entradas inválidas devuelven un mensaje claro.');
