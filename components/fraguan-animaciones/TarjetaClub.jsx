import './fraguan-anim.css';

/**
 * 6. Tarjeta del Club: entra, y el nombre se "estampa" con un golpe seco.
 * Props: nombre, desde ("OCT 2026"), numero ("0001"), activo (true para disparar; cambiá el key para repetir)
 * Mostrala cuando se crea la cuenta (activo={cuentaCreada}).
 */
/** @param {{nombre: string, desde?: string, numero?: string, activo?: boolean}} props */
export default function TarjetaClub({ nombre, desde, numero, activo = true }) {
  const fecha =
    desde ||
    new Date()
      .toLocaleDateString('es-AR', { month: 'short', year: 'numeric' })
      .toUpperCase();
  return (
    <output
      aria-label={`Bienvenido al Club Fraguan, ${nombre}`}
      className={'fa-card' + (activo ? ' in' : '')}
    >
      <div className="fa-card-brand">
        FRAGUAN
        <small>CLUB</small>
      </div>
      <div>
        <span className="fa-ring" />
        <div className="fa-stamp">{nombre}</div>
      </div>
      <div className="fa-card-foot">
        <span>SOCIO DESDE {fecha}</span>
        {numero && <span>N° {numero}</span>}
      </div>
    </output>
  );
}
