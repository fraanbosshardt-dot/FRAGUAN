'use client';
import { useEffect, useState } from 'react';
export type Row = Record<string, any>;
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public saleNotCommitted = false,
  ) {
    super(message);
  }
}
export async function api<T = any>(
  resource: string,
  body?: unknown,
): Promise<T> {
  const r = await fetch('/api/' + resource, {
    method: body === undefined ? 'GET' : 'POST',
    cache: 'no-store',
    headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data: any = await r.json();
  if (!r.ok)
    throw new ApiError(
      data.error || 'No se pudo completar la operación.',
      r.status,
      r.headers.get('X-Sale-Not-Committed') === '1',
    );
  return data;
}
export const money = (n: number = 0) =>
  new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(n / 100);
export const date = (value: string) =>
  value
    ? new Date(
        value.length === 10 ? value + 'T12:00:00Z' : value,
      ).toLocaleString('es-AR', {
        timeZone: 'America/Argentina/Cordoba',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : '—';
export const minor = (value: string | number) => {
  if (typeof value !== 'string' && typeof value !== 'number')
    throw new Error('Ingresá un importe válido sin separador de miles.');
  const normalized = String(value).trim().replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(normalized))
    throw new Error('Ingresá un importe válido sin separador de miles.');
  const [whole, part = ''] = normalized.split('.');
  const result = Number(whole) * 100 + Number(part.padEnd(2, '0'));
  if (!Number.isSafeInteger(result)) throw new Error('Importe fuera de rango.');
  return result;
};
export function useSession(initialSession: Row | null = null) {
  const [session, setSession] = useState<Row | null>(initialSession);
  const [error, setError] = useState('');
  useEffect(() => {
    api('session')
      .then(setSession)
      .catch((e) => setError(e.message));
  }, []);
  return { session, error, reload: () => api('session').then(setSession) };
}
export function useClock() {
  const [clock, setClock] = useState('');
  useEffect(() => {
    const update = () =>
      setClock(
        new Date().toLocaleTimeString('es-AR', {
          hour: '2-digit',
          minute: '2-digit',
          timeZone: 'America/Argentina/Cordoba',
        }),
      );
    update();
    const t = setInterval(update, 30000);
    return () => clearInterval(t);
  }, []);
  return clock;
}
