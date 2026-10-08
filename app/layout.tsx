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
  },
  metadataBase: new URL('https://www.fraguan.com'),
  alternates: { canonical: '/' },
  robots: { index: true, follow: true },
  twitter: { card: 'summary', title: 'FRAGUAN | Tienda oficial' },
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
      addressLocality: 'Isla Verde',
      addressRegion: 'Córdoba',
      postalCode: '2661',
      addressCountry: 'AR',
    },
    hasMerchantReturnPolicy: {
      '@type': 'MerchantReturnPolicy',
      applicableCountry: 'AR',
      returnPolicyCategory:
        'https://schema.org/MerchantReturnFiniteReturnWindow',
      merchantReturnDays: 10,
      returnMethod: [
        'https://schema.org/ReturnByMail',
        'https://schema.org/ReturnInStore',
      ],
      returnFees: 'https://schema.org/FreeReturn',
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
