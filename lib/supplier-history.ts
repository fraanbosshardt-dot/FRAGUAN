import { Actor, AppError, requirePermission } from './auth';
import { one, rows } from '@/db/queries';
import { getBusinessReport } from './reporting';
export async function supplierHistory(a: Actor, supplierId: string) {
  requirePermission(a, 'suppliers');
  requirePermission(a, 'reports');
  const supplier = await one<{ id: string; name: string }>(
    'SELECT id,name FROM suppliers WHERE id=?',
    supplierId,
  );
  if (!supplier) throw new AppError(404, 'Proveedor no encontrado.');
  const to = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
  }).format(new Date());
  const from = new Date(Date.parse(`${to}T12:00:00Z`) - 364 * 86400000)
    .toISOString()
    .slice(0, 10);
  const [orders, stock, report] = await Promise.all([
    rows(
      'SELECT p.id,p.status,p.createdAt,p.dueAt,p.total,p.supplierReference,SUM(i.quantity) AS ordered,SUM(i.received) AS received FROM purchases p LEFT JOIN purchase_items i ON i.purchaseId=p.id WHERE p.supplierId=? GROUP BY p.id ORDER BY p.createdAt DESC LIMIT 250',
      supplierId,
    ),
    one<{ units: number; cost: number; retail: number }>(
      'SELECT COALESCE(SUM(v.stock),0) AS units,COALESCE(SUM(v.stock*v.cost),0) AS cost,COALESCE(SUM(v.stock*v.price),0) AS retail FROM variants v JOIN products p ON p.id=v.productId WHERE p.supplierId=? AND p.active=1',
      supplierId,
    ),
    getBusinessReport(a, { from, to, supplierId }),
  ]);
  return {
    supplier,
    orders,
    stock,
    period: { from, to },
    sales: report.current,
    rotation: stock?.units ? Number(report.current.units) / stock.units : null,
    products: report.breakdowns.products,
  };
}
