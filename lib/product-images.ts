import { z } from 'zod';
import { Actor, AppError, can } from './auth';
import { auditStatement, db, id, now, one, statement } from '@/db/queries';

function authorize(actor: Actor) {
  if (!can(actor, 'products') && !can(actor, 'online-catalog'))
    throw new AppError(403, 'No tenés permiso para editar productos.');
}
export async function productImage(actor: Actor, productId: string) {
  authorize(actor);
  const image = await one<{ id: string; alt: string }>(
    `SELECT id,alt FROM product_images WHERE productId=? AND active=1`,
    productId,
  );
  return {
    image: image ? { ...image, url: `/api/store-image?id=${image.id}` } : null,
  };
}
export async function saveProductImage(actor: Actor, raw: unknown) {
  authorize(actor);
  const input = z
    .object({
      productId: z.string().min(1).max(100),
      mime: z.enum(['image/jpeg', 'image/png', 'image/webp']),
      base64: z.string().min(1).max(1_400_000),
      alt: z.string().trim().min(1).max(180),
    })
    .strict()
    .parse(raw);
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(input.base64))
    throw new AppError(400, 'La imagen no es válida.');
  let bytes: Uint8Array;
  try {
    bytes = Uint8Array.from(atob(input.base64), (c) => c.charCodeAt(0));
  } catch {
    throw new AppError(400, 'La imagen no es válida.');
  }
  const matches =
    input.mime === 'image/jpeg'
      ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
      : input.mime === 'image/png'
        ? [137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => bytes[i] === v)
        : String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' &&
          String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP';
  if (!matches || bytes.length > 1_000_000)
    throw new AppError(400, 'Usá una foto JPG, PNG o WebP de hasta 1 MB.');
  if (!(await one(`SELECT id FROM products WHERE id=?`, input.productId)))
    throw new AppError(404, 'Producto no encontrado.');
  const imageId = id();
  await db().batch([
    statement(
      // Lock the product row so concurrent replacements keep one active photo.
      // The photo itself belongs to product_images, not a products.image field.
      `UPDATE products SET id=id WHERE id=?`,
      input.productId,
    ),
    statement(
      `UPDATE product_images SET active=0 WHERE productId=? AND active=1`,
      input.productId,
    ),
    statement(
      `INSERT INTO product_images(id,productId,mime,contentBase64,alt,createdBy,createdAt) VALUES (?,?,?,?,?,?,?)`,
      imageId,
      input.productId,
      input.mime,
      input.base64,
      input.alt,
      actor.id,
      now(),
    ),
    auditStatement(actor.id, 'Cargar foto de producto', input.productId, null, {
      imageId,
      alt: input.alt,
    }),
  ]);
  return {
    image: {
      id: imageId,
      alt: input.alt,
      url: `/api/store-image?id=${imageId}`,
    },
  };
}
export async function publicProductImage(imageId: string) {
  if (!/^[a-zA-Z0-9-]{1,100}$/.test(imageId))
    throw new AppError(404, 'Imagen no encontrada.');
  const image = await one<{ mime: string; contentBase64: string }>(
    `SELECT mime,contentBase64 FROM product_images WHERE id=?`,
    imageId,
  );
  if (!image) throw new AppError(404, 'Imagen no encontrada.');
  return new Response(
    Uint8Array.from(atob(image.contentBase64), (c) => c.charCodeAt(0)),
    {
      headers: {
        'Content-Type': image.mime,
        'Cache-Control': 'public, max-age=31536000, immutable',
        'X-Content-Type-Options': 'nosniff',
      },
    },
  );
}
