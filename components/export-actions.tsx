'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { workbook, Sheet } from '@/lib/workbook';
export function ExportActions({
  sheets,
  name,
}: {
  sheets: Sheet[];
  name: string;
}) {
  const [sheetIndex, setSheetIndex] = useState(0);
  function csv() {
    const sheet = sheets[sheetIndex] ?? sheets[0];
    if (!sheet) return;
    const cell = (value: unknown) => {
      let text =
        typeof value === 'number'
          ? String(value).replace('.', ',')
          : String(value ?? '');
      if (typeof value !== 'number' && /^\s*[=+\-@]/.test(text))
        text = "'" + text;
      return '"' + text.replaceAll('"', '""') + '"';
    };
    const content = [sheet.columns, ...sheet.rows]
      .map((row) => row.map(cell).join(';'))
      .join('\r\n');
    const url = URL.createObjectURL(
      new Blob(['\ufeff' + content], { type: 'text/csv;charset=utf-8' }),
    );
    const a = document.createElement('a');
    a.href = url;
    a.download = `fraguan-${name}-${sheet.name}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function download() {
    const file = workbook(sheets);
    const url = URL.createObjectURL(
      new Blob([new Uint8Array(file)], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      }),
    );
    const a = document.createElement('a');
    a.href = url;
    a.download = `fraguan-${name}.xlsx`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function print() {
    const frame = document.createElement('iframe');
    frame.title = 'Reporte para imprimir';
    frame.style.cssText = 'position:fixed;width:0;height:0;border:0';
    document.body.appendChild(frame);
    const doc = frame.contentDocument!;
    doc.title = `FRAGUAN · ${name}`;
    const style = doc.createElement('style');
    style.textContent =
      'body{font:12px Arial,sans-serif;color:#111}table{border-collapse:collapse;width:100%;margin-bottom:24px}th,td{border-bottom:1px solid #ccc;text-align:left;padding:6px}thead{display:table-header-group}tr{break-inside:avoid}@page{size:landscape;margin:12mm}';
    doc.head.appendChild(style);
    for (const sheet of sheets) {
      const heading = doc.createElement('h2');
      heading.textContent = `FRAGUAN · ${sheet.name}`;
      doc.body.appendChild(heading);
      const table = doc.createElement('table');
      const head = table.createTHead().insertRow();
      sheet.columns.forEach((label) => {
        const th = doc.createElement('th');
        th.textContent = label;
        head.appendChild(th);
      });
      const body = table.createTBody();
      sheet.rows.forEach((row) => {
        const tr = body.insertRow();
        row.forEach((value) => {
          tr.insertCell().textContent = String(value ?? '');
        });
      });
      doc.body.appendChild(table);
    }
    frame.contentWindow!.addEventListener('afterprint', () => frame.remove(), {
      once: true,
    });
    frame.contentWindow!.focus();
    frame.contentWindow!.print();
    setTimeout(() => frame.remove(), 60000);
  }
  return (
    <>
      {sheets.length > 1 && (
        <select
          aria-label="Tabla para exportar CSV"
          value={sheetIndex}
          onChange={(e) => setSheetIndex(Number(e.target.value))}
        >
          {sheets.map((sheet, i) => (
            <option key={i} value={i}>
              {sheet.name}
            </option>
          ))}
        </select>
      )}
      <Button variant="outline" disabled={!sheets.length} onClick={csv}>
        CSV
      </Button>
      <Button variant="outline" disabled={!sheets.length} onClick={download}>
        Excel
      </Button>
      <Button variant="outline" disabled={!sheets.length} onClick={print}>
        Imprimir / PDF
      </Button>
    </>
  );
}
