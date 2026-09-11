import { z } from 'zod';

function hasUnsafeControl(value: string, multiline: boolean) {
  for (const character of value) {
    const code = character.charCodeAt(0);
    if (code === 127) return true;
    if (code < 32 && (!multiline || ![9, 10, 13].includes(code))) return true;
  }
  return false;
}

export function publicLine(min: number, max: number) {
  return z
    .string()
    .trim()
    .min(min)
    .max(max)
    .refine((value) => !hasUnsafeControl(value, false), 'Texto inválido.');
}

export function publicOptionalLine(max: number) {
  return publicLine(0, max).default('');
}

export function publicMultiline(max: number) {
  return z
    .string()
    .trim()
    .max(max)
    .refine((value) => !hasUnsafeControl(value, true), 'Texto inválido.')
    .default('');
}

export const publicPhone = publicLine(6, 25).refine(
  (value) => /^[+()\d .-]+$/.test(value),
  'Ingresá un teléfono válido.',
);

export const publicDocument = z.union([
  z.literal(''),
  z.string().trim().regex(/^\d{7,11}$/, 'Ingresá un DNI o CUIT válido.'),
]);
