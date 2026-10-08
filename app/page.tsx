import ComingSoon from './coming-soon';
import Storefront from './storefront';
import { isProductionComingSoon } from '@/lib/release-mode';
import { storeCatalog } from '@/lib/online-store';
import { seoOverride } from '@/lib/store-seo';
export async function generateMetadata() {
  const seo = await seoOverride('/');
  const title = seo.title || 'FRAGUAN | Tienda oficial';
  const description =
    seo.description ||
    'Indumentaria FRAGUAN. Comprá online por talle y color, con retiro en Isla Verde, Córdoba, y envíos a todo el país.';
  return {
    title,
    description,
    alternates: { canonical: '/' },
    openGraph: { title, description, url: '/' },
    twitter: { title, description },
    ...(seo.verification ? { verification: { google: seo.verification } } : {}),
  };
}

export default async function Home() {
  if (isProductionComingSoon()) return <ComingSoon />;
  const catalog = await storeCatalog();
  return <Storefront initialCatalog={catalog} />;
}
