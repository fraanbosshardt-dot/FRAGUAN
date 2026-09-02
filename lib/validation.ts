import { z } from 'zod';
export const money = z.number().int().min(0).max(100000000000);
export const positiveMoney = money.refine((n) => n > 0);
export const text = z.string().trim().min(1).max(200);
export const saleInput = z
  .object({
    items: z
      .array(
        z
          .object({
            variantId: text,
            quantity: z.number().int().min(1).max(100),
          })
          .strict(),
      )
      .min(1)
      .max(100),
    customerId: text.nullable(),
    promotionId: text.nullable(),
    payments: z
      .array(
        z
          .object({
            methodId: text,
            baseMinor: positiveMoney,
            receivedMinor: money.optional(),
            reference: z.string().max(200).optional(),
          })
          .strict(),
      )
      .min(1)
      .max(4),
    idempotencyKey: z.string().uuid(),
  })
  .strict();
export const quoteInput = saleInput.omit({ idempotencyKey: true });
export const customerInput = z
  .object({
    name: text,
    surname: text,
    phone: z.string().trim().min(5).max(30),
  })
  .strict();
export const productInput = z
  .object({
    name: text,
    category: text,
    brand: text,
    color: text,
    size: text,
    sku: text,
    barcode: text,
    price: positiveMoney,
    cost: money,
    stock: z.number().int().min(0).max(100000),
    minimum: z.number().int().min(0).max(1000),
  })
  .strict();
export const supplierInput = z
  .object({
    name: text,
    phone: z.string().max(30),
    email: z.union([z.email(), z.literal('')]),
    terms: z.string().max(500),
  })
  .strict();
export const expenseInput = z
  .object({
    category: text,
    description: text,
    amount: positiveMoney,
    date: z.iso.date(),
    methodId: text,
  })
  .strict();
export const payableInput = z
  .object({
    description: text,
    amount: positiveMoney,
    dueAt: z.iso.date(),
    kind: z.enum([
      'Proveedor',
      'Transferencia',
      'Cheque',
      'eCheq',
      'Servicio',
      'Cuota',
    ]),
    supplierId: text.nullable(),
  })
  .strict();
export const withdrawalInput = z
  .object({ person: text, amount: positiveMoney, reason: text, methodId: text })
  .strict();
export const purchaseInput = z
  .object({
    supplierId: text,
    dueAt: z.iso.date(),
    items: z
      .array(
        z
          .object({
            variantId: text,
            quantity: z.number().int().min(1).max(10000),
            cost: money,
          })
          .strict(),
      )
      .min(1)
      .max(100),
  })
  .strict();
export const promotionInput = z
  .object({
    name: text,
    percent: z.number().int().min(1).max(90),
    methodId: text.nullable(),
    startsAt: z.iso.date(),
    endsAt: z.iso.date(),
  })
  .strict();
export const userInput = z
  .object({
    email: z.email(),
    name: text,
    role: z.enum(['ADMIN', 'GERENTE', 'VENDEDOR', 'CAJA', 'STOCK']),
  })
  .strict();
