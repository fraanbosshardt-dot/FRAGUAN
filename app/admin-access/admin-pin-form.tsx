'use client';

import { useState } from 'react';
import { LockKeyhole } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function AdminPinForm({ returnTo }: { returnTo: string }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/admin-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error || 'No se pudo ingresar.');
      window.location.assign(returnTo);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'PIN incorrecto.');
      setPin('');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="admin-access-page">
      <section className="admin-access-card">
        <a className="wordmark" href="/pos">
          FRAGUAN<span>BUSINESS STUDIO</span>
        </a>
        <div className="admin-access-icon">
          <LockKeyhole size={25} />
        </div>
        <p className="eyebrow">ÁREA PROTEGIDA</p>
        <h1>Ingresá a Administración</h1>
        <p className="admin-access-copy">
          Usá el PIN administrativo para consultar información sensible y
          configurar el negocio.
        </p>
        <form onSubmit={submit}>
          <label htmlFor="admin-pin">PIN de 6 dígitos</label>
          <Input
            id="admin-pin"
            type="password"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            maxLength={6}
            value={pin}
            onChange={(event) =>
              setPin(event.target.value.replace(/\D/g, '').slice(0, 6))
            }
            required
          />
          {error && (
            <p className="notice" role="alert">
              {error}
            </p>
          )}
          <Button type="submit" disabled={busy || pin.length !== 6}>
            {busy ? 'Verificando…' : 'Ingresar'}
          </Button>
        </form>
        <a className="admin-access-back" href="/pos">
          Volver al punto de venta
        </a>
      </section>
    </main>
  );
}
