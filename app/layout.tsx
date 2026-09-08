import type { Metadata } from 'next';
import './globals.css';
import { StoreExperience } from '@/components/store-experience';
export const metadata: Metadata = {
  title: 'FRAGUAN | Tienda oficial',
  description:
    'Indumentaria FRAGUAN. Comprá online por talle y color, con envíos a todo el país y beneficios del Club.',
  openGraph: {
    title: 'FRAGUAN | Tienda oficial',
    description: 'Indumentaria FRAGUAN con envíos a todo el país.',
  },
  metadataBase: new URL('https://fraguan.com'),
  alternates: { canonical: '/' },
  robots: { index: true, follow: true },
  twitter: { card: 'summary', title: 'FRAGUAN | Tienda oficial' },
  icons: { icon: '/fraguan-logo.jpg' },
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const organization = {
    '@context': 'https://schema.org', '@type': ['Organization', 'OnlineStore'],
    '@id': 'https://fraguan.com/#organization', name: 'FRAGUAN', url: 'https://fraguan.com',
    logo: 'https://fraguan.com/fraguan-logo.jpg', email: 'atencion@fraguan.com',
    areaServed: { '@type': 'Country', name: 'Argentina' },
    hasMerchantReturnPolicy: {
      '@type': 'MerchantReturnPolicy', applicableCountry: 'AR',
      returnPolicyCategory: 'https://schema.org/MerchantReturnFiniteReturnWindow', merchantReturnDays: 10,
      returnMethod: ['https://schema.org/ReturnByMail', 'https://schema.org/ReturnInStore'],
      returnFees: 'https://schema.org/FreeReturn',
    },
  };
  const website = {
    '@context': 'https://schema.org', '@type': 'WebSite', '@id': 'https://fraguan.com/#website',
    url: 'https://fraguan.com', name: 'FRAGUAN', publisher: { '@id': 'https://fraguan.com/#organization' },
    potentialAction: { '@type': 'SearchAction', target: 'https://fraguan.com/tienda?search={search_term_string}', 'query-input': 'required name=search_term_string' },
  };
  return (
    <html lang="es-AR">
      <body><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(organization).replaceAll('<', '\\u003c') }} /><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(website).replaceAll('<', '\\u003c') }} />{children}<StoreExperience /></body>
    </html>
  );
}
