import ProductPage from './product-page';
import type { Metadata } from 'next';
import { storeProduct } from '@/lib/online-store';
import { publicProductReviews } from '@/lib/store-growth';
import { seoOverride } from '@/lib/store-seo';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  try {
    const { product } = await storeProduct((await params).slug);
    const seo = await seoOverride(`/producto/${product.slug}`);
    const title = seo.title || `${product.name} | FRAGUAN`;
    const description = seo.description || product.shortDescription;
    return {
      title,
      description,
      alternates: { canonical: `/producto/${product.slug}` },
      openGraph: {
        title,
        description,
        type: 'website',
        url: `/producto/${product.slug}`,
      },
      twitter: {
        card: 'summary',
        title,
        description,
      },
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
    const { product, related } = await storeProduct(slug);
    const reviews = await publicProductReviews(product.id);
    const jsonLd = {
      '@context': 'https://schema.org',
      '@type': 'ProductGroup',
      name: product.name,
      description: product.description,
      brand: { '@type': 'Brand', name: product.brand },
      productGroupID: product.id,
      variesBy: ['https://schema.org/color', 'https://schema.org/size'],
      hasVariant: product.variants.map(
        (variant: {
          sku: string;
          color: string;
          size: string;
          price: number;
          stock: number;
        }) => ({
          '@type': 'Product',
          name: `${product.name} · ${variant.color} · ${variant.size}`,
          sku: variant.sku,
          color: variant.color,
          size: variant.size,
          isVariantOf: {
            '@type': 'ProductGroup',
            productGroupID: product.id,
            name: product.name,
          },
          offers: {
            '@type': 'Offer',
            priceCurrency: 'ARS',
            price: variant.price / 100,
            availability:
              variant.stock > 0
                ? 'https://schema.org/InStock'
                : 'https://schema.org/OutOfStock',
            url: `https://www.fraguan.com/producto/${product.slug}?variant=${encodeURIComponent(variant.sku)}`,
          },
        }),
      ),
      ...(reviews.total
        ? {
            aggregateRating: {
              '@type': 'AggregateRating',
              ratingValue: reviews.average,
              reviewCount: reviews.total,
            },
          }
        : {}),
    };
    const breadcrumb = {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          name: 'Tienda',
          item: 'https://www.fraguan.com',
        },
        {
          '@type': 'ListItem',
          position: 2,
          name: product.category,
          item: `https://www.fraguan.com/coleccion/${product.category
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/(^-|-$)/g, '')}`,
        },
        { '@type': 'ListItem', position: 3, name: product.name },
      ],
    };
    return (
      <>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(jsonLd).replaceAll('<', '\\u003c'),
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(breadcrumb).replaceAll('<', '\\u003c'),
          }}
        />
        <ProductPage
          slug={slug}
          initialProduct={product}
          initialRelated={related}
        />
      </>
    );
  } catch {
    return <ProductPage slug={slug} />;
  }
}
