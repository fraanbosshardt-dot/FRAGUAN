'use client';
import { Bell, Check } from 'lucide-react';
import { useState } from 'react';
import { StoreProduct, storeApi } from '@/lib/store-client';

export function StoreProductTrust({ product }: { product: StoreProduct }) {
  const [email, setEmail] = useState('');
  const [variantId, setVariantId] = useState(
    product.variants.find((v) => !v.stock)?.id || '',
  );
  const [notice, setNotice] = useState('');
  async function waitForStock(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      await storeApi('store-back-in-stock', {
        method: 'POST',
        body: JSON.stringify({ variantId, email }),
      });
      setNotice('Te avisaremos apenas vuelva esa variante.');
    } catch (cause) {
      setNotice(
        cause instanceof Error ? cause.message : 'No pudimos guardar el aviso.',
      );
    }
  }
  const unavailable = product.variants.filter((v) => !v.stock);
  if (!unavailable.length) return null;
  return (
    <section className="store-product-trust">
      {!!unavailable.length && (
        <div className="store-stock-alert-form">
          <Bell />
          <div>
            <span>AVISO DE REPOSICIÓN</span>
            <h2>¿No está tu talle?</h2>
            <p>Te escribimos una sola vez cuando vuelva.</p>
            <form onSubmit={waitForStock}>
              <select
                value={variantId}
                onChange={(e) => setVariantId(e.target.value)}
                required
              >
                {unavailable.map((v) => (
                  <option value={v.id} key={v.id}>
                    {v.color} · talle {v.size}
                  </option>
                ))}
              </select>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                autoComplete="email"
                maxLength={200}
                placeholder="tu@email.com"
                required
              />
              <button>Avisarme</button>
            </form>
          </div>
        </div>
      )}
      {notice && (
        <output className="store-inline-success">
          <Check /> {notice}
        </output>
      )}
    </section>
  );
}
