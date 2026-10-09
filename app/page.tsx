import ComingSoon from './coming-soon';
import Storefront from './storefront';
import { isProductionComingSoon } from '@/lib/release-mode';
import { storeCatalog } from '@/lib/online-store';
import { seoOverride } from '@/lib/store-seo';
import { HOME_SEO } from '@/lib/store-seo-data';
export async function generateMetadata() {
  const seo = await seoOverride('/');
  const title = seo.title || HOME_SEO.title;
  const description = seo.description || HOME_SEO.description;
  return {
    title,
    description,
    alternates: { canonical: '/' },
    openGraph: {
      title,
      description,
      url: '/',
      siteName: 'FRAGUAN',
      locale: 'es_AR',
      images: [{ url: '/fraguan-logo.jpg', alt: 'FRAGUAN · Ropa para hombre' }],
    },
    twitter: { title, description },
    ...(seo.verification ? { verification: { google: seo.verification } } : {}),
  };
}

export default async function Home() {
  if (isProductionComingSoon()) return <ComingSoon />;
  const catalog = await storeCatalog();
  return <Storefront initialCatalog={catalog} />;
}
