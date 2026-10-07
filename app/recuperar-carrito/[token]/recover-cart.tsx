'use client';
import { ArrowRight, Check } from 'lucide-react';
import { useEffect, useState } from 'react';
import { storeApi, storeMoney } from '@/lib/store-client';

export default function RecoverCart({ token }: { token: string }) {
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [subtotal, setSubtotal] = useState(0);
  useEffect(() => {
    storeApi<{ cart: any[]; subtotal: number }>(
      `store-recover-cart?token=${encodeURIComponent(token)}`,
    )
      .then(({ cart, subtotal }) => {
        const restored = cart.map((line) => ({
          id: line.variantId,
          productId: line.productId || '',
          productName: line.productName,
          slug: line.slug,
          color: line.color,
          size: line.size,
          price: line.price,
          quantity: line.quantity,
          stock: line.stock,
          sku: line.sku,
          barcode: line.barcode,
        }));
        localStorage.setItem('fraguan-online-cart', JSON.stringify(restored));
        dispatchEvent(new Event('fraguan-cart'));
        setSubtotal(subtotal);
        setState('ready');
      })
      .catch(() => setState('error'));
  }, [token]);
  return (
    <div className="store-shell">
      <section className="store-recovery-page">
        {state === 'loading' && <p>Recuperando tu selección…</p>}
        {state === 'ready' && (
          <>
            <Check />
            <span>SELECCIÓN RECUPERADA</span>
            <h1>Seguimos donde lo dejaste.</h1>
            <p>
              Restauramos tu carrito por {storeMoney(subtotal)}. El stock y el
              precio se validarán nuevamente antes de crear el pedido.
            </p>
            <a href="/checkout">
              Continuar compra <ArrowRight />
            </a>
          </>
        )}
        {state === 'error' && (
          <>
            <h1>Este enlace ya no está disponible.</h1>
            <p>Podés volver a la colección y armar una selección nueva.</p>
            <a href="/">
              Ver colección <ArrowRight />
            </a>
          </>
        )}
      </section>
    </div>
  );
}
