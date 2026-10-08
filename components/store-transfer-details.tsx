'use client';
import { useState } from 'react';
import { Copy, Mail } from 'lucide-react';
import { storeMoney } from '@/lib/store-client';
import {
  STORE_TRANSFER,
  transferReceiptMessage,
} from '@/lib/store-transfer-details';

export function StoreTransferDetails({
  total,
  reference,
}: {
  total: number;
  reference: string;
}) {
  const [message, setMessage] = useState('');
  const receipt = transferReceiptMessage(reference);
  const query = new URLSearchParams({
    view: 'cm',
    fs: '1',
    to: STORE_TRANSFER.receiptEmail,
    su: receipt.subject,
    body: receipt.body,
  });
  async function copy(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      setMessage(`${label} copiado.`);
    } catch {
      setMessage(
        'No pudimos copiarlo. Podés seleccionarlo y copiarlo manualmente.',
      );
    }
  }
  return (
    <section className="transfer-details" aria-labelledby="transfer-title">
      <div className="transfer-instructions">
        <h2 id="transfer-title">Datos para transferir</h2>
        <p>
          Transferí el importe exacto e incluí la referencia única de tu pedido
          en el concepto de la operación.
        </p>
        <strong className="transfer-amount">{storeMoney(total)}</strong>
        <dl>
          <div>
            <dt>Alias</dt>
            <dd>
              <span>{STORE_TRANSFER.alias}</span>
              <button
                type="button"
                aria-label="Copiar alias"
                onClick={() => copy(STORE_TRANSFER.alias, 'Alias')}
              >
                <Copy />
              </button>
            </dd>
          </div>
          <div>
            <dt>Titular</dt>
            <dd>{STORE_TRANSFER.holder}</dd>
          </div>
          <div>
            <dt>DNI</dt>
            <dd>{STORE_TRANSFER.document}</dd>
          </div>
          <div>
            <dt>Referencia única del pedido</dt>
            <dd>
              <span>{reference}</span>
              <button
                type="button"
                aria-label="Copiar referencia única del pedido"
                onClick={() => copy(reference, 'Referencia')}
              >
                <Copy />
              </button>
            </dd>
          </div>
        </dl>
        <output className="transfer-copy-status" aria-live="polite">
          {message}
        </output>
      </div>
      <div className="transfer-receipt">
        <Mail aria-hidden="true" />
        <h2>¿Ya transferiste?</h2>
        <p>
          Mandá el comprobante a{' '}
          <a href={`mailto:${STORE_TRANSFER.receiptEmail}`}>
            {STORE_TRANSFER.receiptEmail}
          </a>{' '}
          con la referencia <strong>{reference}</strong>.
        </p>
        <p>
          El botón completa el destinatario y la referencia en Gmail. Adjuntá el
          comprobante antes de enviarlo.
        </p>
        <a
          className="btn transfer-receipt-link"
          href={`https://mail.google.com/mail/?${query}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          ENVIAR COMPROBANTE POR GMAIL →
        </a>
        <a
          className="transfer-other-mail"
          href={`mailto:${STORE_TRANSFER.receiptEmail}?subject=${encodeURIComponent(receipt.subject)}&body=${encodeURIComponent(receipt.body)}`}
        >
          Usar otra aplicación de correo
        </a>
        <small>
          Vamos a confirmar tu pago después de verificar la transferencia.
        </small>
      </div>
    </section>
  );
}
