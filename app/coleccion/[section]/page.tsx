import type { Metadata } from 'next';
import Storefront from '@/app/storefront';
import ComingSoon from '@/app/coming-soon';
import { isProductionComingSoon } from '@/lib/release-mode';

const names: Record<string, string> = {
  nuevos: 'Nuevos', camisas: 'Camisas', remeras: 'Remeras', pantalones: 'Pantalones',
  camperas: 'Camperas', abrigos: 'Camperas', accesorios: 'Accesorios',
};
export async function generateMetadata({ params }: { params: Promise<{ section: string }> }): Promise<Metadata> {
  const key = (await params).section.toLowerCase();
  const name = names[key] || key.replaceAll('-', ' ');
  return {
    title: `${name} para hombre | FRAGUAN`,
    description: `Comprá ${name.toLowerCase()} FRAGUAN por talle y color. Stock conectado con el local, retiro y envíos a todo el país.`,
    alternates: { canonical: `/coleccion/${key}` },
  };
}
export default async function Page({ params }: { params: Promise<{ section: string }> }) {
  if (isProductionComingSoon()) return <ComingSoon />;
  const key = (await params).section.toLowerCase();
  return <Storefront initialSection={names[key] || key.replaceAll('-', ' ')} />;
}
