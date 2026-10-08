import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Storefront from '@/app/storefront';
import ComingSoon from '@/app/coming-soon';
import { isProductionComingSoon } from '@/lib/release-mode';
import { storeCatalog } from '@/lib/online-store';
import { seoOverride } from '@/lib/store-seo';

const names: Record<string, string> = {
  nuevos: 'Nuevos',
  camisas: 'Camisas',
  remeras: 'Remeras',
  pantalones: 'Pantalones',
  camperas: 'Camperas',
  abrigos: 'Camperas',
  accesorios: 'Accesorios',
  jeans: 'Jeans',
  buzos: 'Buzos',
  chombas: 'Chombas',
};
export async function generateMetadata({
  params,
}: {
  params: Promise<{ section: string }>;
}): Promise<Metadata> {
  const key = (await params).section.toLowerCase();
  const name = names[key] || key.replaceAll('-', ' ');
  const canonicalKey = key === 'abrigos' ? 'camperas' : key;
  const seo = await seoOverride(`/coleccion/${canonicalKey}`);
  const title = seo.title || `${name} para hombre | FRAGUAN`;
  const description =
    seo.description ||
    `Comprá ${name.toLowerCase()} FRAGUAN por talle y color, con retiro y envíos a todo el país.`;
  return {
    title,
    description,
    alternates: { canonical: `/coleccion/${canonicalKey}` },
    openGraph: { title, description, url: `/coleccion/${canonicalKey}` },
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
  if (!names[key] && !catalog.sections.some(s=>s.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g,"-")===key)) notFound();
  return (
    <Storefront initialSection={initialSection} initialCatalog={catalog} />
  );
}
