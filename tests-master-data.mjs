import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

const origin = 'http://localhost:3000';
const headers = {
  Cookie: '__sites_local_auth=1',
  Origin: origin,
  'Content-Type': 'application/json',
};
const suffix = Date.now().toString(36);
let supplierId;
const productCode = `IT-${suffix}`.toUpperCase();

async function request(path, body, extra = {}) {
  const response = await fetch(`${origin}/api/${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { ...headers, ...extra },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = { error: text };
  }
  return { status: response.status, body: parsed };
}

function sql(command) {
  execFileSync(
    process.execPath,
    [
      'node_modules/wrangler/bin/wrangler.js',
      'd1',
      'execute',
      'DB',
      '--local',
      '--config',
      'wrangler.local.jsonc',
      '--command',
      command,
    ],
    { stdio: 'pipe' },
  );
}

function assertStatus(result, status, label) {
  assert.equal(
    result.status,
    status,
    `${label}: ${JSON.stringify(result.body)}`,
  );
}

const supplierPayload = {
  name: `Proveedor ${suffix}`,
  company: 'Distribuidora de prueba',
  contact: 'Contacto de prueba',
  phone: '1112345678',
  whatsapp: '1198765432',
  email: `supplier-${suffix}@example.test`,
  brands: 'FRAGUAN Test',
  terms: '30 días',
  discountBps: 1250,
  paymentDays: 30,
  notes: 'Fixture de integración',
};

const productPayload = {
  name: `Producto ${suffix}`,
  internalCode: productCode,
  category: 'Camisas',
  subcategory: 'Manga larga',
  brand: 'FRAGUAN Test',
  season: 'Todo el año',
  collection: 'Integración',
  location: 'Sector test',
  supplierId,
  color: 'Celeste',
  size: 'L',
  sku: `IT-${suffix}-A`,
  barcode: `779${suffix
    .replace(/[^0-9]/g, '')
    .slice(-10)
    .padStart(10, '0')}`,
  price: 5_990_000,
  cost: 2_400_000,
  stock: 3,
  minimum: 2,
  ideal: 8,
  entryAt: '2026-09-05',
};

try {
  assertStatus(await request('session'), 200, 'sesión');
  assert.equal((await request('session')).body.user.id, 'local_seedy');

  const supplier = await request('suppliers', supplierPayload);
  assertStatus(supplier, 201, 'alta de proveedor');
  supplierId = supplier.body.id;
  productPayload.supplierId = supplierId;

  const created = await request('products', productPayload);
  assertStatus(created, 201, 'alta de producto');
  const productId = created.body.id;
  const productVariantId = `${productId}-v`;

  const listed = await request('products?includeArchived=1');
  assertStatus(listed, 200, 'listado de productos');
  const listedVariant = listed.body.find((row) => row.id === productVariantId);
  assert(listedVariant, 'el producto creado aparece en el listado');
  assert.equal(listedVariant.internalCode, productCode);
  assert.equal(listedVariant.ideal, 8);
  assert.equal(listedVariant.supplierId, supplierId);

  const editedSupplier = await request('update-supplier', {
    id: supplierId,
    ...supplierPayload,
    notes: 'Fixture actualizado',
  });
  assertStatus(editedSupplier, 200, 'edición de proveedor');

  const editedProduct = await request('update-product', {
    id: productId,
    internalCode: productPayload.internalCode,
    category: productPayload.category,
    subcategory: productPayload.subcategory,
    brand: productPayload.brand,
    season: productPayload.season,
    collection: productPayload.collection,
    location: productPayload.location,
    name: `Producto editado ${suffix}`,
    supplierId,
  });
  assertStatus(editedProduct, 200, 'edición de producto');

  const editedVariant = await request('update-variant', {
    id: productVariantId,
    sku: productPayload.sku,
    barcode: productPayload.barcode,
    color: 'Celeste claro',
    size: 'L',
    price: productPayload.price + 100_000,
    cost: productPayload.cost,
    minimum: 2,
    ideal: 8,
    entryAt: productPayload.entryAt,
  });
  assertStatus(editedVariant, 200, 'edición de variante');
  assertStatus(
    await request('update-variant', {
      id: productVariantId,
      sku: productPayload.sku,
      barcode: productPayload.barcode,
      color: 'Celeste claro',
      size: 'L',
      price: productPayload.price,
      cost: productPayload.cost,
      minimum: 2,
      ideal: 8,
      entryAt: productPayload.entryAt,
      stock: 999,
    }),
    400,
    'edición de variante no permite stock directo',
  );

  const customer = await request('customers', {
    name: 'Cliente',
    surname: `Fixture ${suffix}`,
    phone: `11${suffix
      .replace(/[^0-9]/g, '')
      .slice(-8)
      .padStart(8, '0')}`,
  });
  assertStatus(customer, 201, 'alta de cliente');
  const customerRecordId = customer.body.id;
  const editedCustomer = await request('update-customer', {
    id: customerRecordId,
    name: 'Cliente',
    surname: `Fixture ${suffix}`,
    phone: customer.body.phone,
    whatsapp: '1199999999',
    email: `customer-${suffix}@example.test`,
    birthday: '1990-01-02',
    locality: 'Rosario',
    usualSizes: 'L / 42',
    notes: 'Prefiere avisos por WhatsApp',
  });
  assertStatus(editedCustomer, 200, 'edición de cliente');
  const customers = await request(`customers?q=${encodeURIComponent(suffix)}`);
  assertStatus(customers, 200, 'listado de clientes');
  const customerRow = customers.body.find((row) => row.id === customerRecordId);
  assert(customerRow);
  assert.equal(customerRow.locality, 'Rosario');
  assert.equal(customerRow.usualSizes, 'L / 42');

  const archive = await request('set-master-active', {
    entity: 'product',
    id: productId,
    active: false,
  });
  assertStatus(archive, 200, 'archivar producto');
  assert.equal(
    (await request('products')).body.some((row) => row.productId === productId),
    false,
  );
  assertStatus(
    await request('set-master-active', {
      entity: 'product',
      id: productId,
      active: true,
    }),
    200,
    'reactivar producto',
  );

  const importRows = [
    {
      internalCode: `${productCode}-IMPORT`,
      productName: `Importado ${suffix}`,
      category: 'Camisas',
      subcategory: 'Importación',
      brand: 'FRAGUAN Test',
      season: '2026',
      collection: 'CSV',
      location: 'Sector CSV',
      supplierId,
      sku: `CSV-${suffix}-L`,
      barcode: `778${suffix
        .replace(/[^0-9]/g, '')
        .slice(-10)
        .padStart(10, '0')}`,
      color: 'Blanco',
      size: 'L',
      price: 4_990_000,
      cost: 1_900_000,
      stock: 4,
      minimum: 1,
      ideal: 6,
      entryAt: '2026-09-05',
    },
    {
      internalCode: `${productCode}-IMPORT`,
      productName: `Importado ${suffix}`,
      category: 'Camisas',
      subcategory: 'Importación',
      brand: 'FRAGUAN Test',
      season: '2026',
      collection: 'CSV',
      location: 'Sector CSV',
      supplierId,
      sku: `CSV-${suffix}-M`,
      barcode: `777${suffix
        .replace(/[^0-9]/g, '')
        .slice(-10)
        .padStart(10, '0')}`,
      color: 'Blanco',
      size: 'M',
      price: 4_990_000,
      cost: 1_900_000,
      stock: 2,
      minimum: 1,
      ideal: 6,
      entryAt: '2026-09-05',
    },
  ];
  const preview = await request('product-import', {
    rows: importRows,
    mode: 'create_only',
    stockMode: 'set',
    dryRun: true,
  });
  assertStatus(preview, 200, 'validación de importación');
  assert.equal(preview.body.summary.newProducts, 1);
  assert.equal(preview.body.summary.newVariants, 2);
  const applied = await request('product-import', {
    rows: importRows,
    mode: 'create_only',
    stockMode: 'set',
    dryRun: false,
  });
  assertStatus(applied, 200, 'aplicación de importación');
  assert.equal(applied.body.summary.stockAdjustments, 0);
  const imported = (await request('products?includeArchived=1')).body.filter(
    (row) => row.internalCode === `${productCode}-IMPORT`,
  );
  assert.equal(imported.length, 2);
  assert.deepEqual(
    imported.map((row) => row.stock).sort((a, b) => a - b),
    [2, 4],
  );
  assertStatus(
    await request('product-import', {
      rows: importRows,
      mode: 'create_only',
      stockMode: 'set',
      dryRun: false,
    }),
    400,
    'la importación create_only rechaza duplicados',
  );
  assert.equal(typeof imported[0].cost, 'number');

  sql("UPDATE users SET role='VENDEDOR' WHERE id='local_seedy'");
  try {
    assertStatus(
      await request('product-import', {
        rows: importRows,
        mode: 'create_only',
        stockMode: 'ignore',
        dryRun: true,
      }),
      403,
      'vendedor no puede importar',
    );
    const sellerCatalog = await request('catalog');
    assertStatus(sellerCatalog, 200, 'catálogo vendedor');
    assert.equal(
      JSON.stringify(sellerCatalog.body).match(
        /cost|margin|markup|profit|commission|image|photo/i,
      ),
      null,
    );
  } finally {
    sql("UPDATE users SET role='ADMIN' WHERE id='local_seedy'");
  }
  console.log(
    'PASS: master data CRUD, archive/reactivate, stock-safe variant edits, CSV import and seller isolation.',
  );
} finally {
  sql(`
    DELETE FROM stock_movements WHERE variantId IN (SELECT id FROM variants WHERE productId IN (SELECT id FROM products WHERE internalCode LIKE '${productCode}%'));
    DELETE FROM variants WHERE productId IN (SELECT id FROM products WHERE internalCode LIKE '${productCode}%');
    DELETE FROM products WHERE internalCode LIKE '${productCode}%';
    DELETE FROM customers WHERE surname='Fixture ${suffix}';
    DELETE FROM suppliers WHERE id='${supplierId}';
    UPDATE users SET role='ADMIN' WHERE id='local_seedy';
  `);
}
