import './fraguan-anim.css';

/**
 * Hero: entrada letra por letra; el título sigue el desplazamiento de la página.
 * Props: titulo, linea ("Lo nuevo."), destacado ("A tu manera."), children (botones/CTA)
 */
export default function HeroForja({
  titulo = 'FRAGUAN',
  linea = 'Lo nuevo.',
  destacado = 'A tu manera.',
  children,
  tag = 'NUEVA TEMPORADA',
}) {
  return (
    <header className="hero fa-hero">
      <p className="tag k">{tag}</p>
      <h1 className="fa-hero-title" aria-label={titulo}>
        {titulo.split('').map((c, i) => (
          <span className="fa-hero-mask" key={i} aria-hidden="true">
            <span style={{ '--i': i }}>{c}</span>
          </span>
        ))}
      </h1>
      <p className="fa-hero-sub">
        {linea} <strong>{destacado}</strong>
      </p>
      {children}
    </header>
  );
}
