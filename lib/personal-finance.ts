import { z } from 'zod';
import { Actor, AppError } from './auth';
import { auditStatement, db, one, statement } from '@/db/queries';
import type {
  FinanceExpense,
  PersonalFinanceConfig,
} from './personal-finance-model';

const defaultExpenses: FinanceExpense[] = [];
const defaults: PersonalFinanceConfig = {
  availableMinor: 0,
  reserveMinor: 0,
  personalIncomeMinor: 0,
  livingCostsMinor: 0,
  businessIncomeMinor: 0,
  businessFixedCostsMinor: 0,
  businessExtraordinaryMinor: 0,
  businessContributionMarginBps: 0,
  expenses: [],
  debts: [],
  payments: [],
};
const money = z.number().int().min(0).max(100_000_000_000);
const expenseSchema = z
  .object({
    id: z.string().min(1).max(100),
    label: z.string().min(1).max(160),
    category: z.string().min(1).max(80),
    scope: z.enum(['personal', 'business']),
    amountMinor: money,
    frequency: z.enum(['monthly', 'one_time']),
    active: z.boolean(),
    quality: z.enum(['confirmed', 'estimated', 'pending']),
  })
  .strict();
const debtSchema = z
  .object({
    id: z.string().min(1).max(80),
    entity: z.string().min(1).max(100),
    label: z.string().min(1).max(140),
    kind: z.enum(['card', 'loan', 'credit']),
    scope: z.enum(['personal', 'business']),
    balanceMinor: money,
    payoffMinor: money.nullable(),
    monthlyMinor: money.nullable(),
    minimumMinor: money.nullable(),
    remainingInstallments: z.number().int().min(0).max(600).nullable(),
    totalInstallments: z.number().int().min(1).max(600).nullable(),
    annualRateBps: z.number().int().min(0).max(100000).nullable(),
    nextDueOn: z.iso.date().nullable(),
    priority: z.enum(['urgent', 'high', 'medium', 'low', 'maintain']),
    decision: z.string().max(500),
    status: z.enum(['pending', 'review', 'scheduled', 'paid', 'closed']),
    quality: z.enum(['confirmed', 'estimated', 'pending']),
    notes: z.string().max(1000),
  })
  .strict();
const paymentSchema = z
  .object({
    id: z.string().min(1).max(100),
    debtId: z.string().min(1).max(80),
    paidOn: z.iso.datetime(),
    amountMinor: money,
    mode: z.enum(['minimum', 'installment', 'advance', 'custom', 'total']),
    installmentCount: z.number().int().min(1).max(600).nullable(),
  })
  .strict();
const configSchema = z
  .object({
    availableMinor: money,
    reserveMinor: money,
    personalIncomeMinor: money,
    livingCostsMinor: money,
    businessIncomeMinor: money,
    businessFixedCostsMinor: money,
    businessExtraordinaryMinor: money,
    businessContributionMarginBps: z
      .number()
      .int()
      .min(0)
      .max(10000)
      .default(0),
    expenses: z.array(expenseSchema).max(500).default(defaultExpenses),
    debts: z.array(debtSchema).max(100),
    payments: z.array(paymentSchema).max(5000).default([]),
  })
  .strict();

function requireOwner(actor: Actor) {
  if (actor.role !== 'ADMIN') throw new AppError(403, 'Acceso denegado.');
}

export async function getPersonalFinance(actor: Actor) {
  requireOwner(actor);
  const stored = await one<{ value: string }>(
    'SELECT value FROM settings WHERE key=?',
    'personal-finance',
  );
  if (!stored) return defaults;
  try {
    return configSchema.parse(JSON.parse(stored.value));
  } catch {
    throw new AppError(
      500,
      'La configuración financiera personal debe revisarse.',
    );
  }
}

export async function savePersonalFinance(actor: Actor, raw: unknown) {
  requireOwner(actor);
  const input = configSchema.parse(raw);
  const before = await one<{ value: string }>(
    'SELECT value FROM settings WHERE key=?',
    'personal-finance',
  );
  await db().batch([
    statement(
      `INSERT INTO settings(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value`,
      'personal-finance',
      JSON.stringify(input),
    ),
    auditStatement(
      actor.id,
      'Actualizar centro financiero personal',
      'personal-finance',
      before ? { configured: true } : null,
      {
        configured: true,
        debts: input.debts.length,
        expenses: input.expenses.length,
        payments: input.payments.length,
        contributionMarginBps: input.businessContributionMarginBps,
      },
    ),
  ]);
  return input;
}
