import { db, id, now, one, statement, auditStatement } from '@/db/queries';
import { identity, AppError } from './auth';
import { env } from 'cloudflare:workers';
const collection = [
  ['Camisa Oxford', 'Camisas', 59900, 'photo-1598033129183-c4f50c736f10'],
  ['Remera Essential', 'Remeras', 29900, 'photo-1521572163474-6864f9cf17ab'],
  ['Jean Slim Fit', 'Jeans', 74900, 'photo-1542272604-787c3835535d'],
  ['Camisa de lino', 'Camisas', 69900, 'photo-1602810318383-e386cc2a3ccf'],
  ['Buzo Half Zip', 'Buzos', 64900, 'photo-1556821840-3a63f95609a7'],
  ['Pantalón Chino', 'Pantalones', 64900, 'photo-1473966968600-fa801b869a1a'],
  ['Remera Pima', 'Remeras', 34900, 'photo-1521572163474-6864f9cf17ab'],
  ['Campera Urban', 'Camperas', 119900, 'photo-1551028719-00167b16eac5'],
  ['Chomba Classic', 'Chombas', 44900, 'photo-1625910513413-5fc45e8d82e5'],
  ['Jean Straight', 'Jeans', 79900, 'photo-1542272604-787c3835535d'],
] as const;
export async function setup(demo: boolean) {
  const u = await identity();
  if (env.BOOTSTRAP_OWNER_EMAIL) {
    if (u.email.toLowerCase() !== env.BOOTSTRAP_OWNER_EMAIL.toLowerCase())
      throw new AppError(403, 'Solo el propietario puede activar el negocio.');
  } else if (!import.meta.env.DEV || u.userId !== 'local_seedy')
    throw new AppError(403, 'Falta configurar el propietario del negocio.');
  if (await one('SELECT key FROM settings WHERE key=?', 'owner'))
    throw new AppError(409, 'El negocio ya está configurado.');
  const timestamp = now();
  const commands = [
    statement(
      'INSERT INTO settings(key,value) VALUES (?,?)',
      'owner',
      u.email.toLowerCase(),
    ),
    statement(
      'INSERT INTO settings(key,value) VALUES (?,?)',
      'recentDays',
      '30',
    ),
    statement(
      'INSERT INTO settings(key,value) VALUES (?,?)',
      'demo',
      demo ? '1' : '0',
    ),
    statement(
      'INSERT INTO users(id,email,name,role) VALUES (?,?,?,?)',
      u.userId,
      u.email.toLowerCase(),
      u.displayName,
      'ADMIN',
    ),
  ];
  for (const [key, name, surcharge, commission, days, installments] of [
    ['cash', 'Efectivo', 0, 0, 0, 1],
    ['transfer', 'Transferencia', 0, 0, 0, 1],
    ['debit', 'Débito', 0, 150, 2, 1],
    ['credit', 'Crédito · 1 pago', 0, 450, 10, 1],
    ['credit3', 'Crédito · 3 cuotas', 1000, 700, 10, 3],
    ['credit6', 'Crédito · 6 cuotas', 2000, 1000, 10, 6],
    ['qr', 'QR / Mercado Pago', 0, 600, 2, 1],
    ['naranja', 'Naranja X', 0, 600, 14, 1],
    ['gocuotas', 'Go Cuotas', 1000, 800, 14, 4],
  ] as const)
    commands.push(
      statement(
        'INSERT INTO payment_methods(id,name,surchargeBps,commissionBps,days,installments) VALUES (?,?,?,?,?,?)',
        key,
        name,
        surcharge,
        commission,
        days,
        installments,
      ),
    );
  for (const c of [...new Set(collection.map((p) => p[1]))])
    commands.push(
      statement('INSERT INTO categories(id,name) VALUES (?,?)', id(), c),
    );
  commands.push(
    statement('INSERT INTO brands(id,name) VALUES (?,?)', 'fraguan', 'FRAGUAN'),
  );
  if (demo) {
    commands.push(
      statement(
        'INSERT INTO suppliers(id,name,phone,email,terms) VALUES (?,?,?,?,?)',
        'sup-demo',
        'Textiles del Sur · Demo',
        '11 5555 0100',
        'demo@example.com',
        'Cuenta corriente a 30 días',
      ),
    );
    for (let i = 0; i < 50; i++) {
      const p = collection[i % 10];
      const productId = `product-${i + 1}`;
      const name =
        p[0] +
        (i >= 10
          ? ` ${['', 'Premium', 'Relaxed', 'Signature', 'Edition'][Math.floor(i / 10)]}`
          : '');
      commands.push(
        statement(
          'INSERT INTO products(id,name,category,image,supplierId) VALUES (?,?,?,?,?)',
          productId,
          name,
          p[1],
          `https://images.unsplash.com/${p[3]}?auto=format&fit=crop&w=600&q=80`,
          'sup-demo',
        ),
      );
      const sizes =
        p[1] === 'Jeans' || p[1] === 'Pantalones'
          ? ['38', '40', '42', '44', '46', '48']
          : ['S', 'M', 'L', 'XL', 'XXL'];
      for (let c = 0; c < (i < 10 ? 2 : 1); c++)
        for (let s = 0; s < sizes.length; s++) {
          const variantId = `variant-${i + 1}-${c}-${s}`;
          const color =
            i % 10 === 0 ? ['Celeste', 'Blanco'][c] : ['Negro', 'Arena'][c];
          const stock = (i + c + s) % 9;
          commands.push(
            statement(
              'INSERT INTO variants(id,productId,sku,barcode,color,size,price,cost) VALUES (?,?,?,?,?,?,?,?)',
              variantId,
              productId,
              `FR-${String(i + 1).padStart(3, '0')}-${c}-${sizes[s]}`,
              `200${String(i * 20 + c * 8 + s).padStart(9, '0')}`,
              color,
              sizes[s],
              p[2] * 100,
              Math.floor(p[2] * 0.42) * 100,
            ),
          );
          commands.push(
            statement(
              'INSERT INTO stock_movements(id,variantId,quantity,before,after,reason,actorId,reference,createdAt) VALUES (?,?,?,?,?,?,?,?,?)',
              id(),
              variantId,
              stock,
              0,
              stock,
              'Ingreso inicial demo',
              u.userId,
              'demo',
              timestamp,
            ),
          );
        }
    }
    for (const [i, name, surname, phone] of [
      [1, 'Juan', 'Pérez', '11 4444 1234'],
      [2, 'Tomás', 'García', '11 4444 5678'],
      [3, 'Santiago', 'López', '11 4444 9012'],
      [4, 'Nicolás', 'Fernández', '11 4444 3456'],
      [5, 'Mateo', 'Rodríguez', '11 4444 7890'],
    ] as const)
      commands.push(
        statement(
          'INSERT INTO customers(id,name,surname,phone,createdAt) VALUES (?,?,?,?,?)',
          `customer-${i}`,
          name,
          surname,
          phone,
          timestamp,
        ),
      );
    commands.push(
      statement(
        'INSERT INTO cash_sessions(id,openedBy,opening,openedAt) VALUES (?,?,?,?)',
        'cash-demo',
        u.userId,
        10000000,
        timestamp,
      ),
    );
    commands.push(
      statement(
        'INSERT INTO users(id,email,name,role,active) VALUES (?,?,?,?,?)',
        'seller-demo',
        'vendedor@example.com',
        'Lucas · Demo',
        'VENDEDOR',
        0,
      ),
    );
    for (let n = 0; n < 24; n++) {
      const i = n % 24,
        p = collection[i % 10],
        s = i % 9 === 8 ? 2 : 1,
        variantId = `variant-${i + 1}-0-${s}`,
        saleId = `sale-demo-${n}`,
        seller = n % 2 ? 'seller-demo' : u.userId;
      const soldAt = new Date(Date.now() - (23 - n) * 86400000).toISOString(),
        price = p[2] * 100,
        commission = Math.floor(price * 0.015);
      commands.push(
        statement(
          'INSERT INTO sales(id,ticket,sellerId,customerId,subtotal,discount,total,idempotencyKey,requestHash,createdAt) VALUES (?,?,?,?,?,?,?,?,?,?)',
          saleId,
          n + 1,
          seller,
          `customer-${(n % 5) + 1}`,
          price,
          0,
          price,
          `seed-${n}`,
          'seed',
          soldAt,
        ),
      );
      commands.push(
        statement(
          'INSERT INTO sale_items(id,saleId,variantId,name,color,size,quantity,price,cost) SELECT ?,?,v.id,p.name,v.color,v.size,1,v.price,v.cost FROM variants v JOIN products p ON p.id=v.productId WHERE v.id=?',
          `item-demo-${n}`,
          saleId,
          variantId,
        ),
      );
      commands.push(
        statement(
          'INSERT INTO payments(id,saleId,methodId,amount,commission,net,dueAt,reference) VALUES (?,?,?,?,?,?,?,?)',
          id(),
          saleId,
          'debit',
          price,
          commission,
          price - commission,
          soldAt,
          'Demostración',
        ),
      );
      commands.push(
        statement(
          'INSERT INTO cash_movements(id,kind,amount,methodId,reference,actorId,createdAt) VALUES (?,?,?,?,?,?,?)',
          id(),
          'Venta demo',
          price,
          'debit',
          saleId,
          seller,
          soldAt,
        ),
      );
      const points = Math.floor(price / 100000);
      commands.push(
        statement(
          'UPDATE customers SET points=points+? WHERE id=?',
          points,
          `customer-${(n % 5) + 1}`,
        ),
        statement(
          'INSERT INTO loyalty_transactions(id,customerId,points,reason,reference,createdAt) VALUES (?,?,?,?,?,?)',
          id(),
          `customer-${(n % 5) + 1}`,
          points,
          'Venta demo',
          saleId,
          soldAt,
        ),
      );
    }
    for (const [n, description, category, amount] of [
      [1, 'Alquiler del local · Demo', 'Alquiler', 45000000],
      [2, 'Packaging · Demo', 'Packaging', 3800000],
      [3, 'Servicios · Demo', 'Servicios', 5500000],
    ] as const) {
      commands.push(
        statement(
          'INSERT INTO expenses(id,description,category,amount,date,methodId,actorId) VALUES (?,?,?,?,?,?,?)',
          `expense-demo-${n}`,
          description,
          category,
          amount,
          timestamp.slice(0, 10),
          'transfer',
          u.userId,
        ),
        statement(
          'INSERT INTO cash_movements(id,kind,amount,methodId,reference,actorId,createdAt) VALUES (?,?,?,?,?,?,?)',
          id(),
          'Gasto demo',
          -amount,
          'transfer',
          `expense-demo-${n}`,
          u.userId,
          timestamp,
        ),
      );
    }
    commands.push(
      statement(
        'INSERT INTO purchases(id,supplierId,total,createdAt,dueAt,actorId) VALUES (?,?,?,?,?,?)',
        'purchase-demo',
        'sup-demo',
        12579000,
        timestamp,
        new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
        u.userId,
      ),
      statement(
        'INSERT INTO purchase_items(id,purchaseId,variantId,quantity,cost) VALUES (?,?,?,?,?)',
        id(),
        'purchase-demo',
        'variant-1-0-1',
        5,
        2515800,
      ),
    );
    commands.push(
      statement(
        'INSERT INTO payables(id,description,amount,dueAt,kind) VALUES (?,?,?,?,?)',
        'payable-demo',
        'Servicio de internet · Demo',
        3500000,
        new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
        'Servicio',
      ),
    );
    commands.push(
      statement(
        'INSERT INTO promotions(id,name,percent,methodId,startsAt,endsAt) VALUES (?,?,?,?,?,?)',
        'promo-demo',
        'Beneficio efectivo · Demo',
        10,
        'cash',
        timestamp.slice(0, 10),
        new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
      ),
    );
  }
  commands.push(
    auditStatement(u.userId, 'Configuración inicial', 'business', null, {
      demo,
    }),
  );
  // One transaction: a competing initialization fails its unique owner insert and rolls back.
  await db().batch(commands);
  return { ok: true };
}
