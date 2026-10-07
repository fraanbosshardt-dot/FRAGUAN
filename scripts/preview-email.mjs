import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import ts from 'typescript';

const template = { exports: {} };
// Trusted local template, with no external requests or email delivery.
// oxlint-disable-next-line typescript/no-implied-eval
new Function(
  'module',
  'exports',
  ts.transpileModule(readFileSync('lib/email-template.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText,
)(template, template.exports);
const { emailFrame, escapeHtml, orderEmail } = template.exports;
assert.equal(
  escapeHtml('<Hola & "vos">'),
  '&lt;Hola &amp; &quot;vos&quot;&gt;',
);
assert.ok(
  !emailFrame('<Título>', 'Texto', '<p>Contenido</p>', {
    label: 'Ir',
    url: 'javascript:alert(1)',
  }).includes('javascript:'),
);
const html = emailFrame(
  'TU ESTILO.\nTUS NOVEDADES.',
  'Vista previa del nuevo diseño de emails de FRAGUAN.',
  '<p style="margin:0 0 18px">Hola,</p><p style="margin:0 0 18px">Esta es la nueva identidad de nuestros emails: la misma esencia de la tienda, también en tu bandeja de entrada.</p><p style="margin:0">Desde acá vamos a acompañarte con las novedades de tu cuenta y tus compras.</p>',
  { label: 'Explorar FRAGUAN', url: 'https://www.fraguan.com' },
);
assert.ok(html.includes('role="presentation"'));
assert.ok(html.includes('max-width:600px'));
assert.ok(html.includes('#2440ff'));
mkdirSync('outputs', { recursive: true });
writeFileSync('outputs/fraguan-email-preview.html', html);
// Isolated preview fixtures: never inserted into the system or delivered.
const order = {
  orderNumber: 123,
  customerName: 'Vista previa',
  paymentMethod: 'transfer',
  transferReference: 'PREVIEW',
  shippingMethod: 'correo-argentino-home',
  trackingNumber: 'CODIGO-DE-VISTA-PREVIA',
  subtotal: 6990000,
  discount: 0,
  shipping: 890000,
  total: 7880000,
};
const items = [
  {
    productName: 'Prenda de vista previa',
    color: 'Negro',
    size: 'M',
    quantity: 1,
    lineTotal: 6990000,
  },
];
assert.ok(
  orderEmail(order, items, 'created').includes('todavía no confirma el pago'),
);
assert.ok(!orderEmail(order, items, 'created').includes('Seguir mi envío'));
const paid = orderEmail(order, items, 'paid');
assert.ok(paid.includes('COMPRA CONFIRMADA.'));
assert.ok(paid.includes('78.800'));
assert.ok(!paid.includes('Descuento aplicado'));
const shipped = orderEmail(order, items, 'shipped');
assert.ok(
  shipped.includes('https://www.correoargentino.com.ar/formularios/e-commerce'),
);
assert.ok(shipped.includes('CODIGO-DE-VISTA-PREVIA'));
assert.ok(
  !orderEmail(
    { ...order, shippingMethod: 'pickup' },
    items,
    'ready_pickup',
  ).includes('Seguir mi envío'),
);
assert.ok(
  !orderEmail({ ...order, trackingNumber: '' }, items, 'shipped').includes(
    'Seguir mi envío',
  ),
);
for (const event of [
  'created',
  'paid',
  'preparing',
  'ready_pickup',
  'shipped',
  'delivered',
]) {
  writeFileSync(
    `outputs/fraguan-email-${event}.html`,
    orderEmail(order, items, event),
  );
}
writeFileSync(
  'outputs/fraguan-email-welcome.html',
  emailFrame(
    'BIENVENIDO A FRAGUAN.',
    'Tu cuenta está lista.',
    '<p>Hola,</p><p>Tu cuenta ya está lista. Gracias por sumarte a FRAGUAN: menos vueltas, más vos.</p><p>En Mi FRAGUAN podés consultar tus pedidos, guardar tus prendas favoritas y completar tus datos para tu próxima compra.</p>',
    { label: 'Ver mi cuenta', url: 'https://www.fraguan.com/cuenta' },
  ),
);
console.log(
  'Template checks passed. Preview: outputs/fraguan-email-preview.html',
);
