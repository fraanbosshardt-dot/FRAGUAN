'use client';

import { useEffect, useRef, useState } from 'react';
import { storeApi } from '@/lib/store-client';

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize(input: {
            client_id: string;
            callback: (response: { credential: string }) => void;
            auto_select?: boolean;
          }): void;
          renderButton(
            element: HTMLElement,
            options: Record<string, unknown>,
          ): void;
        };
      };
    };
  }
}

export function GoogleSignIn({
  clientId,
  onError,
  resource = 'store-account',
  successPath,
  buttonText = 'continue_with',
  onSuccess,
}: {
  clientId: string;
  onError: (message: string) => void;
  resource?: 'store-account' | 'internal-auth';
  successPath?: string;
  buttonText?: 'continue_with' | 'signin_with' | 'signup_with';
  onSuccess?: () => Promise<void> | void;
}) {
  const target = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!clientId || !target.current) return;
    const render = () => {
      if (!window.google || !target.current) return;
      window.google.accounts.id.initialize({
        client_id: clientId,
        auto_select: false,
        callback: async ({ credential }) => {
          setLoading(true);
          onError('');
          try {
            await storeApi(resource, {
              method: 'POST',
              body: JSON.stringify({ action: 'google', credential }),
            });
            if (onSuccess) {
              await onSuccess();
              setLoading(false);
            } else if (successPath) location.assign(successPath);
            else location.reload();
          } catch (cause: any) {
            onError(cause.message || 'No pudimos iniciar sesión con Google.');
            setLoading(false);
          }
        },
      });
      target.current.replaceChildren();
      window.google.accounts.id.renderButton(target.current, {
        type: 'standard',
        theme: 'outline',
        size: 'large',
        shape: 'rectangular',
        text: buttonText,
        logo_alignment: 'left',
        width: Math.min(390, target.current.clientWidth || 390),
        locale: 'es',
      });
    };
    const existing = document.getElementById(
      'google-identity-services',
    ) as HTMLScriptElement | null;
    if (existing) {
      if (window.google) render();
      else existing.addEventListener('load', render, { once: true });
      return;
    }
    const script = document.createElement('script');
    script.id = 'google-identity-services';
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = render;
    script.onerror = () => onError('No pudimos cargar Google Login.');
    document.head.appendChild(script);
  }, [clientId, onError, resource, successPath, buttonText, onSuccess]);

  if (!clientId)
    return (
      <button className="store-google-placeholder" type="button" disabled>
        Continuar con Google · listo para configurar
      </button>
    );
  return (
    <div className="store-google-signin" aria-busy={loading}>
      <div ref={target} />
      {loading && <small>Ingresando…</small>}
    </div>
  );
}
