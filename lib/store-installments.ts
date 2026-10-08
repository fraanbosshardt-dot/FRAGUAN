import { z } from 'zod';
import { one, db, statement, auditStatement } from '@/db/queries';
import { Actor, requirePermission } from './auth';
const schema = z
  .object({
    enabled: z.boolean(),
    installments: z.union([
      z.literal(3),
      z.literal(6),
      z.literal(9),
      z.literal(12),
    ]),
    productIds: z.array(z.string().min(1).max(100)).max(500),
    providerConfirmed: z.boolean(),
    cft: z.number().min(0).max(1000).default(0),
  })
  .strict()
  .refine(
    (v) => !v.enabled || v.providerConfirmed,
    'Confirmá que Mercado Pago tiene habilitada la financiación sin interés para esta tienda.',
  );
export async function storeInstallments(): Promise<z.infer<typeof schema>> {
  const row = await one<{ value: string }>(
    `SELECT value FROM settings WHERE key='store-installments'`,
  );
  return row
    ? schema.parse(JSON.parse(row.value))
    : {
        enabled: false,
        installments: 3,
        productIds: [],
        providerConfirmed: false,
        cft: 0,
      };
}
export async function readInstallments(actor: Actor) {
  requirePermission(actor, 'online-catalog');
  return storeInstallments();
}
export async function saveInstallments(actor: Actor, raw: unknown) {
  requirePermission(actor, 'online-catalog');
  const config = schema.parse(raw);
  await db().batch([
    statement(
      `INSERT INTO settings(key,value) VALUES ('store-installments',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value`,
      JSON.stringify(config),
    ),
    auditStatement(
      actor.id,
      'Configurar cuotas sin interés online',
      'store-installments',
      await storeInstallments(),
      config,
    ),
  ]);
  return config;
}
