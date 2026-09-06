import { z } from 'zod';
import { Actor, AppError, requirePermission } from './auth';
import { auditStatement, db, one, rows, statement } from '@/db/queries';
export async function inventoryDetail(a: Actor, id: string) {
  requirePermission(a, 'inventory');
  const count = await one<{id: string; status: string; createdAt: string; approvedAt: string | null}>(
    'SELECT id,status,createdAt,approvedAt FROM inventory_counts WHERE id=?',
    id,
  );
  if (!count) throw new AppError(404, 'Conteo no encontrado.');
  const items = await rows(
    'SELECT i.id,i.variantId,p.name,v.sku,v.color,v.size,i.expected,i.counted,i.counted-i.expected AS difference FROM inventory_count_items i JOIN variants v ON v.id=i.variantId JOIN products p ON p.id=v.productId WHERE i.countId=? ORDER BY p.name,v.sku',
    id,
  );
  return { ...count, items };
}
export async function editInventory(a: Actor, raw: unknown) {
  requirePermission(a, 'inventory');
  const input = z
    .object({
      id: z.string().min(1),
      items: z
        .array(
          z
            .object({
              id: z.string().min(1),
              counted: z.number().int().min(0).max(100000),
            })
            .strict(),
        )
        .min(1)
        .max(100),
    })
    .strict()
    .parse(raw);
  const before = await inventoryDetail(a, input.id);
  if (before.status !== 'draft')
    throw new AppError(409, 'El conteo ya fue aprobado.');
  if (
    new Set(input.items.map((i) => i.id)).size !== input.items.length ||
    input.items.length !== before.items.length ||
    input.items.some((i) => !before.items.some((r) => r.id === i.id))
  )
    throw new AppError(400, 'Revisá las prendas del conteo.');
  await db().batch([
    ...input.items.map((i) =>
      statement(
        "UPDATE inventory_count_items SET counted=? WHERE id=? AND countId=? AND EXISTS(SELECT 1 FROM inventory_counts WHERE id=? AND status='draft')",
        i.counted,
        i.id,
        input.id,
        input.id,
      ),
    ),
    auditStatement(a.id, 'Editar conteo', input.id, before.items, input.items),
  ]);
  return { ok: true };
}
