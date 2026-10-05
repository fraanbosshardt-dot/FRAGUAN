import './fraguan-anim.css';

/**
 * 3. Etiqueta colgante. Cada vez que cambia el talle se vuelve a balancear.
 * Props: talle ("M"), nombre ("Camisa Oxford"), precio (59900)
 */
export default function EtiquetaTalle({ talle, nombre, precio }) {
  if (!talle) return null;
  return (
    <div className="fa-tag-wrap" key={talle}>
      <div className="fa-tag-string" />
      <div className="fa-tag">
        <small>Talle</small>
        <b>{talle}</b>
        {nombre && <small>{nombre}</small>}
        {precio != null && <em>$ {Number(precio).toLocaleString('es-AR')}</em>}
      </div>
    </div>
  );
}
