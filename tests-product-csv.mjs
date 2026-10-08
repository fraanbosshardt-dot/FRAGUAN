import assert from 'node:assert/strict';
import { buildProductCsvTemplate, parseProductCsv } from './lib/product-csv.ts';

const columns = [
  'codigo_interno',
  'producto',
  'categoria',
  'sku',
  'codigo_barras',
  'color',
  'talle',
  'precio',
  'costo',
  'stock',
  'stock_minimo',
  'stock_ideal',
];
const example = {
  codigo_interno: 'CAM-OXF',
  producto: 'Camisa Oxford',
  categoria: 'Camisas',
  sku: 'CAM-OXF-CEL-L',
  codigo_barras: '07790000000011',
  color: 'Celeste',
  talle: 'L',
  precio: '59.900,00',
  costo: '24.000,00',
  stock: '3',
  stock_minimo: '2',
  stock_ideal: '8',
};
const parsed = parseProductCsv(buildProductCsvTemplate(columns, example));
assert.equal(parsed.length, 1);
assert.equal(parsed[0].price, 5_990_000);
assert.equal(parsed[0].cost, 2_400_000);
assert.equal(parsed[0].barcode, '07790000000011');
assert.equal(parsed[0].brand, 'FRAGUAN');
assert.equal(parsed[0].stock, 3);
const separate = parseProductCsv(buildProductCsvTemplate([...columns, 'precio_web'], {...example, precio_web:'64.900,00'}));
assert.equal(separate[0].price, 5_990_000);
assert.equal(separate[0].onlinePrice, 6_490_000);
assert.equal(parsed[0].onlinePrice, undefined);

assert.throws(
  () =>
    parseProductCsv(
      `${columns.join(';')};foto\n${columns.map((key) => example[key] ?? '').join(';')};https://example.test/foto.jpg`,
    ),
  /sin fotos/i,
);
assert.throws(
  () => parseProductCsv('producto;sku\nCamisa;CAM-1'),
  /Faltan columnas obligatorias/,
);
assert.throws(
  () =>
    parseProductCsv(
      `${columns.join(';')}\n${columns.map((key) => (key === 'precio' ? 'abc' : (example[key] ?? ''))).join(';')}`,
    ),
  /importe válido/,
);

console.log(
  'PASS: CSV argentino, códigos con ceros, importes en centavos y rechazo explícito de fotos.',
);
