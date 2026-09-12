'use client';

import { useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { GoogleSignIn } from '@/components/google-sign-in';

export function InternalLogin({
  clientId,
  returnTo,
}: {
  clientId: string;
  returnTo: string;
}) {
  const [error, setError] = useState('');
  return (
    <main className="admin-access-page">
      <section className="admin-access-card">
        <div className="wordmark">FRAGUAN</div>
        <div className="admin-access-icon">
          <ShieldCheck size={25} />
        </div>
        <p className="eyebrow">ACCESO DEL PERSONAL</p>
        <h1>Ingresá con Google</h1>
        <p className="admin-access-copy">
          Usá una cuenta habilitada por FRAGUAN. El acceso y cada operación
          quedarán asociados a tu usuario.
        </p>
        <GoogleSignIn
          clientId={clientId}
          resource="internal-auth"
          successPath={returnTo}
          onError={setError}
        />
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
