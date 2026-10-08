import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/producto/', '/coleccion/', '/informacion/', '/api/store-image'],
        disallow: [
          '/api/',
          '/staff-assets/',
          '/admin',
          '/admin-access',
          '/acceso',
          '/pos',
          '/checkout',
          '/cuenta',
          '/pedido/',
        ],
      },
      {
        userAgent: 'Claude-User',
        allow: ['/', '/admin', '/staff-assets/', '/api/store-image'],
        disallow: [
          '/api/',
          '/admin-access',
          '/acceso',
          '/pos',
          '/checkout',
          '/cuenta',
          '/pedido/',
        ],
      },
    ],
    sitemap: 'https://www.fraguan.com/sitemap.xml',
  };
}
