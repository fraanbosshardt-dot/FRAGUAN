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
  productId: string;
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
const FAVORITES_KEY = 'fraguan-online-favorites';
const SESSION_KEY = 'fraguan-store-session';
const ATTRIBUTION_KEY = 'fraguan-store-attribution';

export function storeSessionId() {
  let value = localStorage.getItem(SESSION_KEY);
  if (!value) {
    value = crypto.randomUUID();
    localStorage.setItem(SESSION_KEY, value);
  }
  return value;
}

export function storeAttribution() {
  try {
    return JSON.parse(sessionStorage.getItem(ATTRIBUTION_KEY) || '{}');
  } catch {
    return {};
  }
}

export function captureStoreAttribution() {
  const query = new URLSearchParams(location.search);
  const current = storeAttribution();
  const next = {
    source: query.get('utm_source') || current.source || '',
    medium: query.get('utm_medium') || current.medium || '',
    campaign: query.get('utm_campaign') || current.campaign || '',
  };
  sessionStorage.setItem(ATTRIBUTION_KEY, JSON.stringify(next));
  return next;
}

export function trackStore(
  event: string,
  detail: Record<string, unknown> = {},
) {
  if (typeof window === 'undefined') return;
  const { consentGranted, ...safeDetail } = detail;
  if (localStorage.getItem('fraguan-cookie-consent') !== 'analytics' && !consentGranted) return;
  const attribution = captureStoreAttribution();
  const payload = {
    sessionId: storeSessionId(),
    event,
    path: location.pathname,
    ...attribution,
    ...safeDetail,
  };
  const body = JSON.stringify(payload);
  if (navigator.sendBeacon && event === 'page_view') {
    navigator.sendBeacon('/api/store-event', new Blob([body], { type: 'application/json' }));
    return;
  }
  void storeApi('store-event', { method: 'POST', body }).catch(() => undefined);
}

export function useStoreFavorites() {
  const [favorites, setFavorites] = useState<string[]>([]);
  useEffect(() => {
    try {
      setFavorites(JSON.parse(localStorage.getItem(FAVORITES_KEY) || '[]'));
    } catch {
      setFavorites([]);
    }
  }, []);
  const toggle = useCallback((productId: string) => {
    let current: string[] = [];
    try {
      current = JSON.parse(localStorage.getItem(FAVORITES_KEY) || '[]');
    } catch {
      current = [];
    }
    const next = current.includes(productId)
      ? current.filter((id) => id !== productId)
      : [...current, productId];
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(next));
    setFavorites(next);
    dispatchEvent(new Event('fraguan-favorites'));
  }, []);
  useEffect(() => {
    const sync = () => {
      try {
        setFavorites(JSON.parse(localStorage.getItem(FAVORITES_KEY) || '[]'));
      } catch {
        setFavorites([]);
      }
    };
    addEventListener('fraguan-favorites', sync);
    addEventListener('storage', sync);
    return () => {
      removeEventListener('fraguan-favorites', sync);
      removeEventListener('storage', sync);
    };
  }, []);
  return { favorites, toggle };
}

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
              productId: product.id,
              productName: product.name,
              slug: product.slug,
              quantity: Math.min(quantity, variant.stock),
            },
          ];
      save(next);
      trackStore('add_to_cart', {
        productId: product.id,
        variantId: variant.id,
        value: variant.price * quantity,
        cart: next.map(({ id, productName, slug, color, size, price, quantity }) => ({
          variantId: id, productName, slug, color, size, price, quantity,
        })),
      });
      dispatchEvent(new CustomEvent('fraguan-cart-feedback', { detail: { productName: product.name, size: variant.size } }));
    },
    [save],
  );
  const update = useCallback(
    (variantId: string, quantity: number) => {
      const current: StoreCartItem[] = JSON.parse(
        localStorage.getItem(CART_KEY) || '[]',
      );
      const next = current.flatMap((item) =>
          item.id !== variantId
            ? [item]
            : quantity > 0
              ? [{ ...item, quantity: Math.min(item.stock, quantity) }]
              : [],
        );
      save(next);
      const changed = current.find((item) => item.id === variantId);
      if (changed) trackStore(quantity > 0 ? 'add_to_cart' : 'remove_from_cart', {
        productId: changed.productId,
        variantId,
        value: changed.price * Math.max(0, quantity),
        cart: next.map(({ id, productName, slug, color, size, price, quantity }) => ({
          variantId: id, productName, slug, color, size, price, quantity,
        })),
      });
    },
    [save],
  );
  const clear = useCallback(() => {
    save([]);
    trackStore('remove_from_cart', { cart: [] });
  }, [save]);
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
