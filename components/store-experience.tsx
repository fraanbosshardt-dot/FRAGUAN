'use client';
import { Check, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { trackStore } from '@/lib/store-client';

export function StoreExperience() {
  const pathname = usePathname();
  const internal =
    pathname === '/pos' ||
    pathname === '/acceso' ||
    pathname === '/admin-access' ||
    pathname === '/admin' ||
    pathname.startsWith('/admin/');
  const [message, setMessage] = useState('');
  const [cookies, setCookies] = useState(false);
  useEffect(() => {
    if (internal) return;
    setCookies(!localStorage.getItem('fraguan-cookie-consent'));
    trackStore('page_view');
    const feedback = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      setMessage(`${detail.productName} · talle ${detail.size}`);
      setTimeout(() => setMessage(''), 2600);
    };
    addEventListener('fraguan-cart-feedback', feedback);
    return () => removeEventListener('fraguan-cart-feedback', feedback);
  }, [internal, pathname]);
  if (internal) return null;
  return (
    <>
      {cookies && (
        <aside
          className="store-cookie-banner"
          aria-label="Preferencias de privacidad"
        >
          <div>
            <strong>Tu privacidad, clara.</strong>
            <p>
              Usamos almacenamiento esencial para carrito y sesión. Con tu
              permiso medimos el recorrido para mejorar la tienda.
            </p>
            <a href="/informacion/cookies">Ver política</a>
          </div>
          <div>
            <button
              onClick={() => {
                localStorage.setItem('fraguan-cookie-consent', 'essential');
                setCookies(false);
              }}
            >
              Solo esenciales
            </button>
            <button
              className="primary"
              onClick={() => {
                localStorage.setItem('fraguan-cookie-consent', 'analytics');
                setCookies(false);
                trackStore('page_view', { consentGranted: true });
              }}
            >
              Aceptar medición
            </button>
          </div>
        </aside>
      )}
      {message && (
        <output className="store-toast" aria-live="polite">
          <Check />
          <span>
            <strong>Agregado a tu selección</strong>
            {message}
          </span>
          <button onClick={() => setMessage('')} aria-label="Cerrar aviso">
            <X />
          </button>
        </output>
      )}
    </>
  );
}
