import { env } from 'cloudflare:workers';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { STORE_TRANSFER } from '@/lib/store-transfer-details';

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
        body: 'Podés solicitar un cambio de talle o color dentro de los 7 días corridos desde la entrega. La prenda debe estar sin uso, con sus etiquetas y en las mismas condiciones en que la recibiste. Los cambios están sujetos a stock.',
      },
      {
        title: 'Disponibilidad',
        body: 'Si elegís una prenda de mayor valor, abonás la diferencia. Te informamos el importe antes de confirmar el cambio. Nuestra política comercial no contempla devoluciones por preferencia personal, sin afectar el derecho de arrepentimiento de las compras online ni los derechos ante productos con fallas.',
      },
      {
        title: 'Derecho de arrepentimiento',
        body: 'En compras online podés ejercer el derecho de arrepentimiento dentro de los 10 días corridos desde la entrega o la celebración del contrato, lo que ocurra después, según la normativa vigente. No necesitás una cuenta: usá el Botón de arrepentimiento. Los gastos de devolución corresponden a FRAGUAN. Este derecho es independiente del plazo de 7 días para cambios comerciales.',
      },
      {
        title: 'Producto con inconvenientes',
        body: 'Si recibiste una prenda incorrecta, dañada o con una falla, escribinos a hola@fraguan.com con el número de pedido y una descripción del problema. Si podés, adjuntá fotos para ayudarnos a revisarlo. Coordinaremos la solución que corresponda. El plazo comercial de 7 días no limita tus derechos ante una falla.',
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
        body: `Tenés 10% de descuento por transferencia. Transferí el total indicado en tu pedido al alias ${STORE_TRANSFER.alias}, a nombre de ${STORE_TRANSFER.holder}. Enviá el comprobante a ${STORE_TRANSFER.receiptEmail} e incluí la referencia única del pedido para identificar tu pago.`,
      },
      {
        title: 'Tarjetas',
        body: 'Crédito y débito se procesan mediante Mercado Pago. FRAGUAN no recibe ni almacena los datos completos de tu tarjeta.',
      },
      {
        title: 'Confirmación',
        body: 'Al crear el pedido, tus prendas quedan reservadas durante el tiempo indicado en pantalla. La preparación comienza después de confirmar el pago. Si pagás por transferencia, revisamos la acreditación y el comprobante; si pagás con tarjeta, recibimos la confirmación del pago a través de Mercado Pago.',
      },
      {
        title: 'Compras con retiro en tienda',
        body: 'Las compras online con retiro en FRAGUAN se pagan desde la web, por transferencia o con tarjeta. El retiro en el local no tiene cargo. Esperá el aviso de que tu pedido está listo antes de acercarte.',
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
        body: 'Usá una cinta flexible, sin ajustar: medí el pecho en su parte más amplia y la cintura a su altura natural. Compará con las medidas disponibles en la ficha del producto y con una prenda que te quede cómoda. Tené en cuenta el tipo de prenda y el calce que buscás.',
      },
      {
        title: 'Asistente de talle',
        body: 'En la ficha del producto podés ingresar tu altura, peso y cómo preferís usar la ropa. La recomendación es orientativa: no reemplaza las medidas de la prenda ni garantiza un calce exacto. Si tenés dudas, escribinos antes de comprar.',
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
      'Usamos los datos necesarios para gestionar tus compras, entregar tus pedidos, proteger tu cuenta y atender tus consultas.',
    sections: [
      {
        title: 'Qué datos usamos',
        body: 'Identificación, email, teléfono, domicilio, historial de pedidos, preferencias, talle, recorrido de compra y datos técnicos de seguridad. Los datos de tarjeta quedan en la pasarela de pago.',
      },
      {
        title: 'Para qué',
        body: 'Gestionar compras y pagos, entregar pedidos, prevenir fraude y atender consultas y cambios. También los usamos para guardar tus datos y favoritos si creás una cuenta. Las novedades y promociones se envían cuando las autorizás; crear una cuenta no garantiza beneficios del Club FRAGUAN.',
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
        body: 'Podés actualizar tus datos desde Mi FRAGUAN o solicitar acceso, rectificación o supresión escribiendo a hola@fraguan.com. Verificamos tu identidad para proteger tu información. La eliminación puede estar limitada por obligaciones legales de conservación de las compras.',
      },
      {
        title: 'Marketing',
        body: 'Recibir novedades o ayuda para completar una compra es opcional. Podés retirar tu autorización mediante el enlace de baja de los emails comerciales. Los mensajes necesarios sobre un pedido, su pago o su entrega se gestionan por separado de las promociones.',
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
        body: 'Usamos una cookie necesaria para mantener tu sesión en Mi FRAGUAN y proteger el acceso a tu cuenta. No se utiliza para publicidad.',
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
        body: 'Podés pagar por transferencia con 10% de descuento o con tarjeta de débito o crédito mediante Mercado Pago. El total y el costo de entrega se muestran antes de confirmar. Enviamos a domicilio con Correo Argentino o podés retirar sin cargo en FRAGUAN. Preparamos los pedidos dentro de las 24 a 48 horas hábiles posteriores a la confirmación del pago; el plazo de transporte se cuenta desde el despacho. Ingresá datos correctos para coordinar la entrega.',
      },
      {
        title: 'Cuenta',
        body: 'Crear una cuenta es opcional: también podés comprar como invitado, verificando tu email. Mi FRAGUAN permite consultar pedidos, guardar favoritos y actualizar datos para próximas compras. Protegé tu acceso y avisá a hola@fraguan.com si detectás actividad desconocida. La cuenta no garantiza beneficios del Club FRAGUAN, que todavía no está definido.',
      },
      {
        title: 'Cambios y arrepentimiento',
        body: 'Los cambios comerciales de talle o color pueden solicitarse dentro de los 7 días corridos desde la entrega, con la prenda sin uso y con etiquetas, sujetos a stock. Este plazo no limita los derechos por fallas ni el derecho de arrepentimiento de las compras online. Consultá la política de Cambios y devoluciones para conocer el procedimiento.',
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
      'Escribinos para consultar sobre prendas, compras o entregas. Si tu consulta es sobre una compra, incluí el número o la referencia única del pedido.',
    sections: [
      {
        title: 'Email',
        body: 'Atención al Cliente: hola@fraguan.com. También podés enviar a esta dirección el comprobante de una transferencia, con la referencia única del pedido.',
      },
      {
        title: 'Horario',
        body: 'Encontranos en Sarmiento 785, Isla Verde, Córdoba. Atendemos de lunes a sábado, de 10:00 a 12:30 y de 16:00 a 21:30. Para retirar una compra online, esperá primero el aviso de que el pedido está listo.',
      },
      {
        title: 'Cambios',
        body: 'Para solicitar un cambio, escribinos con el número de pedido, la prenda y el talle o color que necesitás. Revisaremos el stock y te indicaremos cómo continuar.',
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
              body: `${env.STORE_LEGAL_NAME || 'Cristian Jesús Bosshardt (FRAGUAN)'} · CUIT ${env.STORE_CUIT || '20-23758108-4'} · ${env.STORE_ADDRESS || 'Sarmiento 785, Isla Verde, Córdoba, Argentina'} · hola@fraguan.com.`,
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
            <a className="btn a" href="mailto:hola@fraguan.com">
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
