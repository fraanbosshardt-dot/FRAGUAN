import ProductPage from './product-page';
import type { Metadata } from 'next';
import { storeProduct } from '@/lib/online-store';
import { notFound } from 'next/navigation';
import { AppError } from '@/lib/auth';
import { seoOverride } from '@/lib/store-seo';
import { productSeo, productStructuredData } from '@/lib/store-seo-data';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  try {
    const { product } = await storeProduct((await params).slug);
    const seo = await seoOverride(`/producto/${product.slug}`);
    const defaults = productSeo(product);
    const title = seo.title || defaults.title;
    const description = seo.description || defaults.description;
    return {
      title,
      description,
      alternates: { canonical: `/producto/${product.slug}` },
      openGraph: {
        title,
        description,
        type: 'website',
        url: `/producto/${product.slug}`,
        ...(product.imageUrl
          ? { images: [{ url: product.imageUrl, alt: product.name }] }
          : {}),
      },
      twitter: {
        card: product.imageUrl ? 'summary_large_image' : 'summary',
        ...(product.imageUrl ? { images: [product.imageUrl] } : {}),
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

    const jsonLd = productStructuredData(product);
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
  } catch (error) {
    if (error instanceof AppError && error.status === 404) notFound();
    return <ProductPage slug={slug} />;
  }
}
