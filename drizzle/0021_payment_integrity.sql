CREATE UNIQUE INDEX online_orders_payment_reference_unique
  ON online_orders(paymentReference)
  WHERE paymentReference<>'';
