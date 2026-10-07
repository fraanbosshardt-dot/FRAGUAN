import { useEffect, useRef } from 'react';
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
  const titleRef = useRef(null);
  const heroRef = useRef(null);
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (!titleRef.current || !heroRef.current) return;
        const distance = Math.min(
          140,
          Math.max(60, titleRef.current.offsetHeight * 0.45),
        );
        const top =
          heroRef.current.getBoundingClientRect().top + window.scrollY;
        const progress = Math.min(
          1,
          Math.max(0, (window.scrollY - Math.max(0, top - 64)) / distance),
        );
        titleRef.current.style.transform =
          'scale(' + (1 - progress * 0.6) + ')';
        titleRef.current.style.opacity = String(1 - progress);
      });
    };
    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, []);
  return (
    <header className="hero fa-hero" ref={heroRef}>
      <p className="tag k">{tag}</p>
      <h1 className="fa-hero-title" ref={titleRef} aria-label={titulo}>
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
