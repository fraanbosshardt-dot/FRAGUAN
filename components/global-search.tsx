'use client';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandDialog,
  CommandInput,
  CommandList,
  CommandItem,
  CommandEmpty,
} from '@/components/ui/command';
import { api } from '@/lib/client';
type Result = { id: string; title: string; detail: string; href: string };
export function GlobalSearch() {
  const [open, setOpen] = useState(false),
    [query, setQuery] = useState(''),
    [results, setResults] = useState<Result[]>([]),
    [loading, setLoading] = useState(false),
    [error, setError] = useState('');
  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, []);
  useEffect(() => {
    let current = true;
    setResults([]);
    setError('');
    setLoading(open && query.trim().length >= 2);
    if (!open || query.trim().length < 2) return;
    const timer = setTimeout(() => {
      api<Result[]>('global-search?q=' + encodeURIComponent(query))
        .then((data) => {
          if (current) setResults(data);
        })
        .catch((e) => {
          if (current) setError(e.message);
        })
        .finally(() => {
          if (current) setLoading(false);
        });
    }, 200);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [query, open]);
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        Buscar <kbd>Ctrl / ⌘ K</kbd>
      </Button>
      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title="Buscar en FRAGUAN"
        description="Productos, clientes, ventas, proveedores, órdenes y movimientos disponibles para tu usuario."
      >
        <Command shouldFilter={false}>
          <CommandInput
            value={query}
            onValueChange={setQuery}
            placeholder="Buscar en FRAGUAN…"
          />
          <CommandList aria-busy={loading}>
            <CommandEmpty>
              {error ||
                (loading
                  ? 'Buscando…'
                  : query.trim().length < 2
                    ? 'Escribí al menos dos caracteres.'
                    : 'No encontramos resultados.')}
            </CommandEmpty>
            {results.map((result) => (
              <CommandItem
                key={result.id}
                value={result.id}
                onSelect={() => {
                  window.location.assign(result.href);
                }}
              >
                <span>
                  {result.title}
                  <small className="block">{result.detail}</small>
                </span>
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  );
}
