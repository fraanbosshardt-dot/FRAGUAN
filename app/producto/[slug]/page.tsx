import ProductPage from './product-page';
import type { Metadata } from 'next';
import { storeProduct } from '@/lib/online-store';
import { publicProductReviews } from '@/lib/store-growth';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  try {
    const { product } = await storeProduct((await params).slug);
    return {
      title: `${product.name} | FRAGUAN`,
      description: product.shortDescription,
      alternates: { canonical: `/producto/${product.slug}` },
      openGraph: { title: `${product.name} | FRAGUAN`, description: product.shortDescription, type: 'website', url: `/producto/${product.slug}` },
      twitter: { card: 'summary', title: `${product.name} | FRAGUAN`, description: product.shortDescription },
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
  const slug = (await params).slug;
  try {
    const { product } = await storeProduct(slug);
    const reviews = await publicProductReviews(product.id);
    const jsonLd = {
      '@context': 'https://schema.org', '@type': 'ProductGroup',
      name: product.name, description: product.description,
      brand: { '@type': 'Brand', name: product.brand },
      productGroupID: product.id,
      variesBy: ['https://schema.org/color', 'https://schema.org/size'],
      hasVariant: product.variants.map((variant: { sku: string; color: string; size: string; price: number; stock: number }) => ({
        '@type': 'Product', sku: variant.sku, color: variant.color, size: variant.size,
        offers: { '@type': 'Offer', priceCurrency: 'ARS', price: variant.price / 100,
          availability: variant.stock > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
          url: `https://fraguan.com/producto/${product.slug}` },
      })),
      ...(reviews.total ? { aggregateRating: { '@type': 'AggregateRating', ratingValue: reviews.average, reviewCount: reviews.total } } : {}),
    };
    const breadcrumb = { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Tienda', item: 'https://fraguan.com/tienda' },
      { '@type': 'ListItem', position: 2, name: product.category, item: `https://fraguan.com/coleccion/${product.category.toLowerCase()}` },
      { '@type': 'ListItem', position: 3, name: product.name },
    ] };
    return <><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replaceAll('<', '\\u003c') }} /><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb).replaceAll('<', '\\u003c') }} /><ProductPage slug={slug} /></>;
  } catch {
    return <ProductPage slug={slug} />;
  }
}
