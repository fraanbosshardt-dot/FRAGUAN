/** Checkout commissions are independent of Point. Amounts are stored in cents. */
export function onlinePaymentAmounts(
  amount: number,
  terms: { commissionBps: number; days: number },
  paidAt: string,
) {
  const commission = Math.round((amount * Number(terms.commissionBps)) / 10000);
  return {
    commission,
    net: amount - commission,
    dueAt: new Date(Date.parse(paidAt) + Number(terms.days) * 86400000).toISOString(),
  };
}
