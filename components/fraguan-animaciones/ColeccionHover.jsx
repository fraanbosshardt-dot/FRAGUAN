import { useEffect, useRef, useState } from 'react';
import './fraguan-anim.css';

/** Categorías reales; conserva las filas también en pantallas táctiles. */
export default function ColeccionHover({ items = [] }) {
  const preview = useRef(null),
    frame = useRef(0),
    target = useRef({ x: 0, y: 0 });
  const [active, setActive] = useState(null);
  useEffect(() => () => cancelAnimationFrame(frame.current), []);
  const move = (event) => {
    if (
      window.matchMedia('(hover: none), (prefers-reduced-motion: reduce)')
        .matches
    )
      return;
    target.current = { x: event.clientX, y: event.clientY };
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      if (!preview.current) return;
      const { x, y } = target.current;
      const left = Math.max(8, Math.min(x + 24, window.innerWidth - 228));
      const top = Math.max(8, Math.min(y - 145, window.innerHeight - 298));
      preview.current.style.transform =
        'translate3d(' + left + 'px,' + top + 'px,0) rotate(-3deg)';
    });
  };
  return (
    <>
      <div className="fa-col" onMouseLeave={() => setActive(null)}>
        {items.map((item) => (
          <a
            key={item.nombre}
            href={item.href}
            onMouseMove={move}
            onMouseEnter={(event) => {
              move(event);
              setActive(item);
            }}
            onBlur={() => setActive(null)}
          >
            <span>{item.nombre}</span>
            <small>{item.cantidad}</small>
          </a>
        ))}
      </div>
      <div
        className={'fa-col-prev' + (active ? ' show' : '')}
        ref={preview}
        aria-hidden="true"
        style={{
          backgroundImage: active?.img
            ? 'url(' + JSON.stringify(active.img) + ')'
            : undefined,
        }}
      >
        {!active?.img && active?.nombre}
      </div>
    </>
  );
}
