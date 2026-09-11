'use client';

import { ArrowRight } from 'lucide-react';
import { useState } from 'react';
import { storeApi } from '@/lib/store-client';

export function StoreFooter() {
  const [email, setEmail] = useState('');
  const [state, setState] = useState('');

  async function subscribe(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setState('Enviando…');
    try {
      await storeApi('store-newsletter', {
        method: 'POST',
        body: JSON.stringify({ email, source: 'store-footer' }),
      });
      setEmail('');
      setState('Listo. Ya sos parte de FRAGUAN.');
    } catch (cause: any) {
      setState(cause.message || 'No pudimos suscribirte.');
    }
  }

  return (
    <footer className="store-footer">
      <div className="store-footer-brand">
        <a href="/">FRAGUAN</a>
        <p>
          Forjá tu estilo.
        </p>
      </div>
      <nav aria-label="Ayuda y políticas">
        <strong>AYUDA</strong>
        <a href="/cuenta">Mi cuenta</a>
        <a href="/informacion/envios">Envíos</a>
        <a href="/informacion/cambios">Cambios y devoluciones</a>
        <a href="/informacion/pagos">Pagos</a>
        <a href="/informacion/talles">Guía de talles</a>
        <a href="/informacion/contacto">Contacto</a>
      </nav>
      <nav aria-label="Información legal">
        <strong>LEGAL</strong>
        <a href="/informacion/terminos">Términos y condiciones</a>
        <a href="/informacion/privacidad">Privacidad</a>
        <a href="/informacion/cookies">Cookies</a>
        <a className="store-withdrawal-link" href="/arrepentimiento">
          Botón de arrepentimiento
        </a>
      </nav>
      <div className="store-newsletter">
        <span>FRAGUAN LETTER</span>
        <strong>Ingresos, drops y beneficios.</strong>
        <small>Sin ruido. Podés darte de baja cuando quieras.</small>
        <form onSubmit={subscribe}>
          <input
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            type="email"
            autoComplete="email"
            maxLength={200}
            placeholder="tu@email.com"
            aria-label="Email para newsletter"
            required
          />
          <button type="submit">
            Unirme <ArrowRight />
          </button>
        </form>
        {state && <output>{state}</output>}
      </div>
    </footer>
  );
}
