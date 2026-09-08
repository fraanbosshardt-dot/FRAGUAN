import type { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const origin = 'https://fraguan.com';
  return ['tienda', 'informacion/envios', 'informacion/cambios', 'informacion/pagos', 'informacion/talles', 'informacion/contacto', 'informacion/terminos', 'informacion/privacidad', 'informacion/cookies', 'arrepentimiento'].map((path) => ({
    url: `${origin}/${path}`,
    lastModified: new Date(),
    changeFrequency: path === 'tienda' ? 'daily' : 'monthly',
    priority: path === 'tienda' ? 1 : 0.5,
  }));
}
