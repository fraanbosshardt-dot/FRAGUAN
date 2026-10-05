'use client';
import { useEffect, useState, useRef, type CSSProperties } from 'react';
import './PagoAprobado.css';

const money = (n: number) =>
  '$ ' + Number(n).toLocaleString('es-AR', { maximumFractionDigits: 2 });
const num = (n: number) =>
  Number(n).toLocaleString('es-AR', { maximumFractionDigits: 2 });
export type PagoAprobadoProps = {
  status: 'processing' | 'approved';
  pedido?: string | number;
  items?: {
    nombre: string;
    variante: string;
    talle: string;
    precio: number;
    cantidad: number;
  }[];
  subtotal?: number;
  descuento?: number;
  envio?: number;
  total?: number;
  metodo?: string;
  fecha?: Date;
  onPrinted?: () => void;
};

/**
 * Props:
 *  status    "processing" | "approved"   (lo controlás desde tu checkout)
 *  pedido    número de pedido real
 *  items     [{ nombre, variante, talle, precio, cantidad }]
 *  subtotal, descuento, envio, total   (números)
 *  metodo    "Transferencia" | "Tarjeta" | ...
 *  fecha     Date (opcional, default: ahora)
 *  onPrinted callback cuando termina de imprimir (opcional)
 */
export default function PagoAprobado({
  status,
  pedido,
  items = [],
  subtotal = 0,
  descuento = 0,
  envio = 0,
  total = 0,
  metodo,
  fecha,
  onPrinted,
}: PagoAprobadoProps) {
  const [phase, setPhase] = useState(
    status === 'approved' ? 'approved' : 'processing',
  );
  const [date] = useState(() => fecha || new Date());
  const ticket = useRef<HTMLDivElement>(null);
  const printed = useRef(onPrinted);
  printed.current = onPrinted;
  const [ticketHeight, setTicketHeight] = useState(0);
  const isProcessing = phase === 'processing';

  useEffect(() => {
    if (status !== 'approved' || !ticket.current) return;
    const element = ticket.current;
    const measure = () =>
      setTicketHeight(Math.ceil(element.getBoundingClientRect().height));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [status, items, isProcessing]);

  useEffect(() => {
    if (status !== 'approved') {
      setPhase('processing');
      return;
    }
    setPhase('approved');
    const t1 = setTimeout(() => setPhase('printing'), 1800);
    const t2 = setTimeout(() => {
      setPhase('done');
      printed.current?.();
    }, 1800 + 4400);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [status]);

  const showPrinter =
    phase === 'approved' || phase === 'printing' || phase === 'done';
  const printing = phase === 'printing';
  const done = phase === 'done';

  return (
    <div className="pa">
      <output className="pa-status" aria-live="polite">
        {phase === 'processing' ? (
          <>
            <div className="pa-spin" />
            <h1>PROCESANDO PAGO</h1>
            <p>No cierres esta ventana</p>
          </>
        ) : (
          <>
            <svg className="pa-check" viewBox="0 0 56 56" aria-hidden="true">
              <circle cx="28" cy="28" r="24" />
              <path d="M17 29l8 8 15-17" />
            </svg>
            <h1>PAGO APROBADO</h1>
            <p>{done ? 'Ticket impreso' : 'Estamos imprimiendo tu ticket…'}</p>
          </>
        )}
      </output>

      {showPrinter && (
        <div className="pa-printer">
          <div
            className={
              'pa-body' + (printing ? ' work' : '') + (done ? ' done' : '')
            }
          >
            <div className="pa-lights">
              <span className="pa-led" />
              <span>{done ? 'LISTO' : 'IMPRIMIENDO'}</span>
            </div>
            <div className="pa-slot" />
          </div>

          <div
            className={'pa-feed' + (printing || done ? ' open' : '')}
            style={
              { '--pa-ticket-height': `${ticketHeight}px` } as CSSProperties
            }
          >
            <div
              ref={ticket}
              className={'pa-ticket' + (printing || done ? ' go' : '')}
            >
              <div className="c">
                <div className="pa-brand">FRAGUAN</div>
                <div>Tienda oficial · fraguan.com</div>
              </div>
              <hr />
              <div className="l">
                <span>Pedido</span>
                <b>#{pedido}</b>
              </div>
              <div className="l">
                <span>Fecha</span>
                <span>
                  {date.toLocaleDateString('es-AR')}{' '}
                  {date.toLocaleTimeString('es-AR', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
              <div className="l">
                <span>Pago</span>
                <span>{metodo}</span>
              </div>
              <hr />
              {items.map((it, i) => (
                <div key={i}>
                  <div className="l">
                    <span>
                      {it.cantidad || 1}x {it.nombre}
                    </span>
                    <span>{num((it.cantidad || 1) * it.precio)}</span>
                  </div>
                  <div className="sub">
                    &nbsp;&nbsp;{it.variante}
                    {it.talle ? ` · T.${it.talle}` : ''}
                  </div>
                </div>
              ))}
              <hr />
              <div className="l">
                <span>Subtotal</span>
                <span>{num(subtotal)}</span>
              </div>
              {descuento > 0 && (
                <div className="l">
                  <span>Descuentos</span>
                  <span>-{num(descuento)}</span>
                </div>
              )}
              <div className="l">
                <span>Envío</span>
                <span>{envio ? num(envio) : 'Gratis'}</span>
              </div>
              <hr />
              <div className="l tot">
                <span>TOTAL</span>
                <span>{money(total)}</span>
              </div>
              <hr />
              <div className="c">
                PAGO APROBADO ✓<br />
                Forjá tu estilo. Todos los días.
              </div>
              <div className="pa-bars" />
              <div className="c" style={{ marginTop: 6 }}>
                ¡Gracias por tu compra!
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
