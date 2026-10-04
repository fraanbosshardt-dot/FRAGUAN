'use client';

import { useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { GoogleSignIn } from '@/components/google-sign-in';
import { Button } from '@/components/ui/button';

export function InternalLogin({
  clientId,
  returnTo,
  localAccess,
}: {
  clientId: string;
  returnTo: string;
  localAccess: boolean;
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
        <h1>{localAccess ? 'Ingresá a FRAGUAN' : 'Ingresá con Google'}</h1>
        <p className="admin-access-copy">
          {localAccess
            ? 'Entrá al POS o a Administración con la cuenta local. Administración conserva su PIN de acceso.'
            : 'Usá una cuenta habilitada por FRAGUAN. El acceso y cada operación quedarán asociados a tu usuario.'}
        </p>
        {localAccess ? (
          <Button
            onClick={() =>
              window.location.assign(
                `/signin-with-chatgpt?return_to=${encodeURIComponent(returnTo)}`,
              )
            }
          >
            Ingresar
          </Button>
        ) : (
          <GoogleSignIn
            clientId={clientId}
            resource="internal-auth"
            successPath={returnTo}
            onError={setError}
          />
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
