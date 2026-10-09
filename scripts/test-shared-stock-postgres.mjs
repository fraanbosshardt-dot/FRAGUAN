import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

// Optional test-only PostgreSQL WASM runtime. Never uses DATABASE_URL or network.
// Install it into outputs/pg-stock-tests, not the production dependencies.
const runtime =
  process.argv[2] ??
  'outputs/pg-stock-tests/node_modules/@electric-sql/pglite/dist/index.js';
const { PGlite } = await import(pathToFileURL(resolve(runtime)).href);
const database = new PGlite();
try {
  await database.exec(`
    CREATE TABLE variants(id TEXT PRIMARY KEY,stock BIGINT,price BIGINT,cost BIGINT);
    CREATE TABLE sales(id TEXT PRIMARY KEY,channel TEXT NOT NULL DEFAULT 'pos',"onlineOrderId" TEXT);
    CREATE TABLE online_orders(id TEXT PRIMARY KEY,status TEXT DEFAULT 'awaiting_payment',"paymentStatus" TEXT DEFAULT 'pending',"expiresAt" TEXT);
    CREATE TABLE online_order_items("orderId" TEXT,"variantId" TEXT,"unitPrice" BIGINT);
    CREATE TABLE stock_reservations(id TEXT PRIMARY KEY,"orderId" TEXT,"variantId" TEXT,quantity BIGINT,status TEXT DEFAULT 'active',"expiresAt" TEXT);
    CREATE TABLE sale_items(id TEXT PRIMARY KEY,"saleId" TEXT,"variantId" TEXT,quantity BIGINT,price BIGINT,cost BIGINT);
  `);
  const integrity = readFileSync('drizzle-postgres/0001_integrity.sql', 'utf8');
  await database.exec(
    integrity.match(
      /CREATE OR REPLACE FUNCTION fraguan_online_reservation_guard\(\)[\s\S]*?CREATE TRIGGER online_reservation_guard[^;]+;/,
    )[0],
  );
  await database.exec(
    readFileSync('drizzle-postgres/0005_shared_reserved_stock.sql', 'utf8'),
  );
  await database.exec(readFileSync('drizzle-postgres/0010_reported_transfer_reservations.sql', 'utf8'));
  await database.exec(`CREATE TRIGGER sale_item_guard BEFORE INSERT ON sale_items FOR EACH ROW EXECUTE FUNCTION fraguan_sale_item_guard();
    CREATE FUNCTION test_stock_apply() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN UPDATE variants SET stock=stock-NEW.quantity WHERE id=NEW."variantId"; RETURN NEW; END $$;
    CREATE TRIGGER test_stock_apply AFTER INSERT ON sale_items FOR EACH ROW EXECUTE FUNCTION test_stock_apply();
    INSERT INTO variants VALUES ('v',5,10000,4000);
    INSERT INTO sales(id) VALUES ('pos');
  `);
  const future = new Date(Date.now() + 3600000).toISOString(),
    past = new Date(Date.now() - 3600000).toISOString();
  for (const id of ['a', 'b']) {
    await database.query(
      'INSERT INTO online_orders(id,"expiresAt") VALUES ($1,$2)',
      [id, future],
    );
    await database.query('INSERT INTO online_order_items VALUES ($1,$2,$3)', [
      id,
      'v',
      9000,
    ]);
    await database.query(
      'INSERT INTO stock_reservations(id,"orderId","variantId",quantity,"expiresAt") VALUES ($1,$1,\'v\',2,$2)',
      [id, future],
    );
    await database.query("INSERT INTO sales VALUES ($1,'online',$1)", [id]);
  }
  await database.query(
    "INSERT INTO sale_items VALUES ('pos1','pos','v',1,10000,4000)",
  );
  await assert.rejects(
    database.query(
      "INSERT INTO sale_items VALUES ('blocked','pos','v',1,10000,4000)",
    ),
    /insufficient_stock/,
  );
  await database.transaction(async (tx) => {
    await tx.query("UPDATE online_orders SET \"paymentStatus\"='reported' WHERE id='a'");
    await tx.query(
      "INSERT INTO sale_items VALUES ('online-a','a','v',2,9000,4000)",
    );
    await tx.query(
      "UPDATE stock_reservations SET status='consumed' WHERE id='a'",
    );
    await tx.query(
      "UPDATE online_orders SET \"paymentStatus\"='paid' WHERE id='a'",
    );
  });
  assert.equal(
    Number(
      (await database.query("SELECT stock FROM variants WHERE id='v'")).rows[0]
        .stock,
    ),
    2,
  );
  await assert.rejects(
    database.query(
      "INSERT INTO sale_items VALUES ('blocked2','pos','v',1,10000,4000)",
    ),
    /insufficient_stock/,
  );
  await database.transaction(async (tx) => {
    await tx.query(
      "INSERT INTO sale_items VALUES ('online-b','b','v',2,9000,4000)",
    );
    await tx.query(
      "UPDATE stock_reservations SET status='consumed' WHERE id='b'",
    );
  });
  await assert.rejects(
    database.query(
      'INSERT INTO stock_reservations(id,"orderId","variantId",quantity,"expiresAt") VALUES (\'excess\',\'a\',\'v\',1,$1)',
      [future],
    ),
    /online_stock_unavailable/,
  );
  await database.query("UPDATE variants SET stock=4 WHERE id='v'");
  await database.query(
    'INSERT INTO stock_reservations(id,"orderId","variantId",quantity,"expiresAt") VALUES (\'expired\',\'a\',\'v\',4,$1)',
    [past],
  );
  await database.query(
    "INSERT INTO sale_items VALUES ('pos-expired','pos','v',4,10000,4000)",
  );
  await database.query("UPDATE variants SET stock=10 WHERE id='v'");
  await assert.rejects(
    database.query(
      "INSERT INTO sale_items VALUES ('bypass','a','v',2,9000,4000)",
    ),
    /online_stock_unavailable/,
  );
  await database.query(
    "UPDATE stock_reservations SET status='active' WHERE id='b'",
  );
  await assert.rejects(
    database.query(
      "INSERT INTO sale_items VALUES ('wrong-price','b','v',2,10000,4000)",
    ),
    /price_changed/,
  );
  await assert.rejects(
    database.transaction(async (tx) => {
      await tx.query(
        "INSERT INTO sale_items VALUES ('partial','pos','v',1,10000,4000)",
      );
      await tx.query(
        "INSERT INTO sale_items VALUES ('oversell','pos','v',10,10000,4000)",
      );
    }),
    /insufficient_stock/,
  );
  assert.equal(
    Number(
      (await database.query("SELECT stock FROM variants WHERE id='v'")).rows[0]
        .stock,
    ),
    10,
  );
  assert.equal(
    (await database.query("SELECT id FROM sale_items WHERE id='partial'")).rows
      .length,
    0,
  );
  console.log(
    'PASS PostgreSQL guards: reserved availability, own reservation, expiry, price/cost checks, reservation creation and atomic rollback. Local single-connection WASM runtime; no production database or emails.',
  );
} finally {
  await database.close();
}
