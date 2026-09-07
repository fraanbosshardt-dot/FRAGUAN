import Link from 'next/link';
import ComingSoon from './coming-soon';
import { isProductionComingSoon } from '@/lib/release-mode';

export default function Home() {
  if (isProductionComingSoon()) return <ComingSoon />;
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
