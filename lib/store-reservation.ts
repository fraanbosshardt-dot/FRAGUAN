import type { StoreCartItem, StoreCatalog } from './store-client';

export function reservationSeconds(expiresAt: string, timestamp: number) {
  const expiration = Date.parse(expiresAt);
  return Number.isFinite(expiration)
    ? Math.max(0, Math.ceil((expiration - timestamp) / 1000))
    : null;
}

export function reviewReservedItems(
  items: {
    variantId: string;
    productName: string;
    quantity: number;
    unitPrice: number;
  }[],
  catalog: StoreCatalog,
) {
  const restored: StoreCartItem[] = [];
  const notices: string[] = [];
  for (const item of items) {
    const product = catalog.products.find((p) =>
      p.variants.some((v) => v.id === item.variantId),
    );
    const variant = product?.variants.find((v) => v.id === item.variantId);
    if (!product || !variant || variant.stock < 1) {
      notices.push(`${item.productName}: sin disponibilidad por ahora.`);
      continue;
    }
    const quantity = Math.min(item.quantity, variant.stock, 20);
    if (quantity < item.quantity)
      notices.push(
        `${item.productName}: ${quantity === 1 ? 'queda 1 unidad' : `quedan ${quantity} unidades`}.`,
      );
    if (variant.price !== item.unitPrice)
      notices.push(
        `${item.productName}: el precio cambió; revisalo en el carrito.`,
      );
    restored.push({
      ...variant,
      productId: product.id,
      productName: product.name,
      slug: product.slug,
      quantity,
    });
  }
  return { restored, notices };
}
