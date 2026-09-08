import Link from 'next/link';
import Image from 'next/image';

export default function ComingSoon({ area = 'FRAGUAN' }: { area?: string }) {
  return (
    <main className="coming-soon">
      <Image className="coming-soon-logo" src="/fraguan-logo.jpg" alt="FRAGUAN" width={112} height={112} priority />
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
