'use client';
import { DesignProduct } from '@/components/store-design';
import type { StoreProduct } from '@/lib/store-client';
export default function ProductPage({
  slug,
  initialProduct,
  initialRelated,
}: {
  slug: string;
  initialProduct?: StoreProduct | null;
  initialRelated?: StoreProduct[];
}) {
  return (
    <DesignProduct
      slug={slug}
      initialProduct={initialProduct}
      initialRelated={initialRelated}
    />
  );
}
