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
  TrendingUp,
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
  ['replenishment', 'Reposición sugerida', RefreshCw],
  ['sales', 'Ventas', ShoppingBag],
  ['customers', 'Clientes & Club', Users],
  ['customer-intelligence', 'Inteligencia de clientes', Sparkles],
  ['suppliers', 'Proveedores', Truck],
  ['purchases', 'Compras', ClipboardList],
  ['cash', 'Caja', Wallet],
  ['cash-flow', 'Flujo de fondos', TrendingUp],
  ['financial-calendar', 'Calendario financiero', CalendarClock],
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
    ['kind', 'Tipo'],
    ['scope', 'Alcance'],
    ['condition', 'Condición'],
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
  replenishment: 'Detectá faltantes y prepará compras según la rotación real.',
  sales: 'El registro de cada buena experiencia.',
  customers: 'Conocé a quienes eligen FRAGUAN.',
  'customer-intelligence':
    'Segmentos, niveles e historial para construir relaciones duraderas.',
  suppliers: 'Las relaciones detrás de tu colección.',
  purchases: 'De la orden al perchero, con trazabilidad.',
  cash: 'Apertura, movimientos y cierre en un solo lugar.',
  'cash-flow': 'Proyectá cobros y compromisos registrados antes de decidir.',
  'financial-calendar': 'Ordená vencimientos por fecha y nivel de urgencia.',
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
  partially_refunded: 'Devuelta parcialmente',
  draft: 'Borrador',
  sent: 'Enviada',
  partially_received: 'Recibida parcialmente',
  received: 'Recibida',
  pending: 'Pendiente',
  paid: 'Pagada',
  approved: 'Aprobado',
  cash: 'Efectivo',
  debit: 'Débito',
  credit: 'Crédito',
  transfer: 'Transferencia',
  percentage: 'Porcentaje',
  fixed_amount: 'Monto fijo',
  two_for_one: '2×1',
  second_unit_percentage: 'Segunda unidad',
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
    [success, setSuccess] = useState(''),
    [authorization, setAuthorization] = useState<Row | null>(null);
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
  async function customerProfile(customerId: string) {
    setError('');
    try {
      setSelected(await api('customer-intelligence?id=' + customerId));
      setModal('customer-profile');
    } catch (e: any) {
      setError(e.message);
    }
  }
  async function purchaseDetails(purchaseId: string, mode = 'purchase-detail') {
    setError('');
    try {
      setSelected(await api('purchases?id=' + purchaseId));
      setForm({});
      setModal(mode);
    } catch (e: any) {
      setError(e.message);
    }
  }
  async function changePurchaseStatus(
    purchaseId: string,
    action: 'send' | 'confirm',
  ) {
    await mutate('purchase-transitions', { purchaseId, action });
  }
  async function openRefund(s: Row) {
    setError('');
    setForm({ method: 'original' });
    try {
      setSelected(await api('sales?id=' + s.id));
      setModal('refund');
    } catch (e: any) {
      setError(e.message);
    }
  }
  async function authorizeRefund() {
    if (!selected) return;
    setBusy(true);
    setError('');
    try {
      setAuthorization(
        await api('refund-authorizations', {
          saleId: selected.id,
          maxAmount: selected.total,
        }),
      );
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
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
  const purchaseLines: Row[] = form.purchaseLines ?? [
    { variantId: '', quantity: '', cost: '', discount: '' },
  ];
  function updatePurchaseLine(index: number, key: string, value: any) {
    setForm({
      ...form,
      purchaseLines: purchaseLines.map((line, current) =>
        current === index ? { ...line, [key]: value } : line,
      ),
    });
  }
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
        const items = selected?.items
          ?.map((item: Row) => ({
            saleItemId: item.id,
            quantity: Number(form[`refund_${item.id}`] ?? 0),
          }))
          .filter((item: Row) => item.quantity > 0);
        await mutate('refunds', {
          saleId: selected?.id,
          reason: form.reason,
          method: form.method || 'original',
          ...(items?.length ? { items } : {}),
        });
        return;
      }
      if (modal === 'purchase-receipt') {
        const items = selected?.items
          ?.map((item: Row) => ({
            purchaseItemId: item.id,
            quantity: Number(form[`receive_${item.id}`] ?? 0),
          }))
          .filter((item: Row) => item.quantity > 0);
        await mutate('purchase-receipts', {
          purchaseId: selected?.id,
          items,
          notes: form.notes || '',
          idempotencyKey: crypto.randomUUID(),
        });
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
          items: purchaseLines.map((line) => ({
            variantId: line.variantId,
            quantity: Number(line.quantity),
            cost: minor(line.cost),
            discount: line.discount ? minor(line.discount) : 0,
          })),
          discount: form.discount ? minor(form.discount) : 0,
          tax: form.tax ? minor(form.tax) : 0,
          shipping: form.shipping ? minor(form.shipping) : 0,
          paymentMethod: form.paymentMethod || 'cuenta_corriente',
          supplierReference: form.supplierReference || '',
          notes: form.notes || '',
          idempotencyKey: crypto.randomUUID(),
        };
      if (section === 'promotions')
        payload = {
          name: form.name,
          kind: form.kind || 'percentage',
          ...(form.kind !== 'fixed_amount' && form.kind !== 'two_for_one'
            ? { percent: Number(form.percent) }
            : {}),
          ...(form.kind === 'fixed_amount'
            ? { amount: minor(form.amount) }
            : {}),
          methodId: form.methodId || null,
          startsAt: form.startsAt,
          endsAt: form.endsAt,
          category: form.category || null,
          brand: form.brand || null,
          couponCode: form.couponCode || null,
          customerLevel: form.customerLevel || null,
          birthday: form.birthday === 'yes',
          birthdayDays: Number(form.birthdayDays || 0),
          daysOfWeek: form.daysOfWeek
            ? String(form.daysOfWeek)
                .split(',')
                .map((day) => Number(day.trim()))
            : undefined,
          dailyStart: form.dailyStart || null,
          dailyEnd: form.dailyEnd || null,
          priority: Number(form.priority || 0),
          exclusive: form.exclusive === 'yes',
          groupBy: form.groupBy || 'line',
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
                'cash-flow',
                'customer-intelligence',
                'replenishment',
                'financial-calendar',
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
          {section === 'cash-flow' && data && (
            <>
              <div className="metric-grid">
                <Metric
                  title="Fondos registrados hoy"
                  value={money(data.currentRecordedCash?.amountMinor)}
                  detail={
                    data.currentRecordedCash?.status === 'open'
                      ? 'Efectivo de la caja abierta'
                      : 'No hay una caja abierta'
                  }
                />
                {[7, 30, 90].map((days) => (
                  <Metric
                    key={days}
                    title={`Proyección a ${days} días`}
                    value={money(
                      data.horizons?.[String(days)]?.projectedKnownFundsMinor,
                    )}
                    detail={`${money(data.horizons?.[String(days)]?.settlementMinor)} a cobrar · ${money(data.horizons?.[String(days)]?.payableMinor)} comprometidos`}
                  />
                ))}
              </div>
              <div className="dashboard-panels">
                <section className="panel chart-panel">
                  <div className="panel-heading">
                    <h2>Caja conocida proyectada</h2>
                    <span>Próximos 90 días</span>
                  </div>
                  <ChartContainer
                    config={{
                      projectedKnownFundsMinor: {
                        label: 'Fondos proyectados',
                        color: '#60764c',
                      },
                    }}
                    className="sales-chart"
                  >
                    <AreaChart data={data.daily}>
                      <CartesianGrid vertical={false} strokeDasharray="4 5" />
                      <XAxis
                        dataKey="date"
                        tickFormatter={(value) => value.slice(5)}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        tickFormatter={(value) =>
                          `${Math.round(value / 100000)}k`
                        }
                        tickLine={false}
                        axisLine={false}
                      />
                      <Tooltip
                        formatter={(value: any) => money(Number(value))}
                      />
                      <Area
                        type="monotone"
                        dataKey="projectedKnownFundsMinor"
                        stroke="#60764c"
                        strokeWidth={2}
                        fill="url(#salesGradient)"
                      />
                    </AreaChart>
                  </ChartContainer>
                </section>
                <section className="panel">
                  <div className="panel-heading">
                    <h2>Compromisos pendientes</h2>
                    <span>{data.pendingPayables?.count ?? 0} registros</span>
                  </div>
                  <div className="rank-row">
                    <strong>Total pendiente</strong>
                    <span>{money(data.pendingPayables?.totalMinor)}</span>
                  </div>
                  <div className="rank-row">
                    <strong>Ya vencido</strong>
                    <span>{money(data.pendingPayables?.overdueMinor)}</span>
                  </div>
                  <div className="rank-row">
                    <strong>Liquidaciones futuras netas</strong>
                    <span>{money(data.futureSettlements?.totalNetMinor)}</span>
                  </div>
                  <p className="quiet">
                    La proyección usa únicamente la caja abierta, las
                    acreditaciones y las obligaciones registradas. El saldo
                    bancario se incorporará cuando conectemos la fuente
                    definitiva.
                  </p>
                </section>
              </div>
            </>
          )}
          {section === 'customer-intelligence' && data && (
            <>
              <div className="metric-grid">
                <Metric
                  title="Clientes registrados"
                  value={String(data.customerCount ?? 0)}
                  detail={`${data.customersWithPurchases ?? 0} ya compraron`}
                />
                <Metric
                  title="Clientes recurrentes"
                  value={`${((data.repeatCustomerRateBps ?? 0) / 100).toFixed(1)}%`}
                  detail={`${data.repeatCustomers ?? 0} con más de una compra`}
                />
                <Metric
                  title="Valor promedio por cliente"
                  value={money(data.averageCustomerValueMinor)}
                  detail="Compras históricas registradas"
                />
                <Metric
                  title="Ticket promedio"
                  value={money(data.averageTicketMinor)}
                  detail={`${data.purchaseCount ?? 0} compras identificadas`}
                />
              </div>
              <div className="dashboard-panels">
                <section className="panel">
                  <div className="panel-heading">
                    <h2>Segmentación automática</h2>
                    <span>Actividad y frecuencia</span>
                  </div>
                  {data.segments?.map((segment: Row) => (
                    <div className="rank-row" key={segment.segment}>
                      <strong>{segment.segment}</strong>
                      <span>
                        {segment.customers} ·{' '}
                        {(segment.shareBps / 100).toFixed(1)}%
                      </span>
                    </div>
                  ))}
                </section>
                <section className="panel">
                  <div className="panel-heading">
                    <h2>Niveles Club FRAGUAN</h2>
                    <span>Últimos 12 meses</span>
                  </div>
                  {data.loyaltyLevels?.map((level: Row) => (
                    <div className="rank-row" key={level.level}>
                      <strong>{level.level}</strong>
                      <span>
                        {level.customers} · {money(level.lifetimeSpendMinor)}
                      </span>
                    </div>
                  ))}
                </section>
              </div>
              <section className="panel table-panel">
                <div className="panel-heading">
                  <h2>Clientes destacados</h2>
                  <span>Valor y frecuencia</span>
                </div>
                <div className="data-table">
                  <table>
                    <thead>
                      <tr>
                        <th>Cliente</th>
                        <th>Segmento</th>
                        <th>Nivel</th>
                        <th>Compras</th>
                        <th>Total</th>
                        <th>Acción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.topCustomers?.map((customer: Row) => (
                        <tr key={customer.id}>
                          <td>
                            {customer.name} {customer.surname}
                          </td>
                          <td>{customer.segment}</td>
                          <td>{customer.loyaltyLevel}</td>
                          <td>{customer.purchaseCount}</td>
                          <td>{money(customer.lifetimeSpendMinor)}</td>
                          <td>
                            <Button
                              variant="ghost"
                              onClick={() => customerProfile(customer.id)}
                            >
                              Ver perfil
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          )}
          {section === 'replenishment' && data && (
            <>
              <div className="metric-grid">
                <Metric
                  title="Variantes agotadas"
                  value={String(data.summary?.outOfStock ?? 0)}
                  detail="Prioridad crítica"
                />
                <Metric
                  title="Stock bajo"
                  value={String(data.summary?.lowStock ?? 0)}
                  detail={`Sobre ${data.summary?.totalVariants ?? 0} variantes`}
                />
                <Metric
                  title="Unidades sugeridas"
                  value={String(data.summary?.suggestedOrderUnits ?? 0)}
                  detail="Objetivo de cobertura de 45 días"
                />
                <Metric
                  title="Sin proveedor asignado"
                  value={String(data.summary?.variantsWithoutSupplier ?? 0)}
                  detail="Requieren completar producto"
                />
              </div>
              <section className="panel table-panel">
                <div className="panel-heading">
                  <h2>Alertas de reposición</h2>
                  <span>
                    Venta neta de los últimos{' '}
                    {data.config?.velocityWindowDays ?? 30} días
                  </span>
                </div>
                <div className="data-table">
                  <table>
                    <thead>
                      <tr>
                        <th>Producto / variante</th>
                        <th>Proveedor</th>
                        <th>Stock</th>
                        <th>Vendidas</th>
                        <th>Cobertura</th>
                        <th>Sugerencia</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.alerts?.map((item: Row) => (
                        <tr key={item.variantId}>
                          <td>
                            <strong>{item.productName}</strong>
                            <small>
                              {item.color} · {item.size} · {item.sku}
                            </small>
                          </td>
                          <td>{item.supplier?.name ?? 'Sin asignar'}</td>
                          <td>{item.stock.availableUnits}</td>
                          <td>{item.velocity.soldUnits}</td>
                          <td>
                            {item.stock.coverageDays == null
                              ? 'Sin rotación'
                              : `${item.stock.coverageDays} días`}
                          </td>
                          <td>
                            <strong>
                              {item.recommendation.suggestedOrderUnits} u.
                            </strong>
                            <small>{item.recommendation.reason}</small>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!data.alerts?.length && (
                    <div className="empty-state">
                      <Check size={28} />
                      <h3>Stock saludable</h3>
                      <p>
                        No hay variantes que requieran reposición con las reglas
                        actuales.
                      </p>
                    </div>
                  )}
                </div>
              </section>
            </>
          )}
          {section === 'financial-calendar' && data && (
            <>
              <div className="metric-grid">
                {[
                  ['overdue', 'Vencido'],
                  ['today', 'Hoy'],
                  ['next_7_days', 'Próximos 7 días'],
                  ['next_30_days', 'Próximos 30 días'],
                ].map(([key, label]) => (
                  <Metric
                    key={key}
                    title={label}
                    value={money(data.summary?.[key]?.amountMinor)}
                    detail={`${data.summary?.[key]?.count ?? 0} compromisos`}
                  />
                ))}
              </div>
              <section className="panel table-panel">
                <div className="panel-heading">
                  <h2>Agenda de pagos</h2>
                  <span>Hasta {date(data.throughOn)}</span>
                </div>
                <div className="data-table">
                  <table>
                    <thead>
                      <tr>
                        <th>Vencimiento</th>
                        <th>Estado</th>
                        <th>Concepto</th>
                        <th>Tipo</th>
                        <th>Proveedor</th>
                        <th>Importe</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.entries?.map((entry: Row) => (
                        <tr key={entry.id}>
                          <td>{date(entry.dueOn)}</td>
                          <td>
                            {data.summary?.[entry.bucket]?.label ??
                              entry.bucket}
                          </td>
                          <td>{entry.description}</td>
                          <td>{entry.kind}</td>
                          <td>{entry.supplierName ?? '—'}</td>
                          <td>{money(entry.amountMinor)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!data.entries?.length && (
                    <div className="empty-state">
                      <CalendarClock size={28} />
                      <h3>Sin compromisos en el período</h3>
                      <p>
                        Las cuentas a pagar aparecerán ordenadas por
                        vencimiento.
                      </p>
                    </div>
                  )}
                </div>
              </section>
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
                              {['confirmed', 'partially_refunded'].includes(
                                r.status,
                              ) && (
                                <Button
                                  variant="ghost"
                                  onClick={() => openRefund(r)}
                                >
                                  Devolver
                                </Button>
                              )}
                            </>
                          )}
                          {section === 'customers' && (
                            <Button
                              variant="ghost"
                              onClick={() => customerProfile(String(r.id))}
                            >
                              Perfil
                            </Button>
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
                          {section === 'purchases' && (
                            <Button
                              variant="ghost"
                              onClick={() => purchaseDetails(String(r.id))}
                            >
                              Detalle
                            </Button>
                          )}
                          {section === 'purchases' && r.status === 'draft' && (
                            <Button
                              variant="ghost"
                              onClick={() =>
                                changePurchaseStatus(String(r.id), 'send')
                              }
                            >
                              Enviar
                            </Button>
                          )}
                          {section === 'purchases' && r.status === 'sent' && (
                            <Button
                              variant="ghost"
                              onClick={() =>
                                changePurchaseStatus(String(r.id), 'confirm')
                              }
                            >
                              Confirmar
                            </Button>
                          )}
                          {section === 'purchases' &&
                            ['confirmed', 'partially_received'].includes(
                              r.status,
                            ) && (
                              <Button
                                variant="ghost"
                                onClick={() =>
                                  purchaseDetails(
                                    String(r.id),
                                    'purchase-receipt',
                                  )
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
                  ? 'Cambio o devolución'
                  : modal === 'customer-profile'
                    ? 'Perfil del cliente'
                    : modal === 'purchase-detail'
                      ? 'Orden de compra'
                      : modal === 'purchase-receipt'
                        ? 'Recibir mercadería'
                        : 'Confirmar operación'}
          </DialogTitle>
          <DialogDescription>
            {modal === 'refund'
              ? 'Esta operación reintegra el stock, revierte el cobro registrado y descuenta los puntos. Ejecutá el reintegro en el medio de pago correspondiente.'
              : modal === 'customer-profile'
                ? 'Segmentación, nivel e historial calculados con la actividad registrada.'
                : modal === 'purchase-detail'
                  ? 'Líneas, costos, estado y recepciones de la orden.'
                  : modal === 'purchase-receipt'
                    ? 'Registrá únicamente las unidades que llegaron. El resto quedará pendiente.'
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
              {['confirmed', 'partially_refunded'].includes(
                selected.status,
              ) && (
                <Button
                  className="no-print"
                  variant="outline"
                  disabled={busy}
                  onClick={authorizeRefund}
                >
                  <ShieldCheck /> Autorizar devolución al vendedor
                </Button>
              )}
              {authorization && (
                <div className="authorization-code">
                  <span>CÓDIGO VÁLIDO POR 10 MINUTOS</span>
                  <strong>{authorization.token}</strong>
                  <small>Válido una sola vez para este ticket.</small>
                </div>
              )}
            </>
          ) : modal === 'purchase-detail' && selected ? (
            <div className="customer-profile">
              <div className="profile-heading">
                <div>
                  <p className="eyebrow">ORDEN DE COMPRA</p>
                  <h2>{selected.supplier}</h2>
                  <p>
                    {date(selected.createdAt)} · Vence {date(selected.dueAt)}
                  </p>
                </div>
                <div className="profile-badges">
                  <span>{labels[selected.status] ?? selected.status}</span>
                  <span>{money(selected.total)}</span>
                </div>
              </div>
              <div className="data-table profile-history">
                <table>
                  <thead>
                    <tr>
                      <th>Prenda</th>
                      <th>Pedido</th>
                      <th>Recibido</th>
                      <th>Costo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selected.items?.map((item: Row) => (
                      <tr key={item.id}>
                        <td>
                          {item.name}
                          <small>
                            {item.color} · {item.size} · {item.sku}
                          </small>
                        </td>
                        <td>{item.quantity}</td>
                        <td>{item.received}</td>
                        <td>{money(item.cost)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="summary-line">
                <span>Subtotal</span>
                <span>{money(selected.subtotal)}</span>
              </div>
              <div className="summary-line">
                <span>Descuentos</span>
                <span>−{money(selected.discount)}</span>
              </div>
              <div className="summary-line">
                <span>Impuestos + transporte</span>
                <span>
                  {money((selected.tax ?? 0) + (selected.shipping ?? 0))}
                </span>
              </div>
              <div className="total-line">
                <span>Total</span>
                <strong>{money(selected.total)}</strong>
              </div>
              {selected.status === 'draft' && (
                <Button
                  onClick={() => changePurchaseStatus(selected.id, 'send')}
                  disabled={busy}
                >
                  Enviar orden
                </Button>
              )}
              {selected.status === 'sent' && (
                <Button
                  onClick={() => changePurchaseStatus(selected.id, 'confirm')}
                  disabled={busy}
                >
                  Confirmar orden
                </Button>
              )}
              {['confirmed', 'partially_received'].includes(
                selected.status,
              ) && (
                <Button onClick={() => setModal('purchase-receipt')}>
                  Recibir mercadería
                </Button>
              )}
              {!!selected.receipts?.length && (
                <>
                  <h3>Recepciones</h3>
                  {selected.receipts.map((receipt: Row) => (
                    <div className="rank-row" key={receipt.id}>
                      <strong>{date(receipt.createdAt)}</strong>
                      <span>
                        {receipt.units} unidades · {money(receipt.subtotal)}
                      </span>
                    </div>
                  ))}
                </>
              )}
            </div>
          ) : modal === 'customer-profile' && selected ? (
            <div className="customer-profile">
              <div className="profile-heading">
                <div>
                  <p className="eyebrow">CLIENTE FRAGUAN</p>
                  <h2>
                    {selected.metrics?.name} {selected.metrics?.surname}
                  </h2>
                  <p>
                    {selected.metrics?.phone}
                    {selected.metrics?.email
                      ? ` · ${selected.metrics.email}`
                      : ''}
                  </p>
                </div>
                <div className="profile-badges">
                  <span>{selected.metrics?.segment}</span>
                  <span>{selected.metrics?.loyaltyLevel}</span>
                </div>
              </div>
              <div className="metric-grid profile-metrics">
                <Metric
                  title="Valor histórico"
                  value={money(selected.metrics?.lifetimeSpendMinor)}
                  detail={`${selected.metrics?.purchaseCount ?? 0} compras`}
                />
                <Metric
                  title="Ticket promedio"
                  value={money(selected.metrics?.averageTicketMinor)}
                  detail={`${selected.metrics?.points ?? 0} puntos disponibles`}
                />
                <Metric
                  title="Última compra"
                  value={
                    selected.metrics?.lastPurchaseAt
                      ? date(selected.metrics.lastPurchaseAt)
                      : 'Sin compras'
                  }
                  detail={
                    selected.metrics?.daysSinceLastPurchase == null
                      ? 'Todavía sin actividad'
                      : `Hace ${selected.metrics.daysSinceLastPurchase} días`
                  }
                />
              </div>
              <h3>Historial de compras</h3>
              <div className="data-table profile-history">
                <table>
                  <thead>
                    <tr>
                      <th>Ticket</th>
                      <th>Fecha</th>
                      <th>Estado</th>
                      <th>Neto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selected.history?.sales?.map((sale: Row) => (
                      <tr key={sale.id}>
                        <td>#{sale.ticket}</td>
                        <td>{date(sale.createdAt)}</td>
                        <td>{labels[sale.status] ?? sale.status}</td>
                        <td>{money(sale.netTotalMinor)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!selected.history?.sales?.length && (
                <p className="quiet">Todavía no hay compras identificadas.</p>
              )}
              <Button variant="outline" onClick={() => setModal('')}>
                Cerrar perfil
              </Button>
            </div>
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
              {modal === 'refund' && (
                <>
                  <p>
                    Elegí cantidades. Si dejás todas en cero, se devolverá todo
                    lo pendiente.
                  </p>
                  {selected?.items?.map((item: Row) => (
                    <label key={item.id}>
                      {item.name} · {item.color} · {item.size} (máx.{' '}
                      {item.quantity - item.refunded})
                      <Input
                        type="number"
                        min={0}
                        max={item.quantity - item.refunded}
                        value={form[`refund_${item.id}`] ?? 0}
                        onChange={(event) =>
                          setForm({
                            ...form,
                            [`refund_${item.id}`]: event.target.value,
                          })
                        }
                      />
                    </label>
                  ))}
                  {field('method', 'Resolución', {
                    choices: [
                      ['original', 'Reintegrar por el medio original'],
                      ['credit', 'Emitir saldo a favor'],
                    ],
                    value: 'original',
                  })}
                  {field('reason', 'Motivo de la devolución')}
                </>
              )}
              {modal === 'purchase-receipt' && (
                <>
                  {selected?.items?.map((item: Row) => {
                    const pending = item.quantity - item.received;
                    return (
                      <label key={item.id}>
                        {item.name} · {item.color} · {item.size} · pendientes{' '}
                        {pending}
                        <Input
                          type="number"
                          min={0}
                          max={pending}
                          disabled={!pending}
                          value={form[`receive_${item.id}`] ?? 0}
                          onChange={(event) =>
                            setForm({
                              ...form,
                              [`receive_${item.id}`]: event.target.value,
                            })
                          }
                        />
                      </label>
                    );
                  })}
                  {field('notes', 'Observaciones de la recepción', {
                    optional: true,
                  })}
                </>
              )}
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
                      <div className="purchase-lines">
                        <div className="panel-heading">
                          <h3>Prendas de la orden</h3>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() =>
                              setForm({
                                ...form,
                                purchaseLines: [
                                  ...purchaseLines,
                                  {
                                    variantId: '',
                                    quantity: '',
                                    cost: '',
                                    discount: '',
                                  },
                                ],
                              })
                            }
                          >
                            <Plus size={14} /> Línea
                          </Button>
                        </div>
                        {purchaseLines.map((line, index) => (
                          <div className="purchase-line-editor" key={index}>
                            <label>
                              Variante
                              <select
                                required
                                value={line.variantId}
                                onChange={(event) =>
                                  updatePurchaseLine(
                                    index,
                                    'variantId',
                                    event.target.value,
                                  )
                                }
                              >
                                <option value="">Seleccionar…</option>
                                {variantChoices.map(([value, label]) => (
                                  <option key={value} value={value}>
                                    {label}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label>
                              Cantidad
                              <Input
                                required
                                type="number"
                                min={1}
                                value={line.quantity}
                                onChange={(event) =>
                                  updatePurchaseLine(
                                    index,
                                    'quantity',
                                    event.target.value,
                                  )
                                }
                              />
                            </label>
                            <label>
                              Costo unitario (pesos)
                              <Input
                                required
                                inputMode="decimal"
                                value={line.cost}
                                onChange={(event) =>
                                  updatePurchaseLine(
                                    index,
                                    'cost',
                                    event.target.value,
                                  )
                                }
                              />
                            </label>
                            <label>
                              Descuento de línea (pesos)
                              <Input
                                inputMode="decimal"
                                value={line.discount}
                                onChange={(event) =>
                                  updatePurchaseLine(
                                    index,
                                    'discount',
                                    event.target.value,
                                  )
                                }
                              />
                            </label>
                            {purchaseLines.length > 1 && (
                              <Button
                                type="button"
                                variant="ghost"
                                onClick={() =>
                                  setForm({
                                    ...form,
                                    purchaseLines: purchaseLines.filter(
                                      (_, current) => current !== index,
                                    ),
                                  })
                                }
                              >
                                Quitar
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>
                      {field('discount', 'Descuento general (pesos)', {
                        optional: true,
                      })}
                      {field('tax', 'Impuestos (pesos)', { optional: true })}
                      {field('shipping', 'Transporte (pesos)', {
                        optional: true,
                      })}
                      {field('paymentMethod', 'Condición de pago', {
                        choices: [
                          ['cuenta_corriente', 'Cuenta corriente'],
                          ['transferencia', 'Transferencia'],
                          ['cheque', 'Cheque'],
                          ['echeq', 'eCheq'],
                          ['efectivo', 'Efectivo'],
                        ],
                        value: 'cuenta_corriente',
                      })}
                      {field('supplierReference', 'Referencia del proveedor', {
                        optional: true,
                      })}
                      {field('dueAt', 'Vencimiento de pago', { type: 'date' })}
                      {field('notes', 'Observaciones', { optional: true })}
                    </>
                  )}
                  {section === 'promotions' && (
                    <>
                      {field('name', 'Nombre de la promoción')}
                      {field('kind', 'Tipo de beneficio', {
                        choices: [
                          ['percentage', 'Descuento porcentual'],
                          ['fixed_amount', 'Monto fijo'],
                          ['two_for_one', '2×1'],
                          [
                            'second_unit_percentage',
                            'Segunda unidad con descuento',
                          ],
                        ],
                        value: 'percentage',
                      })}
                      {['percentage', 'second_unit_percentage'].includes(
                        form.kind || 'percentage',
                      ) &&
                        field('percent', 'Porcentaje autorizado', {
                          type: 'number',
                        })}
                      {form.kind === 'fixed_amount' &&
                        field('amount', 'Descuento fijo (pesos)')}
                      {['two_for_one', 'second_unit_percentage'].includes(
                        form.kind,
                      ) &&
                        field('groupBy', 'Agrupar unidades por', {
                          choices: [
                            ['line', 'Misma variante'],
                            ['cart', 'Todo el carrito elegible'],
                          ],
                          value: 'line',
                        })}
                      {field('category', 'Categoría (opcional)', {
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
                        ].map((value) => [value, value]),
                        optional: true,
                      })}
                      {field('brand', 'Marca (opcional)', { optional: true })}
                      {field('methodId', 'Medio de pago (vacío: todos)', {
                        choices: paymentChoices,
                        optional: true,
                      })}
                      {field('couponCode', 'Código de cupón (opcional)', {
                        optional: true,
                      })}
                      {field('customerLevel', 'Nivel del Club (opcional)', {
                        choices: ['FRAGUAN', 'Silver', 'Gold', 'Black'].map(
                          (value) => [value, value],
                        ),
                        optional: true,
                      })}
                      {field('birthday', 'Beneficio de cumpleaños', {
                        choices: [
                          ['no', 'No'],
                          ['yes', 'Sí'],
                        ],
                        value: 'no',
                      })}
                      {form.birthday === 'yes' &&
                        field('birthdayDays', 'Días antes y después', {
                          type: 'number',
                          optional: true,
                        })}
                      {field(
                        'daysOfWeek',
                        'Días de semana (0 domingo a 6 sábado, separados por coma)',
                        { optional: true },
                      )}
                      {field('dailyStart', 'Horario desde (opcional)', {
                        type: 'time',
                        optional: true,
                      })}
                      {field('dailyEnd', 'Horario hasta (opcional)', {
                        type: 'time',
                        optional: true,
                      })}
                      {field('startsAt', 'Desde', { type: 'date' })}
                      {field('endsAt', 'Hasta', { type: 'date' })}
                      {field('priority', 'Prioridad', {
                        type: 'number',
                        optional: true,
                      })}
                      {field('exclusive', 'Regla exclusiva', {
                        choices: [
                          ['no', 'Combinable'],
                          ['yes', 'Exclusiva'],
                        ],
                        value: 'no',
                      })}
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
                    : modal === 'purchase-receipt'
                      ? 'Registrar recepción'
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
