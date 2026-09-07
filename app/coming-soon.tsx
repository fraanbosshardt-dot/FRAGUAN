import Link from 'next/link';

export default function ComingSoon({ area = 'FRAGUAN' }: { area?: string }) {
  return (
    <main className="coming-soon">
      <div className="coming-soon-mark" aria-hidden="true">FG</div>
      <p className="eyebrow">{area} · FORJÁ TU ESTILO</p>
      <h1>Próximamente disponible.</h1>
      <p className="coming-soon-copy">
        Estamos preparando el lanzamiento oficial de FRAGUAN. Volvé pronto.
      </p>
      <Link href="/" className="button button-primary">Volver a FRAGUAN</Link>
      <span className="coming-soon-note">Estamos trabajando para vos.</span>
    </main>
  );
}
