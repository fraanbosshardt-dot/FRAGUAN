INSERT INTO payment_methods
  (id,name,"surchargeBps","commissionBps",days,installments,active,destination)
VALUES ('online-mp','Mercado Pago · Web',0,339,18,1,0,'Mercado Pago')
ON CONFLICT (id) DO NOTHING;
