export const STORE_TRANSFER = {
  alias: 'fraguan.tienda.ar',
  holder: 'Cristian Jesus Bosshardt',
  document: '23758108',
  receiptEmail: 'hola@fraguan.com',
} as const;

export function transferReceiptMessage(reference: string) {
  return {
    subject: `Comprobante de pago · ${reference}`,
    body: `Hola FRAGUAN,\n\nAdjunto el comprobante de transferencia de mi pedido.\nReferencia única del pedido: ${reference}\n\nGracias.`,
  };
}
