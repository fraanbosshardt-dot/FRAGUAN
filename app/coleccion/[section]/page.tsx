import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Storefront from '@/app/storefront';
import ComingSoon from '@/app/coming-soon';
import { isProductionComingSoon } from '@/lib/release-mode';
import { storeCatalog } from '@/lib/online-store';
import { seoOverride } from '@/lib/store-seo';
import {
  COLLECTION_NAMES,
  collectionSeo,
  collectionSlug,
} from '@/lib/store-seo-data';

const names = COLLECTION_NAMES;
export async function generateMetadata({
  params,
}: {
  params: Promise<{ section: string }>;
}): Promise<Metadata> {
  const key = (await params).section.toLowerCase();
  const defaults = collectionSeo(key);
  const seo = await seoOverride(defaults.path);
  const title = seo.title || defaults.title;
  const description = seo.description || defaults.description;
  return {
    title,
    description,
    alternates: { canonical: defaults.path },
    openGraph: {
      title,
      description,
      url: defaults.path,
      siteName: 'FRAGUAN',
      locale: 'es_AR',
      images: [{ url: '/fraguan-logo.jpg', alt: 'FRAGUAN' }],
    },
    twitter: { title, description },
  };
}
export default async function Page({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  if (isProductionComingSoon()) return <ComingSoon />;
  const key = (await params).section.toLowerCase();
  const initialSection = names[key] || key.replaceAll('-', ' ');
  const catalog = await storeCatalog();
  if (
    !names[key] &&
    !catalog.sections.some((s) => collectionSlug(s.name) === key)
  )
    notFound();
  return (
    <Storefront initialSection={initialSection} initialCatalog={catalog} />
  );
}
