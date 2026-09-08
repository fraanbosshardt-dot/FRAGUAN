import ProductPage from './product-page';
import type { Metadata } from 'next';
import { storeProduct } from '@/lib/online-store';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  try {
    const { product } = await storeProduct((await params).slug);
    return {
      title: `${product.name} | FRAGUAN`,
      description: product.shortDescription,
      alternates: { canonical: `/producto/${product.slug}` },
    };
  } catch {
    return { title: 'Producto | FRAGUAN', robots: { index: false } };
  }
}
export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  return <ProductPage slug={(await params).slug} />;
}
