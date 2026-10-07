import { statement } from '@/db/queries';

// Must be the first numbering command in the same batch as the INSERT.
// UPDATE locks the counter until commit; rollback also restores its value.
export function allocateDocumentNumber(kind: 'sale' | 'online_order') {
  const source = kind === 'sale' ? 'sales' : 'online_orders';
  const column = kind === 'sale' ? 'ticket' : 'orderNumber';
  const initial = kind === 'sale' ? 0 : 1000;
  // Also preserve numbers introduced by imports or a previous app version.
  const maximum = `(SELECT COALESCE(MAX(${column}),${initial}) FROM ${source})`;
  return statement(
    `UPDATE document_counters SET value=CASE WHEN value<${maximum} THEN ${maximum}+1 ELSE value+1 END WHERE name=?`,
    kind,
  );
}
