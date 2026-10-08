import { z } from 'zod';
import { one, rows, statement, auditStatement, db } from '@/db/queries';
import { Actor, requirePermission } from './auth';
import { publicOptionalLine } from './public-validation';
import { storeApiOrigin, publicStoreData } from './store-api';

export const STORE_ORIGIN = 'https://www.fraguan.com';
const pathSchema = z
  .string()
  .regex(
    /^\/$|^\/(producto|coleccion)\/[a-z0-9-]+$/,
    'Usá / o una ruta de producto o colección.',
  );
const schema = z
  .object({
    path: pathSchema,
    title: publicOptionalLine(70),
    description: publicOptionalLine(180),
    verification: z
      .string()
      .trim()
      .max(200)
      .regex(/^[a-zA-Z0-9_-]*$/, 'Pegá solo el código de verificación.'),
  })
  .strict();
export async function storeSeo(path = '/') {
  pathSchema.parse(path);
  if (storeApiOrigin())
    return publicStoreData<z.infer<typeof schema>>('store-seo', { path });
  const row = await one<{ value: string }>(
    'SELECT value FROM settings WHERE key=?',
    'store-seo:' + path,
  );
  return row
    ? schema.parse(JSON.parse(row.value))
    : { path, title: '', description: '', verification: '' };
}
export async function adminSeo(actor: Actor, path: string) {
  requirePermission(actor, 'marketing');
  return storeSeo(path);
}
export async function saveStoreSeo(actor: Actor, raw: unknown) {
  requirePermission(actor, 'marketing');
  const value = schema.parse(raw);
  await db().batch([
    statement(
      'INSERT INTO settings(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value',
      'store-seo:' + value.path,
      JSON.stringify(value),
    ),
    auditStatement(
      actor.id,
      'Actualizar SEO de la tienda',
      value.path,
      await storeSeo(value.path),
      value,
    ),
  ]);
  return value;
}
export async function seoOverride(path: string) {
  // An unavailable backend must not prevent Google or customers from reading a page.
  return storeSeo(path).catch(() => ({
    path,
    title: '',
    description: '',
    verification: '',
  }));
}

export async function seoAudit(actor: Actor) {
  requirePermission(actor,'marketing');
  const products=await rows<any>(`SELECT p.name,profile.slug,profile.shortDescription,(SELECT COUNT(*) FROM product_images im WHERE im.productId=p.id AND im.active=1) AS images FROM products p JOIN online_product_profiles profile ON profile.productId=p.id WHERE p.active=1 AND profile.published=1 ORDER BY p.name`);
  const overrides=await rows<{key:string;value:string}>(`SELECT key,value FROM settings WHERE key LIKE 'store-seo:%'`);
  const stored=new Map(overrides.map(r=>[r.key.slice(10),JSON.parse(r.value)]));
  const pages=products.map(p=>{const path='/producto/'+p.slug,custom=stored.get(path);const title=custom?.title||p.name+' | FRAGUAN',description=custom?.description||p.shortDescription;return {path,title,description,issues:[...(!p.images?['Falta cargar la foto del producto']:[]),...(!description?['Falta una descripción']:[]),...(title.length>70?['Título extenso']:[])]};});
  for(const page of pages)if(pages.filter(p=>p.title===page.title).length>1)page.issues.push('Título repetido');
  return {pages,sitemap:STORE_ORIGIN+'/sitemap.xml',searchConsole:'https://search.google.com/search-console?resource_id=sc-domain%3Afraguan.com'};
}
