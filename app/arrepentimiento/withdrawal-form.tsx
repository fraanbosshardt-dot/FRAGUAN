'use client';

import { ArrowLeft, ArrowRight, Check, RotateCcw } from 'lucide-react';
import { useState } from 'react';
import { StoreFooter } from '@/components/store-footer';
import { StoreHeader } from '@/components/store-header';
import { storeApi } from '@/lib/store-client';

export default function WithdrawalForm() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ code: string; orderNumber: number } | null>(null);

  async function submit(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const form = new FormData(event.currentTarget);
    try {
      setResult(await storeApi('store-return-request', {
        method: 'POST',
        body: JSON.stringify({
          orderNumber: form.get('orderNumber'),
          email: form.get('email'),
          phone: form.get('phone') || '',
          kind: form.get('kind'),
          reason: form.get('reason'),
          detail: form.get('detail') || '',
        }),
      }));
    } catch (cause: any) {
      setError(cause.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="store-shell">
      <StoreHeader />
      <main className="store-withdrawal-page">
        <a href="/tienda" className="store-back"><ArrowLeft /> Volver a la tienda</a>
        {result ? (
          <section className="store-withdrawal-success">
            <div><Check /></div>
            <span>SOLICITUD RECIBIDA</span>
            <h1>Ya quedó registrada.</h1>
            <p>Pedido #{result.orderNumber}. Guardá este código para cualquier consulta:</p>
            <strong>{result.code}</strong>
            <p>También lo enviaremos al email de la compra. Atención al Cliente continuará la gestión por ese medio.</p>
            <a href="/tienda">Volver a la tienda <ArrowRight /></a>
          </section>
        ) : (
          <div className="store-withdrawal-grid">
            <section>
              <span>DERECHO DE ARREPENTIMIENTO</span>
              <h1>Gestioná tu compra online.</h1>
              <p>Podés iniciar un arrepentimiento, cambio o devolución sin registrarte. Para proteger la compra, verificamos el pedido y el email usado.</p>
              <ul>
                <li><RotateCcw /> Tenés 10 días corridos desde que recibís el producto.</li>
                <li><Check /> El ejercicio del derecho no tiene costo.</li>
                <li><Check /> Recibís un código de identificación inmediato.</li>
              </ul>
            </section>
            <form onSubmit={submit}>
              <label>Tipo de solicitud<select name="kind" required defaultValue="withdrawal">
                <option value="withdrawal">Arrepentimiento de compra</option>
                <option value="exchange">Cambio de talle o color</option>
                <option value="return">Devolución por inconveniente</option>
              </select></label>
              <label>Número de pedido<input name="orderNumber" inputMode="numeric" autoComplete="off" placeholder="Ej. 1042" required /></label>
              <label>Email de la compra<input name="email" type="email" autoComplete="email" required /></label>
              <label>Teléfono <small>Opcional</small><input name="phone" type="tel" autoComplete="tel" /></label>
              <label>Motivo<select name="reason" required defaultValue="">
                <option value="" disabled>Seleccionar</option>
                <option value="Me arrepentí de la compra">Me arrepentí de la compra</option>
                <option value="Compré por error">Compré por error</option>
                <option value="El producto no era lo esperado">El producto no era lo esperado</option>
                <option value="Otro motivo">Otro motivo</option>
              </select></label>
              <label>Detalle <small>Opcional</small><textarea name="detail" rows={4} maxLength={1000} /></label>
              {error && <p className="store-buy-error" role="alert">{error}</p>}
              <button className="store-auth-submit" disabled={busy}>{busy ? 'Registrando…' : 'Confirmar arrepentimiento'} <ArrowRight /></button>
              <p className="store-form-legal">Este formulario solicita la revocación. El reintegro y la devolución se coordinan con Atención al Cliente.</p>
            </form>
          </div>
        )}
      </main>
      <StoreFooter />
    </div>
  );
}
