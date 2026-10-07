'use client';
import type { ReactNode } from 'react';

export function CheckoutPanel({
  number,
  title,
  open,
  completed,
  summary,
  onEdit,
  children,
}: {
  number: number;
  title: string;
  open: boolean;
  completed: boolean;
  summary: string;
  onEdit: () => void;
  children: ReactNode;
}) {
  const heading = `checkout-heading-${number}`;
  const body = `checkout-body-${number}`;
  return (
    <section
      data-checkout-step={number}
      className={
        'cp-panel' + (open ? ' open' : '') + (completed ? ' done' : '')
      }
    >
      <header className="cp-heading">
        <span className="cp-number" aria-hidden="true">
          {completed && !open ? '✓' : number}
        </span>
        <h2 id={heading} tabIndex={-1}>
          {title}
        </h2>
        {completed && !open && (
          <button
            type="button"
            className="cp-edit"
            onClick={onEdit}
            aria-label={`Editar ${title.toLowerCase()}`}
            aria-controls={body}
          >
            Editar
          </button>
        )}
      </header>
      {completed && !open && <p className="cp-completed-summary">{summary}</p>}
      <section
        id={body}
        className="cp-body"
        inert={!open}
        aria-hidden={!open}
        aria-labelledby={heading}
      >
        <div>
          <div className="cp-inner">{children}</div>
        </div>
      </section>
    </section>
  );
}
