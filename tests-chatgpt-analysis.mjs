import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const origin = 'http://localhost:3000';
const headers = {
  Cookie: '__sites_local_auth=1',
  Origin: origin,
  'Content-Type': 'application/json',
};

function localDatabase() {
  const root = resolve('.wrangler/state/v3/d1/miniflare-D1DatabaseObject');
  const files = readdirSync(root).filter(
    (name) => name.endsWith('.sqlite') && name !== 'metadata.sqlite',
  );
  assert.equal(files.length, 1, 'Se esperaba una única base D1 local.');
  return new DatabaseSync(resolve(root, files[0]));
}

async function generate(body) {
  const response = await fetch(`${origin}/api/chatgpt-analysis`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  return { status: response.status, body: await response.json() };
}

const database = localDatabase();
const pin = await fetch(`${origin}/api/admin-pin`, {
  method: 'POST',
  headers,
  body: JSON.stringify({ pin: '197313' }),
});
assert.equal(pin.status, 200);
headers.Cookie += `; ${pin.headers.get('set-cookie').split(';', 1)[0]}`;
const originalRole = database
  .prepare("SELECT role FROM users WHERE id='local_seedy'")
  .get()?.role;
assert(originalRole);

function clean() {
  database.exec(`
    DELETE FROM refund_items WHERE refundId LIKE 'analysis_fixture_%';
    DELETE FROM refunds WHERE id LIKE 'analysis_fixture_%';
    DELETE FROM payments WHERE saleId LIKE 'analysis_fixture_%';
    DELETE FROM sale_items WHERE saleId LIKE 'analysis_fixture_%';
    DELETE FROM sales WHERE id LIKE 'analysis_fixture_%';
    DELETE FROM stock_location_movements WHERE variantId LIKE 'analysis_fixture_%';
    DELETE FROM stock_movements WHERE variantId LIKE 'analysis_fixture_%';
    DELETE FROM variant_location_stock WHERE variantId LIKE 'analysis_fixture_%';
    DELETE FROM variants WHERE id LIKE 'analysis_fixture_%';
    DELETE FROM products WHERE id LIKE 'analysis_fixture_%';
    DELETE FROM customers WHERE id='analysis_fixture_customer';
    DELETE FROM payment_methods WHERE id='analysis_fixture_debit';
  `);
}

function seed() {
  database.exec(`
    INSERT INTO products(id,name,category,brand,season,active)
    VALUES ('analysis_fixture_product','Camisa análisis','Análisis privado','FRAGUAN','Prueba',1);
    INSERT INTO variants(id,productId,sku,barcode,color,size,price,cost,stock,minimum,ideal,entryAt)
    VALUES ('analysis_fixture_variant','analysis_fixture_product','ANALYSIS-1','ANALYSIS-1','Azul','M',6000,2000,2,3,8,'2020-04-01T12:00:00.000Z');
    INSERT INTO variant_location_stock(variantId,locationId,quantity,updatedAt)
    VALUES ('analysis_fixture_variant','loc-unassigned',2,'2020-05-10T12:00:00.000Z');
    INSERT INTO customers(id,name,surname,phone,email,locality,points,createdAt)
    VALUES ('analysis_fixture_customer','NombreSecreto','ApellidoSecreto','3519999999','secreto@example.com','LocalidadSecreta',0,'2020-04-01T12:00:00.000Z');
    INSERT INTO payment_methods(id,name,surchargeBps,commissionBps,days,installments,active)
    VALUES ('analysis_fixture_debit','Débito análisis',0,200,0,1,1);
    INSERT INTO sales(id,ticket,sellerId,customerId,subtotal,discount,total,status,idempotencyKey,requestHash,createdAt)
    VALUES
      ('analysis_fixture_valid',99101001,'local_seedy','analysis_fixture_customer',12000,1000,11000,'partially_refunded','analysis_fixture_valid_key','fixture','2020-05-10T15:00:00.000Z'),
      ('analysis_fixture_cancelled',99101002,'local_seedy',NULL,6000,0,6000,'cancelled','analysis_fixture_cancelled_key','fixture','2020-05-11T15:00:00.000Z');
    INSERT INTO sale_items(id,saleId,variantId,name,color,size,quantity,price,cost,refunded)
    VALUES ('analysis_fixture_item','analysis_fixture_valid','analysis_fixture_variant','Camisa análisis','Azul','M',2,6000,2000,1);
    INSERT INTO payments(id,saleId,methodId,amount,commission,net,dueAt,reference)
    VALUES ('analysis_fixture_payment','analysis_fixture_valid','analysis_fixture_debit',11000,220,10780,'2020-05-10T15:00:00.000Z','');
    INSERT INTO refunds(id,saleId,amount,reason,actorId,method,creditIssued,createdAt)
    VALUES ('analysis_fixture_refund','analysis_fixture_valid',5000,'Prueba','local_seedy','original',0,'2020-05-10T16:00:00.000Z');
    INSERT INTO refund_items(id,refundId,saleItemId,variantId,quantity,amount)
    VALUES ('analysis_fixture_refund_item','analysis_fixture_refund','analysis_fixture_item','analysis_fixture_variant',1,5000);
  `);
}

const allSections = [
  'sales',
  'profitability',
  'products',
  'categoriesBrands',
  'stockRotation',
  'sizesColors',
  'paymentMethods',
  'discountsPromotions',
  'customers',
  'daysHours',
  'branches',
];

try {
  clean();
  seed();
  database
    .prepare("UPDATE users SET role='ADMIN' WHERE id='local_seedy'")
    .run();

  const withSales = await generate({
    from: '2020-05-10',
    to: '2020-05-11',
    comparison: 'previous_period',
    sections: allSections,
  });
  assert.equal(withSales.status, 200, JSON.stringify(withSales.body));
  const text = withSales.body.text;
  assert.match(text, /Facturación neta efectiva exacta/);
  assert.match(text, /No comparable: el período anterior fue cero/);
  assert.match(
    text,
    /Devoluciones registradas durante el período: 1 operaciones/,
  );
  assert.match(text, /Anulaciones originadas en el período: 1/);
  assert.match(text, /Costo de mercadería vendida exacto e histórico/);
  assert.match(text, /Camisa análisis/);
  assert.match(text, /Débito análisis/);
  for (const secret of [
    'NombreSecreto',
    'ApellidoSecreto',
    '3519999999',
    'secreto@example.com',
    'LocalidadSecreta',
    'analysis_fixture_customer',
  ])
    assert.equal(
      text.includes(secret),
      false,
      `Se expuso información privada: ${secret}`,
    );
  assert.equal(
    /\[(FECHA|DATOS|[A-Z_ ]{3,})\]/.test(text),
    false,
    'Quedaron placeholders.',
  );

  const empty = await generate({
    from: '2010-01-01',
    to: '2010-01-07',
    comparison: 'none',
    sections: allSections,
  });
  assert.equal(empty.status, 200, JSON.stringify(empty.body));
  assert.match(empty.body.text, /No hubo ventas válidas/);
  assert.match(empty.body.text, /Período comparativo: Sin comparación/);

  const future = await generate({
    from: '2099-01-01',
    to: '2099-01-02',
    comparison: 'none',
    sections: ['sales'],
  });
  assert.equal(future.status, 400, 'El servidor aceptó un período futuro.');

  database
    .prepare("UPDATE users SET role='VENDEDOR' WHERE id='local_seedy'")
    .run();
  const denied = await generate({
    from: '2020-05-10',
    to: '2020-05-11',
    comparison: 'none',
    sections: ['sales'],
  });
  assert.equal(
    denied.status,
    403,
    'Un vendedor accedió al exportador privado.',
  );

  const component = readFileSync(
    'components/chatgpt-analysis-export.tsx',
    'utf8',
  );
  assert.match(component, /writeText\(report\.text\)/);
  assert.match(component, /new Blob\(\[report\.text\]/);
  console.log(
    'PASS: exportador privado, cálculos, cero comparativo, devoluciones, anulaciones, privacidad y contenido único.',
  );
} finally {
  database
    .prepare('UPDATE users SET role=? WHERE id=?')
    .run(originalRole, 'local_seedy');
  clean();
  database.close();
}
