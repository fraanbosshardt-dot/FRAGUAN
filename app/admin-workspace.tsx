'use client';
import { useEffect, useState } from 'react';
import {
  LayoutDashboard,
  ShoppingBag,
  Package,
  Boxes,
  Users,
  Truck,
  Wallet,
  Receipt,
  CalendarClock,
  ArrowUpRight,
  Plus,
  Search,
  Download,
  RefreshCw,
  ShieldCheck,
  SlidersHorizontal,
  ArrowLeft,
  Tag,
  ClipboardList,
  Sparkles,
  LogOut,
  Check,
  Printer,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { ChartContainer } from '@/components/ui/chart';
import {
  Area,
  AreaChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts';
import { api, money, minor, date, useSession, Row } from '@/lib/client';
const navigation = [
  ['dashboard', 'Vista general', LayoutDashboard],
  ['products', 'Productos', Package],
  ['stock', 'Stock y variantes', Boxes],
  ['sales', 'Ventas', ShoppingBag],
  ['customers', 'Clientes & Club', Users],
  ['suppliers', 'Proveedores', Truck],
  ['purchases', 'Compras', ClipboardList],
  ['cash', 'Caja', Wallet],
  ['expenses', 'Gastos', Receipt],
  ['payables', 'Cuentas a pagar', CalendarClock],
  ['withdrawals', 'Retiros de socios', ArrowUpRight],
  ['promotions', 'Promociones', Tag],
  ['inventory', 'Inventario físico', Boxes],
  ['reports', 'Reportes', LayoutDashboard],
  ['insights', 'FRAGUAN Insights', Sparkles],
  ['users', 'Equipo y permisos', Users],
  ['audit', 'Auditoría', ShieldCheck],
  ['settings', 'Configuración', SlidersHorizontal],
] as const;
const columns: Record<string, [string, string, string?][]> = {
  products: [
    ['name', 'Producto'],
    ['sku', 'SKU'],
    ['color', 'Color'],
    ['size', 'Talle'],
    ['price', 'Precio', 'money'],
    ['cost', 'Costo', 'money'],
    ['stock', 'Stock'],
  ],
  stock: [
    ['name', 'Producto'],
    ['color', 'Color'],
    ['size', 'Talle'],
    ['stock', 'Disponible'],
    ['minimum', 'Mínimo'],
    ['sku', 'SKU'],
  ],
  sales: [
    ['ticket', 'Ticket'],
    ['customerName', 'Cliente'],
    ['sellerName', 'Vendedor'],
    ['createdAt', 'Fecha', 'date'],
    ['status', 'Estado'],
    ['total', 'Total', 'money'],
  ],
  customers: [
    ['name', 'Nombre'],
    ['surname', 'Apellido'],
    ['phone', 'Teléfono'],
    ['purchases', 'Compras'],
    ['spent', 'Total comprado', 'money'],
    ['points', 'Puntos'],
  ],
  suppliers: [
    ['name', 'Proveedor'],
    ['phone', 'Teléfono'],
    ['email', 'Email'],
    ['terms', 'Condiciones'],
  ],
  purchases: [
    ['supplier', 'Proveedor'],
    ['createdAt', 'Fecha', 'date'],
    ['dueAt', 'Vencimiento', 'date'],
    ['status', 'Estado'],
    ['total', 'Total', 'money'],
  ],
  expenses: [
    ['description', 'Concepto'],
    ['category', 'Categoría'],
    ['date', 'Fecha', 'date'],
    ['methodId', 'Medio'],
    ['amount', 'Importe', 'money'],
  ],
  payables: [
    ['description', 'Concepto'],
    ['supplier', 'Proveedor'],
    ['kind', 'Tipo'],
    ['dueAt', 'Vencimiento', 'date'],
    ['status', 'Estado'],
    ['amount', 'Importe', 'money'],
  ],
  withdrawals: [
    ['person', 'Socio'],
    ['reason', 'Motivo'],
    ['createdAt', 'Fecha', 'date'],
    ['amount', 'Importe', 'money'],
  ],
  promotions: [
    ['name', 'Promoción'],
    ['percent', 'Descuento %'],
    ['methodId', 'Medio'],
    ['startsAt', 'Desde', 'date'],
    ['endsAt', 'Hasta', 'date'],
    ['active', 'Activa'],
  ],
  users: [
    ['name', 'Nombre'],
    ['email', 'Email'],
    ['role', 'Rol'],
    ['active', 'Activo'],
  ],
  audit: [
    ['actor', 'Usuario'],
    ['action', 'Acción'],
    ['entityId', 'Referencia'],
    ['createdAt', 'Fecha', 'date'],
  ],
  inventory: [
    ['createdAt', 'Creación', 'date'],
    ['variants', 'Variantes'],
    ['difference', 'Diferencia'],
    ['status', 'Estado'],
  ],
  cash: [
    ['kind', 'Movimiento'],
    ['methodId', 'Medio'],
    ['createdAt', 'Fecha', 'date'],
    ['amount', 'Importe', 'money'],
  ],
};
const descriptions: Record<string, string> = {
  dashboard: 'Una mirada clara a lo que está pasando en tu negocio.',
  products: 'Tu colección, organizada hasta el último detalle.',
  stock: 'Cada talle y cada color, en su lugar.',
  sales: 'El registro de cada buena experiencia.',
  customers: 'Conocé a quienes eligen FRAGUAN.',
  suppliers: 'Las relaciones detrás de tu colección.',
  purchases: 'De la orden al perchero, con trazabilidad.',
  cash: 'Apertura, movimientos y cierre en un solo lugar.',
  expenses: 'Cada gasto, registrado y a la vista.',
  payables: 'Anticipate a tus próximos compromisos.',
  withdrawals: 'Retiros separados de los gastos operativos.',
  promotions: 'Beneficios autorizados para vender mejor.',
  inventory: 'Contá, compará y aprobá los ajustes.',
  reports: 'Decisiones respaldadas por tus datos.',
  insights: 'Señales útiles que surgen de tu operación.',
  users: 'Cada persona, con el acceso que necesita.',
  audit: 'El historial de las acciones importantes.',
  settings: 'Las reglas de tu negocio.',
};
const labels: Record<string, string> = {
  confirmed: 'Completada',
  refunded: 'Devuelta',
  draft: 'Borrador',
  received: 'Recibida',
  pending: 'Pendiente',
  paid: 'Pagada',
  approved: 'Aprobado',
  cash: 'Efectivo',
  debit: 'Débito',
  credit: 'Crédito',
  transfer: 'Transferencia',
};
export default function Admin({ section }: { section: string }) {
  const { session } = useSession();
  const [data, setData] = useState<any>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [modal, setModal] = useState(''),
    [selected, setSelected] = useState<Row | null>(null),
    [search, setSearch] = useState(''),
    [aux, setAux] = useState<Row>({ variants: [], suppliers: [] }),
    [form, setForm] = useState<Row>({}),
    [success, setSuccess] = useState('');
  const title = navigation.find((n) => n[0] === section)?.[1] ?? 'FRAGUAN';
  const load = async () => {
    setData(await api(section));
  };
  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, [section]);
  async function openForm(type = 'create', row: Row | null = null) {
    setForm({});
    setSelected(row);
    setError('');
    setModal(type);
    try {
      const next: Row = { variants: [], suppliers: [] };
      if (['purchases', 'inventory', 'stock'].includes(section))
        next.variants = await api('products');
      if (['purchases', 'payables'].includes(section))
        next.suppliers = await api('suppliers');
      setAux(next);
    } catch (e: any) {
      setError(e.message);
    }
  }
  async function mutate(resource: string, payload: unknown) {
    setBusy(true);
    setError('');
    try {
      await api(resource, payload);
      setModal('');
      setSuccess('Operación guardada correctamente.');
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function details(s: Row) {
    try {
      setSelected(await api('sales?id=' + s.id));
      setModal('sale');
    } catch (e: any) {
      setError(e.message);
    }
  }
  const list: Row[] = Array.isArray(data)
    ? data
    : section === 'cash'
      ? (data?.movements ?? [])
      : [];
  const filtered = list.filter((r) =>
    Object.values(r).join(' ').toLowerCase().includes(search.toLowerCase()),
  );
  function exportCsv() {
    const cols = columns[section] ?? [
      ['name', 'Nombre'],
      ['total', 'Total'],
    ];
    const escaped = (v: unknown) => {
      let s = String(v ?? '');
      if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
      return '"' + s.replaceAll('"', '""') + '"';
    };
    const csv = [
      cols.map((c) => escaped(c[1])).join(';'),
      ...filtered.map((r) =>
        cols
          .map(([k, , kind]) => escaped(kind === 'money' ? r[k] / 100 : r[k]))
          .join(';'),
      ),
    ].join('\r\n');
    const url = URL.createObjectURL(
      new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' }),
    );
    const a = document.createElement('a');
    a.href = url;
    a.download = `fraguan-${section}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
  function field(
    name: string,
    label: string,
    options?: {
      type?: string;
      choices?: [string, string][];
      optional?: boolean;
      value?: any;
    },
  ) {
    return (
      <label key={name}>
        {label}
        {options?.choices ? (
          <select
            value={form[name] ?? options?.value ?? ''}
            required={!options?.optional}
            onChange={(e) => setForm({ ...form, [name]: e.target.value })}
          >
            <option value="">Seleccionar…</option>
            {options.choices.map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        ) : (
          <Input
            type={options?.type ?? 'text'}
            value={form[name] ?? options?.value ?? ''}
            required={!options?.optional}
            onChange={(e) => setForm({ ...form, [name]: e.target.value })}
          />
        )}
      </label>
    );
  }
  const paymentChoices: [string, string][] = [
    ['cash', 'Efectivo'],
    ['transfer', 'Transferencia'],
    ['debit', 'Débito'],
    ['credit', 'Crédito'],
    ['qr', 'QR / Mercado Pago'],
  ];
  const variantChoices: [string, string][] = aux.variants.map((v: Row) => [
    v.id,
    `${v.name} · ${v.color} · ${v.size} (${v.stock})`,
  ]);
  const supplierChoices: [string, string][] = aux.suppliers.map((s: Row) => [
    s.id,
    s.name,
  ]);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      if (modal === 'method') {
        await mutate('configure-method', {
          id: selected?.id,
          name: form.name ?? selected?.name,
          surchargeBps: Math.round(
            Number(form.surcharge ?? selected?.surchargeBps / 100) * 100,
          ),
          commissionBps: Math.round(
            Number(form.commission ?? selected?.commissionBps / 100) * 100,
          ),
          days: Number(form.days ?? selected?.days),
          installments: Number(form.installments ?? selected?.installments),
        });
        return;
      }
      if (modal === 'variant') {
        await mutate('variants', {
          productId: selected?.productId,
          sku: form.sku,
          barcode: form.barcode,
          color: form.color,
          size: form.size,
          price: minor(form.price),
          cost: minor(form.cost),
          stock: Number(form.stock),
          minimum: Number(form.minimum || 3),
        });
        return;
      }
      if (modal === 'action') {
        const action = String(selected?.action);
        const payload: Row = { action, id: selected?.id };
        if (['open-cash', 'close-cash', 'set-price'].includes(action))
          payload.amount = minor(form.amount ?? '');
        if (action === 'set-price') payload.cost = minor(form.cost ?? '');
        if (action === 'set-recent-days') payload.amount = Number(form.amount);
        if (action === 'pay-payable') payload.methodId = form.methodId;
        await mutate('actions', payload);
        return;
      }
      if (modal === 'refund') {
        await mutate('refunds', { saleId: selected?.id, reason: form.reason });
        return;
      }
      let payload: Row = {};
      if (section === 'products')
        payload = {
          name: form.name,
          category: form.category,
          brand: form.brand || 'FRAGUAN',
          color: form.color,
          size: form.size,
          sku: form.sku,
          barcode: form.barcode,
          price: minor(form.price),
          cost: minor(form.cost),
          stock: Number(form.stock),
          minimum: Number(form.minimum ?? 3),
        };
      if (section === 'stock')
        payload = {
          variantId: form.variantId || selected?.id,
          quantity: Number(form.quantity),
          reason: form.reason,
        };
      if (section === 'customers')
        payload = { name: form.name, surname: form.surname, phone: form.phone };
      if (section === 'suppliers')
        payload = {
          name: form.name,
          phone: form.phone || '',
          email: form.email || '',
          terms: form.terms || '',
        };
      if (section === 'expenses')
        payload = {
          category: form.category,
          description: form.description,
          amount: minor(form.amount),
          date: form.date,
          methodId: form.methodId,
        };
      if (section === 'payables')
        payload = {
          description: form.description,
          amount: minor(form.amount),
          dueAt: form.dueAt,
          kind: form.kind,
          supplierId: form.supplierId || null,
        };
      if (section === 'withdrawals')
        payload = {
          person: form.person,
          amount: minor(form.amount),
          reason: form.reason,
          methodId: form.methodId,
        };
      if (section === 'purchases')
        payload = {
          supplierId: form.supplierId,
          dueAt: form.dueAt,
          items: [
            {
              variantId: form.variantId,
              quantity: Number(form.quantity),
              cost: minor(form.cost),
            },
          ],
        };
      if (section === 'promotions')
        payload = {
          name: form.name,
          percent: Number(form.percent),
          methodId: form.methodId || null,
          startsAt: form.startsAt,
          endsAt: form.endsAt,
        };
      if (section === 'users')
        payload = { name: form.name, email: form.email, role: form.role };
      if (section === 'inventory')
        payload = {
          items: [{ variantId: form.variantId, counted: Number(form.counted) }],
        };
      await mutate(section, payload);
    } catch (err: any) {
      setError(err.message);
    }
  }
  function actionDialog(action: string, row: Row | null = null) {
    setSelected({ ...row, action });
    setForm({});
    setError('');
    setModal('action');
  }
  return (
    <div className="admin-shell">
      <aside className="sidebar">
        <a className="wordmark" href="/admin/dashboard">
          FRAGUAN<span>BUSINESS STUDIO</span>
        </a>
        <a className="new-sale-link" href="/pos">
          <Plus size={16} /> Nueva venta <ArrowUpRight size={15} />
        </a>
        <p className="eyebrow">TU NEGOCIO</p>
        <nav>
          {navigation
            .filter(([key]) => session?.permissions?.includes(key))
            .map(([key, label, Icon]) => (
              <a
                key={key}
                href={'/admin/' + key}
                className={section === key ? 'active' : ''}
              >
                <Icon size={16} />
                {label}
              </a>
            ))}
        </nav>
        <div className="sidebar-bottom">
          <span className="avatar">{session?.user?.name?.[0] ?? 'F'}</span>
          <span>
            {session?.user?.name?.split('@')[0]}
            <small>{session?.user?.role}</small>
          </span>
          <a
            href="/signout-with-chatgpt?return_to=%2Fpos"
            title="Cerrar sesión"
          >
            <LogOut size={15} />
          </a>
        </div>
      </aside>
      <main className="admin-main">
        <header className="admin-top">
          <span>
            FRAGUAN <span>/</span> {title}
          </span>
          <div>
            {session?.demo && (
              <span className="demo-pill">DATOS DE DEMOSTRACIÓN</span>
            )}
            <a href="/pos">
              Ir al POS <ArrowUpRight size={13} />
            </a>
          </div>
        </header>
        <div className="admin-content">
          <div className="admin-heading">
            <div>
              <p className="eyebrow">MENOS RUIDO. MÁS CLARIDAD.</p>
              <h1>
                {title}
                <span>.</span>
              </h1>
              <p>{descriptions[section]}</p>
            </div>
            <div className="heading-actions">
              <Button
                variant="outline"
                onClick={() => load().catch((e) => setError(e.message))}
                aria-label="Actualizar"
              >
                <RefreshCw size={15} />
              </Button>
              {columns[section] && (
                <Button variant="outline" onClick={exportCsv}>
                  <Download size={15} /> Exportar CSV
                </Button>
              )}
              {![
                'dashboard',
                'reports',
                'insights',
                'sales',
                'audit',
                'settings',
                'cash',
              ].includes(section) && (
                <Button onClick={() => openForm()}>
                  <Plus size={16} />{' '}
                  {section === 'inventory'
                    ? 'Nuevo conteo'
                    : section === 'stock'
                      ? 'Ajustar stock'
                      : 'Agregar'}
                </Button>
              )}
            </div>
          </div>
          {error && !modal && (
            <p className="notice" role="alert">
              {error}
            </p>
          )}
          {success && (
            <p className="success-notice" role="status">
              <Check size={15} />
              {success}
            </p>
          )}
          {['dashboard', 'reports', 'insights'].includes(section) && data && (
            <>
              <div className="metric-grid">
                <Metric
                  title="Ventas de hoy"
                  value={money(data.today?.revenue)}
                  detail={`${data.today?.tickets ?? 0} tickets completados`}
                />
                <Metric
                  title="Ventas del mes"
                  value={money(data.month?.revenue)}
                  detail="Mes calendario · Argentina"
                />
                <Metric
                  title="Ganancia comercial estimada"
                  value={money(
                    (data.total?.revenue ?? 0) -
                      (data.costs?.cost ?? 0) -
                      (data.fees?.fees ?? 0),
                  )}
                  detail="Histórico · descontando costo y comisión"
                />
                <Metric
                  title="Capital en stock"
                  value={money(data.inventory?.capital)}
                  detail={`${data.inventory?.units ?? 0} unidades disponibles`}
                />
              </div>
              {section === 'insights' ? (
                <div className="insight-grid">
                  <Insight
                    title="Reposición a tiempo"
                    text={`${data.inventory?.low ?? 0} variantes están en su mínimo de stock o por debajo.`}
                  />
                  <Insight
                    title="Tu colección en movimiento"
                    text={
                      data.best?.[0]
                        ? `${data.best[0].name} lidera las ventas con ${data.best[0].units} unidades.`
                        : 'Las primeras ventas van a revelar tus productos más elegidos.'
                    }
                  />
                  <Insight
                    title="Potencial de tu colección"
                    text={`El stock disponible representa ${money(data.inventory?.potential)} a precios actuales de venta.`}
                  />
                  <Insight
                    title="Resultado estimado"
                    text={`${money((data.total?.revenue ?? 0) - (data.costs?.cost ?? 0) - (data.fees?.fees ?? 0) - (data.expenses?.total ?? 0))} después de costos, comisiones y gastos registrados. No incluye impuestos no configurados.`}
                  />
                </div>
              ) : (
                <>
                  <div className="dashboard-panels">
                    <section className="panel chart-panel">
                      <div className="panel-heading">
                        <h2>El ritmo de tus ventas</h2>
                        <span>Últimos 30 días con actividad</span>
                      </div>
                      {data.trend.length ? (
                        <ChartContainer
                          config={{
                            total: { label: 'Ventas', color: '#60764c' },
                          }}
                          className="sales-chart"
                        >
                          <AreaChart data={data.trend}>
                            <defs>
                              <linearGradient
                                id="salesGradient"
                                x1="0"
                                y1="0"
                                x2="0"
                                y2="1"
                              >
                                <stop
                                  offset="0%"
                                  stopColor="#78935e"
                                  stopOpacity={0.28}
                                />
                                <stop
                                  offset="100%"
                                  stopColor="#78935e"
                                  stopOpacity={0}
                                />
                              </linearGradient>
                            </defs>
                            <CartesianGrid
                              vertical={false}
                              strokeDasharray="4 5"
                            />
                            <XAxis
                              dataKey="date"
                              tickFormatter={(v) => v.slice(5)}
                              tickLine={false}
                              axisLine={false}
                            />
                            <YAxis
                              tickFormatter={(v) =>
                                `${Math.round(v / 100000)}k`
                              }
                              tickLine={false}
                              axisLine={false}
                            />
                            <Tooltip formatter={(v: any) => money(Number(v))} />
                            <Area
                              type="monotone"
                              dataKey="total"
                              stroke="#60764c"
                              strokeWidth={2}
                              fill="url(#salesGradient)"
                            />
                          </AreaChart>
                        </ChartContainer>
                      ) : (
                        <div className="chart-empty">
                          <ShoppingBag size={30} />
                          <h3>Tu próxima venta empieza la historia</h3>
                          <p>El gráfico se construye con ventas registradas.</p>
                          <a href="/pos">
                            Crear una venta <ArrowUpRight size={14} />
                          </a>
                        </div>
                      )}
                    </section>
                    <section className="panel">
                      <div className="panel-heading">
                        <h2>Los más elegidos</h2>
                        <span>Unidades vendidas</span>
                      </div>
                      {data.best.length ? (
                        data.best.map((p: Row, i: number) => (
                          <div className="rank-row" key={p.name}>
                            <span>{String(i + 1).padStart(2, '0')}</span>
                            <strong>{p.name}</strong>
                            <span>{p.units}</span>
                          </div>
                        ))
                      ) : (
                        <p className="empty-state">
                          Todavía no hay ventas registradas.
                        </p>
                      )}
                      <div className="stock-alert">
                        <Boxes size={23} />
                        <div>
                          <strong>
                            {data.inventory?.low ?? 0} variantes para revisar
                          </strong>
                          <p>Stock en el mínimo o por debajo.</p>
                          <a href="/admin/stock">Revisar stock →</a>
                        </div>
                      </div>
                    </section>
                  </div>
                  <div className="dashboard-panels">
                    <section className="panel">
                      <div className="panel-heading">
                        <h2>Medios de pago</h2>
                        <span>Histórico</span>
                      </div>
                      {data.byPayment.length ? (
                        data.byPayment.map((p: Row) => (
                          <div className="rank-row" key={p.name}>
                            <strong>{p.name}</strong>
                            <span>{money(p.total)}</span>
                          </div>
                        ))
                      ) : (
                        <p className="empty-state">
                          Los cobros aparecerán acá.
                        </p>
                      )}
                    </section>
                    <section className="panel">
                      <div className="panel-heading">
                        <h2>Tu equipo</h2>
                        <span>Ventas completadas</span>
                      </div>
                      {data.sellers.length ? (
                        data.sellers.map((p: Row) => (
                          <div className="rank-row" key={p.name}>
                            <strong>{p.name}</strong>
                            <span>
                              {p.tickets} tickets · {money(p.total)}
                            </span>
                          </div>
                        ))
                      ) : (
                        <p className="empty-state">Cada venta cuenta.</p>
                      )}
                    </section>
                  </div>
                </>
              )}
            </>
          )}
          {section === 'cash' && data && (
            <>
              <div className="metric-grid cash-metrics">
                <Metric
                  title="Estado de caja"
                  value={
                    data.session && !data.session.closedAt
                      ? 'Abierta'
                      : 'Cerrada'
                  }
                  detail={
                    data.session
                      ? `Apertura ${date(data.session.openedAt)}`
                      : 'Sin aperturas registradas'
                  }
                />
                <Metric
                  title="Fondo inicial"
                  value={money(data.session?.opening)}
                  detail="Efectivo de apertura"
                />
                <Metric
                  title="Efectivo esperado"
                  value={money(
                    (data.session?.opening ?? 0) + (data.balance?.amount ?? 0),
                  )}
                  detail="Fondo inicial + movimientos en efectivo"
                />
              </div>
              <div className="cash-actions">
                {data.session && !data.session.closedAt ? (
                  <Button onClick={() => actionDialog('close-cash')}>
                    Cerrar y contar caja
                  </Button>
                ) : (
                  <Button onClick={() => actionDialog('open-cash')}>
                    Abrir caja
                  </Button>
                )}
                {data.session?.closedAt && (
                  <span>
                    Diferencia del último cierre:{' '}
                    {money(data.session.difference)}
                  </span>
                )}
              </div>
            </>
          )}
          {section === 'payables' && data && (
            <div className="metric-grid cash-metrics">
              {[7, 30, 60].map((days) => (
                <Metric
                  key={days}
                  title={`Compromisos próximos ${days} días`}
                  value={money(
                    list
                      .filter(
                        (p) =>
                          p.status === 'pending' &&
                          new Date(p.dueAt).getTime() <=
                            Date.now() + days * 86400000,
                      )
                      .reduce((n, p) => n + p.amount, 0),
                  )}
                  detail="Incluye obligaciones vencidas"
                />
              ))}
            </div>
          )}
          {section === 'settings' && data && (
            <section className="panel">
              <h2>Acceso del vendedor</h2>
              <p className="settings-copy">
                Las ventas propias recientes se pueden consultar durante{' '}
                {data.recentDays} días. Los costos, márgenes y datos
                administrativos se excluyen de las respuestas del POS.
              </p>
              <Button
                variant="outline"
                onClick={() => actionDialog('set-recent-days')}
              >
                Cambiar período de consulta
              </Button>
              <h2 className="spaced-heading">
                Medios de pago · configuración inicial
              </h2>
              <div className="data-table">
                <table>
                  <thead>
                    <tr>
                      <th>Medio</th>
                      <th>Recargo al cliente</th>
                      <th>Comisión interna</th>
                      <th>Acreditación</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.methods.map((m: Row) => (
                      <tr key={m.id}>
                        <td>{m.name}</td>
                        <td>{m.surchargeBps / 100}%</td>
                        <td>{m.commissionBps / 100}%</td>
                        <td>{m.days} días</td>
                        <td>
                          <Button
                            variant="ghost"
                            onClick={() => {
                              setSelected(m);
                              setForm({});
                              setModal('method');
                            }}
                          >
                            Editar
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="settings-copy">
                Configurá las comisiones y los plazos según tus acuerdos. Los
                vendedores solo ven los precios y cuotas al cliente.
              </p>
            </section>
          )}
          {columns[section] && (
            <section className="panel table-panel">
              <div className="table-toolbar">
                <div>
                  <Search size={16} />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder={`Buscar en ${title.toLowerCase()}…`}
                    aria-label="Filtrar registros"
                  />
                </div>
                <span>{filtered.length} registros</span>
              </div>
              <div className="data-table">
                <table>
                  <thead>
                    <tr>
                      {columns[section].map(([key, label]) => (
                        <th key={key}>{label}</th>
                      ))}
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.slice(0, 250).map((r, i) => (
                      <tr key={r.id ?? i}>
                        {columns[section].map(([key, , kind]) => (
                          <td key={key}>
                            {kind === 'money' ? (
                              money(r[key])
                            ) : kind === 'date' ? (
                              date(r[key])
                            ) : key === 'status' ? (
                              <span className={'status ' + r[key]}>
                                {labels[r[key]] ?? r[key]}
                              </span>
                            ) : key === 'active' ? (
                              r[key] ? (
                                'Sí'
                              ) : (
                                'No'
                              )
                            ) : (
                              (labels[r[key]] ?? String(r[key] ?? '—'))
                            )}
                          </td>
                        ))}
                        <td className="row-actions">
                          {section === 'sales' && (
                            <>
                              <Button
                                variant="ghost"
                                onClick={() => details(r)}
                              >
                                Ver ticket
                              </Button>
                              {r.status === 'confirmed' && (
                                <Button
                                  variant="ghost"
                                  onClick={() => {
                                    setSelected(r);
                                    setForm({});
                                    setModal('refund');
                                  }}
                                >
                                  Devolver
                                </Button>
                              )}
                            </>
                          )}
                          {section === 'products' && (
                            <Button
                              variant="ghost"
                              onClick={() => {
                                setSelected(r);
                                setForm({});
                                setModal('variant');
                              }}
                            >
                              Variante
                            </Button>
                          )}
                          {section === 'products' &&
                            session?.user?.role !== 'STOCK' && (
                              <Button
                                variant="ghost"
                                onClick={() => actionDialog('set-price', r)}
                              >
                                Precio
                              </Button>
                            )}
                          {section === 'stock' && (
                            <Button
                              variant="ghost"
                              onClick={() => openForm('create', r)}
                            >
                              Ajustar
                            </Button>
                          )}
                          {section === 'purchases' && r.status === 'draft' && (
                            <Button
                              variant="ghost"
                              onClick={() =>
                                actionDialog('receive-purchase', r)
                              }
                            >
                              Recibir
                            </Button>
                          )}
                          {section === 'payables' && r.status === 'pending' && (
                            <Button
                              variant="ghost"
                              onClick={() => actionDialog('pay-payable', r)}
                            >
                              Pagar
                            </Button>
                          )}
                          {section === 'inventory' && r.status === 'draft' && (
                            <Button
                              variant="ghost"
                              onClick={() => actionDialog('approve-count', r)}
                            >
                              Aprobar
                            </Button>
                          )}
                          {section === 'users' &&
                            r.active &&
                            r.id !== session?.user?.id && (
                              <Button
                                variant="ghost"
                                onClick={() => actionDialog('disable-user', r)}
                              >
                                Desactivar
                              </Button>
                            )}
                          {section === 'promotions' && (
                            <Button
                              variant="ghost"
                              onClick={() =>
                                actionDialog('toggle-promotion', r)
                              }
                            >
                              {r.active ? 'Pausar' : 'Activar'}
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!filtered.length && (
                  <div className="empty-state">
                    <Package size={28} />
                    <h3>
                      {search
                        ? 'No encontramos coincidencias'
                        : 'Todo listo para empezar'}
                    </h3>
                    <p>
                      {search
                        ? 'Probá con otro término.'
                        : 'Los registros de este módulo aparecerán acá.'}
                    </p>
                  </div>
                )}
                {filtered.length > 250 && (
                  <p className="quiet">
                    Mostrando los primeros 250 registros. Usá el buscador para
                    filtrar.
                  </p>
                )}
              </div>
            </section>
          )}
          <footer className="admin-footer">
            FRAGUAN BUSINESS STUDIO{' '}
            <span>Claridad para decidir. Tiempo para crecer.</span>
          </footer>
        </div>
      </main>
      <Dialog
        open={!!modal}
        onOpenChange={(o) => {
          if (!o && !busy) {
            setModal('');
            setError('');
          }
        }}
      >
        <DialogContent className="fraguan-modal admin-modal">
          <DialogTitle>
            {modal === 'create'
              ? `Agregar · ${title}`
              : modal === 'sale'
                ? 'Detalle de venta'
                : modal === 'refund'
                  ? 'Devolución total'
                  : 'Confirmar operación'}
          </DialogTitle>
          <DialogDescription>
            {modal === 'refund'
              ? 'Esta operación reintegra el stock, revierte el cobro registrado y descuenta los puntos. Ejecutá el reintegro en el medio de pago correspondiente.'
              : 'Los cambios quedarán registrados con tu usuario.'}
          </DialogDescription>
          {error && (
            <p className="notice" role="alert">
              {error}
            </p>
          )}
          {modal === 'sale' && selected ? (
            <>
              <div className="receipt">
                <h2>FRAGUAN</h2>
                <p>
                  Ticket #{selected.ticket} · {date(selected.createdAt)}
                </p>
                {selected.items?.map((i: Row) => (
                  <div key={i.id} className="receipt-line">
                    <span>
                      {i.name}
                      <small>
                        {i.color} · {i.size} · {i.quantity} unidades
                      </small>
                    </span>
                    <strong>{money(i.quantity * i.price)}</strong>
                  </div>
                ))}
                <div className="total-line">
                  <span>Total</span>
                  <strong>{money(selected.total)}</strong>
                </div>
                <p className="quiet">
                  Comprobante interno. No válido como factura fiscal.
                </p>
              </div>
              <Button className="no-print" onClick={() => window.print()}>
                <Printer /> Imprimir
              </Button>
            </>
          ) : (
            <form className="quick-form" onSubmit={submit}>
              {modal === 'method' && (
                <>
                  {field('name', 'Nombre', { value: selected?.name })}
                  {field('surcharge', 'Recargo al cliente (%)', {
                    type: 'number',
                    value: selected?.surchargeBps / 100,
                  })}
                  {field('commission', 'Comisión interna (%)', {
                    type: 'number',
                    value: selected?.commissionBps / 100,
                  })}
                  {field('days', 'Días hasta acreditar', {
                    type: 'number',
                    value: selected?.days,
                  })}
                  {field('installments', 'Cantidad de cuotas', {
                    type: 'number',
                    value: selected?.installments,
                  })}
                </>
              )}
              {modal === 'variant' && (
                <>
                  <p>{selected?.name}</p>
                  {field('color', 'Color')}
                  {field('size', 'Talle')}
                  {field('sku', 'SKU')}
                  {field('barcode', 'Código de barras')}
                  {field('price', 'Precio (pesos)')}
                  {field('cost', 'Costo (pesos)')}
                  {field('stock', 'Stock inicial', { type: 'number' })}
                  {field('minimum', 'Stock mínimo', {
                    type: 'number',
                    optional: true,
                  })}
                </>
              )}
              {modal === 'action' && (
                <>
                  {['open-cash', 'close-cash', 'set-price'].includes(
                    selected?.action,
                  ) &&
                    field(
                      'amount',
                      selected?.action === 'close-cash'
                        ? 'Efectivo contado (pesos)'
                        : selected?.action === 'set-price'
                          ? 'Nuevo precio al cliente (pesos)'
                          : 'Fondo inicial (pesos)',
                    )}
                  {selected?.action === 'set-price' &&
                    field('cost', 'Costo (pesos)')}
                  {selected?.action === 'set-recent-days' &&
                    field('amount', 'Días de consulta (1 a 90)', {
                      type: 'number',
                    })}
                  {selected?.action === 'pay-payable' &&
                    field('methodId', 'Medio de pago', {
                      choices: paymentChoices,
                    })}
                  {selected?.action === 'receive-purchase' && (
                    <p>
                      Se recibirá la orden completa y se generará la cuenta a
                      pagar.
                    </p>
                  )}
                  {selected?.action === 'approve-count' && (
                    <p>
                      Se aplicarán las diferencias del conteo. Si hubo
                      movimientos desde que se contó, se rechazará para evitar
                      un ajuste incorrecto.
                    </p>
                  )}
                  {selected?.action === 'disable-user' && (
                    <p>La cuenta dejará de tener acceso inmediatamente.</p>
                  )}
                </>
              )}
              {modal === 'refund' && field('reason', 'Motivo de la devolución')}
              {modal === 'create' && (
                <>
                  {section === 'products' && (
                    <>
                      {field('name', 'Nombre')}
                      {field('category', 'Categoría', {
                        choices: [
                          'Remeras',
                          'Camisas',
                          'Pantalones',
                          'Jeans',
                          'Buzos',
                          'Camperas',
                          'Accesorios',
                          'Chombas',
                          'Calzado',
                        ].map((x) => [x, x]),
                      })}
                      {field('brand', 'Marca', { optional: true })}
                      {field('color', 'Color')}
                      {field('size', 'Talle')}
                      {field('sku', 'SKU')}
                      {field('barcode', 'Código de barras')}
                      {field('price', 'Precio (pesos)')}
                      {field('cost', 'Costo (pesos)')}
                      {field('stock', 'Stock inicial', { type: 'number' })}
                      {field('minimum', 'Stock mínimo', {
                        type: 'number',
                        optional: true,
                      })}
                    </>
                  )}
                  {section === 'stock' && (
                    <>
                      {!selected &&
                        field('variantId', 'Variante', {
                          choices: variantChoices,
                        })}
                      {selected && (
                        <p>
                          {selected.name} · {selected.color} · {selected.size} ·
                          Stock: {selected.stock}
                        </p>
                      )}
                      {field('quantity', 'Unidades a sumar o restar', {
                        type: 'number',
                      })}
                      {field('reason', 'Motivo del ajuste (mín. 5 caracteres)')}
                    </>
                  )}
                  {section === 'customers' && (
                    <>
                      {field('name', 'Nombre')}
                      {field('surname', 'Apellido')}
                      {field('phone', 'Teléfono')}
                    </>
                  )}
                  {section === 'suppliers' && (
                    <>
                      {field('name', 'Nombre / empresa')}
                      {field('phone', 'Teléfono', { optional: true })}
                      {field('email', 'Email', {
                        type: 'email',
                        optional: true,
                      })}
                      {field('terms', 'Condiciones comerciales', {
                        optional: true,
                      })}
                    </>
                  )}
                  {section === 'expenses' && (
                    <>
                      {field('description', 'Concepto')}
                      {field('category', 'Categoría', {
                        choices: [
                          'Alquiler',
                          'Servicios',
                          'Empleados',
                          'Marketing',
                          'Software',
                          'Impuestos',
                          'Logística',
                          'Packaging',
                          'Otros',
                        ].map((x) => [x, x]),
                      })}
                      {field('amount', 'Importe (pesos)')}
                      {field('date', 'Fecha', { type: 'date' })}
                      {field('methodId', 'Medio de pago', {
                        choices: paymentChoices,
                      })}
                    </>
                  )}
                  {section === 'payables' && (
                    <>
                      {field('description', 'Concepto')}
                      {field('amount', 'Importe (pesos)')}
                      {field('dueAt', 'Vencimiento', { type: 'date' })}
                      {field('kind', 'Tipo', {
                        choices: [
                          'Proveedor',
                          'Transferencia',
                          'Cheque',
                          'eCheq',
                          'Servicio',
                          'Cuota',
                        ].map((x) => [x, x]),
                      })}
                      {field('supplierId', 'Proveedor', {
                        choices: supplierChoices,
                        optional: true,
                      })}
                    </>
                  )}
                  {section === 'withdrawals' && (
                    <>
                      {field('person', 'Socio / propietario')}
                      {field('amount', 'Importe (pesos)')}
                      {field('reason', 'Motivo')}
                      {field('methodId', 'Medio de pago', {
                        choices: paymentChoices,
                      })}
                    </>
                  )}
                  {section === 'purchases' && (
                    <>
                      {field('supplierId', 'Proveedor', {
                        choices: supplierChoices,
                      })}
                      {field('variantId', 'Variante', {
                        choices: variantChoices,
                      })}
                      {field('quantity', 'Cantidad', { type: 'number' })}
                      {field('cost', 'Costo unitario (pesos)')}
                      {field('dueAt', 'Vencimiento de pago', { type: 'date' })}
                    </>
                  )}
                  {section === 'promotions' && (
                    <>
                      {field('name', 'Nombre de la promoción')}
                      {field('percent', 'Porcentaje autorizado', {
                        type: 'number',
                      })}
                      {field('methodId', 'Medio de pago (vacío: todos)', {
                        choices: paymentChoices,
                        optional: true,
                      })}
                      {field('startsAt', 'Desde', { type: 'date' })}
                      {field('endsAt', 'Hasta', { type: 'date' })}
                    </>
                  )}
                  {section === 'users' && (
                    <>
                      {field('name', 'Nombre')}
                      {field('email', 'Email de la cuenta ChatGPT', {
                        type: 'email',
                      })}
                      {field('role', 'Rol', {
                        choices: [
                          'VENDEDOR',
                          'CAJA',
                          'STOCK',
                          'GERENTE',
                          'ADMIN',
                        ].map((x) => [x, x]),
                      })}
                      <p className="quiet">
                        Además del rol, la cuenta debe estar autorizada para
                        acceder al sitio privado.
                      </p>
                    </>
                  )}
                  {section === 'inventory' && (
                    <>
                      {field('variantId', 'Variante a contar', {
                        choices: variantChoices,
                      })}
                      {field('counted', 'Cantidad encontrada', {
                        type: 'number',
                      })}
                      <p className="quiet">
                        Guardar el conteo no modifica stock. Se requiere una
                        aprobación posterior.
                      </p>
                    </>
                  )}
                </>
              )}
              <Button type="submit" className="activate" disabled={busy}>
                {busy
                  ? 'Guardando…'
                  : modal === 'refund'
                    ? 'Confirmar devolución'
                    : modal === 'action'
                      ? 'Confirmar'
                      : 'Guardar'}
                <Check />
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
function Metric({
  title,
  value,
  detail,
}: {
  title: string;
  value: string;
  detail: string;
}) {
  return (
    <section className="metric">
      <p>{title}</p>
      <strong>{value}</strong>
      <small>{detail}</small>
    </section>
  );
}
function Insight({ title, text }: { title: string; text: string }) {
  return (
    <section className="panel insight">
      <Sparkles size={21} />
      <h2>{title}</h2>
      <p>{text}</p>
    </section>
  );
}
