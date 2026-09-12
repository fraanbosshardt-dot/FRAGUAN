'use client';

import { LogOut } from 'lucide-react';
import { useState } from 'react';

export function InternalSignOut() {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      className="internal-sign-out"
      title="Cerrar sesión"
      aria-label="Cerrar sesión"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await fetch('/api/internal-auth', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'logout' }),
          });
        } finally {
          location.assign('/acceso?returnTo=%2Fpos');
        }
      }}
    >
      <LogOut size={15} />
    </button>
  );
}
