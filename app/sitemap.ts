import type { MetadataRoute } from 'next';
import { storeCatalog } from '@/lib/online-store';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = 'https://www.fraguan.com';
  const staticPages: MetadataRoute.Sitemap = [
    '',
    'informacion/envios',
    'informacion/cambios',
    'informacion/pagos',
    'informacion/talles',
    'informacion/contacto',
    'informacion/terminos',
    'informacion/privacidad',
    'informacion/cookies',
    'arrepentimiento',
  ].map((path) => ({
    url: path ? `${origin}/${path}` : origin,

    changeFrequency: path === '' ? 'daily' : 'monthly',
    priority: path === '' ? 1 : 0.5,
  }));
  try {
    const catalog = await storeCatalog();
    const slug = (value: string) =>
      value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
    return [
      ...staticPages,
      ...['Nuevos', ...catalog.sections.map((section) => section.name)]
        .filter((name, index, all) => all.indexOf(name) === index)
        .map((name) => ({
          url: `${origin}/coleccion/${slug(name)}`,
          changeFrequency: 'daily' as const,
          priority: 0.8,
        })),
      ...catalog.products.map((product) => ({
        url: `${origin}/producto/${product.slug}`,
        changeFrequency: 'weekly' as const,
        priority: 0.9,
      })),
    ];
  } catch {
    return staticPages;
  }
}
