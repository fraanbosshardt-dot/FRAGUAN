import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const sqlite = new DatabaseSync(':memory:');
sqlite.exec(`CREATE TABLE variants(id TEXT PRIMARY KEY,price INTEGER,onlinePrice INTEGER);
CREATE TABLE store_price_campaign_items(originalPrice INTEGER,originalOnlinePrice INTEGER);
INSERT INTO variants VALUES('inherited',10000,NULL),('separate',10000,12000);
INSERT INTO store_price_campaign_items VALUES(10000,NULL);`);
sqlite.exec(readFileSync('drizzle/0027_independent_prices.sql','utf8'));
assert.equal(sqlite.prepare("SELECT onlinePrice FROM variants WHERE id='inherited'").get().onlinePrice,10000);
assert.equal(sqlite.prepare("SELECT onlinePrice FROM variants WHERE id='separate'").get().onlinePrice,12000);
sqlite.exec("UPDATE variants SET price=15000 WHERE id='inherited'");
assert.equal(sqlite.prepare("SELECT onlinePrice FROM variants WHERE id='inherited'").get().onlinePrice,10000);
sqlite.exec("UPDATE variants SET onlinePrice=9000 WHERE id='inherited'");
assert.equal(sqlite.prepare("SELECT price FROM variants WHERE id='inherited'").get().price,15000);
assert.equal(sqlite.prepare('SELECT originalOnlinePrice FROM store_price_campaign_items').get().originalOnlinePrice,10000);
sqlite.exec("INSERT INTO variants(id,price) VALUES('legacy-create',20000)");
sqlite.exec("UPDATE variants SET price=25000 WHERE id='legacy-create'");
assert.equal(sqlite.prepare("SELECT onlinePrice FROM variants WHERE id='legacy-create'").get().onlinePrice,20000);
sqlite.close();

const { PGlite } = await import(pathToFileURL(resolve('outputs/pg-stock-tests/node_modules/@electric-sql/pglite/dist/index.js')).href);
const pg = new PGlite();
try {
  await pg.exec(`CREATE TABLE variants(id TEXT PRIMARY KEY,price BIGINT,"onlinePrice" BIGINT);
CREATE TABLE store_price_campaign_items("originalPrice" BIGINT,"originalOnlinePrice" BIGINT);
INSERT INTO variants VALUES('inherited',10000,NULL),('separate',10000,12000);
INSERT INTO store_price_campaign_items VALUES(10000,NULL);`);
  await pg.exec(readFileSync('drizzle-postgres/0008_independent_prices.sql','utf8'));
  const row = async id => (await pg.query('SELECT price,"onlinePrice" FROM variants WHERE id=$1',[id])).rows[0];
  assert.equal(Number((await row('inherited')).onlinePrice),10000);
  assert.equal(Number((await row('separate')).onlinePrice),12000);
  await pg.exec("UPDATE variants SET price=15000 WHERE id='inherited'");
  assert.equal(Number((await row('inherited')).onlinePrice),10000);
  await pg.exec(`UPDATE variants SET "onlinePrice"=9000 WHERE id='inherited'`);
  assert.equal(Number((await row('inherited')).price),15000);
  await pg.exec("INSERT INTO variants(id,price) VALUES('legacy-create',20000)");
  await pg.exec("UPDATE variants SET price=25000 WHERE id='legacy-create'");
  assert.equal(Number((await row('legacy-create')).onlinePrice),20000);
  assert.equal(Number((await pg.query('SELECT "originalOnlinePrice" FROM store_price_campaign_items')).rows[0].originalOnlinePrice),10000);
} finally { await pg.close(); }
console.log('PASS SQLite/PostgreSQL: conservar importes, separar cambios de local/web y proteger precios originales de campañas.');
