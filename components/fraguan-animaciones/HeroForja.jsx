import { useEffect, useRef } from 'react';
import './fraguan-anim.css';

/**
 * 4. Hero: el título entra letra por letra y al scrollear se achica y queda fijo arriba.
 * Props: titulo, linea ("Lo nuevo."), destacado ("A tu manera."), children (botones/CTA)
 */
export default function HeroForja({
  titulo = 'FRAGUAN',
  linea = 'Lo nuevo.',
  destacado = 'A tu manera.',
  children,
  tag = 'NUEVA TEMPORADA',
}) {
  const ref = useRef(null);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const p = Math.min(window.scrollY / 320, 1);
        if (ref.current) ref.current.style.transform = `scale(${1 - p * 0.6})`;
      });
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <header className="hero fa-hero">
      <p className="tag k">{tag}</p>
      <h1 className="fa-hero-title" ref={ref} aria-label={titulo}>
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
