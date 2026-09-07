'use client';
import { useCallback, useEffect, useState } from 'react';

export type StoreVariant = {
  id: string;
  sku: string;
  barcode: string;
  color: string;
  size: string;
  price: number;
  stock: number;
};
export type StoreProduct = {
  id: string;
  name: string;
  category: string;
  brand: string;
  slug: string;
  shortDescription: string;
  description: string;
  material: string;
  care: string;
  fit: string;
  section: string;
  featured: boolean;
  price: number;
  variants: StoreVariant[];
};
export type StoreCartItem = StoreVariant & {
  productName: string;
  slug: string;
  quantity: number;
};

export async function storeApi<T = any>(
  resource: string,
  options?: RequestInit,
): Promise<T> {
  const headers = new Headers(options?.headers);
  if (options?.body) headers.set('Content-Type', 'application/json');
  const response = await fetch(`/api/${resource}`, {
    ...options,
    headers,
  });
  const data: any = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error(data.error || 'No pudimos completar la operación.');
  return data as T;
}
export const storeMoney = (value: number) =>
  new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(value / 100);

const CART_KEY = 'fraguan-online-cart';
export function useStoreCart() {
  const [cart, setCartState] = useState<StoreCartItem[]>([]);
  useEffect(() => {
    try {
      setCartState(JSON.parse(localStorage.getItem(CART_KEY) || '[]'));
    } catch {
      setCartState([]);
    }
  }, []);
  useEffect(() => {
    const sync = () => {
      try {
        setCartState(JSON.parse(localStorage.getItem(CART_KEY) || '[]'));
      } catch {
        setCartState([]);
      }
    };
    addEventListener('fraguan-cart', sync);
    addEventListener('storage', sync);
    return () => {
      removeEventListener('fraguan-cart', sync);
      removeEventListener('storage', sync);
    };
  }, []);
  const save = useCallback((next: StoreCartItem[]) => {
    localStorage.setItem(CART_KEY, JSON.stringify(next));
    setCartState(next);
    dispatchEvent(new Event('fraguan-cart'));
  }, []);
  const add = useCallback(
    (product: StoreProduct, variant: StoreVariant, quantity = 1) => {
      const current: StoreCartItem[] = JSON.parse(
        localStorage.getItem(CART_KEY) || '[]',
      );
      const found = current.find((item) => item.id === variant.id);
      const next = found
        ? current.map((item) =>
            item.id === variant.id
              ? {
                  ...item,
                  quantity: Math.min(variant.stock, item.quantity + quantity),
                }
              : item,
          )
        : [
            ...current,
            {
              ...variant,
              productName: product.name,
              slug: product.slug,
              quantity: Math.min(quantity, variant.stock),
            },
          ];
      save(next);
    },
    [save],
  );
  const update = useCallback(
    (variantId: string, quantity: number) => {
      const current: StoreCartItem[] = JSON.parse(
        localStorage.getItem(CART_KEY) || '[]',
      );
      save(
        current.flatMap((item) =>
          item.id !== variantId
            ? [item]
            : quantity > 0
              ? [{ ...item, quantity: Math.min(item.stock, quantity) }]
              : [],
        ),
      );
    },
    [save],
  );
  const clear = useCallback(() => save([]), [save]);
  return {
    cart,
    add,
    update,
    clear,
    count: cart.reduce((total, item) => total + item.quantity, 0),
    subtotal: cart.reduce(
      (total, item) => total + item.price * item.quantity,
      0,
    ),
  };
}
