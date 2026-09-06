'use client';

/** Print an independent document so modal overflow cannot clip long tickets or label batches. */
export function printCommerce(kind: 'receipt' | 'labels') {
  const source = document.querySelector(
    kind === 'labels' ? '.print-labels' : '.receipt',
  );
  if (!source) throw new Error('No se encontró el comprobante para imprimir.');
  const frame = document.createElement('iframe');
  frame.title = kind === 'labels' ? 'Etiquetas FRAGUAN' : 'Ticket FRAGUAN';
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
    small{display:block;font-size:10px} .receipt-footer{text-align:center;margin-top:12px}
    .label-sheet{display:grid;grid-template-columns:repeat(2,1fr);gap:5mm;break-after:page}
    .label-sheet:last-child{break-after:auto}
    .print-label{display:flex;flex-direction:column;justify-content:center;gap:1mm;height:55mm;padding:3mm;border:1px solid #ccc;text-align:center;break-inside:avoid;overflow-wrap:anywhere}
    .print-label b{font-size:17px}.print-label strong{font-size:16px;letter-spacing:2px}.print-label svg{flex-shrink:0}
    @page{${kind === 'labels' ? 'size:A4;margin:8mm' : 'margin:4mm'}}
  `;
  doc.head.appendChild(style);
  if (kind === 'labels') {
    const labels = Array.from(source.children);
    for (let start = 0; start < labels.length; start += 8) {
      const page = doc.createElement('section');
      page.className = 'label-sheet';
      labels
        .slice(start, start + 8)
        .forEach((label) => page.appendChild(label.cloneNode(true)));
      doc.body.appendChild(page);
    }
  } else doc.body.appendChild(source.cloneNode(true));
  frame.contentWindow!.addEventListener('afterprint', () => frame.remove(), {
    once: true,
  });
  frame.contentWindow!.focus();
  frame.contentWindow!.print();
  setTimeout(() => frame.remove(), 60000);
}
