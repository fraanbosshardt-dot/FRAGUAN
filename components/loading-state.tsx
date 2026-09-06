import { Skeleton } from '@/components/ui/skeleton';

export function LoadingState({
  label = 'Cargando información…',
}: {
  label?: string;
}) {
  return (
    <output aria-live="polite" className="loading-state">
      <p>{label}</p>
      <div aria-hidden="true">
        <Skeleton className="h-8 w-48 mb-5" />
        {[0, 1, 2, 3].map((row) => (
          <Skeleton key={row} className="h-12 w-full mb-3" />
        ))}
      </div>
    </output>
  );
}
