import { STORE_TRANSFER } from './store-transfer-details';
/** Store palette from app/store-design.css. Inline styles keep email clients usable. */
export const emailTheme = {
  ink: '#14110f',
  blue: '#2440ff',
  lavender: '#93a3ff',
  bone: '#f2eee6',
  sand: '#e4ded1',
};

export function escapeHtml(value: unknown) {
  return (
    typeof value === 'string' || typeof value === 'number' ? String(value) : ''
  ).replace(
    /[&<>'"]/g,
    (char) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[
        char
      ]!,
  );
}

export function emailFrame(
  title: string,
  preheader: string,
  content: string,
  action?: { label: string; url: string },
) {
  // Never render executable URL schemes, including URLs supplied in campaign forms.
  const actionUrl =
    action && /^https?:\/\//i.test(action.url) ? action.url : '';
  const button = actionUrl
    ? `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin-top:30px"><tr><td bgcolor="${emailTheme.blue}" style="background:${emailTheme.blue};mso-padding-alt:17px 24px"><a href="${escapeHtml(actionUrl)}" style="display:inline-block;padding:17px 24px;color:#ffffff;font-size:13px;font-weight:700;letter-spacing:.04em;text-decoration:none;text-transform:uppercase">${escapeHtml(action!.label)} &rarr;</a></td></tr></table>`
    : '';
  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${escapeHtml(title)}</title>
<style>@font-face{font-family:Anton;src:url('https://www.fraguan.com/fonts/anton-latin-v1.woff2')}@font-face{font-family:'DM Sans';src:url('https://www.fraguan.com/fonts/dm-sans-latin-v1.woff2')}body,p,h1{margin:0}a{color:inherit}@media only screen and (max-width:600px){.email-pad{padding:30px 24px!important}.email-title{font-size:38px!important}.email-wrap{width:100%!important}.email-footer{padding:28px 24px!important}}</style></head>
<body style="margin:0;padding:0;background:${emailTheme.bone};color:${emailTheme.ink};font-family:'DM Sans',Arial,Helvetica,sans-serif;-webkit-text-size-adjust:100%">
<div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all">${escapeHtml(preheader)}</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="${emailTheme.bone}"><tr><td align="center" style="padding:24px 0">
<!--[if mso]><table role="presentation" width="600"><tr><td><![endif]-->
<table role="presentation" class="email-wrap" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;width:100%">
<tr><td align="center" bgcolor="${emailTheme.blue}" style="padding:12px 20px;color:#ffffff;font-size:11px;line-height:18px;letter-spacing:.15em;font-weight:700">FORJÁ TU ESTILO. &nbsp; MÁS VOS.</td></tr>
<tr><td bgcolor="${emailTheme.ink}" style="padding:25px 32px"><a href="https://www.fraguan.com" style="font-family:Anton,Impact,'Arial Narrow',Arial,sans-serif;font-size:36px;line-height:42px;font-weight:400;color:${emailTheme.bone};text-decoration:none;letter-spacing:-1px">FRAGUAN</a></td></tr>
<tr><td class="email-pad" bgcolor="${emailTheme.bone}" style="padding:44px 32px 46px">
<p style="margin:0 0 18px;font-size:11px;line-height:18px;letter-spacing:.15em;font-weight:700;color:${emailTheme.blue}">MI FRAGUAN</p>
<h1 class="email-title" style="margin:0 0 26px;font-family:Anton,Impact,'Arial Narrow',Arial,sans-serif;font-size:48px;line-height:1.14;font-weight:400;letter-spacing:-.025em;overflow-wrap:break-word">${escapeHtml(title)}</h1>
<div style="font-size:16px;line-height:1.75;color:${emailTheme.ink}">${content.replace(/<p>/g, '<p style="margin:0 0 18px">')}</div>
${button}
</td></tr>
<tr><td bgcolor="${emailTheme.sand}" style="padding:20px 32px;border-top:1px solid #cdc0a8;font-size:13px;line-height:22px">¿Necesitás ayuda? <a href="mailto:hola@fraguan.com" style="font-weight:700;text-decoration:underline;color:${emailTheme.ink}">Escribinos</a>.</td></tr>
<tr><td class="email-footer" bgcolor="${emailTheme.ink}" style="padding:32px;color:${emailTheme.bone}"><p style="margin:0 0 20px;font-family:Anton,Impact,'Arial Narrow',Arial,sans-serif;font-size:30px;line-height:1.2;font-weight:400">MENOS VUELTAS.<br><span style="color:${emailTheme.lavender}">MÁS VOS.</span></p><p style="margin:0 0 18px;font-size:12px;line-height:24px"><a href="https://www.fraguan.com/cuenta" style="color:${emailTheme.bone};text-decoration:underline">Mi cuenta</a> &nbsp; / &nbsp; <a href="https://www.fraguan.com" style="color:${emailTheme.bone};text-decoration:underline">La tienda</a></p><p style="margin:0;font-size:11px;line-height:20px;color:${emailTheme.bone}">FRAGUAN · Isla Verde, Córdoba, Argentina</p></td></tr>
</table><!--[if mso]></td></tr></table><![endif]-->
</td></tr></table></body></html>`;
}

export function verificationEmail(code: string) {
  return emailFrame(
    'CONFIRMÁ TU EMAIL.',
    `${code} es tu código de verificación FRAGUAN. Vence en 10 minutos.`,
    `<p>Ingresá este código en FRAGUAN para verificar tu email y continuar:</p><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:26px 0"><tr><td align="center" bgcolor="${emailTheme.sand}" style="padding:22px 12px;border:1px solid #cdc0a8;font-family:Consolas,'Courier New',monospace;font-size:36px;font-weight:700;line-height:1.3;letter-spacing:.12em;color:${emailTheme.ink}">${escapeHtml(code)}</td></tr></table><p>El código vence en <strong>10 minutos</strong>. No lo compartas con nadie.</p><p>Si no solicitaste este código, ignorá este mensaje.</p><p style="font-size:13px">Este email es automático. No respondas a noreply@fraguan.com; si necesitás ayuda, escribinos a hola@fraguan.com.</p>`,
  );
}

export const orderEmailTitles = {
  created: 'RECIBIMOS TU PEDIDO.',
  paid: 'COMPRA CONFIRMADA.',
  preparing: 'ESTAMOS PREPARANDO TU COMPRA.',
  ready_pickup: 'TU PEDIDO ESTÁ LISTO.',
  shipped: 'TU PEDIDO YA SALIÓ.',
  delivered: '¡GRACIAS POR ELEGIRNOS!',
} as const;

type OrderEmailItem = {
  productName: string;
  color: string;
  size: string;
  quantity: number;
  lineTotal: number;
};

export function orderEmail(
  order: {
    trackingUrl?: string;
    orderNumber: number;
    customerName: string;
    paymentMethod: string;
    transferReference?: string;
    shippingMethod?: string;
    trackingNumber?: string;
    subtotal: number;
    discount: number;
    shipping: number;
    total: number;
  },
  items: OrderEmailItem[],
  event: keyof typeof orderEmailTitles,
) {
  const money = (value: number) =>
    new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      maximumFractionDigits: 2,
    }).format(Number(value) / 100);
  const number = escapeHtml(order.orderNumber);
  const message = {
    created:
      order.paymentMethod === 'transfer'
        ? 'Tu pedido está registrado. Vamos a confirmar tu compra cuando verifiquemos la transferencia. Este email todavía no confirma el pago.'
        : 'Tu pedido está registrado. Te enviaremos la confirmación cuando el pago esté aprobado.',
    paid: 'Confirmamos tu pago. Gracias por tu compra: te avisaremos cuando tu pedido esté listo para retirar o salga hacia tu domicilio, según la entrega que elegiste.',
    preparing:
      'Ya estamos preparando tus prendas. Te avisaremos por email cuando estén listas para retirar o cuando despachemos el envío.',
    ready_pickup:
      'Tus prendas están listas para retirar en nuestro local de Isla Verde, Córdoba. Presentá tu documento y el número de pedido al buscarlas.',
    shipped: order.trackingNumber
      ? 'Despachamos tu pedido. Abajo tenés el código de seguimiento para consultar los movimientos de tu envío.'
      : 'Despachamos tu pedido. Si necesitás el código de seguimiento, escribinos para consultarlo.',
    delivered:
      'Registramos la entrega de tu pedido. Esperamos que disfrutes tus prendas. Si necesitás ayuda con tu compra, escribinos.',
  }[event];
  const itemRows = items
    .map(
      (item) =>
        `<tr><td style="padding:16px 0;border-bottom:1px solid #cdc0a8;font-size:14px;line-height:22px"><strong>${escapeHtml(item.productName)}</strong><br><span>${escapeHtml([item.color, item.size && 'Talle ' + item.size].filter(Boolean).join(' · '))} · Cantidad ${escapeHtml(item.quantity)}</span></td><td align="right" valign="top" style="padding:16px 0 16px 12px;border-bottom:1px solid #cdc0a8;font-size:14px;line-height:22px;white-space:nowrap">${escapeHtml(money(item.lineTotal))}</td></tr>`,
    )
    .join('');
  const totalRow = (label: string, value: number, bold = false) =>
    `<tr><td style="padding:7px 0;font-size:${bold ? 17 : 14}px;font-weight:${bold ? 700 : 400}">${label}</td><td align="right" style="padding:7px 0 7px 12px;font-size:${bold ? 17 : 14}px;font-weight:${bold ? 700 : 400};white-space:nowrap">${escapeHtml(money(value))}</td></tr>`;
  const summary = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:28px 0"><tr><td colspan="2" style="font-size:12px;font-weight:700;letter-spacing:.08em;border-bottom:2px solid ${emailTheme.ink};padding-bottom:12px">TU PEDIDO #${number}</td></tr>${itemRows}${totalRow('Subtotal', order.subtotal)}${Number(order.discount) > 0 ? totalRow('Descuento aplicado', -order.discount) : ''}${totalRow(order.shippingMethod === 'pickup' ? 'Retiro en el local' : 'Envío', order.shipping)}${totalRow('Total', order.total, true)}</table>`;
  const reference =
    event === 'created' &&
    order.paymentMethod === 'transfer' &&
    order.transferReference
      ? `<p>Transferí ${escapeHtml(money(order.total))} al alias <strong>${escapeHtml(STORE_TRANSFER.alias)}</strong>.<br>Titular: ${escapeHtml(STORE_TRANSFER.holder)} · DNI ${escapeHtml(STORE_TRANSFER.document)}.</p><p>Referencia única de tu pedido: <strong>${escapeHtml(order.transferReference)}</strong>.</p><p>Si ya transferiste, mandá el comprobante a <a href="mailto:${STORE_TRANSFER.receiptEmail}">${STORE_TRANSFER.receiptEmail}</a> con esta referencia. Vamos a confirmar tu pago después de verificar la transferencia.</p>`
      : '';
  const tracking =
    event === 'shipped' && order.trackingNumber
      ? `<p>Código de seguimiento: <strong>${escapeHtml(order.trackingNumber)}</strong>.</p>`
      : '';
  const carrierUrl =
    event === 'shipped' &&
    order.trackingNumber &&
    order.shippingMethod === 'correo-argentino-home'
      ? 'https://www.correoargentino.com.ar/formularios/e-commerce'
      : '';
  return emailFrame(
    orderEmailTitles[event],
    `Pedido #${order.orderNumber} · ${orderEmailTitles[event]}`,
    `<p>Hola ${escapeHtml(order.customerName)},</p><p>${message}</p>${reference}${tracking}${carrierUrl ? '<p>Ingresá ese código en el seguimiento de Correo Argentino.</p>' : ''}${summary}`,
    order.trackingUrl
      ? { label: 'Ver mi pedido', url: order.trackingUrl }
      : carrierUrl
      ? { label: 'Seguir mi envío', url: carrierUrl }
      : { label: 'Volver a la tienda', url: 'https://www.fraguan.com' },
  );
}
