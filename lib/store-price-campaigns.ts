import { z } from 'zod';
import { auditStatement, db, id, now, rows, statement } from '@/db/queries';
import { Actor, AppError, requirePermission } from './auth';

const inputSchema = z
  .object({
    name: z.string().trim().min(3).max(80),
    startsAt: z.iso.datetime(),
    endsAt: z.iso.datetime(),
    discount: z.number().int().min(1).max(80),
    variantIds: z.array(z.string().min(1)).min(1).max(500),
    referencePrices: z
      .record(z.string(), z.number().int().min(1).max(10000000000))
      .default({}),
  })
  .strict()
  .refine(
    (v) => Date.parse(v.endsAt) > Date.parse(v.startsAt),
    'El fin debe ser posterior al inicio.',
  );
export async function campaignPreview(actor: Actor, raw: unknown) {
  requirePermission(actor, 'online-catalog');
  const input = inputSchema.parse(raw);
  const ids = [...new Set(input.variantIds)];
  const variants = await rows<any>(
    `SELECT v.id,p.name,v.color,v.size,v.onlinePrice,v.price FROM variants v JOIN products p ON p.id=v.productId WHERE p.active=1 AND v.id IN (${ids.map(() => '?').join(',')})`,
    ...ids,
  );
  if (variants.length !== ids.length)
    throw new AppError(
      400,
      'Alguna variante ya no está disponible. Actualizá los datos.',
    );
  return {
    input,
    items: variants.map((v) => ({
      ...v,
      originalPrice: v.onlinePrice ?? v.price,
      referencePrice: input.referencePrices[v.id] ?? v.onlinePrice ?? v.price,
      campaignPrice: Math.max(
        1,
        Math.round(
          ((input.referencePrices[v.id] ?? v.onlinePrice ?? v.price) *
            (100 - input.discount)) /
            100,
        ),
      ),
    })),
  };
}
export async function campaignOverview(actor: Actor) {
  requirePermission(actor, 'online-catalog');
  return {
    campaigns: await rows(
      `SELECT c.*, (SELECT COUNT(*) FROM store_price_campaign_items i WHERE i.campaignId=c.id) AS variants, (SELECT COUNT(*) FROM store_price_campaign_items i WHERE i.campaignId=c.id AND i.status='skipped') AS skipped FROM store_price_campaigns c ORDER BY createdAt DESC LIMIT 50`,
    ),
    variants: await rows(
      `SELECT v.id,v.productId,p.name,v.color,v.size,COALESCE(v.onlinePrice,v.price) AS price FROM variants v JOIN products p ON p.id=v.productId JOIN online_product_profiles f ON f.productId=p.id WHERE p.active=1 AND f.published=1 ORDER BY p.name,v.color,v.size`,
    ),
  };
}
export async function campaignWrite(actor: Actor, raw: any) {
  requirePermission(actor, 'online-catalog');
  if (raw.action === 'preview') return campaignPreview(actor, raw.config);
  if (raw.action === 'create') {
    const preview = await campaignPreview(actor, raw.config),
      campaignId = id();
    if (Date.parse(preview.input.endsAt) <= Date.now())
      throw new AppError(400, 'La campaña debe finalizar en el futuro.');
    await db().batch([
      statement(
        `INSERT INTO store_price_campaigns(id,name,startsAt,endsAt,createdBy,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?)`,
        campaignId,
        preview.input.name,
        preview.input.startsAt,
        preview.input.endsAt,
        actor.id,
        now(),
        now(),
      ),
      ...preview.items.map((v) =>
        statement(
          `INSERT INTO store_price_campaign_items(id,campaignId,variantId,originalOnlinePrice,originalPrice,referencePrice,campaignPrice) VALUES (?,?,?,?,?,?,?)`,
          id(),
          campaignId,
          v.id,
          v.onlinePrice,
          v.originalPrice,
          v.referencePrice,
          v.campaignPrice,
        ),
      ),
      auditStatement(
        actor.id,
        'Programar campaña online',
        campaignId,
        null,
        preview.input,
      ),
    ]);
    return { ok: true };
  }
  const input = z
    .object({ action: z.enum(['restore', 'cancel']), id: z.string().min(1) })
    .strict()
    .parse(raw);
  await restoreCampaign(input.id, actor.id);
  return { ok: true };
}
async function restoreCampaign(campaignId: string, actorId?: string) {
  const commands = [
    // The campaign row serializes restorations against activation on PostgreSQL.
    statement(
      `UPDATE store_price_campaigns SET status='restoring',updatedAt=? WHERE id=? AND status IN ('scheduled','active')`,
      now(),
      campaignId,
    ),
    statement(
      `UPDATE variants SET onlinePrice=(SELECT i.originalOnlinePrice FROM store_price_campaign_items i WHERE i.campaignId=? AND i.variantId=variants.id),updatedAt=? WHERE id IN (SELECT i.variantId FROM store_price_campaign_items i JOIN store_price_campaigns c ON c.id=i.campaignId WHERE c.id=? AND c.status='restoring' AND i.status='active' AND variants.onlinePrice=i.campaignPrice)`,
      campaignId,
      now(),
      campaignId,
    ),
    statement(
      `UPDATE store_price_campaign_items SET status=CASE WHEN status='scheduled' THEN 'cancelled' WHEN status='active' AND (SELECT v.onlinePrice FROM variants v WHERE v.id=variantId) = originalOnlinePrice OR (status='active' AND originalOnlinePrice IS NULL AND (SELECT v.onlinePrice FROM variants v WHERE v.id=variantId) IS NULL) THEN 'restored' ELSE 'skipped' END WHERE campaignId=? AND EXISTS (SELECT 1 FROM store_price_campaigns c WHERE c.id=? AND c.status='restoring')`,
      campaignId,
      campaignId,
    ),
    statement(
      `UPDATE store_price_campaigns SET status='restored',updatedAt=? WHERE id=? AND status='restoring'`,
      now(),
      campaignId,
    ),
  ];
  if (actorId)
    commands.push(
      auditStatement(actorId, 'Restaurar precios de campaña', campaignId),
    );
  await db().batch(commands);
}
export async function runPriceCampaigns() {
  const campaigns = await rows<any>(
    `SELECT * FROM store_price_campaigns WHERE status IN ('scheduled','active') ORDER BY startsAt`,
  );
  for (const campaign of campaigns) {
    if (campaign.endsAt <= now()) {
      await restoreCampaign(campaign.id);
      continue;
    }
    if (campaign.status !== 'scheduled' || campaign.startsAt > now()) continue;
    const appliedAt = now();
    await db().batch([
      statement(
        `UPDATE store_price_campaigns SET status='active',updatedAt=? WHERE id=? AND status='scheduled'`,
        appliedAt,
        campaign.id,
      ),
      statement(
        `UPDATE store_price_campaign_items SET status='active',appliedAt=? WHERE campaignId=? AND status='scheduled' AND originalPrice=(SELECT COALESCE(v.onlinePrice,v.price) FROM variants v WHERE v.id=variantId) AND ((originalOnlinePrice IS NULL AND (SELECT v.onlinePrice FROM variants v WHERE v.id=variantId) IS NULL) OR originalOnlinePrice=(SELECT v.onlinePrice FROM variants v WHERE v.id=variantId)) AND NOT EXISTS(SELECT 1 FROM store_price_campaign_items other WHERE other.variantId=store_price_campaign_items.variantId AND other.campaignId<>? AND other.status='active')`,
        appliedAt,
        campaign.id,
        campaign.id,
      ),
      statement(
        `UPDATE variants SET onlinePrice=(SELECT i.campaignPrice FROM store_price_campaign_items i WHERE i.campaignId=? AND i.variantId=variants.id),updatedAt=? WHERE id IN (SELECT i.variantId FROM store_price_campaign_items i WHERE i.campaignId=? AND i.status='active' AND i.appliedAt=? AND i.originalPrice=COALESCE(variants.onlinePrice,variants.price))`,
        campaign.id,
        appliedAt,
        campaign.id,
        appliedAt,
      ),
      statement(
        `UPDATE store_price_campaign_items SET status='skipped' WHERE campaignId=? AND (status='scheduled' OR (status='active' AND appliedAt=? AND NOT EXISTS (SELECT 1 FROM variants v WHERE v.id=variantId AND v.updatedAt=? AND v.onlinePrice=campaignPrice)))`,
        campaign.id,
        appliedAt,
        appliedAt,
      ),
    ]);
  }
  return { checked: campaigns.length };
}
