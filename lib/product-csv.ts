export type ProductImportClientRow = {
  internalCode: string;
  productName: string;
  category: string;
  subcategory: string;
  brand: string;
  season: string;
  collection: string;
  location: string;
  supplierId: string | null;
  sku: string;
  barcode: string;
  color: string;
  size: string;
  price: number;
  cost: number;
  stock: number;
  minimum: number;
  ideal: number;
  entryAt: string;
};

const HEADER_ALIASES: Record<keyof ProductImportClientRow, string[]> = {
  internalCode: ['codigo_interno', 'codigo_producto', 'codigo'],
  productName: ['producto', 'nombre_producto', 'nombre'],
  category: ['categoria'],
  subcategory: ['subcategoria'],
  brand: ['marca'],
  season: ['temporada'],
  collection: ['coleccion'],
  location: ['ubicacion'],
  supplierId: ['proveedor_id', 'id_proveedor'],
  sku: ['sku'],
  barcode: ['codigo_barras', 'barcode', 'ean'],
  color: ['color'],
  size: ['talle', 'size'],
  price: ['precio', 'precio_venta'],
  cost: ['costo'],
  stock: ['stock', 'stock_inicial'],
  minimum: ['stock_minimo', 'minimo'],
  ideal: ['stock_ideal', 'ideal'],
  entryAt: ['fecha_ingreso', 'ingreso'],
};

const REQUIRED: Array<keyof ProductImportClientRow> = [
  'internalCode',
  'productName',
  'category',
  'sku',
  'barcode',
  'color',
  'size',
  'price',
  'cost',
];

function normalizedHeader(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function delimiterFor(text: string) {
  const firstLine = text.replace(/^\uFEFF/, '').split(/\r?\n/, 1)[0] ?? '';
  let semicolons = 0;
  let commas = 0;
  let quoted = false;
  for (let index = 0; index < firstLine.length; index++) {
    if (firstLine[index] === '"') {
      if (quoted && firstLine[index + 1] === '"') index += 1;
      else quoted = !quoted;
    } else if (!quoted && firstLine[index] === ';') semicolons += 1;
    else if (!quoted && firstLine[index] === ',') commas += 1;
  }
  return semicolons >= commas ? ';' : ',';
}

function parseMatrix(source: string) {
  const text = source.replace(/^\uFEFF/, '');
  const delimiter = delimiterFor(text);
  const matrix: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let index = 0; index < text.length; index++) {
    const character = text[index];
    if (character === '"') {
      if (quoted && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else quoted = !quoted;
      continue;
    }
    if (!quoted && character === delimiter) {
      row.push(field.trim());
      field = '';
      continue;
    }
    if (!quoted && (character === '\n' || character === '\r')) {
      if (character === '\r' && text[index + 1] === '\n') index += 1;
      row.push(field.trim());
      if (row.some(Boolean)) matrix.push(row);
      row = [];
      field = '';
      continue;
    }
    field += character;
  }
  if (quoted)
    throw new Error('El CSV contiene una celda entre comillas sin cerrar.');
  row.push(field.trim());
  if (row.some(Boolean)) matrix.push(row);
  return matrix;
}

function moneyMinor(value: string, rowNumber: number, field: string) {
  const compact = value.replace(/\s|\$/g, '');
  if (!compact) throw new Error(`Fila ${rowNumber}: falta ${field}.`);
  let normalized = compact;
  const comma = compact.lastIndexOf(',');
  const dot = compact.lastIndexOf('.');
  if (comma >= 0 && dot >= 0)
    normalized =
      comma > dot
        ? compact.replaceAll('.', '').replace(',', '.')
        : compact.replaceAll(',', '');
  else if (comma >= 0)
    normalized = compact.replaceAll('.', '').replace(',', '.');
  else if ((compact.match(/\./g) ?? []).length > 1)
    normalized = compact.replaceAll('.', '');
  const number = Number(normalized);
  const minor = Math.round(number * 100);
  if (!Number.isFinite(number) || number < 0 || !Number.isSafeInteger(minor))
    throw new Error(`Fila ${rowNumber}: ${field} no es un importe válido.`);
  return minor;
}

function integer(
  value: string,
  fallback: number,
  rowNumber: number,
  field: string,
) {
  if (!value) return fallback;
  const result = Number(value);
  if (!Number.isSafeInteger(result) || result < 0)
    throw new Error(`Fila ${rowNumber}: ${field} debe ser un entero positivo.`);
  return result;
}

function valueFor(
  row: string[],
  indexes: Partial<Record<keyof ProductImportClientRow, number>>,
  key: keyof ProductImportClientRow,
) {
  const index = indexes[key];
  return index === undefined ? '' : (row[index] ?? '').trim();
}

export function parseProductCsv(source: string): ProductImportClientRow[] {
  if (!source.trim()) throw new Error('El archivo CSV está vacío.');
  const matrix = parseMatrix(source);
  if (matrix.length < 2)
    throw new Error('El CSV debe incluir encabezados y al menos una variante.');
  const headers = matrix[0].map(normalizedHeader);
  const forbidden = headers.find((header) =>
    ['imagen', 'image', 'foto', 'photo', 'url_imagen'].includes(header),
  );
  if (forbidden)
    throw new Error(
      'FRAGUAN funciona sin fotos: eliminá la columna de imagen antes de importar.',
    );
  const indexes: Partial<Record<keyof ProductImportClientRow, number>> = {};
  for (const [key, aliases] of Object.entries(HEADER_ALIASES) as Array<
    [keyof ProductImportClientRow, string[]]
  >) {
    const index = headers.findIndex((header) => aliases.includes(header));
    if (index >= 0) indexes[key] = index;
  }
  const missing = REQUIRED.filter((key) => indexes[key] === undefined);
  if (missing.length)
    throw new Error(
      `Faltan columnas obligatorias: ${missing
        .map((key) => HEADER_ALIASES[key][0])
        .join(', ')}.`,
    );
  return matrix.slice(1).map((row, index) => {
    const rowNumber = index + 2;
    const required = (key: keyof ProductImportClientRow) => {
      const value = valueFor(row, indexes, key);
      if (!value)
        throw new Error(`Fila ${rowNumber}: falta ${HEADER_ALIASES[key][0]}.`);
      return value;
    };
    return {
      internalCode: required('internalCode'),
      productName: required('productName'),
      category: required('category'),
      subcategory: valueFor(row, indexes, 'subcategory'),
      brand: valueFor(row, indexes, 'brand') || 'FRAGUAN',
      season: valueFor(row, indexes, 'season'),
      collection: valueFor(row, indexes, 'collection'),
      location: valueFor(row, indexes, 'location'),
      supplierId: valueFor(row, indexes, 'supplierId') || null,
      sku: required('sku'),
      barcode: required('barcode'),
      color: required('color'),
      size: required('size'),
      price: moneyMinor(required('price'), rowNumber, 'precio'),
      cost: moneyMinor(required('cost'), rowNumber, 'costo'),
      stock: integer(valueFor(row, indexes, 'stock'), 0, rowNumber, 'stock'),
      minimum: integer(
        valueFor(row, indexes, 'minimum'),
        3,
        rowNumber,
        'stock mínimo',
      ),
      ideal: integer(
        valueFor(row, indexes, 'ideal'),
        6,
        rowNumber,
        'stock ideal',
      ),
      entryAt: valueFor(row, indexes, 'entryAt'),
    };
  });
}

export function csvCell(value: unknown) {
  const text =
    value == null
      ? ''
      : typeof value === 'string' ||
          typeof value === 'number' ||
          typeof value === 'boolean'
        ? String(value)
        : JSON.stringify(value);
  return `"${text.replaceAll('"', '""')}"`;
}

export function buildProductCsvTemplate(
  columns: string[],
  example: Record<string, unknown>,
) {
  return `\uFEFF${columns.map(csvCell).join(';')}\r\n${columns
    .map((column) => csvCell(example[column]))
    .join(';')}\r\n`;
}
