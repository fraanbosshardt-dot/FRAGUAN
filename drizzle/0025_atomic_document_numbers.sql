CREATE TABLE document_counters (
  name TEXT PRIMARY KEY,
  value INTEGER NOT NULL CHECK(value >= 0)
);
INSERT INTO document_counters(name,value)
SELECT 'sale',COALESCE(MAX(ticket),0) FROM sales;
INSERT INTO document_counters(name,value)
SELECT 'online_order',COALESCE(MAX(orderNumber),1000) FROM online_orders;
