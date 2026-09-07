import { z } from 'zod';
import {
  auditStatement,
  db,
  id,
  now,
  one,
  rows,
  statement,
} from '@/db/queries';
import { Actor, AppError, requirePermission } from './auth';

const locationInput = z
  .object({
    action: z.literal('location'),
    name: z.string().trim().min(2).max(100),
    code: z
      .string()
      .trim()
      .min(2)
      .max(30)
      .regex(/^[A-Za-z0-9-]+$/),
    kind: z.enum(['store', 'warehouse', 'other']),
    detail: z.string().trim().max(300).default(''),
  })
  .strict();
const transferInput = z
  .object({
    action: z.literal('transfer'),
    variantId: z.string().trim().min(1).max(100),
    fromLocationId: z.string().trim().min(1).max(100),
    toLocationId: z.string().trim().min(1).max(100),
    quantity: z.number().int().min(1).max(100000),
    notes: z.string().trim().max(500).default(''),
  })
  .strict();

export async function storageOverview(actor: Actor) {
  requirePermission(actor, 'storage');
  const [locations, inventory, transfers, salonShortages] = await Promise.all([
    rows(
      `SELECT l.id,l.name,l.code,l.kind,l.detail,l.priority,l.active,
              COALESCE(SUM(vls.quantity),0) AS units,
              COUNT(CASE WHEN vls.quantity>0 THEN 1 END) AS variants
         FROM stock_locations l
         LEFT JOIN variant_location_stock vls ON vls.locationId=l.id
        GROUP BY l.id ORDER BY l.priority,l.name`,
    ),
    rows(
      `SELECT v.id,p.name,v.sku,v.barcode,v.color,v.size,v.stock AS totalStock,
              l.id AS locationId,l.name AS location,l.code AS locationCode,
              l.kind,l.detail,vls.quantity,vls.updatedAt
         FROM variant_location_stock vls
         JOIN variants v ON v.id=vls.variantId
         JOIN products p ON p.id=v.productId
         JOIN stock_locations l ON l.id=vls.locationId
        WHERE vls.quantity>0
        ORDER BY p.name,v.color,v.size,l.priority,l.name`,
    ),
    rows(
      `SELECT t.id,t.createdAt,p.name,v.sku,v.color,v.size,t.quantity,
              source.name AS source,destination.name AS destination,
              t.notes,u.name AS actor
         FROM stock_transfers t
         JOIN variants v ON v.id=t.variantId
         JOIN products p ON p.id=v.productId
         JOIN stock_locations source ON source.id=t.fromLocationId
         JOIN stock_locations destination ON destination.id=t.toLocationId
         JOIN users u ON u.id=t.actorId
        ORDER BY t.createdAt DESC LIMIT 250`,
    ),
    rows(
      `SELECT v.id,p.name,v.sku,v.color,v.size,v.minimum,v.ideal,
              COALESCE(salon.quantity,0) AS salonStock,
              warehouse.locationId,location.name AS location,
              warehouse.quantity AS warehouseStock,
              MIN(warehouse.quantity,MAX(0,v.ideal-COALESCE(salon.quantity,0))) AS suggested
         FROM variants v
         JOIN products p ON p.id=v.productId
         JOIN variant_location_stock warehouse ON warehouse.variantId=v.id AND warehouse.quantity>0
         JOIN stock_locations location ON location.id=warehouse.locationId AND location.kind='warehouse'
         LEFT JOIN variant_location_stock salon ON salon.variantId=v.id AND salon.locationId='loc-salon'
        WHERE COALESCE(salon.quantity,0)<v.minimum
        ORDER BY suggested DESC,p.name,v.color,v.size`,
    ),
  ]);
  return { locations, inventory, transfers, salonShortages };
}

export async function storageWrite(actor: Actor, raw: unknown) {
  requirePermission(actor, 'storage');
  const action = z
    .looseObject({ action: z.enum(['location', 'transfer']) })
    .parse(raw).action;
  if (action === 'location') {
    const input = locationInput.parse(raw);
    const locationId = id();
    try {
      await db().batch([
        statement(
          `INSERT INTO stock_locations(id,name,code,kind,detail,priority,active,createdAt)
           VALUES (?,?,?,?,?,100,1,?)`,
          locationId,
          input.name,
          input.code.toUpperCase(),
          input.kind,
          input.detail,
          now(),
        ),
        auditStatement(actor.id, 'Crear ubicación de stock', locationId, null, {
          name: input.name,
          code: input.code.toUpperCase(),
          kind: input.kind,
        }),
      ]);
    } catch (cause) {
      if (cause instanceof Error && /UNIQUE/i.test(cause.message))
        throw new AppError(409, 'Ya existe una ubicación con ese código.');
      throw cause;
    }
    return storageOverview(actor);
  }

  const input = transferInput.parse(raw);
  if (input.fromLocationId === input.toLocationId)
    throw new AppError(400, 'Elegí dos ubicaciones diferentes.');
  const available = await one<{ quantity: number }>(
    `SELECT quantity FROM variant_location_stock
      WHERE variantId=? AND locationId=?`,
    input.variantId,
    input.fromLocationId,
  );
  if (!available || available.quantity < input.quantity)
    throw new AppError(409, 'No hay suficientes unidades en el origen.');
  const transferId = id();
  await db().batch([
    statement(
      `INSERT INTO stock_transfers(id,variantId,fromLocationId,toLocationId,quantity,actorId,notes,createdAt)
       VALUES (?,?,?,?,?,?,?,?)`,
      transferId,
      input.variantId,
      input.fromLocationId,
      input.toLocationId,
      input.quantity,
      actor.id,
      input.notes,
      now(),
    ),
    auditStatement(actor.id, 'Transferir stock', transferId, null, input),
  ]);
  return storageOverview(actor);
}
