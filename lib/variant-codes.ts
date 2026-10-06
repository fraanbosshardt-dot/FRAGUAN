import { one } from '@/db/queries';
import { AppError } from './auth';

// Internal codes, printed with the existing Code 39 label renderer.
// These do not claim a registered GS1/EAN product identifier.
export function generateVariantCodes(uuid = crypto.randomUUID()) {
  const suffix = (
    BigInt(`0x${uuid.replaceAll('-', '').slice(0, 16)}`) %
    BigInt(10_000_000_000)
  )
    .toString()
    .padStart(10, '0');
  const barcode = `20${suffix}`;
  return { barcode, sku: `FG-${barcode}` };
}

export async function resolveVariantCodes(input: {
  sku?: string;
  barcode?: string;
}) {
  const sku = input.sku?.trim() ?? '';
  const barcode = input.barcode?.trim() ?? '';
  for (let attempt = 0; attempt < 8; attempt++) {
    const generated = generateVariantCodes();
    const candidate = {
      sku: sku || generated.sku,
      barcode: barcode || generated.barcode,
    };
    const conflict = await one(
      'SELECT id FROM variants WHERE sku=? OR barcode=? LIMIT 1',
      candidate.sku,
      candidate.barcode,
    );
    if (!conflict) return candidate;
    if (sku && barcode)
      throw new AppError(
        409,
        'El SKU o código de barras ya pertenece a otra variante.',
      );
  }
  throw new AppError(
    409,
    'No se pudo asignar un código único. Revisá los códigos ingresados o volvé a intentar.',
  );
}
