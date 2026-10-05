'use client';

import { useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { GoogleSignIn } from '@/components/google-sign-in';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function InternalLogin({
  clientId,
  returnTo,
  localAccess,
  passwordAccess,
  area = 'pos',
}: {
  clientId: string;
  returnTo: string;
  localAccess: boolean;
  passwordAccess: boolean;
  area?: 'pos' | 'admin';
}) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/internal-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'password',
          email: values.get('email'),
          password: values.get('password'),
        }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error || 'No se pudo ingresar.');
      window.location.assign(returnTo);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo ingresar.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="admin-access-page">
      <section className="admin-access-card">
        <div className="wordmark">FRAGUAN</div>
        <div className="admin-access-icon">
          <ShieldCheck size={25} />
        </div>
        <p className="eyebrow">
          {area === 'admin' ? 'ADMINISTRACIÓN' : 'ACCESO DEL PERSONAL'}
        </p>
        <h1>
          {area === 'admin' ? 'Ingresá a Administración' : 'Ingresá a FRAGUAN'}
        </h1>
        <p className="admin-access-copy">
          {localAccess
            ? 'Entrá al POS o a Administración con la cuenta local. Administración conserva su PIN de acceso.'
            : area === 'admin'
              ? 'Ingresá con tu email y contraseña. Luego confirmá tu PIN para acceder al panel.'
              : 'Usá tu email y contraseña para entrar al POS. Administración conserva su PIN adicional de acceso.'}
        </p>
        {passwordAccess ? (
          <form onSubmit={submit}>
            <label htmlFor="staff-email">Email del propietario</label>
            <Input
              id="staff-email"
              name="email"
              type="email"
              autoComplete="username"
              maxLength={254}
              required
              disabled={busy}
            />
            <label htmlFor="staff-password">Contraseña</label>
            <Input
              id="staff-password"
              name="password"
              type="password"
              autoComplete="current-password"
              minLength={12}
              maxLength={128}
              required
              disabled={busy}
            />
            <Button type="submit" disabled={busy}>
              {busy ? 'Verificando…' : 'Ingresar'}
            </Button>
          </form>
        ) : localAccess ? (
          <Button
            onClick={() =>
              window.location.assign(
                `/signin-with-chatgpt?return_to=${encodeURIComponent(returnTo)}`,
              )
            }
          >
            Ingresar
          </Button>
        ) : clientId ? (
          <GoogleSignIn
            clientId={clientId}
            resource="internal-auth"
            successPath={returnTo}
            onError={setError}
          />
        ) : (
          <output className="notice" style={{ display: 'block' }}>
            El acceso del personal está protegido. Falta configurar las
            credenciales de producción.
          </output>
        )}
        {error && (
          <p className="notice" role="alert">
            {error}
          </p>
        )}
        <a className="admin-access-back" href="/">
          Volver a la tienda
        </a>
      </section>
    </main>
  );
}
