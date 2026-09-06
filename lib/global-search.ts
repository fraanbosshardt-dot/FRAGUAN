import { rows } from '@/db/queries';
import { Actor, AppError, can } from './auth';

export async function globalSearch(actor: Actor, query: string) {
  if (['VENDEDOR', 'CAJA'].includes(actor.role))
    throw new AppError(403, 'Acceso denegado.');
  const term = query.trim().slice(0, 100);
  if (term.length < 2) return [];
  const like = `%${term.replace(/[\\%_]/g, '\\$&')}%`;
  const results: { id: string; title: string; detail: string; href: string }[] =
    [];
  if (can(actor, 'products')) {
    const found = await rows<{
      id: string;
      name: string;
      sku: string;
      color: string;
      size: string;
    }>(
      "SELECT v.id,p.name,v.sku,v.color,v.size FROM variants v JOIN products p ON p.id=v.productId WHERE p.active=1 AND (p.name||' '||v.sku||' '||v.barcode) LIKE ? ESCAPE '\\' LIMIT 8",
      like,
    );
    results.push(
      ...found.map((r) => ({
        id: `product-${r.id}`,
        title: r.name,
        detail: `${r.color} · ${r.size} · ${r.sku}`,
        href: `/admin/products?q=${encodeURIComponent(r.sku)}`,
      })),
    );
  }
  if (can(actor, 'customer-intelligence')) {
    const found = await rows<{ id: string; name: string; phone: string }>(
      "SELECT id,name||' '||surname AS name,phone FROM customers WHERE active=1 AND (name||' '||surname||' '||phone) LIKE ? ESCAPE '\\' LIMIT 8",
      like,
    );
    results.push(
      ...found.map((r) => ({
        id: `customer-${r.id}`,
        title: r.name,
        detail: `Cliente · ${r.phone}`,
        href: `/admin/customers?customer=${encodeURIComponent(r.id)}`,
      })),
    );
  }
  if (can(actor, 'sales')) {
    const found = await rows<{ id: string; ticket: number; createdAt: string }>(
      "SELECT id,ticket,createdAt FROM sales WHERE CAST(ticket AS TEXT) LIKE ? ESCAPE '\\' ORDER BY createdAt DESC LIMIT 8",
      like,
    );
    results.push(
      ...found.map((r) => ({
        id: `sale-${r.id}`,
        title: `Ticket #${r.ticket}`,
        detail: 'Venta',
        href: `/admin/sales?sale=${encodeURIComponent(r.id)}`,
      })),
    );
  }
  if (can(actor, 'suppliers')) {
    const found = await rows<{ id: string; name: string }>(
      "SELECT id,name FROM suppliers WHERE active=1 AND name LIKE ? ESCAPE '\\' LIMIT 8",
      like,
    );
    results.push(
      ...found.map((r) => ({
        id: `supplier-${r.id}`,
        title: r.name,
        detail: 'Proveedor',
        href: `/admin/suppliers?q=${encodeURIComponent(r.name)}`,
      })),
    );
  }
  if (can(actor, 'purchases')) {
    const found = await rows<{ id: string; name: string; status: string }>(
      "SELECT po.id,s.name,po.status FROM purchases po JOIN suppliers s ON s.id=po.supplierId WHERE (s.name||' '||COALESCE(po.supplierReference,'')) LIKE ? ESCAPE '\\' ORDER BY po.createdAt DESC LIMIT 8",
      like,
    );
    results.push(
      ...found.map((r) => ({
        id: `purchase-${r.id}`,
        title: `Orden · ${r.name}`,
        detail: 'Compra',
        href: `/admin/purchases?purchase=${encodeURIComponent(r.id)}`,
      })),
    );
  }
  if (can(actor, 'stock')) {
    const found = await rows<{
      id: string;
      name: string;
      reason: string;
      sku: string;
    }>(
      "SELECT sm.id,p.name,sm.reason,v.sku FROM stock_movements sm JOIN variants v ON v.id=sm.variantId JOIN products p ON p.id=v.productId WHERE (p.name||' '||v.sku||' '||sm.reason) LIKE ? ESCAPE '\\' ORDER BY sm.createdAt DESC LIMIT 8",
      like,
    );
    results.push(
      ...found.map((r) => ({
        id: `movement-${r.id}`,
        title: `${r.name} · ${r.reason}`,
        detail: 'Movimiento de stock',
        href: `/admin/stock?q=${encodeURIComponent(r.name)}`,
      })),
    );
  }
  return results;
}
