import { useEffect, useRef, useState } from 'react';
import './fraguan-anim.css';

const money = (n) => '$ ' + Number(n).toLocaleString('es-AR');

/** 2. Barra de envío gratis. Props: subtotal (número), meta (default 150000) */
export default function BarraEnvioGratis({ subtotal = 0, meta = 150000 }) {
  const pct = Math.max(0, Math.min(100, (subtotal / meta) * 100));
  const gano = subtotal >= meta;
  const prev = useRef(subtotal);
  const [win, setWin] = useState(false);

  useEffect(() => {
    if (prev.current < meta && subtotal >= meta) {
      setWin(true);
    }
    prev.current = subtotal;
  }, [subtotal, meta]);

  useEffect(() => {
    if (!win) return;
    const timer = setTimeout(() => setWin(false), 2200);
    return () => clearTimeout(timer);
  }, [win]);

  return (
    <div className={'fa-ship' + (win ? ' win' : '')}>
      <p aria-live="polite" key={gano ? 'ok' : 'falta'}>
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
    </div>
  );
}
