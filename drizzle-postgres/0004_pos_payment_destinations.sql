ALTER TABLE payment_methods ADD COLUMN IF NOT EXISTS destination TEXT NOT NULL DEFAULT '';
ALTER TABLE payments ADD COLUMN IF NOT EXISTS destination TEXT NOT NULL DEFAULT '';
UPDATE payment_methods SET active=0 WHERE id NOT IN ('cash','transfer','debit','credit','point-prepaid');
UPDATE payment_methods SET name='Efectivo', destination='Caja', active=1, "surchargeBps"=0, "commissionBps"=0, days=0, installments=1 WHERE id='cash';
UPDATE payment_methods SET name='Transferencia', destination='Mercado Pago', active=1, "surchargeBps"=0, "commissionBps"=0, days=0, installments=1 WHERE id='transfer';
UPDATE payment_methods SET name='Débito', destination='Mercado Pago', active=1, "surchargeBps"=0, "commissionBps"=288, days=2, installments=1 WHERE id='debit';
UPDATE payment_methods SET name='Crédito', destination='Mercado Pago', active=1, "surchargeBps"=0, "commissionBps"=440, days=10, installments=1 WHERE id='credit';
UPDATE payment_methods SET name='Prepaga', destination='Mercado Pago', active=1, "surchargeBps"=0, "commissionBps"=368, days=3, installments=1 WHERE id='point-prepaid';
