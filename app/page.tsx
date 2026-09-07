import Link from 'next/link';

export default function Home() {
  return (
    <main className="coming-soon">
      <div className="coming-soon-mark" aria-hidden="true">
        FG
      </div>
      <p className="eyebrow">FRAGUAN · FORJÁ TU ESTILO</p>
      <h1>La tienda está tomando forma.</h1>
      <p className="coming-soon-copy">
        Estamos preparando una experiencia nueva. Muy pronto vas a poder comprar
        FRAGUAN online.
      </p>
      <div className="coming-soon-actions">
        <Link href="/tienda" className="button button-primary">
          Ver entorno de trabajo
        </Link>
        <Link href="/pos" className="button button-ghost">
          Acceso POS
        </Link>
      </div>
      <span className="coming-soon-note">Próximamente disponible en fraguan.com</span>
    </main>
  );
}
