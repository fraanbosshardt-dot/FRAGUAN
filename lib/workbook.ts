// A dependency-free, uncompressed Office Open XML workbook. Text is always an
// inline string, so user-provided cells cannot become executable Excel formulas.
export type Sheet = {
  name: string;
  columns: string[];
  rows: (string | number | null)[][];
};
const scalarText = (value: unknown) =>
  value == null
    ? ''
    : typeof value === 'string' ||
        typeof value === 'number' ||
        typeof value === 'boolean'
      ? String(value)
      : JSON.stringify(value);
const xml = (value: unknown) =>
  scalarText(value)
    .split('')
    .filter((character) => {
      const code = character.charCodeAt(0);
      return code === 9 || code === 10 || code === 13 || code >= 32;
    })
    .join('')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
function columnName(index: number): string {
  let result = '';
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26))
    result = String.fromCharCode(65 + ((n - 1) % 26)) + result;
  return result;
}
function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function header(size: number) {
  const data = new Uint8Array(size);
  const view = new DataView(data.buffer);
  return {
    data,
    u16: (at: number, value: number) => view.setUint16(at, value, true),
    u32: (at: number, value: number) => view.setUint32(at, value, true),
  };
}
function zip(files: [string, string][]) {
  const encoder = new TextEncoder(),
    chunks: Uint8Array[] = [],
    directory: Uint8Array[] = [];
  let offset = 0;
  for (const [path, text] of files) {
    const name = encoder.encode(path),
      body = encoder.encode(text),
      crc = crc32(body),
      local = header(30),
      central = header(46);
    local.u32(0, 0x04034b50);
    local.u16(4, 20);
    local.u16(6, 0x800);
    local.u16(12, 33);
    local.u32(14, crc);
    local.u32(18, body.length);
    local.u32(22, body.length);
    local.u16(26, name.length);
    central.u32(0, 0x02014b50);
    central.u16(4, 20);
    central.u16(6, 20);
    central.u16(8, 0x800);
    central.u16(14, 33);
    central.u32(16, crc);
    central.u32(20, body.length);
    central.u32(24, body.length);
    central.u16(28, name.length);
    central.u32(42, offset);
    chunks.push(local.data, name, body);
    directory.push(central.data, name);
    offset += 30 + name.length + body.length;
  }
  const directorySize = directory.reduce((n, chunk) => n + chunk.length, 0),
    end = header(22);
  end.u32(0, 0x06054b50);
  end.u16(8, files.length);
  end.u16(10, files.length);
  end.u32(12, directorySize);
  end.u32(16, offset);
  const output = new Uint8Array(offset + directorySize + 22);
  let cursor = 0;
  for (const chunk of [...chunks, ...directory, end.data]) {
    output.set(chunk, cursor);
    cursor += chunk.length;
  }
  return output;
}
export function workbook(sheets: Sheet[]) {
  if (!sheets.length || sheets.length > 50)
    throw new Error('El libro debe tener entre 1 y 50 hojas.');
  const used = new Set<string>();
  const names = sheets.map((sheet, index) => {
    let name =
      sheet.name
        .replace(/[[\]:*?/\\]/g, ' ')
        .slice(0, 26)
        .trim() || `Hoja ${index + 1}`;
    if (used.has(name.toLowerCase())) name += ` ${index + 1}`;
    used.add(name.toLowerCase());
    return name;
  });
  const prefix = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
  const files: [string, string][] = [
    [
      '[Content_Types].xml',
      `${prefix}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`,
    ],
    [
      '_rels/.rels',
      `${prefix}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    ],
    [
      'xl/workbook.xml',
      `${prefix}<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${names.map((name, i) => `<sheet name="${xml(name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>`,
    ],
    [
      'xl/_rels/workbook.xml.rels',
      `${prefix}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}</Relationships>`,
    ],
  ];
  sheets.forEach((sheet, i) => {
    if (
      !sheet.columns.length ||
      sheet.columns.length > 200 ||
      sheet.rows.length > 100000
    )
      throw new Error('Demasiados datos para exportar. Acotá el período.');
    const data = [sheet.columns, ...sheet.rows]
      .map(
        (row, r) =>
          `<row r="${r + 1}">${row.map((value, c) => (typeof value === 'number' && Number.isFinite(value) ? `<c r="${columnName(c)}${r + 1}"><v>${value}</v></c>` : `<c r="${columnName(c)}${r + 1}" t="inlineStr"><is><t xml:space="preserve">${xml(value)}</t></is></c>`)).join('')}</row>`,
      )
      .join('');
    files.push([
      `xl/worksheets/sheet${i + 1}.xml`,
      `${prefix}<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetData>${data}</sheetData><autoFilter ref="A1:${columnName(sheet.columns.length - 1)}${sheet.rows.length + 1}"/></worksheet>`,
    ]);
  });
  return zip(files);
}
