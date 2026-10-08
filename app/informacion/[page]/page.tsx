import { env } from 'cloudflare:workers';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

type Section = { title: string; body: string };
type Page = {
  eyebrow: string;
  title: string;
  intro: string;
  sections: Section[];
};

const pages: Record<string, Page> = {
  envios: {
    eyebrow: 'ENTREGA',
    title: 'Tu pedido, donde estés.',
    intro:
      'Recibí tu pedido en casa con Correo Argentino o retiralo sin cargo en la tienda FRAGUAN de Isla Verde, Córdoba. Elegí la modalidad de entrega antes de pagar.',
    sections: [
      {
        title: 'Preparación del pedido',
        body: 'Preparamos tu pedido y lo dejamos listo para despachar o retirar dentro de las 24 a 48 horas hábiles posteriores a la confirmación del pago. Este tiempo de preparación es independiente del plazo del transporte.',
      },
      {
        title: 'Costo y plazo del envío',
        body: 'Ingresá tu código postal para conocer el costo y el plazo estimado del envío antes de confirmar la compra. El plazo del transporte comienza cuando despachamos tu pedido, después de la preparación. Los tiempos de Correo Argentino son estimados.',
      },
      {
        title: 'Seguimiento',
        body: 'Cuando despachamos tu pedido, te enviamos el código de seguimiento por email. También podés consultarlo en Mi FRAGUAN y en la página de seguimiento de tu pedido.',
      },
      {
        title: 'Retiro en tienda',
        body: 'El retiro en FRAGUAN es gratuito. Esperá el aviso “Listo para retirar” antes de acercarte. Encontranos en Sarmiento 785, Isla Verde, Córdoba. Atendemos de lunes a sábado, de 10:00 a 12:30 y de 16:00 a 21:30. Para retirar, presentá el número de pedido y tu documento. También puede retirar otra persona: debe presentar el número de pedido y su propio documento.',
      },
      {
        title: 'Al recibir tu pedido',
        body: 'Revisá el paquete al recibirlo. Si llega abierto, dañado o con una prenda incorrecta, escribinos desde Contacto con el número de pedido para que podamos ayudarte.',
      },
    ],
  },
  cambios: {
    eyebrow: 'CAMBIOS Y DEVOLUCIONES',
    title: 'Simple y trazable.',
    intro:
      'Cada solicitud queda vinculada al pedido para resolverla sin perder el historial.',
    sections: [
      {
        title: 'Cambio comercial',
        body: 'Podés solicitar cambio de talle o color dentro de los 30 días corridos desde la entrega. La prenda debe estar sin uso, con etiquetas y en las mismas condiciones recibidas.',
      },
      {
        title: 'Disponibilidad',
        body: 'Los cambios dependen del stock vigente. Si la nueva prenda tiene otro precio, se informa la diferencia antes de confirmar. También puede emitirse saldo a favor.',
      },
      {
        title: 'Derecho de arrepentimiento',
        body: 'En compras a distancia podés revocar la compra dentro de los 10 días corridos desde la recepción, sin costo. No requiere cuenta: usá el Botón de arrepentimiento.',
      },
      {
        title: 'Producto con inconvenientes',
        body: 'Si recibiste un artículo incorrecto, dañado o con una falla, conservá el empaque y comunicate con Atención al Cliente para coordinar la solución.',
      },
      {
        title: 'Reintegros',
        body: 'Cuando corresponda un reintegro, se procesa al mismo medio de pago. La acreditación final depende de los tiempos de la entidad financiera.',
      },
    ],
  },
  pagos: {
    eyebrow: 'PAGOS',
    title: 'Elegí cómo pagar.',
    intro:
      'Siempre ves precio, descuentos, entrega y total final antes de confirmar.',
    sections: [
      {
        title: 'Transferencia',
        body: 'Tenés 10% de descuento. Transferí el importe exacto y usá la referencia indicada en tu pedido.',
      },
      {
        title: 'Tarjetas',
        body: 'Crédito y débito se procesan mediante Mercado Pago. FRAGUAN no recibe ni almacena los datos completos de tu tarjeta.',
      },
      {
        title: 'Confirmación',
        body: 'El stock se reserva al crear el pedido. La preparación comienza cuando el proveedor de pago confirma la acreditación.',
      },
    ],
  },
  talles: {
    eyebrow: 'GUÍA DE TALLES',
    title: 'Elegí con seguridad.',
    intro:
      'El talle puede variar según el calce y la construcción de cada prenda.',
    sections: [
      {
        title: 'Cómo medirte',
        body: 'Usá una cinta flexible, sin ajustar. Para pecho y cintura medí alrededor de la parte más amplia; para pantalones, compará también con una prenda que te quede bien.',
      },
      {
        title: 'Asistente de talle',
        body: 'En la ficha de cada producto podés ingresar tu altura, peso y cómo preferís usar la ropa para recibir una recomendación orientativa.',
      },
      {
        title: 'Entre dos talles',
        body: 'Elegí el mayor si preferís comodidad o el menor si buscás un calce cercano al cuerpo. Podés solicitar un cambio sujeto a disponibilidad.',
      },
    ],
  },
  privacidad: {
    eyebrow: 'PRIVACIDAD',
    title: 'Tus datos, con propósito.',
    intro:
      'Recopilamos lo necesario para comprar, entregar, proteger tu cuenta y ofrecer beneficios.',
    sections: [
      {
        title: 'Qué datos usamos',
        body: 'Identificación, email, teléfono, domicilio, historial de pedidos, preferencias, talle, recorrido de compra y datos técnicos de seguridad. Los datos de tarjeta quedan en la pasarela de pago.',
      },
      {
        title: 'Para qué',
        body: 'Procesar compras, prevenir fraude, entregar pedidos, atender cambios, mostrar Club FRAGUAN y enviar marketing únicamente cuando exista consentimiento.',
      },
      {
        title: 'Proveedores',
        body: 'Podemos compartir los datos mínimos necesarios con Google para autenticación, Mercado Pago para cobros, Correo Argentino para entregas y Resend para emails.',
      },
      {
        title: 'Conservación y seguridad',
        body: 'Conservamos datos mientras sean necesarios para la relación comercial, obligaciones legales y prevención de fraude. Aplicamos sesiones seguras, control de acceso y minimización de datos.',
      },
      {
        title: 'Tus derechos',
        body: 'Podés solicitar acceso, actualización, rectificación o supresión de tus datos. Verificaremos tu identidad antes de responder para proteger la cuenta.',
      },
      {
        title: 'Marketing',
        body: 'La suscripción y la recuperación de carrito son opcionales. Cada email comercial incluye un enlace para darte de baja. Medimos campañas sin guardar costos internos ni datos de tarjeta.',
      },
    ],
  },
  cookies: {
    eyebrow: 'COOKIES',
    title: 'Vos elegís.',
    intro:
      'La tienda separa el almacenamiento imprescindible de la medición opcional.',
    sections: [
      {
        title: 'Sesión',
        body: 'La cookie de Mi FRAGUAN mantiene la sesión iniciada y es HttpOnly, SameSite y segura en producción.',
      },
      {
        title: 'Carrito y favoritos',
        body: 'El navegador guarda localmente el carrito y los favoritos para que no se pierdan al cambiar de página.',
      },
      {
        title: 'Servicios externos',
        body: 'Google y Mercado Pago pueden usar sus propios mecanismos técnicos cuando elegís iniciar sesión o pagar. Sus políticas se muestran en esos servicios.',
      },
      {
        title: 'Medición propia',
        body: 'Con tu permiso registramos páginas, búsquedas, productos vistos y pasos de compra para mejorar la experiencia y medir campañas. No se activa al elegir “Solo esenciales”.',
      },
      {
        title: 'Recuperación',
        body: 'Solo asociamos un carrito con tu email cuando pedís expresamente ayuda para terminar la compra o cuando tu cuenta tiene comunicaciones autorizadas.',
      },
    ],
  },
  terminos: {
    eyebrow: 'TÉRMINOS Y CONDICIONES',
    title: 'Comprar, sin letra chica.',
    intro:
      'Estas condiciones regulan el uso de la tienda online y las compras realizadas en FRAGUAN.',
    sections: [
      {
        title: 'Catálogo y precios',
        body: 'Publicamos características, variantes, stock y precios en pesos argentinos con impuestos incluidos. Una compra queda confirmada cuando se acredita el pago.',
      },
      {
        title: 'Stock y errores',
        body: 'La creación del pedido reserva temporalmente el stock. Ante un error evidente de publicación o falta de stock no detectada, informaremos la situación y ofreceremos alternativas o reintegro.',
      },
      {
        title: 'Pagos y entrega',
        body: 'Los medios, descuentos, costos y plazos aparecen antes de confirmar. El cliente debe ingresar datos correctos y disponer de una persona que pueda recibir el pedido.',
      },
      {
        title: 'Cuenta',
        body: 'La cuenta es personal. El cliente debe proteger el acceso a Google o su contraseña y avisar si detecta actividad desconocida.',
      },
      {
        title: 'Cambios y arrepentimiento',
        body: 'Aplican la política de Cambios y devoluciones y los derechos irrenunciables previstos por la normativa argentina de defensa del consumidor.',
      },
      {
        title: 'Propiedad intelectual',
        body: 'FRAGUAN, su logo, textos, diseño y contenidos son de sus titulares y no pueden reproducirse comercialmente sin autorización.',
      },
      {
        title: 'Actualizaciones',
        body: 'La versión vigente se publica en este sitio. Los cambios no alteran pedidos ya confirmados ni reducen derechos reconocidos por ley.',
      },
    ],
  },
  contacto: {
    eyebrow: 'ATENCIÓN AL CLIENTE',
    title: 'Estamos para resolver.',
    intro:
      'Incluí siempre tu número de pedido para que podamos encontrar la compra rápido.',
    sections: [
      {
        title: 'Email',
        body: 'Escribinos a atencion@fraguan.com. Las notificaciones de pedido se envían desde el dominio de emails de FRAGUAN.',
      },
      {
        title: 'Horario',
        body: 'Atención al Cliente: lunes a sábado, de 10 a 21 hs.',
      },
      {
        title: 'Cambios',
        body: 'Para cambios comerciales usá Mi FRAGUAN o indicá pedido, prenda y talle requerido en tu consulta.',
      },
      {
        title: 'Arrepentimiento',
        body: 'La revocación de una compra online tiene un formulario público separado y genera un código inmediato.',
      },
    ],
  },
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ page: string }>;
}): Promise<Metadata> {
  const { page } = await params;
  const content = pages[page];
  if (!content)
    return { title: 'Información | FRAGUAN', robots: { index: false } };
  return {
    title: `${content.eyebrow.charAt(0)}${content.eyebrow.slice(1).toLowerCase()} | FRAGUAN`,
    description: content.intro,
    alternates: { canonical: `/informacion/${page}` },
  };
}

export default async function InformationPage({
  params,
}: {
  params: Promise<{ page: string }>;
}) {
  const { page } = await params;
  const source = pages[page];
  if (!source) notFound();
  const content =
    page === 'terminos'
      ? {
          ...source,
          sections: [
            {
              title: 'Proveedor',
              body: `${env.STORE_LEGAL_NAME || 'FRAGUAN'} · CUIT ${env.STORE_CUIT || 'pendiente de configuración'} · ${env.STORE_ADDRESS || 'domicilio comercial pendiente de configuración'} · ${env.STORE_SUPPORT_EMAIL || 'atencion@fraguan.com'}.`,
            },
            ...source.sections,
          ],
        }
      : source;
  const titles: Record<string, string> = {
    envios: 'Envíos',
    cambios: 'Cambios y devoluciones',
    pagos: 'Pagos',
    talles: 'Guía de talles',
    contacto: 'Contacto',
    terminos: 'Términos y condiciones',
    privacidad: 'Privacidad',
    cookies: 'Cookies',
  };
  return (
    <section className="sec lt pg">
      <b className="k">AYUDA</b>
      <h1 className="d h1">{titles[page] || content.title}</h1>
      <div className="txt">
        <p>{content.intro}</p>
        {content.sections.map((item) => (
          <div key={item.title}>
            <h2 className="design-text-title">{item.title}</h2>
            <p>{item.body}</p>
          </div>
        ))}
        {page === 'contacto' && (
          <p>
            <a
              className="btn a"
              href={
                'mailto:' + (env.STORE_SUPPORT_EMAIL || 'atencion@fraguan.com')
              }
            >
              ESCRIBINOS →
            </a>
          </p>
        )}
        {page === 'cambios' && (
          <a className="btn" href="/arrepentimiento">
            SOLICITAR CAMBIO O DEVOLUCIÓN →
          </a>
        )}
      </div>
    </section>
  );
}
