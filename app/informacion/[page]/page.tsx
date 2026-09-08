import { notFound } from 'next/navigation';
import { StoreHeader } from '@/components/store-header';

const pages: Record<string, { eyebrow: string; title: string; intro: string; sections: { title: string; body: string }[] }> = {
  envios: {
    eyebrow: 'ENTREGA',
    title: 'Tu pedido, donde estés.',
    intro: 'Elegí envío por Correo Argentino o retiro en FRAGUAN durante el checkout.',
    sections: [
      { title: 'Costo y plazo', body: 'Ingresá tu código postal en el checkout para calcular el costo y el plazo estimado. El total se muestra antes de confirmar.' },
      { title: 'Seguimiento', body: 'Cuando despachemos tu compra vas a recibir el código por email y también quedará disponible en Mi FRAGUAN.' },
      { title: 'Retiro', body: 'El retiro en tienda no tiene costo. Esperá el aviso “Listo para retirar” antes de acercarte.' },
    ],
  },
  cambios: {
    eyebrow: 'CAMBIOS',
    title: 'Simple y trazable.',
    intro: 'Cada compra queda vinculada a su pedido para resolver cambios sin perder el historial.',
    sections: [
      { title: 'Qué necesitás', body: 'Conservá el comprobante y la prenda sin uso, con sus etiquetas y en las mismas condiciones en que fue entregada.' },
      { title: 'Disponibilidad', body: 'Los cambios de talle o color dependen del stock vigente. También podemos registrar el saldo a favor autorizado.' },
      { title: 'Cómo iniciar', body: 'Ingresá a Mi FRAGUAN, abrí el pedido y usá los datos de contacto informados en la confirmación de compra.' },
    ],
  },
  pagos: {
    eyebrow: 'PAGOS',
    title: 'Elegí cómo pagar.',
    intro: 'El checkout informa el precio final antes de confirmar el pedido.',
    sections: [
      { title: 'Transferencia', body: 'Tiene 10% de descuento. Usá el importe exacto y la referencia única del pedido para que podamos identificar el pago.' },
      { title: 'Tarjetas', body: 'El pago con crédito o débito se procesará mediante Mercado Pago cuando la integración productiva esté habilitada.' },
      { title: 'Seguridad', body: 'FRAGUAN no almacena los datos completos de tu tarjeta. La confirmación del pago se recibe directamente desde la pasarela.' },
    ],
  },
  privacidad: {
    eyebrow: 'PRIVACIDAD',
    title: 'Tus datos, con propósito.',
    intro: 'Usamos únicamente la información necesaria para gestionar compras, entregas, cuenta y beneficios.',
    sections: [
      { title: 'Datos de compra', body: 'Nombre, contacto y dirección se utilizan para procesar pedidos, enviar comprobantes y coordinar la entrega.' },
      { title: 'Cuenta y Club', body: 'El historial permite mostrar pedidos, puntos y cashback. La comunicación comercial requiere consentimiento.' },
      { title: 'Control', body: 'Podés cerrar sesión, darte de baja del newsletter y solicitar la revisión de tus datos mediante el canal de contacto de FRAGUAN.' },
    ],
  },
};

export default async function InformationPage({ params }: { params: Promise<{ page: string }> }) {
  const { page } = await params;
  const content = pages[page];
  if (!content) notFound();
  return (
    <div className="store-shell">
      <StoreHeader />
      <main className="store-information">
        <a href="/tienda">← Volver a la tienda</a>
        <header>
          <span>{content.eyebrow}</span>
          <h1>{content.title}</h1>
          <p>{content.intro}</p>
        </header>
        <section>
          {content.sections.map((item, index) => (
            <article key={item.title}>
              <span>{String(index + 1).padStart(2, '0')}</span>
              <h2>{item.title}</h2>
              <p>{item.body}</p>
            </article>
          ))}
        </section>
      </main>
    </div>
  );
}
