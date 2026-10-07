import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
import { migrate } from './database-tools.mjs';

export const actor = { id: 'admin', role: 'ADMIN', active: 1 };
export function fixture(t) {
  const database = new DatabaseSync(':memory:');
  migrate(database);
  t.after(() => database.close());
  const cache = new Map(),
    nodeRequire = createRequire(import.meta.url);
  const binding = {
    prepare(sql) {
      return {
        bind(...args) {
          return {
            first: async () => database.prepare(sql).get(...args) ?? null,
            all: async () => ({ results: database.prepare(sql).all(...args) }),
            run: async () => database.prepare(sql).run(...args),
          };
        },
      };
    },
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
  function load(name) {
    const file = resolve(name);
    if (cache.has(file)) return cache.get(file).exports;
    const loaded = { exports: {} };
    cache.set(file, loaded);
    vm.runInNewContext(
      ts.transpileModule(readFileSync(file, 'utf8'), {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2022,
          esModuleInterop: true,
        },
      }).outputText,
      {
        module: loaded,
        exports: loaded.exports,
        crypto,
        console,
        Date,
        TextEncoder,
        TextDecoder,
        btoa,
        atob,
        Request,
        URL,
        require(name) {
          if (name === 'cloudflare:workers') return { env: { DB: binding } };
          if (name === '@/app/chatgpt-auth')
            return { getChatGPTUser: async () => null };
          if (name.startsWith('@/')) return load(name.slice(2) + '.ts');
          if (name.startsWith('.'))
            return load(resolve(dirname(file), name + '.ts'));
          return nodeRequire(name);
        },
      },
      { filename: file },
    );
    return loaded.exports;
  }
  database.exec(`
    INSERT INTO users(id,email,name,role,active) VALUES ('admin','test@example.invalid','Prueba','ADMIN',1);
    INSERT INTO products(id,name,category) VALUES ('product','Camisa','Camisas');
    INSERT INTO variants(id,productId,sku,barcode,color,size,price,cost,stock,minimum) VALUES ('variant','product','TEST','TEST','Azul','L',10000,4000,100,1);
    INSERT INTO variant_location_stock(variantId,locationId,quantity,updatedAt) VALUES ('variant','loc-unassigned',100,'2026-01-01T12:00:00Z');
    INSERT INTO payment_methods(id,name) VALUES ('cash','Efectivo'),('transfer','Transferencia');
    INSERT INTO cash_sessions(id,openedBy,opening,openedAt) VALUES ('session','admin',0,'2026-01-01T12:00:00Z');
  `);
  return {
    database,
    load,
    sell: (quantity) =>
      load('lib/sales.ts').confirmSale(actor, {
        items: [{ variantId: 'variant', quantity }],
        customerId: null,
        promotionId: null,
        payments: [
          {
            methodId: 'cash',
            baseMinor: quantity * 10000,
            receivedMinor: quantity * 10000,
          },
        ],
        idempotencyKey: crypto.randomUUID(),
      }),
  };
}
