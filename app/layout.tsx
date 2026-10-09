import type { Metadata } from 'next';
import './globals.css';
import './store-design.css';
import { StoreDesignBoundary } from '@/components/store-design';
import { StoreExperience } from '@/components/store-experience';
export const metadata: Metadata = {
  title: 'FRAGUAN | Tienda oficial',
  description:
    'Indumentaria FRAGUAN. Comprá online por talle y color, con envíos a todo el país y retiro en Isla Verde, Córdoba.',
  openGraph: {
    title: 'FRAGUAN | Tienda oficial',
    description: 'Indumentaria FRAGUAN con envíos a todo el país.',
    locale: 'es_AR',
    siteName: 'FRAGUAN',
    images: [{ url: '/fraguan-logo.jpg', alt: 'FRAGUAN · Tienda oficial' }],
  },
  metadataBase: new URL('https://www.fraguan.com'),
  alternates: { canonical: '/' },
  robots: { index: true, follow: true },
  twitter: {
    card: 'summary_large_image',
    title: 'FRAGUAN | Tienda oficial',
    images: ['/fraguan-logo.jpg'],
  },
  icons: { icon: '/fraguan-icon.png' },
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const organization = {
    '@context': 'https://schema.org',
    '@type': ['Organization', 'OnlineStore'],
    '@id': 'https://www.fraguan.com/#organization',
    name: 'FRAGUAN',
    url: 'https://www.fraguan.com',
    logo: 'https://www.fraguan.com/fraguan-logo.jpg',
    email: 'hola@fraguan.com',
    areaServed: { '@type': 'Country', name: 'Argentina' },
    address: {
      '@type': 'PostalAddress',
      streetAddress: 'Sarmiento 785',
      addressLocality: 'Isla Verde',
      addressRegion: 'Córdoba',
      addressCountry: 'AR',
    },
    hasMerchantReturnPolicy: {
      '@type': 'MerchantReturnPolicy',
      merchantReturnLink: 'https://www.fraguan.com/informacion/cambios',
    },
  };
  const website = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': 'https://www.fraguan.com/#website',
    url: 'https://www.fraguan.com',
    name: 'FRAGUAN',
    publisher: { '@id': 'https://www.fraguan.com/#organization' },
    potentialAction: {
      '@type': 'SearchAction',
      target: 'https://www.fraguan.com/tienda?search={search_term_string}',
      'query-input': 'required name=search_term_string',
    },
  };
  return (
    <html lang="es-AR">
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(organization).replaceAll('<', '\\u003c'),
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(website).replaceAll('<', '\\u003c'),
          }}
        />
        <StoreDesignBoundary>{children}</StoreDesignBoundary>
        <StoreExperience />
      </body>
    </html>
  );
}
