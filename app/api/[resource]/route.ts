import {
  actor,
  identity,
  can,
  requirePermission,
  protectWrite,
  reply,
  fail,
  AppError,
} from '@/lib/auth';
import {
  one,
  rows,
  statement,
  db,
  id,
  now,
  auditStatement,
} from '@/db/queries';
import { setup } from '@/lib/seed';
import { customerInput } from '@/lib/validation';
import {
  confirmSale,
  quote,
  publicQuote,
  saleDetail,
  refundSale,
} from '@/lib/sales';
import { adminWrite, adminAction, dashboard } from '@/lib/admin';
import { z } from 'zod';
import { configureMethod, addVariant } from '@/lib/configuration';
export const dynamic = 'force-dynamic';
export async function GET(
  req: Request,
  { params }: { params: Promise<{ resource: string }> },
) {
  try {
    const { resource } = await params;
    const url = new URL(req.url);
    if (resource === 'session') {
      const u = await identity();
      const configured = await one(
        'SELECT value FROM settings WHERE key=?',
        'owner',
      );
      if (!configured) return reply({ needsSetup: true, name: u.displayName });
      const a = await actor();
      return reply({
        user: a,
        demo:
          (
            await one<{ value: string }>(
              'SELECT value FROM settings WHERE key=?',
              'demo',
            )
          )?.value === '1',
        permissions: [
          'pos',
          'dashboard',
          'products',
          'stock',
          'customers',
          'sales',
          'suppliers',
          'purchases',
          'cash',
          'expenses',
          'payables',
          'withdrawals',
          'promotions',
          'reports',
          'inventory',
          'insights',
          'users',
          'audit',
          'settings',
        ].filter((p) => can(a, p)),
      });
    }
    const a = await actor();
    if (resource === 'catalog') {
      requirePermission(a, 'pos');
      return reply(
        await rows(
          'SELECT v.id,v.productId,p.name,p.category,p.brand,p.image,v.sku,v.barcode,v.color,v.size,v.price,v.stock FROM variants v JOIN products p ON p.id=v.productId WHERE p.active=1 ORDER BY p.rowid,v.rowid',
        ),
      );
    }
    if (resource === 'methods') {
      requirePermission(a, 'pos');
      return reply(
        await rows(
          'SELECT id,name,surchargeBps,installments FROM payment_methods WHERE active=1',
        ),
      );
    }
    if (resource === 'offers') {
      requirePermission(a, 'pos');
      return reply(
        await rows(
          'SELECT id,name,percent,methodId FROM promotions WHERE active=1 AND startsAt<=? AND endsAt>=?',
          now().slice(0, 10),
          now().slice(0, 10),
        ),
      );
    }
    if (resource === 'customers') {
      requirePermission(a, 'customers');
      const q = url.searchParams.get('q')?.slice(0, 100) ?? '';
      if (a.role === 'VENDEDOR' || a.role === 'CAJA') {
        if (q.length < 2) return reply([]);
        return reply(
          await rows(
            "SELECT id,name,surname,phone FROM customers WHERE name||' '||surname LIKE ? OR phone LIKE ? LIMIT 15",
            `%${q}%`,
            `%${q}%`,
          ),
        );
      }
      return reply(
        await rows(
          "SELECT c.id,c.name,c.surname,c.phone,c.email,c.points,c.createdAt,COUNT(s.id) AS purchases,COALESCE(SUM(s.total),0) AS spent,MAX(s.createdAt) AS lastPurchase FROM customers c LEFT JOIN sales s ON s.customerId=c.id AND s.status='confirmed' WHERE c.name||' '||c.surname LIKE ? OR c.phone LIKE ? GROUP BY c.id ORDER BY c.createdAt DESC LIMIT 500",
          `%${q}%`,
          `%${q}%`,
        ),
      );
    }
    if (resource === 'sales') {
      if (!can(a, 'sales') && !can(a, 'own-sales'))
        throw new AppError(403, 'Acceso denegado.');
      if (url.searchParams.has('id'))
        return reply(await saleDetail(a, url.searchParams.get('id')!));
      if (can(a, 'sales'))
        return reply(
          await rows(
            'SELECT s.id,s.ticket,s.total,s.createdAt,s.status,u.name AS sellerName,c.name AS customerName FROM sales s JOIN users u ON u.id=s.sellerId LEFT JOIN customers c ON c.id=s.customerId ORDER BY s.createdAt DESC LIMIT 200',
          ),
        );
      const days = Number(
        (
          await one<{ value: string }>(
            'SELECT value FROM settings WHERE key=?',
            'recentDays',
          )
        )?.value || 0,
      );
      if (!days)
        throw new AppError(403, 'Consulta de ventas recientes deshabilitada.');
      return reply(
        await rows(
          'SELECT id,ticket,total,createdAt,status FROM sales WHERE sellerId=? AND createdAt>=? ORDER BY createdAt DESC LIMIT 50',
          a.id,
          new Date(Date.now() - days * 86400000).toISOString(),
        ),
      );
    }
    requirePermission(a, resource);
    if (['dashboard', 'reports', 'insights'].includes(resource))
      return reply(await dashboard());
    if (resource === 'products' || resource === 'stock')
      return reply(
        await rows(
          'SELECT v.id,v.productId,p.name,p.category,p.brand,v.sku,v.barcode,v.color,v.size,v.price,v.cost,v.stock,v.minimum FROM variants v JOIN products p ON p.id=v.productId WHERE p.active=1 ORDER BY p.rowid,v.rowid',
        ),
      );
    if (resource === 'suppliers')
      return reply(
        await rows(
          'SELECT id,name,phone,email,terms FROM suppliers WHERE active=1',
        ),
      );
    if (resource === 'purchases')
      return reply(
        await rows(
          'SELECT p.id,s.name AS supplier,p.total,p.status,p.createdAt,p.dueAt FROM purchases p JOIN suppliers s ON s.id=p.supplierId ORDER BY p.createdAt DESC',
        ),
      );
    if (resource === 'expenses')
      return reply(
        await rows(
          'SELECT id,category,description,amount,date,methodId FROM expenses ORDER BY date DESC',
        ),
      );
    if (resource === 'withdrawals')
      return reply(
        await rows(
          'SELECT id,person,amount,reason,methodId,createdAt FROM withdrawals ORDER BY createdAt DESC',
        ),
      );
    if (resource === 'payables')
      return reply(
        await rows(
          'SELECT p.id,p.description,p.amount,p.dueAt,p.kind,p.status,s.name AS supplier FROM payables p LEFT JOIN suppliers s ON s.id=p.supplierId ORDER BY p.dueAt',
        ),
      );
    if (resource === 'promotions')
      return reply(
        await rows(
          'SELECT id,name,percent,methodId,startsAt,endsAt,active FROM promotions ORDER BY startsAt DESC',
        ),
      );
    if (resource === 'users')
      return reply(await rows('SELECT id,name,email,role,active FROM users'));
    if (resource === 'audit')
      return reply(
        await rows(
          'SELECT l.id,u.name AS actor,l.action,l.entityId,l.before,l.after,l.createdAt FROM audit_log l LEFT JOIN users u ON u.id=l.actorId ORDER BY l.createdAt DESC LIMIT 200',
        ),
      );
    if (resource === 'inventory')
      return reply(
        await rows(
          'SELECT c.id,c.status,c.createdAt,c.approvedAt,COUNT(i.id) AS variants,SUM(i.counted-i.expected) AS difference FROM inventory_counts c LEFT JOIN inventory_count_items i ON i.countId=c.id GROUP BY c.id ORDER BY c.createdAt DESC',
        ),
      );
    if (resource === 'cash') {
      const session = await one(
        'SELECT id,opening,openedAt,closedAt,counted,expected,difference FROM cash_sessions ORDER BY openedAt DESC LIMIT 1',
      );
      return reply({
        session,
        movements: await rows(
          'SELECT id,kind,amount,methodId,reference,createdAt FROM cash_movements WHERE sessionId=? ORDER BY createdAt DESC',
          session?.id ?? '',
        ),
        balance: await one(
          "SELECT COALESCE(SUM(amount),0) AS amount FROM cash_movements WHERE sessionId=? AND methodId='cash'",
          session?.id ?? '',
        ),
      });
    }
    if (resource === 'settings')
      return reply({
        recentDays: Number(
          (
            await one<{ value: string }>(
              'SELECT value FROM settings WHERE key=?',
              'recentDays',
            )
          )?.value ?? 0,
        ),
        methods: await rows(
          'SELECT id,name,surchargeBps,commissionBps,days,installments FROM payment_methods',
        ),
      });
    throw new AppError(403, 'Acceso denegado.');
  } catch (e) {
    return fail(e);
  }
}
export async function POST(
  req: Request,
  { params }: { params: Promise<{ resource: string }> },
) {
  try {
    protectWrite(req);
    const { resource } = await params;
    const body = await req.json();
    if (resource === 'setup') {
      const x = z.object({ demo: z.boolean() }).strict().parse(body);
      return reply(await setup(x.demo), 201);
    }
    const a = await actor();
    if (resource === 'customers') {
      requirePermission(a, 'customers');
      const x = customerInput.parse(body),
        key = id();
      await db().batch([
        statement(
          'INSERT INTO customers(id,name,surname,phone,createdAt) VALUES (?,?,?,?,?)',
          key,
          x.name,
          x.surname,
          x.phone,
          now(),
        ),
        auditStatement(a.id, 'Crear cliente', key),
      ]);
      return reply({ id: key, ...x }, 201);
    }
    if (resource === 'quote') {
      requirePermission(a, 'pos');
      return reply(publicQuote(await quote(body)));
    }
    if (resource === 'sales') {
      requirePermission(a, 'pos');
      return reply(await confirmSale(a, body), 201);
    }
    if (resource === 'refunds') {
      requirePermission(a, 'refunds');
      return reply(await refundSale(a, body));
    }
    if (resource === 'actions') return reply(await adminAction(a, body));
    if (resource === 'configure-method')
      return reply(await configureMethod(a, body));
    if (resource === 'variants') return reply(await addVariant(a, body), 201);
    return reply(await adminWrite(resource, a, body), 201);
  } catch (e) {
    return fail(e);
  }
}
