'use client';
import { DesignCatalog } from '@/components/store-design';
import type { StoreCatalog } from '@/lib/store-client';
export default function Storefront({
  initialCatalog,
  initialSection,
}: {
  initialCatalog?: StoreCatalog;
  initialSection?: string;
}) {
  return (
    <DesignCatalog initialCatalog={initialCatalog} section={initialSection} />
  );
}
