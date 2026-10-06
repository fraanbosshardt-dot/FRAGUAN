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
    promotionIds: z.array(text).max(10).optional(),
    couponCode: z.string().trim().max(50).optional(),
    manualDiscountMinor: money.optional(),
    manualDiscountBps: z.number().int().min(0).max(10000).optional(),
    autoPromotions: z.boolean().optional(),
    excludedPromotionIds: z.array(text).max(100).optional(),
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
    idempotencyKey: z.uuid(),
    expectedTotalMinor: money.optional(),
  })
  .strict();
export const quoteInput = saleInput.omit({
  idempotencyKey: true,
  expectedTotalMinor: true,
});
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
    internalCode: z.string().trim().max(200).default(''),
    category: text,
    subcategory: z.string().trim().max(200).default(''),
    brand: text,
    season: z.string().trim().max(200).default(''),
    collection: z.string().trim().max(200).default(''),
    location: z.string().trim().max(200).default(''),
    supplierId: z.union([text, z.literal(''), z.null()]).default(null),
    color: text,
    size: text,
    sku: text,
    barcode: text,
    price: positiveMoney,
    cost: money,
    stock: z.number().int().min(0).max(100000),
    minimum: z.number().int().min(0).max(1000),
    ideal: z.number().int().min(0).max(100000).default(6),
    entryAt: z.union([z.iso.date(), z.literal('')]).default(''),
  })
  .strict();
export const supplierInput = z
  .object({
    name: text,
    company: z.string().trim().max(200).default(''),
    contact: z.string().trim().max(200).default(''),
    phone: z.string().max(30),
    whatsapp: z.string().trim().max(30).default(''),
    email: z.union([z.email(), z.literal('')]),
    brands: z.string().trim().max(200).default(''),
    terms: z.string().max(500),
    discountBps: z.number().int().min(0).max(10000).default(0),
    paymentDays: z.number().int().min(0).max(3650).default(0),
    notes: z.string().trim().max(1500).default(''),
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
    kind: z.enum(['Proveedor', 'Transferencia', 'Servicio', 'Cuota']),
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
    kind: z
      .enum([
        'percentage',
        'fixed_amount',
        'two_for_one',
        'second_unit_percentage',
      ])
      .default('percentage'),
    percent: z.number().int().min(1).max(100).optional(),
    amount: positiveMoney.optional(),
    methodId: text.nullable(),
    startsAt: z.iso.date(),
    endsAt: z.iso.date(),
    category: text.nullable().optional(),
    brand: text.nullable().optional(),
    couponCode: z.string().trim().min(3).max(50).nullable().optional(),
    customerLevel: z
      .enum(['FRAGUAN', 'Silver', 'Gold', 'Black'])
      .nullable()
      .optional(),
    birthday: z.boolean().default(false),
    birthdayDays: z.number().int().min(0).max(30).default(0),
    daysOfWeek: z.array(z.number().int().min(0).max(6)).max(7).optional(),
    dailyStart: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
      .nullable()
      .optional(),
    dailyEnd: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
      .nullable()
      .optional(),
    priority: z.number().int().min(-1000).max(1000).default(0),
    exclusive: z.boolean().default(false),
    groupBy: z.enum(['line', 'cart']).default('line'),
  })
  .strict()
  .superRefine((value, context) => {
    if (
      ['percentage', 'second_unit_percentage'].includes(value.kind) &&
      value.percent === undefined
    )
      context.addIssue({
        code: 'custom',
        path: ['percent'],
        message: 'Ingresá el porcentaje.',
      });
    if (value.kind === 'fixed_amount' && value.amount === undefined)
      context.addIssue({
        code: 'custom',
        path: ['amount'],
        message: 'Ingresá el importe fijo.',
      });
    if (
      (value.dailyStart && !value.dailyEnd) ||
      (!value.dailyStart && value.dailyEnd)
    )
      context.addIssue({
        code: 'custom',
        path: ['dailyEnd'],
        message: 'Completá el horario desde y hasta.',
      });
  });
export const userInput = z
  .object({
    email: z.email().trim().toLowerCase().max(254),
    name: text,
    role: z.enum(['ADMIN', 'GERENTE', 'VENDEDOR', 'CAJA', 'STOCK']),
  })
  .strict();
