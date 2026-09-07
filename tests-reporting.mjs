import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const origin = 'http://localhost:3000';
const headers = {
  Cookie: '__sites_local_auth=1',
  Origin: origin,
  'Content-Type': 'application/json',
};

async function request(path) {
  const response = await fetch(`${origin}/api/${path}`, { headers });
  return { status: response.status, body: await response.json() };
}

function localDatabase() {
  const root = resolve('.wrangler/state/v3/d1/miniflare-D1DatabaseObject');
  const files = readdirSync(root).filter(
    (name) => name.endsWith('.sqlite') && name !== 'metadata.sqlite',
  );
  assert.equal(files.length, 1, 'Se esperaba una única base D1 local.');
  return new DatabaseSync(resolve(root, files[0]));
}

function assertNoKey(value, forbiddenKey) {
  if (!value || typeof value !== 'object') return;
  for (const [key, nested] of Object.entries(value)) {
    assert.notEqual(
      key,
      forbiddenKey,
      `La API expuso el campo ${forbiddenKey}.`,
    );
    assertNoKey(nested, forbiddenKey);
  }
}

const database = localDatabase();
database.exec('PRAGMA foreign_keys=ON');
const originalRole = database
  .prepare("SELECT role FROM users WHERE id='local_seedy'")
  .get()?.role;
assert(originalRole, 'No existe el usuario local de integración.');

function cleanFixture() {
  database.exec(`
    DELETE FROM refunds WHERE saleId LIKE 'report_fixture_%';
    DELETE FROM payments WHERE saleId LIKE 'report_fixture_%';
    DELETE FROM sale_items WHERE saleId LIKE 'report_fixture_%';
    DELETE FROM sales WHERE id LIKE 'report_fixture_%';
    DELETE FROM stock_movements WHERE reference LIKE 'report_fixture_%' OR id LIKE 'report_fixture_%';
    DELETE FROM variants WHERE id LIKE 'report_fixture_%';
    DELETE FROM products WHERE id LIKE 'report_fixture_%';
    DELETE FROM suppliers WHERE id='report_fixture_supplier';
    DELETE FROM customers WHERE id='report_fixture_customer';
    DELETE FROM payment_methods WHERE id='report_fixture_card';
  `);
}

function createFixture() {
  database.exec(`
    INSERT INTO suppliers(id,name,phone,email,terms)
    VALUES ('report_fixture_supplier','Proveedor reporte','','','');

    INSERT INTO products(id,name,category,brand,season,supplierId,active)
    VALUES
      ('report_fixture_product','Producto reporte','Reporte aislado','Marca reporte','Prueba','report_fixture_supplier',1),
      ('report_fixture_stagnant','Producto sin venta actual','Reporte aislado','Marca reporte','Prueba','report_fixture_supplier',1),
      ('report_fixture_other','Producto de otra categoría','Otra categoría reporte','Marca reporte','Prueba','report_fixture_supplier',1);

    INSERT INTO variants(id,productId,sku,barcode,color,size,price,cost,stock,minimum)
    VALUES
      ('report_fixture_variant','report_fixture_product','REPORT-FIXTURE-A','REPORT-FIXTURE-A','Único','U',10000,4000,20,1),
      ('report_fixture_previous_variant','report_fixture_product','REPORT-FIXTURE-P','REPORT-FIXTURE-P','Anterior','U',7000,3000,20,1),
      ('report_fixture_cash_variant','report_fixture_product','REPORT-FIXTURE-C','REPORT-FIXTURE-C','Efectivo','U',6000,2500,20,1),
      ('report_fixture_stagnant_variant','report_fixture_stagnant','REPORT-FIXTURE-S','REPORT-FIXTURE-S','Único','U',3000,1000,20,1),
      ('report_fixture_other_variant','report_fixture_other','REPORT-FIXTURE-B','REPORT-FIXTURE-B','Único','U',5000,2000,20,1);

    INSERT INTO variant_location_stock(variantId,locationId,quantity,updatedAt)
    SELECT id,'loc-unassigned',stock,'2040-02-01T12:00:00.000Z'
    FROM variants WHERE id LIKE 'report_fixture_%';

    INSERT INTO customers(id,name,surname,phone,email,points,createdAt)
    VALUES ('report_fixture_customer','Cliente','Reporte','1199990000','',0,'2040-02-01T12:00:00.000Z');

    INSERT INTO payment_methods(id,name,surchargeBps,commissionBps,days,installments,active)
    VALUES ('report_fixture_card','Tarjeta reporte',0,1000,0,1,1);

    INSERT INTO sales(id,ticket,sellerId,customerId,subtotal,discount,total,status,idempotencyKey,requestHash,createdAt)
    VALUES
      ('report_fixture_history',99000001,'local_seedy','report_fixture_customer',3000,0,3000,'confirmed','report_fixture_history_key','fixture','2040-02-01T15:00:00.000Z'),
      ('report_fixture_previous',99000002,'local_seedy','report_fixture_customer',7000,0,7000,'confirmed','report_fixture_previous_key','fixture','2040-02-09T15:00:00.000Z'),
      ('report_fixture_partial',99000003,'local_seedy','report_fixture_customer',25000,5000,20000,'partially_refunded','report_fixture_partial_key','fixture','2040-02-10T15:00:00.000Z'),
      ('report_fixture_cash',99000004,'local_seedy',NULL,6000,0,6000,'confirmed','report_fixture_cash_key','fixture','2040-02-11T15:00:00.000Z');

    INSERT INTO sale_items(id,saleId,variantId,name,color,size,quantity,price,cost,refunded)
    VALUES
      ('report_fixture_history_item','report_fixture_history','report_fixture_stagnant_variant','Producto sin venta actual','Único','U',1,3000,1000,0),
      ('report_fixture_previous_item','report_fixture_previous','report_fixture_previous_variant','Producto reporte','Anterior','U',1,7000,3000,0),
      ('report_fixture_partial_target','report_fixture_partial','report_fixture_variant','Producto reporte','Único','U',2,10000,4000,1),
      ('report_fixture_partial_other','report_fixture_partial','report_fixture_other_variant','Producto de otra categoría','Único','U',1,5000,2000,0),
      ('report_fixture_cash_item','report_fixture_cash','report_fixture_cash_variant','Producto reporte','Efectivo','U',1,6000,2500,0);

    INSERT INTO payments(id,saleId,methodId,amount,commission,net,dueAt,reference)
    VALUES
      ('report_fixture_history_payment','report_fixture_history','report_fixture_card',3000,300,2700,'2040-02-01T15:00:00.000Z',''),
      ('report_fixture_previous_payment','report_fixture_previous','report_fixture_card',7000,700,6300,'2040-02-09T15:00:00.000Z',''),
      ('report_fixture_partial_card','report_fixture_partial','report_fixture_card',12000,1200,10800,'2040-02-10T15:00:00.000Z',''),
      ('report_fixture_partial_cash','report_fixture_partial','cash',8000,0,8000,'2040-02-10T15:00:00.000Z',''),
      ('report_fixture_cash_payment','report_fixture_cash','cash',6000,0,6000,'2040-02-11T15:00:00.000Z','');

    INSERT INTO refunds(id,saleId,amount,reason,actorId,method,creditIssued,createdAt)
    VALUES ('report_fixture_refund','report_fixture_partial',8000,'Devolución de prueba','local_seedy','original',0,'2040-02-10T16:00:00.000Z');
  `);
}

try {
  cleanFixture();
  createFixture();
  database
    .prepare("UPDATE users SET role='ADMIN' WHERE id='local_seedy'")
    .run();

  const report = await request(
    'reports?from=2040-02-10&to=2040-02-11&category=Reporte%20aislado',
  );
  assert.equal(report.status, 200, JSON.stringify(report.body));
  assert.deepEqual(report.body.period, {
    from: '2040-02-10',
    to: '2040-02-11',
    days: 2,
  });
  assert.deepEqual(report.body.previousPeriod, {
    from: '2040-02-08',
    to: '2040-02-09',
    days: 2,
  });
  assert.deepEqual(report.body.current, {
    revenueMinor: 14000,
    tickets: 2,
    units: 2,
    costMinor: 6500,
    commissionMinor: 480,
    grossProfitMinor: 7020,
    marginBps: 5014,
    averageTicketMinor: 7000,
    newCustomers: 0,
    repeatCustomers: 1,
  });
  assert.equal(report.body.previous.revenueMinor, 7000);
  assert.equal(report.body.previous.grossProfitMinor, 3300);
  assert.equal(report.body.comparison.revenueMinor.changeBps, 10000);
  assert.equal(
    report.body.trend.reduce((sum, day) => sum + day.revenueMinor, 0),
    report.body.current.revenueMinor,
  );
  assert.equal(report.body.breakdowns.categories.length, 1);
  assert.equal(report.body.breakdowns.categories[0].revenueMinor, 14000);
  assert.equal(report.body.breakdowns.products.length, 1);
  assert.equal(report.body.breakdowns.products[0].revenueMinor, 14000);
  assert.equal(report.body.breakdowns.products[0].commissionMinor, 480);
  assert.equal(
    report.body.breakdowns.paymentMethods.reduce(
      (sum, method) => sum + method.revenueMinor,
      0,
    ),
    14000,
  );
  assert.equal(
    report.body.breakdowns.paymentMethods.reduce(
      (sum, method) => sum + method.commissionMinor,
      0,
    ),
    480,
  );
  assert.deepEqual(
    report.body.productsWithoutSales.map((product) => product.id),
    ['report_fixture_stagnant'],
  );
  assert.equal(
    report.body.productsWithoutSales[0].lastSaleAt,
    '2040-02-01T15:00:00.000Z',
  );
  assertNoKey(report.body, 'image');

  const methodReport = await request(
    'reports?from=2040-02-10&to=2040-02-11&category=Reporte%20aislado&methodId=report_fixture_card',
  );
  assert.equal(methodReport.status, 200, JSON.stringify(methodReport.body));
  assert.equal(methodReport.body.current.revenueMinor, 8000);
  assert.equal(methodReport.body.current.tickets, 1);
  assert.equal(methodReport.body.breakdowns.products[0].revenueMinor, 8000);
  assert.equal(
    methodReport.body.breakdowns.paymentMethods.reduce(
      (sum, method) => sum + method.revenueMinor,
      0,
    ),
    8000,
  );

  assert.equal(
    (await request('reports?from=2040-02-11&to=2040-02-10')).status,
    400,
  );
  assert.equal(
    (await request('reports?from=2030-01-01&to=2040-02-10')).status,
    400,
  );

  database
    .prepare("UPDATE users SET role='VENDEDOR' WHERE id='local_seedy'")
    .run();
  assert.equal(
    (
      await request(
        'reports?from=2040-02-10&to=2040-02-11&category=Reporte%20aislado',
      )
    ).status,
    403,
    'Un vendedor no debe acceder a reportes ni costos internos.',
  );

  console.log(
    'PASS: reportes netos reconciliados, filtros coherentes, productos sin venta y permiso de servidor.',
  );
} finally {
  database
    .prepare('UPDATE users SET role=? WHERE id=?')
    .run(originalRole, 'local_seedy');
  cleanFixture();
  database.close();
}
