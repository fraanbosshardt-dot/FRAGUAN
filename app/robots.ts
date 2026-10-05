import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: ['/', '/producto/', '/coleccion/', '/informacion/'],
      disallow: [
        '/api/',
        '/admin',
        '/admin-access',
        '/acceso',
        '/pos',
        '/checkout',
        '/cuenta',
        '/pedido/',
      ],
    },
    sitemap: 'https://fraguan.com/sitemap.xml',
  };
}
