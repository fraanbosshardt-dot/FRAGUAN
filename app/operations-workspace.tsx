'use client';
import { useEffect, useState } from 'react';
import { api, money, minor, date, Row, useSession } from '@/lib/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { GlobalSearch } from '@/components/global-search';
import { ThemeToggle } from '@/components/theme-toggle';
import { ExportActions } from '@/components/export-actions';
import { LoadingState } from '@/components/loading-state';
type Field = {
  key: string;
  label: string;
  type?: string;
  choices?: [string, string][];
};
const labels: Record<string, string> = {
  banking: 'Bancos y cheques',
  communications: 'Comunicaciones',
  'seller-commissions': 'Comisiones del equipo',
  'club-rewards': 'Canjes del Club',
  access: 'Permisos por usuario',
  issued: 'Emitido',
  received: 'Recibido',
  deposited: 'Depositado',
  cleared: 'Acreditado / debitado',
  rejected: 'Rechazado',
  cancelled: 'Cancelado',
  reserved: 'Reservado',
  delivered: 'Entregado',
  pos: 'Punto de venta',
  customers: 'Clientes',
  'own-sales': 'Ventas propias',
  sales: 'Ventas generales',
  dashboard: 'Resumen del negocio',
  products: 'Productos',
  stock: 'Stock',
  replenishment: 'Reposición',
  suppliers: 'Proveedores',
  purchases: 'Compras',
  expenses: 'Gastos',
  payables: 'Cuentas a pagar',
  cash: 'Caja',
  'cash-flow': 'Flujo de fondos',
  'financial-calendar': 'Calendario financiero',
  promotions: 'Promociones',
  reports: 'Reportes',
  refunds: 'Devoluciones',
  inventory: 'Inventario',
  insights: 'Insights',
  'customer-intelligence': 'Inteligencia de clientes',
  'customer-credits': 'Saldos a favor',
};
export default function Operations({ section }: { section: string }) {
  const { session } = useSession();
  const [data, setData] = useState<Row | null>(null),
    [error, setError] = useState(''),
    [success, setSuccess] = useState(''),
    [busy, setBusy] = useState(false),
    [dialog, setDialog] = useState<{
      title: string;
      fields: Field[];
      action: string;
    } | null>(null),
    [form, setForm] = useState<Row>({}),
    [selectedUser, setSelectedUser] = useState(''),
    [denied, setDenied] = useState<string[]>([]);
  const [period, setPeriod] = useState({ from: '', to: '' });
  const [appliedPeriod, setAppliedPeriod] = useState('');
  const load = () =>
    api(section + (section === 'seller-commissions' ? appliedPeriod : '')).then(
      setData,
    );
  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, [section, appliedPeriod]);
  const accounts: [string, string][] = (data?.accounts ?? []).map((r: Row) => [
    r.id,
    r.name,
  ]);
  function open(
    title: string,
    action: string,
    fields: Field[],
    initial: Row = {},
  ) {
    setError('');
    setForm({
      ...initial,
      reference: crypto.randomUUID(),
      idempotencyKey: crypto.randomUUID(),
    });
    setDialog({ title, action, fields });
  }
  async function write(payload: Row) {
    setBusy(true);
    setError('');
    try {
      await api(section, payload);
      setDialog(null);
      setSuccess('Operación guardada.');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar.');
    } finally {
      setBusy(false);
    }
  }
  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!dialog) return;
    try {
      const payload: Row = { action: dialog.action };
      for (const field of dialog.fields) {
        const v = form[field.key] ?? '';
        payload[field.key] =
          field.type === 'signed-money'
            ? minor(String(v).replace(/^-/, '')) *
              (String(v).startsWith('-') ? -1 : 1)
            : field.type === 'money'
              ? minor(String(v))
              : field.type === 'number'
                ? Number(v)
                : v;
      }
      if (form.id) payload.id = form.id;
      if (section === 'seller-commissions') delete payload.action;
      if (dialog.action === 'entry') payload.reference = form.reference;
      if (dialog.action === 'redeem')
        payload.idempotencyKey = form.idempotencyKey;
      void write(payload);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  function table(
    title: string,
    records: Row[],
    columns: [string, string, string?][],
    actions?: (r: Row) => React.ReactNode,
  ) {
    return (
      <section className="panel table-panel">
        <div className="panel-heading">
          <h2>{title}</h2>
          <ExportActions
            name={title}
            sheets={[
              {
                name: title,
                columns: columns.map((c) => c[1]),
                rows: records.map((r) =>
                  columns.map(([k, , kind]) =>
                    kind === 'money' ? Number(r[k] ?? 0) / 100 : (r[k] ?? ''),
                  ),
                ),
              },
            ]}
          />
        </div>
        <div className="data-table">
          <table>
            <thead>
              <tr>
                {columns.map(([k, label]) => (
                  <th key={k}>{label}</th>
                ))}
                {actions && <th>Acciones</th>}
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.id}>
                  {columns.map(([k, , kind]) => (
                    <td key={k}>
                      {kind === 'money'
                        ? money(r[k])
                        : kind === 'date'
                          ? date(r[k])
                          : (labels[r[k]] ?? String(r[k] ?? '—'))}
                    </td>
                  ))}
                  {actions && (
                    <td>
                      <div className="heading-actions">{actions(r)}</div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          {!records.length && (
            <p className="empty-state">Todavía no hay registros.</p>
          )}
        </div>
      </section>
    );
  }
  const checkActions: Record<string, string[]> = {
    issued: ['cleared', 'rejected', 'cancelled'],
    received: ['deposited', 'cancelled'],
    deposited: ['cleared', 'rejected'],
    rejected: ['cancelled'],
  };
  return (
    <main className="admin-content operations-page">
      <header className="admin-top">
        <a href="/admin/dashboard">FRAGUAN · Administración</a>
        <div>
          <GlobalSearch />
          <ThemeToggle />
        </div>
      </header>
      <nav className="heading-actions" aria-label="Operaciones">
        {[
          'banking',
          'club-rewards',
          'access',
          'communications',
          'seller-commissions',
        ]
          .filter((s) => session?.permissions?.includes(s))
          .map((s) => (
            <a key={s} href={`/admin/${s}`}>
              {labels[s]}
            </a>
          ))}
        <a href="/pos">Punto de venta</a>
      </nav>
      <h1>{labels[section]}</h1>
      {error && !dialog && (
        <p role="alert" className="notice">
          {error}
        </p>
      )}
      {success && <p role="status">{success}</p>}
      {!data && !error && <LoadingState />}
      {!data && error && (
        <Button
          variant="outline"
          onClick={() => {
            setError('');
            load().catch((e) => setError(e.message));
          }}
        >
          Reintentar carga
        </Button>
      )}
      {section === 'banking' && data && (
        <>
          <p>
            Saldo registrado de cada cuenta. Contrastá los movimientos con el
            extracto bancario antes de conciliarlos.
          </p>
          <div className="heading-actions">
            <Button
              onClick={() =>
                open(
                  'Nueva cuenta',
                  'account',
                  [
                    { key: 'name', label: 'Nombre de la cuenta' },
                    { key: 'bank', label: 'Banco' },
                    { key: 'alias', label: 'Alias / referencia' },
                    {
                      key: 'opening',
                      label:
                        'Saldo inicial (pesos; negativo si hay descubierto)',
                      type: 'signed-money',
                    },
                  ],
                  { opening: '0' },
                )
              }
            >
              Nueva cuenta
            </Button>
            <Button
              disabled={!accounts.length}
              onClick={() =>
                open('Registrar movimiento', 'entry', [
                  { key: 'accountId', label: 'Cuenta', choices: accounts },
                  {
                    key: 'direction',
                    label: 'Tipo',
                    choices: [
                      ['in', 'Ingreso'],
                      ['out', 'Egreso'],
                    ],
                  },
                  { key: 'amount', label: 'Importe (pesos)', type: 'money' },
                  { key: 'description', label: 'Concepto' },
                  {
                    key: 'occurredAt',
                    label: 'Fecha del movimiento',
                    type: 'date',
                  },
                ])
              }
            >
              Registrar movimiento
            </Button>
            <Button
              disabled={!accounts.length}
              onClick={() =>
                open('Registrar cheque', 'check', [
                  { key: 'number', label: 'Número / identificador' },
                  { key: 'bank', label: 'Banco emisor' },
                  {
                    key: 'type',
                    label: 'Tipo',
                    choices: [
                      ['paper', 'Cheque papel'],
                      ['echeq', 'eCheq'],
                    ],
                  },
                  {
                    key: 'direction',
                    label: 'Origen',
                    choices: [
                      ['issued', 'Emitido por FRAGUAN'],
                      ['received', 'Recibido de un tercero'],
                    ],
                  },
                  { key: 'party', label: 'Beneficiario / emisor' },
                  { key: 'amount', label: 'Importe (pesos)', type: 'money' },
                  { key: 'issuedAt', label: 'Fecha de emisión', type: 'date' },
                  { key: 'dueAt', label: 'Vencimiento', type: 'date' },
                  {
                    key: 'accountId',
                    label: 'Cuenta de débito / depósito',
                    choices: accounts,
                  },
                  {
                    key: 'payableId',
                    label: 'Cuenta a pagar asociada (cheques emitidos)',
                    choices: [
                      ['none', 'Sin asociar'],
                      ...data.payables.map((p: Row) => [
                        p.id,
                        `${p.description} · ${money(p.amount)}`,
                      ]),
                    ],
                  },
                ])
              }
            >
              Cheque / eCheq
            </Button>
          </div>
          {table('Cuentas', data.accounts, [
            ['name', 'Cuenta'],
            ['bank', 'Banco'],
            ['alias', 'Alias'],
            ['balance', 'Saldo registrado', 'money'],
          ])}
          {table(
            'Cheques y vencimientos',
            data.checks,
            [
              ['number', 'Número'],
              ['party', 'Contraparte'],
              ['dueAt', 'Vencimiento', 'date'],
              ['amount', 'Importe', 'money'],
              ['status', 'Estado'],
            ],
            (r) =>
              (checkActions[r.status] ?? []).map((status) => (
                <Button
                  key={status}
                  variant="outline"
                  disabled={busy}
                  onClick={() =>
                    open(
                      `Cheque ${r.number} · ${labels[status]}`,
                      'transition',
                      [
                        {
                          key: 'status',
                          label: 'Nuevo estado',
                          choices: [[status, labels[status]]],
                        },
                        { key: 'reason', label: 'Motivo / referencia' },
                      ],
                      { id: r.id, status },
                    )
                  }
                >
                  {labels[status]}
                </Button>
              )),
          )}
          {table(
            'Movimientos bancarios (últimos 250)',
            data.entries,
            [
              ['account', 'Cuenta'],
              ['occurredAt', 'Fecha', 'date'],
              ['description', 'Concepto'],
              ['amount', 'Importe', 'money'],
              ['statementReference', 'Referencia del extracto'],
            ],
            (r) =>
              !r.reconciledAt && (
                <Button
                  disabled={busy}
                  variant="outline"
                  onClick={() =>
                    open(
                      `Conciliar ${money(r.amount)} del ${date(r.occurredAt)}`,
                      'reconcile',
                      [
                        {
                          key: 'amount',
                          label:
                            'Importe del extracto (pesos; negativo para egresos)',
                          type: 'signed-money',
                        },
                        {
                          key: 'occurredAt',
                          label: 'Fecha según extracto',
                          type: 'date',
                        },
                        {
                          key: 'statementReference',
                          label: 'Referencia única del extracto',
                        },
                      ],
                      { id: r.id },
                    )
                  }
                >
                  Confirmar contra extracto
                </Button>
              ),
          )}
          {table(
            'Historial de cheques (últimos 250 cambios)',
            data.events.map((event: Row) => ({
              ...event,
              fromStatus: labels[event.fromStatus] ?? event.fromStatus,
              toStatus: labels[event.toStatus] ?? event.toStatus,
            })),
            [
              ['number', 'Cheque'],
              ['createdAt', 'Fecha', 'date'],
              ['fromStatus', 'Estado anterior'],
              ['toStatus', 'Nuevo estado'],
              ['reason', 'Motivo'],
              ['actor', 'Registrado por'],
            ],
          )}
        </>
      )}
      {section === 'club-rewards' && data && (
        <>
          <p>
            Reservá beneficios con puntos y confirmá su entrega. Cancelar una
            reserva devuelve los puntos al cliente. Los canjes no registran
            ventas ni entregas de stock automáticamente.
          </p>
          <div className="heading-actions">
            <Button
              onClick={() =>
                open('Crear beneficio', 'reward', [
                  { key: 'name', label: 'Nombre' },
                  {
                    key: 'description',
                    label: 'Qué recibe el cliente y condiciones',
                  },
                  { key: 'points', label: 'Puntos necesarios', type: 'number' },
                ])
              }
            >
              Crear beneficio
            </Button>
            <Button
              disabled={!data.rewards.some((r: Row) => r.active)}
              onClick={() =>
                open('Reservar canje', 'redeem', [
                  {
                    key: 'customerId',
                    label: 'Cliente y puntos disponibles',
                    choices: data.customers.map((r: Row) => [
                      r.id,
                      `${r.name} · ${r.phone} · ${r.points} puntos`,
                    ]),
                  },
                  {
                    key: 'rewardId',
                    label: 'Beneficio',
                    choices: data.rewards
                      .filter((r: Row) => r.active)
                      .map((r: Row) => [
                        r.id,
                        `${r.name} · ${r.points} puntos`,
                      ]),
                  },
                ])
              }
            >
              Canjear puntos
            </Button>
          </div>
          {table(
            'Beneficios',
            data.rewards,
            [
              ['name', 'Beneficio'],
              ['description', 'Condiciones'],
              ['points', 'Puntos'],
            ],
            (r) => (
              <Button
                disabled={busy}
                variant="outline"
                onClick={() => write({ action: 'toggle', id: r.id })}
              >
                {r.active ? 'Pausar' : 'Reactivar'}
              </Button>
            ),
          )}
          {table(
            'Canjes (últimos 250)',
            data.redemptions,
            [
              ['customer', 'Cliente'],
              ['rewardName', 'Beneficio'],
              ['points', 'Puntos'],
              ['createdAt', 'Fecha', 'date'],
              ['status', 'Estado'],
            ],
            (r) =>
              r.status === 'reserved' && (
                <>
                  <Button
                    disabled={busy}
                    onClick={() => write({ action: 'deliver', id: r.id })}
                  >
                    Confirmar entrega
                  </Button>
                  <Button
                    variant="outline"
                    disabled={busy}
                    onClick={() => write({ action: 'cancel', id: r.id })}
                  >
                    Cancelar y devolver puntos
                  </Button>
                </>
              ),
          )}
        </>
      )}
      {section === 'communications' && data && (
        <>
          <p>
            Sugerencias de hoy: cumpleaños y clientes sin compras hace 90 días.
            Revisá cada mensaje antes de enviarlo. El envío automático se
            conectará junto con WhatsApp o email.
          </p>
          {table(
            'Mensajes preparados',
            data.drafts,
            [
              ['customer', 'Cliente'],
              ['phone', 'Contacto'],
              ['kind', 'Motivo'],
              ['message', 'Mensaje'],
            ],
            (r) => (
              <Button
                onClick={() =>
                  navigator.clipboard
                    .writeText(r.message)
                    .then(() => setSuccess('Mensaje copiado.'))
                    .catch(() =>
                      setError(
                        'No se pudo copiar. Seleccioná el texto del mensaje.',
                      ),
                    )
                }
              >
                Copiar mensaje
              </Button>
            ),
          )}
        </>
      )}
      {section === 'seller-commissions' && data && (
        <>
          <form
            className="heading-actions"
            onSubmit={(event) => {
              event.preventDefault();
              if (period.from > period.to) {
                setError(
                  'La fecha inicial debe ser anterior o igual a la final.',
                );
                return;
              }
              setError('');
              setAppliedPeriod('?' + new URLSearchParams(period).toString());
            }}
          >
            <label>
              Desde
              <Input
                type="date"
                required
                value={period.from}
                onChange={(event) =>
                  setPeriod({ ...period, from: event.target.value })
                }
              />
            </label>
            <label>
              Hasta
              <Input
                type="date"
                required
                value={period.to}
                onChange={(event) =>
                  setPeriod({ ...period, to: event.target.value })
                }
              />
            </label>
            <Button type="submit">Consultar período</Button>
          </form>
          <p>
            Período: {date(data.from)} al {date(data.to)}. Estimación sobre
            ventas netas de devoluciones, aplicando la tasa actual. No registra
            un pago de sueldo ni de comisión.
          </p>
          {table(
            `Comisiones estimadas · ${data.from} a ${data.to}`,
            data.sellers,
            [
              ['name', 'Vendedor'],
              ['tickets', 'Tickets'],
              ['revenue', 'Ventas netas', 'money'],
              ['rate', 'Tasa %'],
              ['estimatedCommission', 'Comisión estimada', 'money'],
            ],
            (r) =>
              data.canConfigure && (
                <Button
                  onClick={() =>
                    open(
                      `Comisión de ${r.name}`,
                      'configure',
                      [
                        {
                          key: 'rate',
                          label: 'Porcentaje sobre ventas netas',
                          type: 'number',
                        },
                      ],
                      { id: r.id, rate: r.rate },
                    )
                  }
                >
                  Configurar
                </Button>
              ),
          )}
        </>
      )}
      {section === 'access' && data && (
        <section className="panel">
          <h2>Restringir accesos de un usuario</h2>
          <p>
            El rol define el acceso máximo. Marcá las funciones que querés
            bloquear. El vendedor siempre conserva su perfil comercial
            restringido.
          </p>
          <label>
            Usuario
            <select
              value={selectedUser}
              onChange={(e) => {
                setSelectedUser(e.target.value);
                setDenied(
                  data.users.find((u: Row) => u.id === e.target.value)
                    ?.denied ?? [],
                );
              }}
            >
              <option value="">Seleccionar…</option>
              {data.users
                .filter((u: Row) => u.role !== 'ADMIN')
                .map((u: Row) => (
                  <option key={u.id} value={u.id}>
                    {u.name} · {u.role}
                  </option>
                ))}
            </select>
          </label>
          {selectedUser && (
            <>
              <div className="permission-grid">
                {data.permissions.map((permission: string) => (
                  <label key={permission}>
                    <input
                      type="checkbox"
                      checked={denied.includes(permission)}
                      onChange={(e) =>
                        setDenied(
                          e.target.checked
                            ? [...denied, permission]
                            : denied.filter((p) => p !== permission),
                        )
                      }
                    />
                    Bloquear {labels[permission] ?? permission}
                  </label>
                ))}
              </div>
              <Button
                disabled={busy}
                onClick={() => write({ userId: selectedUser, denied })}
              >
                Guardar restricciones
              </Button>
            </>
          )}
        </section>
      )}
      <Dialog
        open={!!dialog}
        onOpenChange={(value) => {
          if (!value && !busy) setDialog(null);
        }}
      >
        <DialogContent>
          <DialogTitle>{dialog?.title}</DialogTitle>
          <DialogDescription>
            Completá los datos y confirmá para guardar la operación.
          </DialogDescription>
          <form className="quick-form" onSubmit={submit}>
            {dialog?.fields.map((field) => (
              <label key={field.key}>
                {field.label}
                {field.choices ? (
                  <select
                    required
                    value={form[field.key] ?? ''}
                    onChange={(e) =>
                      setForm({ ...form, [field.key]: e.target.value })
                    }
                  >
                    <option value="">Seleccionar…</option>
                    {field.choices.map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <Input
                    required
                    type={
                      ['money', 'signed-money'].includes(field.type ?? '')
                        ? 'text'
                        : (field.type ?? 'text')
                    }
                    inputMode={field.type === 'money' ? 'decimal' : undefined}
                    min={
                      field.type === 'number'
                        ? field.key === 'rate'
                          ? 0
                          : 1
                        : undefined
                    }
                    step={field.key === 'rate' ? '0.01' : undefined}
                    value={form[field.key] ?? ''}
                    onChange={(e) =>
                      setForm({ ...form, [field.key]: e.target.value })
                    }
                  />
                )}
              </label>
            ))}
            {error && <p role="alert">{error}</p>}
            <Button disabled={busy} type="submit">
              {busy ? 'Guardando…' : 'Confirmar'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </main>
  );
}
