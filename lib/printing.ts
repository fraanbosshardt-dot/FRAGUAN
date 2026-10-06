'use client';

/** Print an independent document so modal overflow cannot clip long tickets or label batches. */
export function printCommerce(kind: 'receipt' | 'labels' | 'pos-day') {
  const source = document.querySelector(
    kind === 'labels'
      ? '.print-labels'
      : kind === 'pos-day'
        ? '.pos-day-report'
        : '.receipt',
  );
  if (!source) throw new Error('No se encontró el comprobante para imprimir.');
  const frame = document.createElement('iframe');
  frame.title =
    kind === 'labels'
      ? 'Etiquetas FRAGUAN'
      : kind === 'pos-day'
        ? 'Resumen de ventas FRAGUAN'
        : 'Ticket FRAGUAN';
  frame.style.cssText = 'position:fixed;width:0;height:0;border:0';
  document.body.appendChild(frame);
  const doc = frame.contentDocument!;
  doc.title = frame.title;
  doc.documentElement.lang = 'es-AR';
  const style = doc.createElement('style');
  style.textContent = `
    *{box-sizing:border-box}body{margin:0;font:12px Arial,sans-serif;color:#000;background:#fff}
    .no-print,.receipt-check{display:none}h2{text-align:center;font-size:22px}
    .receipt{max-width:72mm;margin:auto}.receipt p{text-align:center}
    .receipt-line,.total-line,.summary-line{display:flex;justify-content:space-between;gap:8px;padding:8px 0;border-bottom:1px dashed #aaa;break-inside:avoid}
    .pos-day-stats{display:flex;flex-wrap:wrap;gap:16px}.pos-day-stats b{display:block}.pos-day-report .recent-list button{display:flex;justify-content:space-between;gap:16px;border:0;border-bottom:1px dashed #aaa;background:#fff;color:#000;width:100%;padding:8px 0;text-align:left}.pos-day-report svg{display:none}small{display:block;font-size:10px} .receipt-footer{text-align:center;margin-top:12px}
    .pos-report-card{margin:16px 0;break-inside:avoid}.pos-report-card h2{text-align:left;font-size:16px}.pos-records{list-style:none;padding:0}.pos-records li,.pos-records button{width:100%;display:flex;justify-content:space-between;gap:16px;text-align:left;border:0;background:#fff;color:#000;padding:6px 0}.pos-records li{border-bottom:1px dashed #aaa;break-inside:avoid}.pos-meter{display:flex;justify-content:space-between;gap:12px;padding:6px 0}.pos-meter meter{display:none}.pos-sales-chart{display:flex;align-items:end;gap:4px;flex-wrap:wrap}.pos-sales-chart button{display:flex;flex-direction:column;align-items:center;border:0;background:#fff;color:#000;min-width:50px;max-width:80px;font-size:9px;break-inside:avoid}.pos-sales-chart i{display:block;width:16px;background:#aaa;print-color-adjust:exact}.pos-gross-breakdown summary{font-weight:bold}.pos-gross-breakdown small{margin-top:8px}
    .print-labels{display:flex;flex-direction:column;width:48mm;margin:0 auto}
    .print-label{display:flex;flex-direction:column;justify-content:center;gap:1mm;min-height:48mm;width:48mm;padding:3mm 0;border-bottom:1px dashed #aaa;text-align:center;break-inside:avoid;overflow-wrap:anywhere}
    .print-label b{font-size:17px}.print-label strong{font-size:16px;letter-spacing:2px}.print-label svg{flex-shrink:0}
    .print-label .label-barcode{font-family:monospace;letter-spacing:0;font-size:11px}
    ${kind === 'labels' ? 'body{width:58mm;padding:0 5mm}.print-label svg{width:48mm!important;height:12mm!important}' : ''}
    @page{${kind === 'labels' ? 'size:auto;margin:0' : 'margin:4mm'}}
  `;
  doc.head.appendChild(style);
  if (kind === 'labels') {
    doc.body.appendChild(source.cloneNode(true));
  } else {
    const copy = source.cloneNode(true) as Element;
    copy
      .querySelectorAll('details')
      .forEach((detail) => detail.setAttribute('open', ''));
    doc.body.appendChild(copy);
  }
  frame.contentWindow!.addEventListener('afterprint', () => frame.remove(), {
    once: true,
  });
  frame.contentWindow!.focus();
  frame.contentWindow!.print();
  setTimeout(() => frame.remove(), 60000);
}
