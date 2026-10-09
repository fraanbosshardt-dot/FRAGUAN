import type { StoreProduct } from './store-client';

export const STORE_ORIGIN = 'https://www.fraguan.com';
export const HOME_SEO = {
  path: '/',
  title: 'FRAGUAN | Ropa para hombre · Tienda online',
  description:
    'Ropa para hombre en FRAGUAN. Elegí talle y color, comprá online con envíos por Correo Argentino o retiro en nuestra tienda de Isla Verde, Córdoba.',
};
export const INFORMATION_SEO: Record<
  string,
  { title: string; description: string }
> = {
  envios: {
    title: 'Envíos y retiro en tienda | FRAGUAN',
    description:
      'Envíos a domicilio con Correo Argentino y retiro en Isla Verde, Córdoba. Consultá preparación, plazos y seguimiento de tu pedido.',
  },
  cambios: {
    title: 'Cambios y devoluciones | FRAGUAN',
    description:
      'Consultá las condiciones para cambios de talle o color, productos con inconvenientes y devoluciones de compras online en FRAGUAN.',
  },
  pagos: {
    title: 'Métodos de pago | FRAGUAN',
    description:
      'Pagá con tarjeta mediante Mercado Pago o por transferencia. Consultá cómo confirmar el pago de tu compra online en FRAGUAN.',
  },
  talles: {
    title: 'Guía de talles | FRAGUAN',
    description:
      'Encontrá orientación para elegir tu talle y revisar el calce de las prendas antes de comprar online en FRAGUAN.',
  },
  contacto: {
    title: 'Contacto y horarios de la tienda | FRAGUAN',
    description:
      'Contactá a FRAGUAN en hola@fraguan.com. Encontranos en Sarmiento 785, Isla Verde, Córdoba. Consultá horarios y atención al cliente.',
  },
  terminos: {
    title: 'Términos y condiciones | FRAGUAN',
    description:
      'Conocé las condiciones de compra online, pagos, entregas y atención de pedidos en la tienda FRAGUAN.',
  },
  privacidad: {
    title: 'Privacidad | FRAGUAN',
    description:
      'Conocé cómo FRAGUAN utiliza y protege tus datos al navegar, crear una cuenta y realizar compras online.',
  },
  cookies: {
    title: 'Cookies | FRAGUAN',
    description:
      'Consultá el uso de cookies de FRAGUAN y las opciones para gestionar tus preferencias de navegación y medición.',
  },
};
export const COLLECTION_NAMES: Record<string, string> = {
  nuevos: 'Nuevos',
  camisas: 'Camisas',
  remeras: 'Remeras',
  pantalones: 'Pantalones',
  camperas: 'Camperas',
  abrigos: 'Camperas',
  accesorios: 'Accesorios',
  jeans: 'Jeans',
  buzos: 'Buzos',
  chombas: 'Chombas',
};
export function collectionSlug(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}
export function collectionSeo(key: string) {
  const canonicalKey = key === 'abrigos' ? 'camperas' : key;
  const name = COLLECTION_NAMES[key] || key.replaceAll('-', ' ');
  return {
    path: `/coleccion/${canonicalKey}`,
    name,
    title:
      key === 'nuevos'
        ? 'Novedades en ropa para hombre | FRAGUAN'
        : `${name} para hombre | FRAGUAN`,
    description: `Comprá ${name.toLowerCase()} en FRAGUAN. Elegí talle y color, con envíos por Correo Argentino o retiro en Isla Verde, Córdoba.`,
  };
}
export function productSeo(
  product: Pick<StoreProduct, 'name' | 'shortDescription' | 'category'>,
) {
  const ownDescription = product.shortDescription?.trim();
  return {
    title: `${product.name} | FRAGUAN`,
    description:
      (ownDescription !== 'Una prenda versátil para usar todos los días.'
        ? ownDescription
        : '') ||
      `${product.name} en FRAGUAN. Consultá talles, colores y stock disponible. Comprá online con envío o retiro en Isla Verde, Córdoba.`,
  };
}
export function productStructuredData(product: StoreProduct) {
  const url = `${STORE_ORIGIN}/producto/${product.slug}`;
  const image = product.imageUrl
    ? new URL(product.imageUrl, STORE_ORIGIN).href
    : undefined;
  const ownDescription = product.description?.trim();
  return {
    '@context': 'https://schema.org',
    '@type': 'ProductGroup',
    '@id': `${url}#product`,
    name: product.name,
    url,
    ...(image ? { image } : {}),
    description:
      (ownDescription !==
      'Diseñada para combinar fácil, sentirse cómoda y acompañarte durante todo el día.'
        ? ownDescription
        : '') || productSeo(product).description,
    ...(product.brand
      ? { brand: { '@type': 'Brand', name: product.brand } }
      : {}),
    ...(product.material &&
    product.material !== 'Consultar composición en la etiqueta.'
      ? { material: product.material }
      : {}),
    productGroupID: product.id,
    variesBy: ['https://schema.org/color', 'https://schema.org/size'],
    hasVariant: product.variants.map((variant) => ({
      '@type': 'Product',
      '@id': `${url}#${encodeURIComponent(variant.id)}`,
      name: `${product.name} · ${variant.color} · ${variant.size}`,
      sku: variant.sku,
      description: productSeo(product).description,
      ...(image ? { image } : {}),
      color: variant.color,
      size: variant.size,
      offers: {
        '@type': 'Offer',
        priceCurrency: 'ARS',
        price: variant.price / 100,
        itemCondition: 'https://schema.org/NewCondition',
        availability:
          variant.stock > 0
            ? 'https://schema.org/InStock'
            : 'https://schema.org/OutOfStock',
        seller: { '@id': `${STORE_ORIGIN}/#organization` },
        url: `${url}?variant=${encodeURIComponent(variant.sku)}`,
      },
    })),
  };
}
