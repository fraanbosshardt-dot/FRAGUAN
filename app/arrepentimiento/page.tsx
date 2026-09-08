import type { Metadata } from 'next';
import WithdrawalForm from './withdrawal-form';

export const metadata: Metadata = {
  title: 'Botón de arrepentimiento | FRAGUAN',
  description: 'Solicitá la revocación de una compra online en FRAGUAN.',
};

export default function Page() {
  return <WithdrawalForm />;
}
