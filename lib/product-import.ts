import { z } from 'zod';
import {
  auditStatement,
  db,
  id,
  now,
  one,
  rows,
  statement,
} from '@/db/queries';
import { Actor, AppError, requirePermission } from './auth';
import { money, positiveMoney, text } from './validation';

const optionalText = z.string().trim().max(200).default('');
const importRow = z
  .object({
    internalCode: text,
    productName: text,
    category: text,
    subcategory: optionalText,
    brand: text.default('FRAGUAN'),
    season: optionalText,
    collection: optionalText,
    location: optionalText,
    supplierId: z.union([text, z.literal(''), z.null()]).default(null),
    sku: text,
    barcode: text,
    color: text,
    size: text,
    price: positiveMoney,
    cost: money,
    stock: z.number().int().min(0).max(100_000).default(0),
    minimum: z.number().int().min(0).max(100_000).default(3),
    ideal: z.number().int().min(0).max(100_000).default(6),
    entryAt: z.union([z.iso.date(), z.literal('')]).default(''),
  })
  .strict();

const importInput = z
  .object({
    rows: z.array(importRow).min(1).max(200),
    mode: z.enum(['create_only', 'upsert']).default('create_only'),
    stockMode: z.enum(['ignore', 'set']).default('ignore'),
    dryRun: z.boolean().default(true),
  })
  .strict();

type ImportRow = z.infer<typeof importRow>;

type ExistingProduct = {
  id: string;
  internalCode: string;
};

type ExistingVariant = {
  id: string;
  productId: string;
  sku: string;
  barcode: string;
  color: string;
  size: string;
  stock: number;
};

function productSignature(row: ImportRow) {
  return JSON.stringify({
    productName: row.productName,
    category: row.category,
    subcategory: row.subcategory,
    brand: row.brand,
    season: row.season,
    collection: row.collection,
    location: row.location,
    supplierId: row.supplierId || null,
  });
}

function normalizeRows(input: z.infer<typeof importInput>) {
  return input.rows.map((row) => ({
    ...row,
    internalCode: row.internalCode.toUpperCase(),
    sku: row.sku.toUpperCase(),
    supplierId: row.supplierId || null,
  }));
}

export async function importProducts(actor: Actor, raw: unknown) {
  requirePermission(actor, 'products');
  requirePermission(actor, 'stock');
  const input = importInput.parse(raw);
  const importRows = normalizeRows(input);
  const errors: string[] = [];
  const signatures = new Map<string, string>();
  const seenSkus = new Set<string>();
  const seenBarcodes = new Set<string>();
  const seenCombinations = new Set<string>();

  importRows.forEach((row, index) => {
    const number = index + 2;
    if (row.ideal < row.minimum)
      errors.push(`Fila ${number}: el stock ideal es menor al mínimo.`);
    if (seenSkus.has(row.sku))
      errors.push(`Fila ${number}: el SKU ${row.sku} está repetido.`);
    if (seenBarcodes.has(row.barcode))
      errors.push(`Fila ${number}: el código ${row.barcode} está repetido.`);
    const combination = `${row.internalCode}\u0000${row.color}\u0000${row.size}`;
    if (seenCombinations.has(combination))
      errors.push(
        `Fila ${number}: la combinación ${row.color}/${row.size} está repetida para ${row.internalCode}.`,
      );
    const signature = productSignature(row);
    if (
      signatures.has(row.internalCode) &&
      signatures.get(row.internalCode) !== signature
    )
      errors.push(
        `Fila ${number}: los datos generales de ${row.internalCode} no coinciden con sus otras variantes.`,
      );
    signatures.set(row.internalCode, signature);
    seenSkus.add(row.sku);
    seenBarcodes.add(row.barcode);
    seenCombinations.add(combination);
  });

  const [existingProducts, existingVariants, supplierIds] = await Promise.all([
    rows<ExistingProduct>(
      "SELECT id,internalCode FROM products WHERE internalCode<>''",
    ),
    rows<ExistingVariant>(
      'SELECT id,productId,sku,barcode,color,size,stock FROM variants',
    ),
    rows<{ id: string }>('SELECT id FROM suppliers'),
  ]);
  const productsByCode = new Map(
    existingProducts.map((product) => [
      product.internalCode.toUpperCase(),
      product,
    ]),
  );
  const variantsBySku = new Map(
    existingVariants.map((variant) => [variant.sku.toUpperCase(), variant]),
  );
  const variantsByBarcode = new Map(
    existingVariants.map((variant) => [variant.barcode, variant]),
  );
  const variantsByCombination = new Map(
    existingVariants.map((variant) => [
      `${variant.productId}\u0000${variant.color}\u0000${variant.size}`,
      variant,
    ]),
  );
  const validSuppliers = new Set(supplierIds.map((supplier) => supplier.id));
  const productIds = new Map<string, string>();
  let newProducts = 0;
  let newVariants = 0;
  let updatedProducts = 0;
  let updatedVariants = 0;
  let stockAdjustments = 0;

  for (let index = 0; index < importRows.length; index++) {
    const row = importRows[index];
    const number = index + 2;
    if (row.supplierId && !validSuppliers.has(row.supplierId))
      errors.push(`Fila ${number}: el proveedor indicado no existe.`);
    const product = productsByCode.get(row.internalCode);
    const productId = product?.id ?? productIds.get(row.internalCode) ?? id();
    productIds.set(row.internalCode, productId);
    if (!product && !productsByCode.has(row.internalCode)) {
      productsByCode.set(row.internalCode, {
        id: productId,
        internalCode: row.internalCode,
      });
      newProducts += 1;
    }
    const skuMatch = variantsBySku.get(row.sku);
    const barcodeMatch = variantsByBarcode.get(row.barcode);
    if (skuMatch && barcodeMatch && skuMatch.id !== barcodeMatch.id)
      errors.push(
        `Fila ${number}: el SKU y el código de barras pertenecen a variantes distintas.`,
      );
    const variant = skuMatch ?? barcodeMatch;
    if (variant && variant.productId !== productId)
      errors.push(
        `Fila ${number}: la variante existente pertenece a otro producto.`,
      );
    const combinationMatch = variantsByCombination.get(
      `${productId}\u0000${row.color}\u0000${row.size}`,
    );
    if (combinationMatch && (!variant || combinationMatch.id !== variant.id))
      errors.push(
        `Fila ${number}: ya existe otra variante con color ${row.color} y talle ${row.size}.`,
      );
    if (variant) {
      if (input.mode === 'create_only')
        errors.push(`Fila ${number}: el SKU ${row.sku} ya existe.`);
      else {
        updatedVariants += 1;
        if (input.stockMode === 'set' && row.stock !== variant.stock)
          stockAdjustments += 1;
      }
    } else newVariants += 1;
  }

  if (errors.length)
    throw new AppError(
      400,
      `${errors.slice(0, 8).join(' ')}${errors.length > 8 ? ` Hay ${errors.length - 8} errores más.` : ''}`,
    );

  if (input.mode === 'upsert')
    updatedProducts = new Set(
      importRows
        .filter((row) =>
          existingProducts.some(
            (p) => p.id === productIds.get(row.internalCode),
          ),
        )
        .map((row) => row.internalCode),
    ).size;

  const summary = {
    rows: importRows.length,
    newProducts,
    updatedProducts,
    newVariants,
    updatedVariants,
    stockAdjustments,
  };
  if (input.dryRun) return { dryRun: true, valid: true, summary };

  const commands: D1PreparedStatement[] = [];
  const writtenProducts = new Set<string>();
  const changedAt = now();
  for (const row of importRows) {
    const productId = productIds.get(row.internalCode)!;
    const originalProduct = existingProducts.find(
      (product) => product.id === productId,
    );
    if (!writtenProducts.has(productId)) {
      if (originalProduct && input.mode === 'upsert')
        commands.push(
          statement(
            `UPDATE products SET name=?,category=?,subcategory=?,brand=?,season=?,collection=?,
                    location=?,supplierId=?,active=1,archivedAt=NULL,updatedAt=? WHERE id=?`,
            row.productName,
            row.category,
            row.subcategory,
            row.brand,
            row.season,
            row.collection,
            row.location,
            row.supplierId,
            changedAt,
            productId,
          ),
        );
      else if (!originalProduct)
        commands.push(
          statement(
            `INSERT INTO products(id,name,internalCode,category,subcategory,brand,season,
                    collection,location,supplierId,updatedAt)
             VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
            productId,
            row.productName,
            row.internalCode,
            row.category,
            row.subcategory,
            row.brand,
            row.season,
            row.collection,
            row.location,
            row.supplierId,
            changedAt,
          ),
        );
      writtenProducts.add(productId);
    }
    const existing =
      variantsBySku.get(row.sku) ?? variantsByBarcode.get(row.barcode);
    const variantId = existing?.id ?? id();
    if (existing) {
      commands.push(
        statement(
          `UPDATE variants SET sku=?,barcode=?,color=?,size=?,price=?,cost=?,minimum=?,ideal=?,
                  entryAt=?,updatedAt=? WHERE id=?`,
          row.sku,
          row.barcode,
          row.color,
          row.size,
          row.price,
          row.cost,
          row.minimum,
          row.ideal,
          row.entryAt,
          changedAt,
          variantId,
        ),
      );
      if (input.stockMode === 'set' && row.stock !== existing.stock)
        commands.push(
          statement(
            `INSERT INTO stock_movements(id,variantId,quantity,before,after,reason,
                    actorId,reference,createdAt) VALUES (?,?,?,?,?,?,?,?,?)`,
            id(),
            variantId,
            row.stock - existing.stock,
            existing.stock,
            row.stock,
            'Importación masiva',
            actor.id,
            `import:${changedAt}`,
            changedAt,
          ),
        );
    } else {
      commands.push(
        statement(
          `INSERT INTO variants(id,productId,sku,barcode,color,size,price,cost,minimum,
                  ideal,entryAt,updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
          variantId,
          productId,
          row.sku,
          row.barcode,
          row.color,
          row.size,
          row.price,
          row.cost,
          row.minimum,
          row.ideal,
          row.entryAt,
          changedAt,
        ),
      );
      if (input.stockMode === 'set' && row.stock > 0)
        commands.push(
          statement(
            `INSERT INTO stock_movements(id,variantId,quantity,before,after,reason,
                    actorId,reference,createdAt) VALUES (?,?,?,?,?,?,?,?,?)`,
            id(),
            variantId,
            row.stock,
            0,
            row.stock,
            'Importación inicial',
            actor.id,
            `import:${changedAt}`,
            changedAt,
          ),
        );
    }
  }
  commands.push(
    auditStatement(actor.id, 'Importar productos', id(), null, {
      ...summary,
      mode: input.mode,
      stockMode: input.stockMode,
    }),
  );
  await db().batch(commands);
  return { dryRun: false, valid: true, summary };
}

export async function productImportTemplate(actor: Actor) {
  requirePermission(actor, 'products');
  const supplier = await one<{ id: string }>(
    'SELECT id FROM suppliers WHERE active=1 ORDER BY name LIMIT 1',
  );
  return {
    columns: [
      'codigo_interno',
      'producto',
      'categoria',
      'subcategoria',
      'marca',
      'temporada',
      'coleccion',
      'ubicacion',
      'proveedor_id',
      'sku',
      'codigo_barras',
      'color',
      'talle',
      'precio',
      'costo',
      'stock',
      'stock_minimo',
      'stock_ideal',
      'fecha_ingreso',
    ],
    example: {
      codigo_interno: 'CAM-OXF',
      producto: 'Camisa Oxford',
      categoria: 'Camisas',
      subcategoria: 'Manga larga',
      marca: 'FRAGUAN',
      temporada: 'Todo el año',
      coleccion: 'Esenciales',
      ubicacion: 'Sector A',
      proveedor_id: supplier?.id ?? '',
      sku: 'CAM-OXF-CEL-L',
      codigo_barras: '7790000000011',
      color: 'Celeste',
      talle: 'L',
      precio: '59900,00',
      costo: '24000,00',
      stock: '3',
      stock_minimo: '2',
      stock_ideal: '8',
      fecha_ingreso: new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Argentina/Buenos_Aires',
      }).format(new Date()),
    },
    moneyFormat:
      'Pesos con coma o punto decimal; la interfaz convierte a centavos.',
  };
}
