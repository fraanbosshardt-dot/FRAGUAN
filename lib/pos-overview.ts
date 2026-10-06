import { z } from 'zod';
import { Actor, AppError, can, requirePermission } from './auth';
import { one, rows } from '@/db/queries';
import { argentinaDay } from './business-date';

export async function posOverview(a: Actor, raw: unknown) {
  requirePermission(a, 'pos');
  const period = z
    .object({ from: z.iso.date(), to: z.iso.date() })
    .strict()
    .parse(raw);
  const today = argentinaDay();
  const from = `${period.from}T03:00:00.000Z`;
  const until = new Date(
    Date.parse(`${period.to}T03:00:00.000Z`) + 86400000,
  ).toISOString();
  if (
    period.from > period.to ||
    period.to > today ||
    Date.parse(until) - Date.parse(from) > 92 * 86400000
  )
    throw new AppError(
      400,
      'Elegí un período válido de hasta 92 días, sin fechas futuras.',
    );
  if (!can(a, 'sales') && period.from !== today) {
    const days = Number(
      (
        await one<{ value: string }>(
          'SELECT value FROM settings WHERE key=?',
          'recentDays',
        )
      )?.value || 0,
    );
    const earliest = new Date(
      Date.parse(today + 'T12:00:00Z') - Math.max(0, days - 1) * 86400000,
    )
      .toISOString()
      .slice(0, 10);
    if (!days || period.from < earliest)
      throw new AppError(
        403,
        'Este período supera los días de consulta habilitados para tu usuario.',
      );
  }
  const [sales, refunds, payments, products] = await Promise.all([
    rows<Record<string, any>>(
      `SELECT s.id,s.ticket,s.total,s.subtotal,s.discount,s.createdAt,s.status,
      c.name AS customerName,c.surname AS customerSurname,c.phone AS customerPhone,
      COALESCE(i.units,0) AS units FROM sales s LEFT JOIN customers c ON c.id=s.customerId
      LEFT JOIN (SELECT saleId,SUM(quantity) AS units FROM sale_items GROUP BY saleId) i ON i.saleId=s.id
      WHERE s.sellerId=? AND s.createdAt>=? AND s.createdAt<? ORDER BY s.createdAt DESC`,
      a.id,
      from,
      until,
    ),
    rows<Record<string, any>>(
      `SELECT r.id,r.saleId,s.ticket,r.amount,r.reason,r.method,r.createdAt,
      c.name AS customerName,c.surname AS customerSurname,COALESCE(i.units,0) AS units
      FROM refunds r JOIN sales s ON s.id=r.saleId LEFT JOIN customers c ON c.id=s.customerId
      LEFT JOIN (SELECT refundId,SUM(quantity) AS units FROM refund_items GROUP BY refundId) i ON i.refundId=r.id
      WHERE s.sellerId=? AND r.createdAt>=? AND r.createdAt<? ORDER BY r.createdAt DESC`,
      a.id,
      from,
      until,
    ),
    rows<Record<string, any>>(
      `SELECT m.name,SUM(p.amount) AS amount FROM payments p
      JOIN sales s ON s.id=p.saleId JOIN payment_methods m ON m.id=p.methodId
      WHERE s.sellerId=? AND s.createdAt>=? AND s.createdAt<? GROUP BY m.name ORDER BY SUM(p.amount) DESC`,
      a.id,
      from,
      until,
    ),
    rows<Record<string, any>>(
      `SELECT i.name,SUM(i.quantity) AS units,SUM(i.quantity*i.price) AS amount
      FROM sale_items i JOIN sales s ON s.id=i.saleId WHERE s.sellerId=? AND s.createdAt>=? AND s.createdAt<?
      GROUP BY i.name ORDER BY SUM(i.quantity*i.price) DESC`,
      a.id,
      from,
      until,
    ),
  ]);
  const gross = sales.reduce((n, s) => n + Number(s.total), 0);
  const returned = refunds.reduce((n, r) => n + Number(r.amount), 0);
  const merchandise = sales.reduce((n, s) => n + Number(s.subtotal), 0);
  const discounts = sales.reduce((n, s) => n + Number(s.discount), 0);
  const surcharges = gross - (merchandise - discounts);
  const trend = [];
  for (let at = Date.parse(from); at < Date.parse(until); at += 86400000) {
    const day = new Date(at).toISOString().slice(0, 10);
    const daySales = sales.filter(
      (s) =>
        Date.parse(s.createdAt) >= at &&
        Date.parse(s.createdAt) < at + 86400000,
    );
    const dayRefunds = refunds.filter(
      (r) =>
        Date.parse(r.createdAt) >= at &&
        Date.parse(r.createdAt) < at + 86400000,
    );
    trend.push({
      day,
      amount: daySales.reduce((n, s) => n + Number(s.total), 0),
      returned: dayRefunds.reduce((n, r) => n + Number(r.amount), 0),
      count: daySales.length,
    });
  }
  return {
    ...period,
    sales,
    refunds,
    payments,
    products,
    trend,
    gross,
    merchandise,
    discounts,
    surcharges,
    returned,
    net: gross - returned,
    tickets: sales.length,
    units: sales.reduce((n, s) => n + Number(s.units), 0),
    average: sales.length ? Math.round(gross / sales.length) : 0,
  };
}
