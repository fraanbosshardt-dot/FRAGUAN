import './fraguan-anim.css';

/** Lista de categorías sin tarjetas flotantes que tapen el contenido. */
export default function ColeccionHover({ items = [] }) {
  return (
    <div className="fa-col">
      {items.map((item) => (
        <a key={item.nombre} href={item.href}>
          <span>{item.nombre}</span>
          <small>{item.cantidad}</small>
        </a>
      ))}
    </div>
  );
}
