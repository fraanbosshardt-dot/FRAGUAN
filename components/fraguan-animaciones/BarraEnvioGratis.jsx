import { useEffect, useRef, useState } from 'react';
import './fraguan-anim.css';

const money = (n) => '$ ' + Number(n).toLocaleString('es-AR');

/** 2. Barra de envío gratis. Props: subtotal (número), meta (default 150000) */
export default function BarraEnvioGratis({
  subtotal = 0,
  meta = 150000,
  ready = true,
}) {
  const pct = Math.max(0, Math.min(100, (subtotal / meta) * 100));
  const gano = subtotal >= meta;
  const prev = useRef(null);
  const [win, setWin] = useState(false);

  useEffect(() => {
    if (!ready) return;
    if (prev.current !== null && prev.current < meta && subtotal >= meta) {
      setWin(true);
    }
    if (subtotal < meta) setWin(false);
    prev.current = subtotal;
  }, [subtotal, meta, ready]);

  useEffect(() => {
    if (!win) return;
    const timer = setTimeout(() => setWin(false), 4200);
    return () => clearTimeout(timer);
  }, [win]);

  return (
    <div className={'fa-ship' + (gano ? ' earned' : '') + (win ? ' win' : '')}>
      <p aria-live="polite" aria-atomic="true">
        {gano
          ? '¡Envío gratis desbloqueado! ✦'
          : `Te faltan ${money(meta - subtotal)} para envío gratis`}
      </p>
      <progress
        className="fa-ship-accessible"
        aria-label="Progreso hacia envío gratis"
        value={pct}
        max={100}
      />
      <div className="fa-ship-bar" aria-hidden="true">
        <div className="fa-ship-fill" style={{ width: pct + '%' }} />
      </div>
      <div className="fa-ship-celebration" aria-hidden="true">
        <div className="fa-ship-clip">
          <div className="fa-ship-content">
            <span className="fa-ship-check">
              <svg viewBox="0 0 40 40" fill="none">
                <circle cx="20" cy="20" r="18" />
                <path d="m11 20 6 6 12-13" />
              </svg>
              <i />
              <i />
              <i />
              <i />
            </span>
            <div className="fa-ship-copy">
              <strong>¡LO CONSEGUISTE!</strong>
              <span>El envío va por nuestra cuenta.</span>
            </div>
            <svg className="fa-ship-truck" viewBox="0 0 48 40" fill="none">
              <path className="fa-ship-road" d="M3 35h42" />
              <g>
                <path d="M7 10h22v19H7zM29 18h7l6 7v4H29" />
                <path d="M33 18v7h9M3 16h9M1 22h8" />
                <circle cx="15" cy="30" r="4" />
                <circle cx="35" cy="30" r="4" />
              </g>
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}
