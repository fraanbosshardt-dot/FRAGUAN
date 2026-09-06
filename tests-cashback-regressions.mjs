import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

// Execute the actual services and migrations against disposable SQLite, never
// changing the developer's customers, stock, cash session, or Club settings.
const root = dirname(fileURLToPath(import.meta.url));
const nodeRequire = createRequire(import.meta.url);
export const actor = { id: 'admin', role: 'ADMIN', active: 1 };

export function fixture(t, { rate = 100, expiry = 30, timestamp } = {}) {
  const Clock = timestamp
    ? class extends Date {
        constructor(...args) {
          super(...(args.length ? args : [timestamp]));
        }
        static now() {
          return Date.parse(timestamp);
        }
      }
    : Date;
  const database = new DatabaseSync(':memory:');
  t.after(() => database.close());
  database.exec('PRAGMA foreign_keys=ON');
  for (const file of readdirSync(resolve(root, 'drizzle'))
    .filter((f) => f.endsWith('.sql'))
    .sort()) {
    database.exec(readFileSync(resolve(root, 'drizzle', file), 'utf8'));
  }
  function prepare(sql) {
    return {
      bind(...args) {
        return {
          first: async () => database.prepare(sql).get(...args) ?? null,
          all: async () => ({ results: database.prepare(sql).all(...args) }),
          run: async () => database.prepare(sql).run(...args),
        };
      },
    };
  }
  const binding = {
    prepare,
    async batch(commands) {
      database.exec('BEGIN');
      try {
        const results = [];
        for (const command of commands) results.push(await command.run());
        database.exec('COMMIT');
        return results;
      } catch (error) {
        database.exec('ROLLBACK');
        throw error;
      }
    },
  };
  const cache = new Map();
  function load(file) {
    if (cache.has(file)) return cache.get(file).exports;
    const module = { exports: {} };
    cache.set(file, module);
    const compiled = ts.transpileModule(readFileSync(file, 'utf8'), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        esModuleInterop: true,
      },
    });
    vm.runInNewContext(
      compiled.outputText,
      {
        module,
        exports: module.exports,
        crypto,
        console,
        Date: Clock,
        TextEncoder,
        TextDecoder,
        URL,
        require(name) {
          if (name === 'cloudflare:workers') return { env: { DB: binding } };
          if (name === '@/app/chatgpt-auth')
            return { getChatGPTUser: async () => null };
          if (name.startsWith('@/'))
            return load(resolve(root, name.slice(2) + '.ts'));
          if (name.startsWith('.'))
            return load(resolve(dirname(file), name + '.ts'));
          return nodeRequire(name);
        },
      },
      { filename: file },
    );
    return module.exports;
  }
  database.exec(`
    INSERT INTO users(id,email,name,role,active) VALUES ('admin','test@example.test','Test','ADMIN',1);
    INSERT INTO customers(id,name,surname,phone,createdAt) VALUES ('customer','Cliente','Prueba','1100000000','2026-01-01T12:00:00Z');
    INSERT INTO products(id,name,category) VALUES ('product','Camisa','Camisas');
    INSERT INTO variants(id,productId,sku,barcode,color,size,price,cost,stock,minimum)
      VALUES ('variant','product','TEST','TEST','Azul','L',10000,4000,100,1);
    INSERT INTO payment_methods(id,name) VALUES ('cash','Efectivo');
    INSERT INTO cash_sessions(id,openedBy,opening,openedAt) VALUES ('session','admin',0,'2026-01-01T12:00:00Z');
  `);
  database.prepare('INSERT INTO settings(key,value) VALUES (?,?)').run(
    'customerIntelligence',
    JSON.stringify({
      loyalty: {
        cashbackBps: { FRAGUAN: rate, Silver: rate, Gold: rate, Black: rate },
        cashbackExpiryDays: expiry,
      },
    }),
  );
  const sales = load(resolve(root, 'lib/sales.ts'));
  const returns = load(resolve(root, 'lib/returns.ts'));
  return {
    database,
    load: (name) => load(resolve(root, name)),
    async sell(quantity, cashback = 0, key = crypto.randomUUID()) {
      const total = quantity * 10000;
      return sales.confirmSale(actor, {
        items: [{ variantId: 'variant', quantity }],
        customerId: 'customer',
        promotionId: null,
        payments: [
          ...(cashback ? [{ methodId: 'cashback', baseMinor: cashback }] : []),
          ...(total > cashback
            ? [
                {
                  methodId: 'cash',
                  baseMinor: total - cashback,
                  receivedMinor: total - cashback,
                },
              ]
            : []),
        ],
        idempotencyKey: key,
      });
    },
    refund(sale, quantity) {
      const item = database
        .prepare('SELECT id FROM sale_items WHERE saleId=?')
        .get(sale.id);
      return returns.refundPartial(actor, {
        saleId: sale.id,
        reason: 'Devolución de prueba',
        ...(quantity ? { items: [{ saleItemId: item.id, quantity }] } : {}),
      });
    },
    balance() {
      return database
        .prepare(
          "SELECT COALESCE(SUM(balance),0) AS balance FROM customer_cashback WHERE status='active' AND (expiresAt IS NULL OR expiresAt>=?)",
        )
        .get(new Date().toISOString()).balance;
    },
  };
}

test('three successive partial refunds only reverse their proportional cashback', async (t) => {
  const f = fixture(t);
  const sale = await f.sell(4);
  assert.equal(f.balance(), 400);
  for (const expected of [300, 200, 100, 0]) {
    await f.refund(sale, 1);
    assert.equal(f.balance(), expected);
  }
  assert.equal(
    f.database.prepare("SELECT stock FROM variants WHERE id='variant'").get()
      .stock,
    100,
  );
  await assert.rejects(() => f.refund(sale));
});

test('mixed payment refund restores spent cashback without reversing the restored balance', async (t) => {
  const f = fixture(t);
  await f.sell(10); // Earn 1,000.
  const sale = await f.sell(4, 1000); // Spend it and earn 400.
  assert.equal(f.balance(), 400);
  for (const expected of [550, 700, 850, 1000]) {
    await f.refund(sale, 1);
    assert.equal(f.balance(), expected);
  }
  const cash = f.database
    .prepare(
      "SELECT -SUM(amount) AS amount FROM cash_movements WHERE kind='Devolución'",
    )
    .get();
  assert.equal(cash.amount, 39000);
});

test('cashback refunds respect configured expiry', async (t) => {
  const f = fixture(t, { expiry: 30 });
  await f.sell(10);
  const sale = await f.sell(1, 1000);
  await f.refund(sale);
  const restored = f.database
    .prepare(
      'SELECT expiresAt,createdAt FROM customer_cashback WHERE refundId IS NOT NULL',
    )
    .get();
  assert.equal(
    Math.round(
      (Date.parse(restored.expiresAt) - Date.parse(restored.createdAt)) /
        86400000,
    ),
    30,
  );
});

test('used cashback cannot be overspent and repeated sale requests never credit twice', async (t) => {
  const f = fixture(t);
  const key = crypto.randomUUID();
  const first = await f.sell(1, 0, key);
  const repeated = await f.sell(1, 0, key);
  assert.equal(repeated.id, first.id);
  assert.equal(f.balance(), 100);
  await assert.rejects(() => f.sell(1, 101), /cashback suficiente/);
  await f.sell(1, 100);
  assert.equal(f.balance(), 100);
});

test('a refund never makes previously spent cashback negative', async (t) => {
  const f = fixture(t);
  const original = await f.sell(4);
  await f.sell(1, 400);
  await f.refund(original);
  assert.equal(f.balance(), 100);
  assert.equal(
    f.database
      .prepare(
        'SELECT COUNT(*) AS count FROM customer_cashback WHERE balance<0',
      )
      .get().count,
    0,
  );
});

test('refunding a purchase fully paid with cashback works without an open cash session', async (t) => {
  const f = fixture(t, { rate: 10000 });
  await f.sell(1);
  const purchase = await f.sell(1, 10000);
  f.database.exec("UPDATE cash_sessions SET closedAt='2026-01-01T20:00:00Z'");
  await f.refund(purchase);
  assert.equal(f.balance(), 10000);
  assert.equal(
    f.database
      .prepare(
        "SELECT COUNT(*) AS count FROM cash_movements WHERE kind='Devolución'",
      )
      .get().count,
    0,
  );
});
