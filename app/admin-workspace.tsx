'use client';
import { useCallback, useEffect, useState } from 'react';
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
  Tag,
  ClipboardList,
  Sparkles,
  LogOut,
  Check,
  Printer,
  TrendingUp,
  Globe2,
  PackageCheck,
  BarChart3,
  type LucideIcon,
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
import { buildProductCsvTemplate, parseProductCsv } from '@/lib/product-csv';
import { GlobalSearch } from '@/components/global-search';
import { ThemeToggle } from '@/components/theme-toggle';
import { ExportActions } from '@/components/export-actions';
import { InventoryLines } from '@/components/inventory-lines';
import { Barcode } from '@/components/barcode';
import { printCommerce } from '@/lib/printing';
import { LoadingState } from '@/components/loading-state';
const exportLabels: Record<string, string> = {
  products: 'Productos',
  categories: 'Categorías',
  brands: 'Marcas',
  suppliers: 'Proveedores',
  sellers: 'Vendedores',
  paymentMethods: 'Medios de pago',
  promotions: 'Resultados de promociones',
  grantedDiscountMinor: 'Descuento original otorgado (ARS)',
  name: 'Nombre',
  units: 'Unidades',
  tickets: 'Tickets',
  revenueMinor: 'Ventas netas (ARS)',
  costMinor: 'Costo (ARS)',
  commissionMinor: 'Comisiones (ARS)',
  grossProfitMinor: 'Ganancia comercial (ARS)',
  marginBps: 'Margen (%)',
  sku: 'SKU',
  color: 'Color',
  size: 'Talle',
};
type NavigationItem = readonly [string, string, LucideIcon];
type NavigationGroup = {
  label: string;
  items: readonly NavigationItem[];
  primaryCount: number;
};
const navigationGroups: readonly NavigationGroup[] = [
  {
    label: 'Inicio',
    primaryCount: 1,
    items: [['dashboard', 'Vista general', LayoutDashboard]],
  },
  {
    label: 'Tienda online',
    primaryCount: 3,
    items: [
      ['online-orders', 'Pedidos online', PackageCheck],
      ['online-catalog', 'Catálogo online', Globe2],
      ['marketing', 'Crecimiento online', BarChart3],
    ],
  },
  {
    label: 'Ventas y clientes',
    primaryCount: 3,
    items: [
      ['sales', 'Ventas y devoluciones', ShoppingBag],
      ['customers', 'Clientes y Club', Users],
      ['promotions', 'Promociones', Tag],
      ['customer-intelligence', 'Segmentos y fidelización', Sparkles],
      ['club-rewards', 'Canjes del Club', Tag],
      ['communications', 'Comunicaciones', Users],
      ['newsletter', 'Email y newsletter', Sparkles],
    ],
  },
  {
    label: 'Productos y compras',
    primaryCount: 4,
    items: [
      ['products', 'Productos y stock', Package],
      ['storage', 'Ubicaciones y depósito', Boxes],
      ['purchases', 'Compras', ClipboardList],
      ['suppliers', 'Proveedores', Truck],
      ['stock-movements', 'Movimientos de stock', ArrowUpRight],
      ['replenishment', 'Reposición sugerida', RefreshCw],
      ['inventory', 'Inventario físico', Boxes],
    ],
  },
  {
    label: 'Dinero y compromisos',
    primaryCount: 4,
    items: [
      ['cash', 'Caja', Wallet],
      ['banking', 'Bancos y cheques', Wallet],
      ['expenses', 'Gastos', Receipt],
      ['payables', 'Cuentas a pagar', CalendarClock],
      ['financial-calendar', 'Calendario financiero', CalendarClock],
      ['cash-flow', 'Flujo de fondos', TrendingUp],
      ['withdrawals', 'Retiros de socios', ArrowUpRight],
    ],
  },
  {
    label: 'Análisis',
    primaryCount: 3,
    items: [
      ['reports', 'Reportes', LayoutDashboard],
      ['insights', 'FRAGUAN Insights', Sparkles],
      ['seller-commissions', 'Comisiones del equipo', TrendingUp],
    ],
  },
  {
    label: 'Sistema',
    primaryCount: 2,
    items: [
      ['users', 'Equipo', Users],
      ['settings', 'Configuración', SlidersHorizontal],
      ['access', 'Permisos por usuario', ShieldCheck],
      ['audit', 'Auditoría', ShieldCheck],
    ],
  },
];
const navigation = navigationGroups.flatMap((group) => group.items);
const columns: Record<string, [string, string, string?][]> = {
  'online-orders': [
    ['orderNumber', 'Pedido'],
    ['createdAt', 'Fecha', 'date'],
    ['customerName', 'Cliente'],
    ['paymentStatus', 'Pago'],
    ['fulfillmentStatus', 'Preparación'],
    ['paymentMethod', 'Medio'],
    ['transferReference', 'Referencia'],
    ['total', 'Total', 'money'],
  ],
  'online-catalog': [
    ['name', 'Producto'],
    ['section', 'Sección'],
    ['localPrice', 'Precio local', 'money'],
    ['onlinePrice', 'Precio online', 'money'],
    ['stock', 'Stock'],
    ['variants', 'Variantes'],
    ['featured', 'Destacado'],
    ['published', 'Publicado'],
    ['slug', 'Enlace'],
  ],
  products: [
    ['name', 'Producto'],
    ['internalCode', 'Código'],
    ['sku', 'SKU'],
    ['color', 'Color'],
    ['size', 'Talle'],
    ['price', 'Precio', 'money'],
    ['effectiveOnlinePrice', 'Precio online', 'money'],
    ['cost', 'Costo', 'money'],
    ['marginPercent', 'Margen bruto %'],
    ['markupPercent', 'Markup %'],
    ['stock', 'Stock'],
    ['minimum', 'Mínimo'],
    ['ideal', 'Ideal'],
    ['location', 'Ubicación'],
    ['active', 'Activo'],
  ],
  stock: [
    ['name', 'Producto'],
    ['color', 'Color'],
    ['size', 'Talle'],
    ['stock', 'Disponible'],
    ['minimum', 'Mínimo'],
    ['sku', 'SKU'],
  ],
  storage: [
    ['name', 'Producto'],
    ['sku', 'SKU'],
    ['color', 'Color'],
    ['size', 'Talle'],
    ['location', 'Ubicación'],
    ['detail', 'Detalle'],
    ['quantity', 'Unidades'],
    ['totalStock', 'Stock total'],
  ],
  'stock-movements': [
    ['createdAt', 'Fecha', 'date'],
    ['name', 'Producto'],
    ['sku', 'SKU'],
    ['color', 'Color'],
    ['size', 'Talle'],
    ['quantity', 'Movimiento'],
    ['before', 'Anterior'],
    ['after', 'Posterior'],
    ['reason', 'Motivo'],
    ['notes', 'Observaciones'],
    ['location', 'Ubicación indicada'],
    ['actor', 'Usuario'],
    ['reference', 'Referencia'],
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
    ['email', 'Email'],
    ['purchases', 'Compras'],
    ['spent', 'Total comprado', 'money'],
    ['points', 'Puntos'],
    ['active', 'Activo'],
  ],
  suppliers: [
    ['name', 'Proveedor'],
    ['contact', 'Contacto'],
    ['phone', 'Teléfono'],
    ['email', 'Email'],
    ['terms', 'Condiciones'],
    ['purchased', 'Comprado', 'money'],
    ['active', 'Activo'],
  ],
  purchases: [
    ['supplier', 'Proveedor'],
    ['createdAt', 'Fecha', 'date'],
    ['dueAt', 'Vencimiento', 'date'],
    ['completionStatus', 'Estado de la compra'],
    ['paymentStatus', 'Pago'],
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
  dashboard: 'Resumen del negocio y accesos a las tareas más frecuentes.',
  'online-orders':
    'Pagos, referencias, preparación, envíos y seguimiento en una sola cola.',
  'online-catalog':
    'Elegí qué productos se publican y completá su información de venta online.',
  marketing: 'Medí el embudo y gestioná recuperación, reposiciones, reseñas y campañas desde los mismos datos de la tienda.',
  products:
    'Productos, variantes, precios y existencias reunidos en un solo lugar.',
  stock: 'Consultá y ajustá las unidades de cada variante.',
  storage:
    'Encontrá cada prenda y mové unidades entre salón, depósito, estantes y cajas.',
  replenishment: 'Detectá faltantes y prepará compras según la rotación real.',
  sales: 'Consultá ventas, tickets y devoluciones autorizadas.',
  customers: 'Datos, compras, puntos y beneficios de cada cliente.',
  'customer-intelligence':
    'Segmentos, niveles e historial para construir relaciones duraderas.',
  newsletter: 'Suscriptores, campañas y notificaciones de pedidos por email.',
  suppliers: 'Datos de contacto, condiciones e historial de proveedores.',
  purchases: 'Creá órdenes y registrá recepciones parciales o completas.',
  cash: 'Apertura, movimientos y cierre en un solo lugar.',
  'cash-flow': 'Proyectá cobros y compromisos registrados antes de decidir.',
  'financial-calendar': 'Ordená vencimientos por fecha y nivel de urgencia.',
  expenses: 'Registrá y consultá los gastos del negocio.',
  payables: 'Anticipate a tus próximos compromisos.',
  withdrawals: 'Retiros separados de los gastos operativos.',
  promotions: 'Definí los descuentos y beneficios que puede aplicar el POS.',
  inventory: 'Contá, compará y aprobá los ajustes.',
  reports: 'Ventas, costos, márgenes y resultados para analizar el negocio.',
  insights: 'Alertas y oportunidades detectadas en la operación.',
  users: 'Cada persona, con el acceso que necesita.',
  audit: 'El historial de las acciones importantes.',
  settings: 'Medios de pago, cuotas y reglas generales del sistema.',
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
  reported: 'Transferencia informada',
  awaiting_payment: 'Esperando pago',
  preparing: 'Preparando',
  shipped: 'Despachado',
  unfulfilled: 'Pendiente',
  transfer: 'Transferencia',
  card: 'Tarjeta',
  withdrawal: 'Arrepentimiento',
  exchange: 'Cambio',
  return: 'Devolución',
  not_registered: 'Sin obligación registrada',
  approved: 'Aprobado',
  cash: 'Efectivo',
  debit: 'Débito',
  credit: 'Crédito',
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
    [page, setPage] = useState(0),
    [aux, setAux] = useState<Row>({ variants: [], suppliers: [] }),
    [form, setForm] = useState<Row>({}),
    [success, setSuccess] = useState(''),
    [authorization, setAuthorization] = useState<Row | null>(null),
    [reportFrom, setReportFrom] = useState(
      () =>
        `${new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }).format(new Date()).slice(0, 7)}-01`,
    ),
    [reportTo, setReportTo] = useState(() =>
      new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Argentina/Buenos_Aires',
      }).format(new Date()),
    ),
    [financialPlans, setFinancialPlans] = useState<Row>({
      recurring: [],
      obligations: [],
    });
  const title = navigation.find((n) => n[0] === section)?.[1] ?? 'FRAGUAN';
  const load = useCallback(async () => {
    if (section === 'financial-calendar') {
      const [calendar, plans] = await Promise.all([
        api('financial-calendar'),
        api('financial-plans'),
      ]);
      setData(calendar);
      setFinancialPlans(plans);
      return;
    }
    setData(
      await api(
        section === 'reports'
          ? `reports?from=${reportFrom}&to=${reportTo}`
          : ['products', 'suppliers'].includes(section)
            ? `${section}?includeArchived=1`
            : section,
      ),
    );
  }, [section, reportFrom, reportTo]);
  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, [load]);
  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    setSearch(query.get('q') ?? '');
    if (query.get('customer')) void customerProfile(query.get('customer')!);
    if (query.get('sale')) void details({ id: query.get('sale') });
    if (query.get('purchase')) void purchaseDetails(query.get('purchase')!);
  }, [section]);
  async function openForm(type = 'create', row: Row | null = null) {
    setForm(
      row && type.startsWith('edit-')
        ? {
            ...row,
            ...(type === 'edit-variant'
              ? {
                  price: Number(row.price ?? 0) / 100,
                  onlinePrice:
                    row.onlinePrice == null
                      ? ''
                      : Number(row.onlinePrice) / 100,
                  cost: Number(row.cost ?? 0) / 100,
                }
              : {}),
            ...(type === 'edit-online-product'
              ? {
                  onlinePrice: Number(row.onlinePrice ?? 0) / 100,
                  useLocalPrice: Number(row.inheritedVariants ?? 0) > 0,
                }
              : {}),
            ...(type === 'edit-supplier'
              ? { discountPercent: Number(row.discountBps ?? 0) / 100 }
              : {}),
          }
        : type === 'labels'
          ? { labelCount: 1 }
          : type === 'storage-transfer' && row
            ? {
                variantId: row.id,
                fromLocationId: row.locationId,
                toLocationId: row.toLocationId || '',
                quantity: row.suggested || 1,
              }
            : {},
    );
    setSelected(row);
    setError('');
    setModal(type);
    try {
      const next: Row = { variants: [], suppliers: [], locations: [] };
      if (['purchases', 'inventory', 'stock'].includes(section))
        next.variants = await api('products');
      if (
        ['products', 'purchases', 'payables', 'financial-calendar'].includes(
          section,
        )
      )
        next.suppliers = await api('suppliers');
      if (type === 'stock-adjust')
        next.locations = (await api('storage')).locations;
      setAux(next);
    } catch (e: any) {
      setError(e.message);
    }
  }
  function openLoyaltyConfig() {
    const config = data?.config;
    const threshold = (level: 'Silver' | 'Gold' | 'Black') =>
      config?.loyalty?.thresholds?.[level] ?? {
        minSpendMinor: 0,
        minPurchases: 0,
        minPoints: 0,
      };
    const silver = threshold('Silver');
    const gold = threshold('Gold');
    const black = threshold('Black');
    setForm({
      loyaltyWindowDays: config?.loyalty?.evaluationWindowDays ?? 365,
      silverSpend: Number(silver.minSpendMinor ?? 0) / 100,
      silverPurchases: silver.minPurchases ?? 0,
      silverPoints: silver.minPoints ?? 0,
      goldSpend: Number(gold.minSpendMinor ?? 0) / 100,
      goldPurchases: gold.minPurchases ?? 0,
      goldPoints: gold.minPoints ?? 0,
      blackSpend: Number(black.minSpendMinor ?? 0) / 100,
      blackPurchases: black.minPurchases ?? 0,
      blackPoints: black.minPoints ?? 0,
      cashbackExpiryDays: config?.loyalty?.cashbackExpiryDays ?? 365,
      fraguanCashback: Number(config?.loyalty?.cashbackBps?.FRAGUAN ?? 0) / 100,
      silverCashback: Number(config?.loyalty?.cashbackBps?.Silver ?? 0) / 100,
      goldCashback: Number(config?.loyalty?.cashbackBps?.Gold ?? 0) / 100,
      blackCashback: Number(config?.loyalty?.cashbackBps?.Black ?? 0) / 100,
      fraguanBenefits: (config?.loyalty?.benefits?.FRAGUAN ?? []).join(', '),
      silverBenefits: (config?.loyalty?.benefits?.Silver ?? []).join(', '),
      goldBenefits: (config?.loyalty?.benefits?.Gold ?? []).join(', '),
      blackBenefits: (config?.loyalty?.benefits?.Black ?? []).join(', '),
    });
    setSelected(null);
    setError('');
    setModal('loyalty-config');
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
  async function onlineOrderDetails(orderId: string) {
    try {
      setSelected(await api('online-orders?id=' + encodeURIComponent(orderId)));
      setForm({});
      setModal('online-order');
    } catch (e: any) {
      setError(e.message);
    }
  }
  async function customerProfile(customerId: string) {
    setError('');
    try {
      const encodedId = encodeURIComponent(customerId);
      const [profile, balances, cashback] = await Promise.all([
        api('customer-intelligence?id=' + encodedId),
        api('customer-credit-balance?customerId=' + encodedId),
        api('customer-cashback?customerId=' + encodedId),
      ]);
      setSelected({ ...profile, balances, cashback });
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
      : section === 'storage'
        ? (data?.inventory ?? [])
        : [];
  const filtered = list.filter((r) =>
    Object.values(r).join(' ').toLowerCase().includes(search.toLowerCase()),
  );
  const pageSize = 50;
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pageCount - 1);
  useEffect(() => {
    setPage(0);
  }, [search, section]);
  function reportComparison(key: string) {
    const value = data?.comparison?.[key];
    if (!value) return 'Sin período comparable';
    if (value.changeBps == null) return 'Sin base en el período anterior';
    const sign = value.changeBps > 0 ? '+' : '';
    return `${sign}${(value.changeBps / 100).toFixed(1)}% vs. período anterior`;
  }
  async function downloadProductTemplate() {
    try {
      const template = await api('product-import-template');
      const url = URL.createObjectURL(
        new Blob(
          [buildProductCsvTemplate(template.columns, template.example)],
          { type: 'text/csv;charset=utf-8' },
        ),
      );
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'fraguan-plantilla-productos.csv';
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      setError(e.message);
    }
  }
  async function previewProductImport() {
    if (!form.importRows?.length) {
      setError('Seleccioná un archivo CSV antes de validarlo.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const preview = await api('product-import', {
        rows: form.importRows,
        mode: form.mode || 'create_only',
        stockMode: form.stockMode || 'ignore',
        dryRun: true,
      });
      setForm({ ...form, importPreview: preview });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
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
            step={options?.type === 'number' ? 'any' : undefined}
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
  const locationChoices: [string, string][] = (
    section === 'storage' ? (data?.locations ?? []) : (aux.locations ?? [])
  )
    .filter((location: Row) => location.active)
    .map((location: Row) => [
      location.id,
      `${location.name}${location.detail ? ` · ${location.detail}` : ''}`,
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
  async function submit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    try {
      if (modal === 'loyalty-config') {
        await mutate('customer-intelligence-config', {
          loyalty: {
            evaluationWindowDays: Number(form.loyaltyWindowDays),
            thresholds: {
              Silver: {
                minSpendMinor: minor(String(form.silverSpend)),
                minPurchases: Number(form.silverPurchases),
                minPoints: Number(form.silverPoints),
              },
              Gold: {
                minSpendMinor: minor(String(form.goldSpend)),
                minPurchases: Number(form.goldPurchases),
                minPoints: Number(form.goldPoints),
              },
              Black: {
                minSpendMinor: minor(String(form.blackSpend)),
                minPurchases: Number(form.blackPurchases),
                minPoints: Number(form.blackPoints),
              },
            },
            cashbackBps: {
              FRAGUAN: Math.round(Number(form.fraguanCashback) * 100),
              Silver: Math.round(Number(form.silverCashback) * 100),
              Gold: Math.round(Number(form.goldCashback) * 100),
              Black: Math.round(Number(form.blackCashback) * 100),
            },
            cashbackExpiryDays: Number(form.cashbackExpiryDays),
            benefits: {
              FRAGUAN: String(form.fraguanBenefits || '')
                .split(',')
                .map((value) => value.trim())
                .filter(Boolean),
              Silver: String(form.silverBenefits || '')
                .split(',')
                .map((value) => value.trim())
                .filter(Boolean),
              Gold: String(form.goldBenefits || '')
                .split(',')
                .map((value) => value.trim())
                .filter(Boolean),
              Black: String(form.blackBenefits || '')
                .split(',')
                .map((value) => value.trim())
                .filter(Boolean),
            },
          },
        });
        return;
      }
      if (modal === 'product-import') {
        if (!form.importPreview)
          throw new Error('Validá el archivo antes de importarlo.');
        await mutate('product-import', {
          rows: form.importRows,
          mode: form.mode || 'create_only',
          stockMode: form.stockMode || 'ignore',
          dryRun: false,
        });
        return;
      }
      if (modal === 'edit-product') {
        await mutate('update-product', {
          id: selected?.productId,
          name: form.name,
          internalCode: form.internalCode || '',
          category: form.category,
          subcategory: form.subcategory || '',
          brand: form.brand || 'FRAGUAN',
          season: form.season || '',
          collection: form.collection || '',
          location: form.location || '',
          supplierId: form.supplierId || null,
        });
        return;
      }
      if (modal === 'edit-variant') {
        await mutate('update-variant', {
          id: selected?.id,
          sku: form.sku,
          barcode: form.barcode,
          color: form.color,
          size: form.size,
          price: minor(form.price),
          onlinePrice:
            form.onlinePrice === '' || form.onlinePrice == null
              ? null
              : minor(form.onlinePrice),
          cost: minor(form.cost),
          minimum: Number(form.minimum || 0),
          ideal: Number(form.ideal || 0),
          entryAt: form.entryAt || '',
        });
        return;
      }
      if (modal === 'edit-customer') {
        await mutate('update-customer', {
          id: selected?.id,
          name: form.name,
          surname: form.surname,
          phone: form.phone,
          email: form.email || '',
          birthday: form.birthday || null,
          locality: form.locality || '',
          usualSizes: form.usualSizes || '',
          notes: form.notes || '',
        });
        return;
      }
      if (modal === 'edit-supplier') {
        await mutate('update-supplier', {
          id: selected?.id,
          name: form.name,
          company: form.company || '',
          contact: form.contact || '',
          phone: form.phone || '',
          email: form.email || '',
          brands: form.brands || '',
          terms: form.terms || '',
          discountBps: Math.round(Number(form.discountPercent || 0) * 100),
          paymentDays: Number(form.paymentDays || 0),
          notes: form.notes || '',
        });
        return;
      }
      if (modal === 'master-active') {
        await mutate('set-master-active', {
          entity: selected?.entity,
          id: selected?.targetId,
          active: !selected?.active,
        });
        return;
      }
      if (modal === 'recurring-expense') {
        const today = new Intl.DateTimeFormat('en-CA', {
          timeZone: 'America/Argentina/Buenos_Aires',
        }).format(new Date());
        await mutate('recurring-expenses', {
          description: form.description,
          category: form.category || 'Servicios',
          amount: minor(form.amount),
          frequency: form.frequency || 'monthly',
          interval: Number(form.interval || 1),
          startsOn: form.startsOn || today,
          endsOn: form.endsOn || null,
          supplierId: form.supplierId || null,
          methodId: form.methodId || null,
        });
        return;
      }
      if (modal === 'installment-obligation') {
        const today = new Intl.DateTimeFormat('en-CA', {
          timeZone: 'America/Argentina/Buenos_Aires',
        }).format(new Date());
        await mutate('installment-obligations', {
          description: form.description,
          supplierId: form.supplierId || null,
          total: minor(form.total),
          installmentCount: Number(form.installmentCount || 3),
          firstDueOn: form.firstDueOn || today,
          intervalMonths: Number(form.intervalMonths || 1),
          kind: form.kind || 'Cuota',
        });
        return;
      }
      if (modal === 'method') {
        await mutate(selected?.id ? 'configure-method' : 'create-method', {
          ...(selected?.id ? { id: selected.id } : {}),
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
          ideal: Number(form.ideal || 6),
          entryAt: form.entryAt || '',
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
      if (modal === 'stock-adjust') {
        await mutate('stock', {
          variantId: selected?.id,
          quantity: Number(form.quantity),
          reason: form.reason,
          notes: form.notes || '',
          locationId: form.locationId || null,
        });
        return;
      }
      if (modal === 'storage-location') {
        await mutate('storage', {
          action: 'location',
          name: form.name,
          code: form.code,
          kind: form.kind,
          detail: form.detail || '',
        });
        return;
      }
      if (modal === 'storage-transfer') {
        await mutate('storage', {
          action: 'transfer',
          variantId: form.variantId,
          fromLocationId: form.fromLocationId,
          toLocationId: form.toLocationId,
          quantity: Number(form.quantity),
          notes: form.notes || '',
        });
        return;
      }
      if (modal === 'newsletter-campaign') {
        await mutate('newsletter', {
          subject: form.subject,
          preheader: form.preheader || '',
          content: form.content,
          ctaLabel: form.ctaLabel || '',
          ctaUrl: form.ctaUrl || '',
        });
        return;
      }
      if (modal === 'edit-online-product') {
        await mutate('online-catalog', {
          productId: selected?.id,
          slug: form.slug,
          shortDescription: form.shortDescription,
          description: form.description,
          material: form.material || '',
          care: form.care || '',
          fit: form.fit,
          section: form.section,
          featured: Boolean(form.featured),
          published: Boolean(form.published),
          sortOrder: Number(form.sortOrder || 0),
          onlinePrice: form.useLocalPrice ? null : minor(form.onlinePrice),
        });
        return;
      }
      let payload: Row = {};
      if (section === 'products')
        payload = {
          name: form.name,
          internalCode: form.internalCode || '',
          category: form.category,
          subcategory: form.subcategory || '',
          brand: form.brand || 'FRAGUAN',
          season: form.season || '',
          collection: form.collection || '',
          location: form.location || '',
          supplierId: form.supplierId || null,
          color: form.color,
          size: form.size,
          sku: form.sku,
          barcode: form.barcode,
          price: minor(form.price),
          cost: minor(form.cost),
          stock: Number(form.stock),
          minimum: Number(form.minimum ?? 3),
          ideal: Number(form.ideal ?? 6),
          entryAt: form.entryAt || '',
        };
      if (section === 'stock')
        payload = {
          variantId: form.variantId || selected?.id,
          quantity: Number(form.quantity),
          reason: form.reason,
          notes: form.notes || '',
        };
      if (section === 'customers')
        payload = { name: form.name, surname: form.surname, phone: form.phone };
      if (section === 'suppliers')
        payload = {
          name: form.name,
          company: form.company || '',
          contact: form.contact || '',
          phone: form.phone || '',
          email: form.email || '',
          brands: form.brands || '',
          terms: form.terms || '',
          discountBps: Math.round(Number(form.discountPercent || 0) * 100),
          paymentDays: Number(form.paymentDays || 0),
          notes: form.notes || '',
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
          expectedAt: form.expectedAt || null,
          carrier: form.carrier || '',
          trackingReference: form.trackingReference || '',
          deliveryAddress: form.deliveryAddress || '',
          paymentTerms: form.paymentTerms || '',
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
          items: (form.countLines ?? [{ variantId: '', counted: '' }]).map(
            (line: Row) => ({
              variantId: line.variantId,
              counted: Number(line.counted),
            }),
          ),
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
  function currentModalTitle() {
    const titles: Record<string, string> = {
      'product-import': 'Importar productos y variantes',
      'edit-product': 'Editar producto',
      'edit-variant': 'Editar variante',
      'edit-customer': 'Editar cliente',
      'edit-supplier': 'Editar proveedor',
      labels: 'Imprimir etiquetas',
      'loyalty-config': 'Configurar Club FRAGUAN',
      'master-active': selected?.active
        ? 'Archivar registro'
        : 'Reactivar registro',
      'recurring-expense': 'Nuevo gasto recurrente',
      'installment-obligation': 'Nueva obligación en cuotas',
      sale: 'Detalle de venta',
      refund: 'Cambio o devolución',
      'customer-profile': 'Perfil del cliente',
      'purchase-detail': 'Orden de compra',
      'purchase-receipt': 'Recibir mercadería',
      'stock-adjust': 'Ajustar stock',
      'storage-location': 'Nueva ubicación',
      'storage-transfer': 'Mover mercadería',
      'edit-online-product': 'Publicación online',
      'online-order': `Pedido #${selected?.orderNumber ?? ''}`,
      'newsletter-campaign': 'Nueva campaña de email',
    };
    return modal === 'create'
      ? `Agregar · ${title}`
      : (titles[modal] ?? 'Confirmar operación');
  }
  function currentModalDescription() {
    const descriptions: Record<string, string> = {
      'product-import':
        'Validá el archivo antes de aplicarlo. El stock siempre se ajusta mediante movimientos trazables.',
      'edit-product':
        'Actualizá la ficha general compartida por todas sus variantes.',
      'edit-variant':
        'Actualizá identificación, precio, costo y objetivos. El stock se modifica desde su módulo específico.',
      'edit-customer':
        'Completá los datos útiles para atención, fidelización y seguimiento.',
      'edit-supplier':
        'Mantené el contacto y las condiciones comerciales del proveedor.',
      labels:
        'Generá etiquetas de texto con precio, talle, color, SKU y código de barras.',
      'loyalty-config':
        'Los cambios se aplican a la clasificación de clientes y a las promociones por nivel.',
      'master-active':
        'El archivo es reversible y conserva ventas, movimientos e historial.',
      'recurring-expense':
        'Definí la frecuencia una sola vez. El sistema generará cuentas a pagar identificables y evitará duplicados.',
      'installment-obligation':
        'El importe se dividirá exactamente entre las cuotas y cada vencimiento quedará registrado por separado.',
      refund:
        'Esta operación reintegra el stock, revierte el cobro registrado y descuenta los puntos. Ejecutá el reintegro en el medio de pago correspondiente.',
      'customer-profile':
        'Segmentación, nivel e historial calculados con la actividad registrada.',
      'purchase-detail': 'Líneas, costos, estado y recepciones de la orden.',
      'purchase-receipt':
        'Registrá únicamente las unidades que llegaron. El resto quedará pendiente.',
      'stock-adjust':
        'El ajuste crea un movimiento trazable y conserva la cantidad anterior y posterior.',
      'storage-location':
        'Creá un sector, estante, módulo, perchero o caja para ubicar mercadería.',
      'storage-transfer':
        'Mové unidades sin alterar el stock total. La transferencia quedará registrada.',
      'edit-online-product':
        'La tienda usa el mismo precio, variantes y stock del sistema.',
      'online-order':
        'Pago, prendas, preparación y envío reunidos en un solo lugar.',
    };
    return (
      descriptions[modal] ?? 'Los cambios quedarán registrados con tu usuario.'
    );
  }
  return (
    <div className="admin-shell">
      <aside className="sidebar">
        <a className="wordmark" href="/admin/dashboard">
          FRAGUAN<span>ADMINISTRACIÓN</span>
        </a>
        <a className="new-sale-link" href="/pos">
          <Plus size={16} /> Nueva venta <ArrowUpRight size={15} />
        </a>
        <nav aria-label="Áreas de administración">
          {navigationGroups.map((group) => {
            const items = group.items.filter(([key]) =>
              session?.permissions?.includes(key),
            );
            if (!items.length) return null;
            const primary = items.slice(0, group.primaryCount);
            const secondary = items.slice(group.primaryCount);
            return (
              <div className="nav-group" key={group.label}>
                <p>{group.label}</p>
                {primary.map(([key, label, Icon]) => (
                  <a
                    key={key}
                    href={'/admin/' + key}
                    className={section === key ? 'active' : ''}
                  >
                    <Icon size={17} />
                    {label}
                  </a>
                ))}
                {!!secondary.length && (
                  <details
                    className="nav-more"
                    open={secondary.some(([key]) => key === section)}
                  >
                    <summary>Más herramientas</summary>
                    {secondary.map(([key, label, Icon]) => (
                      <a
                        key={key}
                        href={'/admin/' + key}
                        className={section === key ? 'active' : ''}
                      >
                        <Icon size={17} />
                        {label}
                      </a>
                    ))}
                  </details>
                )}
              </div>
            );
          })}
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
            <GlobalSearch />
            <ThemeToggle />
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
              <p className="eyebrow">ADMINISTRACIÓN</p>
              <h1>
                {title}
                <span>.</span>
              </h1>
              <p>{descriptions[section]}</p>
            </div>
            <div className="heading-actions">
              {columns[section] && Array.isArray(data) && (
                <ExportActions
                  name={section}
                  sheets={[
                    {
                      name: title,
                      columns: columns[section].map((c) => c[1]),
                      rows: filtered.map((row) =>
                        columns[section].map(([key, , kind]) =>
                          kind === 'money'
                            ? Number(row[key] ?? 0) / 100
                            : (row[key] ?? ''),
                        ),
                      ),
                    },
                  ]}
                />
              )}
              {section === 'reports' && data?.breakdowns && (
                <ExportActions
                  name={`reportes-${reportFrom}-${reportTo}`}
                  sheets={Object.entries(data.breakdowns).map(
                    ([name, records]) => ({
                      name: exportLabels[name] ?? name,
                      columns: Object.keys(
                        (records as Row[])[0] ?? { name: '' },
                      )
                        .filter((key) => key !== 'id')
                        .map((key) => exportLabels[key] ?? key),
                      rows: (records as Row[]).map((row) =>
                        Object.entries(row)
                          .filter(([key]) => key !== 'id')
                          .map(([key, value]) =>
                            key.endsWith('Minor') || key.endsWith('Bps')
                              ? Number(value ?? 0) / 100
                              : value,
                          ),
                      ),
                    }),
                  )}
                />
              )}
              <Button
                variant="outline"
                onClick={() => load().catch((e) => setError(e.message))}
                aria-label="Actualizar"
              >
                <RefreshCw size={15} />
              </Button>
              {section === 'products' && (
                <Button
                  variant="outline"
                  onClick={() => openForm('product-import')}
                >
                  <Download size={15} /> Importar CSV
                </Button>
              )}
              {section === 'storage' && (
                <Button onClick={() => openForm('storage-location')}>
                  <Plus size={16} /> Nueva ubicación
                </Button>
              )}
              {section === 'customer-intelligence' && (
                <Button variant="outline" onClick={openLoyaltyConfig}>
                  <SlidersHorizontal size={15} /> Configurar Club
                </Button>
              )}
              {section === 'newsletter' && (
                <Button onClick={() => openForm('newsletter-campaign')}>
                  <Plus size={16} /> Nueva campaña
                </Button>
              )}
              {section === 'marketing' && (
                <Button onClick={() => mutate('marketing', { action: 'run-automations' })} disabled={busy}>
                  <RefreshCw size={15} /> Ejecutar automatizaciones
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
                'stock-movements',
                'storage',
                'online-orders',
                'online-catalog',
                'newsletter',
                'marketing',
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
            <output className="success-notice">
              <Check size={15} />
              {success}
            </output>
          )}
          {!data && !error && <LoadingState />}
          {section === 'dashboard' && data && (
            <section className="task-launcher" aria-label="Accesos rápidos">
              <div className="task-launcher-heading">
                <div>
                  <h2>¿Qué necesitás hacer?</h2>
                  <p>Entrá directo a las tareas de uso diario.</p>
                </div>
              </div>
              <div className="task-launcher-grid">
                <a href="/pos">
                  <ShoppingBag size={20} />
                  <span>
                    <strong>Nueva venta</strong>
                    <small>Abrir el POS</small>
                  </span>
                  <ArrowUpRight size={16} />
                </a>
                {session?.permissions?.includes('online-orders') && (
                  <a href="/admin/online-orders">
                    <PackageCheck size={20} />
                    <span>
                      <strong>Pedidos online</strong>
                      <small>Pago, preparación y envío</small>
                    </span>
                    <ArrowUpRight size={16} />
                  </a>
                )}
                {session?.permissions?.includes('products') && (
                  <a href="/admin/products">
                    <Package size={20} />
                    <span>
                      <strong>Producto y stock</strong>
                      <small>Precio, variantes y existencias</small>
                    </span>
                    <ArrowUpRight size={16} />
                  </a>
                )}
                {session?.permissions?.includes('storage') && (
                  <a href="/admin/storage">
                    <Boxes size={20} />
                    <span>
                      <strong>Buscar en depósito</strong>
                      <small>Ubicar o mover una prenda</small>
                    </span>
                    <ArrowUpRight size={16} />
                  </a>
                )}
                {session?.permissions?.includes('customers') && (
                  <a href="/admin/customers">
                    <Users size={20} />
                    <span>
                      <strong>Clientes y Club</strong>
                      <small>Perfil, compras y puntos</small>
                    </span>
                    <ArrowUpRight size={16} />
                  </a>
                )}
                {session?.permissions?.includes('cash') && (
                  <a href="/admin/cash">
                    <Wallet size={20} />
                    <span>
                      <strong>Caja</strong>
                      <small>Abrir, mover o cerrar</small>
                    </span>
                    <ArrowUpRight size={16} />
                  </a>
                )}
                {session?.permissions?.includes('purchases') && (
                  <a href="/admin/purchases">
                    <ClipboardList size={20} />
                    <span>
                      <strong>Compras</strong>
                      <small>Ordenar y recibir mercadería</small>
                    </span>
                    <ArrowUpRight size={16} />
                  </a>
                )}
              </div>
            </section>
          )}
          {['dashboard', 'insights'].includes(section) && data && (
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
          {section === 'reports' && data && (
            <>
              <section className="panel report-filters">
                <div>
                  <p className="eyebrow">PERÍODO DEL REPORTE</p>
                  <strong>
                    {date(data.period?.from)} al {date(data.period?.to)}
                  </strong>
                  <small>
                    Comparado con {date(data.previousPeriod?.from)} al{' '}
                    {date(data.previousPeriod?.to)}
                  </small>
                </div>
                <label>
                  Desde
                  <Input
                    type="date"
                    value={reportFrom}
                    max={reportTo}
                    onChange={(event) => setReportFrom(event.target.value)}
                  />
                </label>
                <label>
                  Hasta
                  <Input
                    type="date"
                    value={reportTo}
                    min={reportFrom}
                    onChange={(event) => setReportTo(event.target.value)}
                  />
                </label>
                <Button
                  onClick={() => load().catch((e) => setError(e.message))}
                >
                  Aplicar período
                </Button>
              </section>
              <div className="metric-grid">
                <Metric
                  title="Venta neta"
                  value={money(data.current?.revenueMinor)}
                  detail={reportComparison('revenueMinor')}
                />
                <Metric
                  title="Ganancia comercial"
                  value={money(data.current?.grossProfitMinor)}
                  detail={reportComparison('grossProfitMinor')}
                />
                <Metric
                  title="Margen comercial"
                  value={`${((data.current?.marginBps ?? 0) / 100).toFixed(1)}%`}
                  detail={`Anterior: ${((data.previous?.marginBps ?? 0) / 100).toFixed(1)}%`}
                />
                <Metric
                  title="Ticket promedio"
                  value={money(data.current?.averageTicketMinor)}
                  detail={reportComparison('averageTicketMinor')}
                />
                <Metric
                  title="Tickets"
                  value={String(data.current?.tickets ?? 0)}
                  detail={reportComparison('tickets')}
                />
                <Metric
                  title="Unidades netas"
                  value={String(data.current?.units ?? 0)}
                  detail={reportComparison('units')}
                />
                <Metric
                  title="Clientes nuevos"
                  value={String(data.current?.newCustomers ?? 0)}
                  detail={reportComparison('newCustomers')}
                />
                <Metric
                  title="Clientes recurrentes"
                  value={String(data.current?.repeatCustomers ?? 0)}
                  detail={reportComparison('repeatCustomers')}
                />
              </div>
              <div className="dashboard-panels">
                <section className="panel chart-panel">
                  <div className="panel-heading">
                    <h2>Evolución del período</h2>
                    <span>Venta neta por día</span>
                  </div>
                  {data.trend?.length ? (
                    <ChartContainer
                      config={{
                        revenueMinor: {
                          label: 'Venta neta',
                          color: '#60764c',
                        },
                      }}
                      className="sales-chart"
                    >
                      <AreaChart data={data.trend}>
                        <defs>
                          <linearGradient
                            id="reportGradient"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop
                              offset="0%"
                              stopColor="#78935e"
                              stopOpacity={0.3}
                            />
                            <stop
                              offset="100%"
                              stopColor="#78935e"
                              stopOpacity={0}
                            />
                          </linearGradient>
                        </defs>
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
                          dataKey="revenueMinor"
                          stroke="#60764c"
                          strokeWidth={2}
                          fill="url(#reportGradient)"
                        />
                      </AreaChart>
                    </ChartContainer>
                  ) : (
                    <div className="chart-empty">
                      <ShoppingBag size={28} />
                      <h3>Sin ventas en este período</h3>
                      <p>Elegí otro rango o registrá nuevas operaciones.</p>
                    </div>
                  )}
                </section>
                <section className="panel">
                  <div className="panel-heading">
                    <h2>Categorías</h2>
                    <span>Venta neta asignada</span>
                  </div>
                  {data.breakdowns?.categories?.slice(0, 8).map((item: Row) => (
                    <div className="rank-row" key={item.name}>
                      <strong>{item.name}</strong>
                      <span>
                        {item.units} u. · {money(item.revenueMinor)}
                      </span>
                    </div>
                  ))}
                </section>
              </div>
              <div className="dashboard-panels">
                <section className="panel">
                  <div className="panel-heading">
                    <h2>Medios de pago</h2>
                    <span>Importe y comisión netos</span>
                  </div>
                  {data.breakdowns?.paymentMethods?.map((item: Row) => (
                    <div className="rank-row" key={item.id}>
                      <strong>{item.name}</strong>
                      <span>
                        {money(item.revenueMinor)} · comisión{' '}
                        {money(item.commissionMinor)}
                      </span>
                    </div>
                  ))}
                </section>
                <section className="panel">
                  <div className="panel-heading">
                    <h2>Vendedores</h2>
                    <span>Venta neta</span>
                  </div>
                  {data.breakdowns?.sellers?.map((item: Row) => (
                    <div className="rank-row" key={item.id}>
                      <strong>{item.name}</strong>
                      <span>
                        {item.tickets} tickets · {money(item.revenueMinor)}
                      </span>
                    </div>
                  ))}
                </section>
              </div>
              <section className="panel table-panel">
                <div className="panel-heading">
                  <h2>Rentabilidad por producto</h2>
                  <span>Hasta 100 productos</span>
                </div>
                <div className="data-table">
                  <table>
                    <thead>
                      <tr>
                        <th>Producto</th>
                        <th>Unidades</th>
                        <th>Venta neta</th>
                        <th>Costo</th>
                        <th>Comisión</th>
                        <th>Resultado comercial</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.breakdowns?.products?.map((item: Row) => (
                        <tr key={item.id}>
                          <td>{item.name}</td>
                          <td>{item.units}</td>
                          <td>{money(item.revenueMinor)}</td>
                          <td>{money(item.costMinor)}</td>
                          <td>{money(item.commissionMinor)}</td>
                          <td>
                            {money(
                              item.revenueMinor -
                                item.costMinor -
                                item.commissionMinor,
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
              <section className="panel">
                <div className="panel-heading">
                  <h2>Resultados de promociones</h2>
                </div>
                <p className="quiet">
                  Ventas con saldo neto en el período. Si un ticket usó varias
                  promociones aparece en cada una: estas filas no se suman. El
                  descuento es el otorgado originalmente; las ventas y el
                  resultado descuentan devoluciones.
                </p>
                <div className="data-table">
                  <table>
                    <thead>
                      <tr>
                        <th>Promoción</th>
                        <th>Tickets</th>
                        <th>Descuento original</th>
                        <th>Venta neta asociada</th>
                        <th>Resultado comercial</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.breakdowns?.promotions?.map((item: Row) => (
                        <tr key={`${item.id}-${item.name}`}>
                          <td>{item.name}</td>
                          <td>{item.tickets}</td>
                          <td>{money(item.grantedDiscountMinor)}</td>
                          <td>{money(item.revenueMinor)}</td>
                          <td>{money(item.grossProfitMinor)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!data.breakdowns?.promotions?.length && (
                    <p className="empty-state">
                      Sin ventas con promociones en este período.
                    </p>
                  )}
                </div>
              </section>
              {!!data.productsWithoutSales?.length && (
                <section className="panel">
                  <div className="panel-heading">
                    <h2>Productos sin ventas</h2>
                    <span>
                      {data.productsWithoutSales.length} en el período
                    </span>
                  </div>
                  <div className="stagnant-products">
                    {data.productsWithoutSales.slice(0, 20).map((item: Row) => (
                      <span key={item.id}>
                        {item.name} · {item.category}
                        {item.lastSaleAt
                          ? ` · última ${date(item.lastSaleAt)}`
                          : ' · sin venta histórica'}
                      </span>
                    ))}
                  </div>
                </section>
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
                  value={money(
                    (data.currentRecordedCash?.amountMinor ?? 0) +
                      (data.currentRecordedBank?.amountMinor ?? 0),
                  )}
                  detail={
                    data.currentRecordedCash?.status === 'open'
                      ? `Caja abierta + ${data.currentRecordedBank?.accounts ?? 0} cuentas bancarias registradas`
                      : `Sin caja abierta · ${data.currentRecordedBank?.accounts ?? 0} cuentas bancarias registradas`
                  }
                />
                {[7, 30, 60, 90].map((days) => (
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
              <div className="cash-actions financial-actions">
                <Button onClick={() => openForm('recurring-expense')}>
                  <Plus size={15} /> Gasto recurrente
                </Button>
                <Button
                  variant="outline"
                  onClick={() => openForm('installment-obligation')}
                >
                  <Plus size={15} /> Obligación en cuotas
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    const through = new Date();
                    through.setDate(through.getDate() + 365);
                    void mutate('materialize-financial', {
                      throughOn: through.toISOString().slice(0, 10),
                    });
                  }}
                >
                  <RefreshCw size={15} /> Generar próximos vencimientos
                </Button>
              </div>
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
              <div className="dashboard-panels">
                <section className="panel">
                  <div className="panel-heading">
                    <h2>Gastos recurrentes</h2>
                    <span>{financialPlans.recurring?.length ?? 0} reglas</span>
                  </div>
                  {financialPlans.recurring?.map((plan: Row) => (
                    <div className="rank-row" key={plan.id}>
                      <div>
                        <strong>{plan.description}</strong>
                        <small>
                          {plan.frequency === 'monthly' ? 'Mensual' : 'Semanal'}{' '}
                          · cada {plan.interval} período(s)
                        </small>
                      </div>
                      <span>{money(plan.amount)}</span>
                      <Button
                        variant="ghost"
                        onClick={() =>
                          mutate('toggle-recurring', { id: plan.id })
                        }
                      >
                        {plan.active ? 'Pausar' : 'Activar'}
                      </Button>
                    </div>
                  ))}
                  {!financialPlans.recurring?.length && (
                    <p className="quiet">
                      No hay gastos recurrentes configurados.
                    </p>
                  )}
                </section>
                <section className="panel">
                  <div className="panel-heading">
                    <h2>Planes en cuotas</h2>
                    <span>
                      {financialPlans.obligations?.length ?? 0} planes
                    </span>
                  </div>
                  {financialPlans.obligations?.map((plan: Row) => (
                    <div className="rank-row" key={plan.id}>
                      <div>
                        <strong>{plan.description}</strong>
                        <small>
                          {plan.paidInstallments}/{plan.installmentCount} cuotas
                          pagadas
                        </small>
                      </div>
                      <span>{money(plan.total)}</span>
                    </div>
                  ))}
                  {!financialPlans.obligations?.length && (
                    <p className="quiet">No hay obligaciones en cuotas.</p>
                  )}
                </section>
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
                Medios de pago y planes de cuotas
              </h2>
              <Button
                variant="outline"
                onClick={() => {
                  setSelected({
                    name: '',
                    surchargeBps: 0,
                    commissionBps: 0,
                    days: 0,
                    installments: 1,
                  });
                  setForm({});
                  setModal('method');
                }}
              >
                Agregar medio o plan
              </Button>
              <div className="data-table">
                <table>
                  <thead>
                    <tr>
                      <th>Medio</th>
                      <th>Recargo al cliente</th>
                      <th>Comisión interna</th>
                      <th>Acreditación</th>
                      <th>Cuotas</th>
                      <th>Disponible</th>
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
                        <td>{m.installments}</td>
                        <td>{m.active ? 'Sí' : 'No'}</td>
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
                          {!['cash', 'store_credit', 'cashback'].includes(
                            m.id,
                          ) && (
                            <Button
                              variant="ghost"
                              disabled={busy}
                              onClick={() =>
                                mutate('set-method-active', {
                                  id: m.id,
                                  active: !m.active,
                                }).catch((e) => setError(e.message))
                              }
                            >
                              {m.active ? 'Pausar' : 'Reactivar'}
                            </Button>
                          )}
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
          {section === 'storage' && data && (
            <>
              {!!data.salonShortages?.length && (
                <section className="panel salon-replenishment">
                  <div className="panel-heading">
                    <div>
                      <h2>Reponer el salón</h2>
                      <span>
                        Hay mercadería en depósito para estas variantes con poco
                        stock en el área de venta.
                      </span>
                    </div>
                  </div>
                  <div className="salon-replenishment-list">
                    {data.salonShortages.slice(0, 12).map((item: Row) => (
                      <div key={`${item.id}-${item.locationId}`}>
                        <span>
                          <strong>{item.name}</strong> · {item.color} ·{' '}
                          {item.size}
                        </span>
                        <span>
                          Salón {item.salonStock} · {item.location}{' '}
                          {item.warehouseStock}
                        </span>
                        <Button
                          variant="outline"
                          onClick={() =>
                            openForm('storage-transfer', {
                              ...item,
                              quantity: item.warehouseStock,
                              toLocationId: 'loc-salon',
                            })
                          }
                        >
                          Mover {item.suggested} al salón
                        </Button>
                      </div>
                    ))}
                  </div>
                </section>
              )}
              <section
                className="storage-location-grid"
                aria-label="Ubicaciones"
              >
                {(data.locations ?? []).map((location: Row) => (
                  <article className="storage-location-card" key={location.id}>
                    <div>
                      <span className={`location-kind ${location.kind}`}>
                        {location.kind === 'store'
                          ? 'Salón'
                          : location.kind === 'warehouse'
                            ? 'Depósito'
                            : 'Otro'}
                      </span>
                      <strong>{location.name}</strong>
                      <small>{location.detail || location.code}</small>
                    </div>
                    <div>
                      <strong>{location.units}</strong>
                      <span>{location.variants} variantes</span>
                    </div>
                  </article>
                ))}
              </section>
              {!!data.transfers?.length && (
                <section className="panel storage-recent">
                  <div className="panel-heading">
                    <h2>Transferencias recientes</h2>
                    <span>Últimos movimientos entre ubicaciones</span>
                  </div>
                  <div className="storage-transfer-list">
                    {data.transfers.slice(0, 8).map((transfer: Row) => (
                      <div key={transfer.id}>
                        <span>
                          <strong>{transfer.name}</strong> · {transfer.color} ·{' '}
                          {transfer.size}
                        </span>
                        <span>
                          {transfer.source} → {transfer.destination}
                        </span>
                        <strong>{transfer.quantity} u.</strong>
                        <small>{date(transfer.createdAt)}</small>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </>
          )}
          {section === 'newsletter' && data && (
            <div className="newsletter-admin-grid">
              <section className="panel">
                <div className="panel-heading">
                  <h2>Suscriptores activos</h2>
                  <span>
                    {data.configured
                      ? 'Resend configurado'
                      : 'Falta configurar Resend'}
                  </span>
                </div>
                <div className="newsletter-subscriber-list">
                  {(data.subscribers ?? []).map((subscriber: Row) => (
                    <div key={subscriber.id}>
                      <span>
                        <strong>{subscriber.name || 'Sin nombre'}</strong>
                        <small>{subscriber.email}</small>
                      </span>
                      <span className={'status ' + subscriber.status}>
                        {subscriber.status === 'active' ? 'Activo' : 'Baja'}
                      </span>
                    </div>
                  ))}
                  {!data.subscribers?.length && (
                    <p className="quiet">Todavía no hay suscriptores.</p>
                  )}
                </div>
              </section>
              <section className="panel">
                <div className="panel-heading">
                  <h2>Campañas enviadas</h2>
                  <span>Historial Resend</span>
                </div>
                <div className="newsletter-subscriber-list">
                  {(data.campaigns ?? []).map((campaign: Row) => (
                    <div key={campaign.id}>
                      <span>
                        <strong>{campaign.subject}</strong>
                        <small>
                          {campaign.sentCount}/{campaign.recipientCount}{' '}
                          enviados
                        </small>
                      </span>
                      <span className={'status ' + campaign.status}>
                        {campaign.status}
                      </span>
                    </div>
                  ))}
                  {!data.campaigns?.length && (
                    <p className="quiet">Las campañas aparecerán acá.</p>
                  )}
                </div>
              </section>
            </div>
          )}
          {section === 'marketing' && data && (
            <div className="growth-admin">
              <section className="metric-grid">
                {[
                  ['Sesiones', data.funnel?.visitors ?? 0],
                  ['Vieron productos', data.funnel?.productViews ?? 0],
                  ['Agregaron', data.funnel?.addToCart ?? 0],
                  ['Iniciaron compra', data.funnel?.checkout ?? 0],
                  ['Compraron', data.funnel?.purchases ?? 0],
                ].map(([label, value]) => <article className="metric" key={String(label)}><p>{label}</p><strong>{value}</strong><small>Últimos {data.periodDays} días</small></article>)}
              </section>
              <div className="growth-grid">
                <section className="panel"><div className="panel-heading"><h2>Embudo de compra</h2><span>Sesiones únicas</span></div><div className="growth-funnel">{[
                  ['Visitas', data.funnel?.visitors], ['Producto', data.funnel?.productViews], ['Carrito', data.funnel?.addToCart], ['Checkout', data.funnel?.checkout], ['Compra', data.funnel?.purchases],
                ].map(([label, value], index) => { const max = Math.max(1, data.funnel?.visitors || 1); return <div key={String(label)}><span>{label}</span><i><b style={{ width: `${Math.max(3, Number(value || 0) / max * 100)}%` }} /></i><strong>{value || 0}{index ? ` · ${Math.round(Number(value || 0) / Math.max(1, Number(Object.values(data.funnel)[index - 1] || 1)) * 100)}%` : ''}</strong></div>; })}</div></section>
                <section className="panel"><div className="panel-heading"><h2>Origen de ventas</h2><span>Campañas y canales</span></div><div className="growth-list">{(data.sources ?? []).map((row: Row, index: number) => <div key={`${row.source}-${row.campaign}-${index}`}><span><strong>{row.source}</strong><small>{row.campaign}</small></span><b>{row.sessions} sesiones</b><em>{money(row.revenue)}</em></div>)}{!data.sources?.length && <p className="quiet">Los canales aparecerán cuando haya visitas.</p>}</div></section>
              </div>
              <div className="growth-grid">
                <section className="panel"><div className="panel-heading"><h2>Carritos por recuperar</h2><span>{data.configured ? 'Emails automáticos listos' : 'Falta configurar Resend'}</span></div><div className="growth-list">{(data.carts ?? []).map((cart: Row) => <div key={cart.id}><span><strong>{cart.email || 'Visitante sin email'}</strong><small>{date(cart.lastActivityAt)} · {cart.source || 'Directo'}</small></span><b>{money(cart.subtotal)}</b><em>{cart.secondReminderAt ? '2 avisos' : cart.firstReminderAt ? '1 aviso' : 'Pendiente'}</em></div>)}{!data.carts?.length && <p className="quiet">No hay carritos pendientes.</p>}</div></section>
                <section className="panel"><div className="panel-heading"><h2>Productos más mirados</h2><span>Interés y agregado</span></div><div className="growth-list">{(data.products ?? []).map((product: Row) => <div key={product.name}><span><strong>{product.name}</strong><small>{product.views} vistas</small></span><b>{product.adds} agregados</b></div>)}</div></section>
              </div>
              <section className="panel"><div className="panel-heading"><h2>Reseñas para moderar</h2><span>Las compras verificadas quedan identificadas</span></div><div className="growth-review-list">{(data.reviews ?? []).map((review: Row) => <article key={review.id}><div><strong>{review.product} · {review.rating}/5</strong><small>{review.displayName}{review.verified ? ' · Compra verificada' : ''}</small><p>{review.body}</p></div><span className={'status ' + review.status}>{review.status}</span>{review.status === 'pending' && <div><Button variant="outline" onClick={() => mutate('marketing', { action: 'moderate-review', reviewId: review.id, status: 'rejected' })}>Rechazar</Button><Button onClick={() => mutate('marketing', { action: 'moderate-review', reviewId: review.id, status: 'published' })}>Publicar</Button></div>}</article>)}{!data.reviews?.length && <p className="quiet">Todavía no hay opiniones.</p>}</div></section>
              <section className="panel"><div className="panel-heading"><h2>Avisos de reposición</h2><span>Conectados al stock de variantes</span></div><div className="growth-list">{(data.waits ?? []).map((wait: Row) => <div key={wait.id}><span><strong>{wait.product}</strong><small>{wait.color} · talle {wait.size} · {wait.email}</small></span><em>{wait.status === 'waiting' ? 'Esperando stock' : 'Avisado'}</em></div>)}{!data.waits?.length && <p className="quiet">No hay avisos pendientes.</p>}</div></section>
            </div>
          )}
          {columns[section] && data && (
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
                    {filtered
                      .slice(
                        currentPage * pageSize,
                        (currentPage + 1) * pageSize,
                      )
                      .map((r, i) => (
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
                              ) : ['active', 'featured', 'published'].includes(
                                  key,
                                ) ? (
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
                              <>
                                <Button
                                  variant="ghost"
                                  onClick={() => customerProfile(String(r.id))}
                                >
                                  Perfil
                                </Button>
                                <Button
                                  variant="ghost"
                                  onClick={() => openForm('edit-customer', r)}
                                >
                                  Editar
                                </Button>
                                <Button
                                  variant="ghost"
                                  onClick={() =>
                                    openForm('master-active', {
                                      ...r,
                                      entity: 'customer',
                                      targetId: r.id,
                                    })
                                  }
                                >
                                  {r.active ? 'Archivar' : 'Reactivar'}
                                </Button>
                              </>
                            )}
                            {section === 'products' && (
                              <>
                                <Button
                                  variant="ghost"
                                  disabled={!r.active}
                                  onClick={() => {
                                    setSelected(r);
                                    setForm({});
                                    setModal('variant');
                                  }}
                                >
                                  + Variante
                                </Button>
                                <Button
                                  variant="ghost"
                                  onClick={() => openForm('edit-product', r)}
                                >
                                  Producto
                                </Button>
                                <Button
                                  variant="ghost"
                                  onClick={() => openForm('edit-variant', r)}
                                >
                                  Editar variante
                                </Button>
                                <Button
                                  variant="ghost"
                                  onClick={() =>
                                    openForm('master-active', {
                                      ...r,
                                      entity: 'product',
                                      targetId: r.productId,
                                    })
                                  }
                                >
                                  {r.active ? 'Archivar' : 'Reactivar'}
                                </Button>
                              </>
                            )}
                            {section === 'products' &&
                              r.active &&
                              session?.user?.role !== 'STOCK' && (
                                <Button
                                  variant="ghost"
                                  onClick={() => actionDialog('set-price', r)}
                                >
                                  Precio
                                </Button>
                              )}
                            {section === 'products' && r.active && (
                              <>
                                {session?.permissions?.includes('stock') && (
                                  <Button
                                    variant="ghost"
                                    onClick={() => openForm('stock-adjust', r)}
                                  >
                                    Ajustar stock
                                  </Button>
                                )}
                                <Button
                                  variant="ghost"
                                  onClick={() => openForm('labels', r)}
                                >
                                  <Printer size={14} /> Etiquetas
                                </Button>
                              </>
                            )}
                            {section === 'stock' && (
                              <Button
                                variant="ghost"
                                onClick={() => openForm('create', r)}
                              >
                                Ajustar
                              </Button>
                            )}
                            {section === 'storage' && (
                              <Button
                                variant="ghost"
                                onClick={() => openForm('storage-transfer', r)}
                              >
                                Mover
                              </Button>
                            )}
                            {section === 'online-orders' && (
                              <Button
                                variant="ghost"
                                onClick={() => onlineOrderDetails(String(r.id))}
                              >
                                Gestionar
                              </Button>
                            )}
                            {section === 'online-catalog' && (
                              <>
                                <Button
                                  variant="ghost"
                                  onClick={() =>
                                    openForm('edit-online-product', r)
                                  }
                                >
                                  Editar publicación
                                </Button>
                                {r.published ? (
                                  <a
                                    href={'/producto/' + r.slug}
                                    target="_blank"
                                    rel="noreferrer"
                                  >
                                    Ver tienda
                                  </a>
                                ) : null}
                              </>
                            )}
                            {section === 'suppliers' &&
                              session?.permissions?.includes('reports') && (
                                <Button
                                  variant="ghost"
                                  onClick={async () => {
                                    try {
                                      setSelected(
                                        await api(
                                          'supplier-history?id=' +
                                            encodeURIComponent(r.id),
                                        ),
                                      );
                                      setModal('supplier-profile');
                                    } catch (e) {
                                      setError((e as Error).message);
                                    }
                                  }}
                                >
                                  Historial y rendimiento
                                </Button>
                              )}
                            {section === 'suppliers' && (
                              <>
                                <Button
                                  variant="ghost"
                                  onClick={() => openForm('edit-supplier', r)}
                                >
                                  Editar
                                </Button>
                                <Button
                                  variant="ghost"
                                  onClick={() =>
                                    openForm('master-active', {
                                      ...r,
                                      entity: 'supplier',
                                      targetId: r.id,
                                    })
                                  }
                                >
                                  {r.active ? 'Archivar' : 'Reactivar'}
                                </Button>
                              </>
                            )}
                            {section === 'purchases' && (
                              <Button
                                variant="ghost"
                                onClick={() => purchaseDetails(String(r.id))}
                              >
                                Detalle
                              </Button>
                            )}
                            {section === 'purchases' &&
                              r.status === 'draft' && (
                                <Button
                                  variant="ghost"
                                  onClick={() =>
                                    changePurchaseStatus(String(r.id), 'send')
                                  }
                                >
                                  Marcar como enviada
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
                            {section === 'payables' &&
                              r.status === 'pending' && (
                                <Button
                                  variant="ghost"
                                  onClick={() => actionDialog('pay-payable', r)}
                                >
                                  Pagar
                                </Button>
                              )}
                            {section === 'inventory' && (
                              <Button
                                variant="ghost"
                                onClick={async () => {
                                  try {
                                    setSelected(
                                      await api(
                                        'inventory?id=' +
                                          encodeURIComponent(r.id),
                                      ),
                                    );
                                    setModal('inventory-detail');
                                  } catch (e) {
                                    setError((e as Error).message);
                                  }
                                }}
                              >
                                Ver diferencias
                              </Button>
                            )}
                            {section === 'inventory' &&
                              r.status === 'draft' && (
                                <Button
                                  variant="ghost"
                                  onClick={() =>
                                    actionDialog('approve-count', r)
                                  }
                                >
                                  Aprobar
                                </Button>
                              )}
                            {section === 'users' &&
                              r.active &&
                              r.id !== session?.user?.id && (
                                <Button
                                  variant="ghost"
                                  onClick={() =>
                                    actionDialog('disable-user', r)
                                  }
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
                {pageCount > 1 && (
                  <nav
                    className="table-pagination"
                    aria-label="Páginas del listado"
                  >
                    <Button
                      variant="outline"
                      disabled={currentPage === 0}
                      onClick={() => setPage(currentPage - 1)}
                    >
                      Anterior
                    </Button>
                    <output>
                      Página {currentPage + 1} de {pageCount} ·{' '}
                      {filtered.length} registros
                    </output>
                    <Button
                      variant="outline"
                      disabled={currentPage + 1 === pageCount}
                      onClick={() => setPage(currentPage + 1)}
                    >
                      Siguiente
                    </Button>
                  </nav>
                )}
              </div>
            </section>
          )}
          <footer className="admin-footer">
            FRAGUAN <span>Sistema de gestión</span>
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
          <DialogTitle>{currentModalTitle()}</DialogTitle>
          <DialogDescription>{currentModalDescription()}</DialogDescription>
          {error && (
            <p className="notice" role="alert">
              {error}
            </p>
          )}
          {modal === 'online-order' && selected ? (
            <div className="online-order-detail">
              <div className="online-order-status">
                <span className={'status ' + selected.paymentStatus}>
                  {labels[selected.paymentStatus] ?? selected.paymentStatus}
                </span>
                <span className={'status ' + selected.fulfillmentStatus}>
                  {labels[selected.fulfillmentStatus] ??
                    selected.fulfillmentStatus}
                </span>
              </div>
              <div className="stock-adjust-summary">
                <strong>{selected.customerName}</strong>
                <span>
                  {selected.email} · {selected.phone}
                </span>
                <span>
                  {selected.shippingMethod === 'pickup'
                    ? 'Retiro en el local'
                    : `${selected.address}${selected.addressExtra ? ` · ${selected.addressExtra}` : ''}, ${selected.city}, ${selected.province} · CP ${selected.postalCode}`}
                </span>
                {selected.document && <span>DNI: {selected.document}</span>}
                {selected.couponCode && <span>Cupón aplicado: {selected.couponCode}</span>}
                {selected.attributionJson && (() => { try { const source = JSON.parse(selected.attributionJson); return <span>Origen: {source.source || 'Directo'}{source.campaign ? ` · ${source.campaign}` : ''}</span>; } catch { return null; } })()}
              </div>
              {!!selected.returnRequests?.length && (
                <div className="online-return-alert">
                  <strong>Solicitudes del cliente</strong>
                  {selected.returnRequests.map((request: Row) => (
                    <div key={request.code}>
                      <span>{request.code} · {labels[request.kind] ?? request.kind}</span>
                      <small>{request.reason} · {date(request.createdAt)}</small>
                      {request.detail && <p>{request.detail}</p>}
                    </div>
                  ))}
                </div>
              )}
              <div className="online-order-reference">
                <span>Referencia de transferencia</span>
                <strong>{selected.transferReference}</strong>
                <small>
                  Operación informada: {selected.paymentReference || '—'}
                </small>
              </div>
              <div className="online-picking-list">
                <h3>Prendas a preparar</h3>
                {selected.items?.map((item: Row, index: number) => (
                  <div key={`${item.sku}-${index}`}>
                    <span>
                      <strong>{item.productName}</strong>
                      <small>
                        {item.color} · Talle {item.size} · SKU {item.sku}
                      </small>
                    </span>
                    <span>{item.location}</span>
                    <b>{item.quantity} u.</b>
                  </div>
                ))}
              </div>
              <div className="total-line">
                <span>Total del pedido</span>
                <strong>{money(selected.total)}</strong>
              </div>
              {['pending', 'reported'].includes(selected.paymentStatus) && (
                <div className="online-order-action">
                  {field('paymentReference', 'Referencia bancaria confirmada', {
                    value:
                      selected.paymentReference || selected.transferReference,
                  })}
                  <Button
                    disabled={busy}
                    onClick={() =>
                      mutate('online-orders', {
                        action: 'mark-paid',
                        orderId: selected.id,
                        paymentReference:
                          form.paymentReference ||
                          selected.paymentReference ||
                          selected.transferReference,
                      })
                    }
                  >
                    <Check /> Confirmar pago
                  </Button>
                  <Button
                    variant="outline"
                    disabled={busy}
                    onClick={() =>
                      mutate('online-orders', {
                        action: 'cancel',
                        orderId: selected.id,
                        reason: 'Cancelado desde administración',
                      })
                    }
                  >
                    Cancelar pedido
                  </Button>
                </div>
              )}
              {selected.paymentStatus === 'paid' &&
                selected.fulfillmentStatus === 'unfulfilled' && (
                  <Button
                    disabled={busy}
                    onClick={() =>
                      mutate('online-orders', {
                        action: 'prepare',
                        orderId: selected.id,
                      })
                    }
                  >
                    <PackageCheck /> Empezar preparación
                  </Button>
                )}
              {selected.paymentStatus === 'paid' &&
                selected.fulfillmentStatus === 'preparing' && (
                  <div className="online-order-action">
                    {field('trackingNumber', 'Seguimiento de Correo Argentino')}
                    <Button
                      disabled={busy}
                      onClick={() =>
                        mutate('online-orders', {
                          action: 'ship',
                          orderId: selected.id,
                          trackingNumber: form.trackingNumber,
                        })
                      }
                    >
                      Marcar despachado
                    </Button>
                  </div>
                )}
            </div>
          ) : modal === 'labels' && selected ? (
            <div className="quick-form">
              <div className="no-print">
                {field('labelCount', 'Cantidad de etiquetas', {
                  type: 'number',
                  value: 1,
                })}
                <p className="quiet">
                  Se imprime una etiqueta por unidad. El máximo de esta tanda es
                  100.
                </p>
                <Button type="button" onClick={() => printCommerce('labels')}>
                  <Printer /> Imprimir etiquetas
                </Button>
              </div>
              <div
                className="print-labels"
                aria-label="Vista previa de etiquetas"
              >
                {Array.from({
                  length: Math.min(
                    100,
                    Math.max(1, Number(form.labelCount ?? 1) || 1),
                  ),
                }).map((_, index) => (
                  <article className="print-label" key={index}>
                    <strong>FRAGUAN</strong>
                    <span>{selected.name}</span>
                    <span>
                      {selected.color} · {selected.size}
                    </span>
                    <b>{money(selected.price)}</b>
                    <small>SKU {selected.sku}</small>
                    <Barcode value={selected.barcode} />
                    <small className="label-barcode">{selected.barcode}</small>
                  </article>
                ))}
              </div>
            </div>
          ) : modal === 'sale' && selected ? (
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
              <Button
                className="no-print"
                onClick={() => printCommerce('receipt')}
              >
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
              <ExportActions
                name={`orden-${selected.id}`}
                sheets={[
                  {
                    name: 'Orden de compra',
                    columns: ['Dato', 'Detalle'],
                    rows: [
                      ['Orden', selected.id],
                      ['Proveedor', selected.supplier],
                      ['Estado', labels[selected.status] ?? selected.status],
                      ['Fecha', date(selected.createdAt)],
                      ['Vencimiento', date(selected.dueAt)],
                      ['Medio de pago', selected.paymentMethod],
                      [
                        'Condiciones de pago',
                        selected.paymentTerms || 'Sin condiciones adicionales',
                      ],
                      [
                        'Entrega prevista',
                        selected.expectedAt
                          ? date(selected.expectedAt)
                          : 'Sin fecha',
                      ],
                      ['Transportista', selected.carrier || 'Sin asignar'],
                      [
                        'Seguimiento',
                        selected.trackingReference || 'Sin referencia',
                      ],
                      [
                        'Dirección de entrega',
                        selected.deliveryAddress || 'Sin especificar',
                      ],
                      [
                        'Referencia del proveedor',
                        selected.supplierReference || 'Sin referencia',
                      ],
                      ['Notas y condiciones', selected.notes || 'Sin notas'],
                      ['Subtotal ARS', selected.subtotal / 100],
                      ['Descuentos ARS', selected.discount / 100],
                      ['Impuestos ARS', selected.tax / 100],
                      ['Transporte ARS', selected.shipping / 100],
                      ['Total ARS', selected.total / 100],
                    ],
                  },
                  {
                    name: 'Detalle de mercadería',
                    columns: [
                      'Producto',
                      'SKU',
                      'Color',
                      'Talle',
                      'Pedido',
                      'Recibido',
                      'Costo unitario ARS',
                      'Descuento de línea ARS',
                      'Neto de línea ARS',
                    ],
                    rows: (selected.items ?? []).map((item: Row) => [
                      item.name,
                      item.sku,
                      item.color,
                      item.size,
                      item.quantity,
                      item.received,
                      item.cost / 100,
                      (item.discount ?? 0) / 100,
                      (item.quantity * item.cost - (item.discount ?? 0)) / 100,
                    ]),
                  },
                ]}
              />
              <div className="profile-heading">
                <div>
                  <p className="eyebrow">ORDEN DE COMPRA</p>
                  <h2>{selected.supplier}</h2>
                  <p>
                    {date(selected.createdAt)} · Vence {date(selected.dueAt)}
                  </p>
                  <p>
                    Entrega prevista:{' '}
                    {selected.expectedAt
                      ? date(selected.expectedAt)
                      : 'Sin fecha acordada'}
                  </p>
                  {selected.carrier && <p>Transportista: {selected.carrier}</p>}
                  {selected.trackingReference && (
                    <p>Seguimiento: {selected.trackingReference}</p>
                  )}
                  {selected.deliveryAddress && (
                    <p>Entrega en: {selected.deliveryAddress}</p>
                  )}
                  {selected.paymentTerms && (
                    <p>Condiciones: {selected.paymentTerms}</p>
                  )}
                  {selected.notes && <p>Observaciones: {selected.notes}</p>}
                </div>
                <div className="profile-badges">
                  <span>
                    {labels[selected.completionStatus ?? selected.status] ??
                      selected.status}
                  </span>
                  <span>
                    Pago:{' '}
                    {labels[selected.paymentStatus] ?? selected.paymentStatus}
                  </span>
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
                <span>Impuestos</span>
                <span>{money(selected.tax ?? 0)}</span>
              </div>
              <div className="summary-line">
                <span>Transporte</span>
                <span>{money(selected.shipping ?? 0)}</span>
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
                  Marcar como enviada
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
          ) : modal === 'supplier-profile' && selected ? (
            <div className="customer-profile">
              <h2>{selected.supplier.name}</h2>
              <p>
                Ventas del {date(selected.period.from)} al{' '}
                {date(selected.period.to)}.
              </p>
              <div className="metric-grid">
                <Metric
                  title="Ventas netas"
                  value={money(selected.sales.revenueMinor)}
                  detail={`${selected.sales.units} unidades`}
                />
                <Metric
                  title="Ganancia comercial"
                  value={money(selected.sales.grossProfitMinor)}
                  detail="Después de costos y comisiones de cobro"
                />
                <Metric
                  title="Capital en stock"
                  value={money(selected.stock.cost)}
                  detail={`${selected.stock.units} unidades actuales`}
                />
              </div>
              <p>
                Unidades vendidas / stock actual:{' '}
                {selected.rotation === null
                  ? 'Sin stock actual'
                  : Number(selected.rotation).toFixed(2)}
                . Esta relación usa el stock actual, no un promedio histórico.
              </p>
              <div className="metric-grid">
                <Metric
                  title="Entregas a tiempo"
                  value={`${selected.fulfillment?.onTime ?? 0} / ${selected.fulfillment?.completed ?? 0}`}
                  detail="Órdenes recibidas con fecha de entrega acordada"
                />
                <Metric
                  title="Entregas atrasadas"
                  value={String(selected.fulfillment?.overdue ?? 0)}
                  detail="Órdenes abiertas cuya fecha prevista ya pasó"
                />
              </div>
              <ExportActions
                name="historial-proveedor"
                sheets={[
                  {
                    name: 'Órdenes',
                    columns: [
                      'Fecha',
                      'Referencia',
                      'Estado',
                      'Total ARS',
                      'Pedidas',
                      'Recibidas',
                      'Entrega prevista',
                      'Recepción completa',
                      'Transportista',
                    ],
                    rows: selected.orders.map((r: Row) => [
                      r.createdAt,
                      r.supplierReference,
                      r.status,
                      r.total / 100,
                      r.ordered,
                      r.received,
                      r.expectedAt ?? '',
                      r.receivedAt ?? '',
                      r.carrier ?? '',
                    ]),
                  },
                ]}
              />
              <div className="data-table">
                <table>
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Estado</th>
                      <th>Total</th>
                      <th>Recibidas / pedidas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selected.orders.map((r: Row) => (
                      <tr key={r.id}>
                        <td>{date(r.createdAt)}</td>
                        <td>{labels[r.status] ?? r.status}</td>
                        <td>{money(r.total)}</td>
                        <td>
                          {r.received} / {r.ordered}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!selected.orders.length && (
                  <p className="quiet">No hay órdenes para este proveedor.</p>
                )}
              </div>
            </div>
          ) : modal === 'inventory-detail' && selected ? (
            <div className="customer-profile">
              <h2>Diferencias del inventario</h2>
              <p>
                {selected.status === 'draft'
                  ? 'Borrador · cantidades editables hasta aprobar'
                  : 'Conteo aprobado'}
              </p>
              <div className="data-table">
                <table>
                  <thead>
                    <tr>
                      <th>Variante</th>
                      <th>Sistema</th>
                      <th>Encontrado</th>
                      <th>Diferencia</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selected.items.map((r: Row, index: number) => (
                      <tr key={r.id}>
                        <td>
                          {r.name}
                          <small>
                            {r.color} · {r.size} · {r.sku}
                          </small>
                        </td>
                        <td>{r.expected}</td>
                        <td>
                          {selected.status === 'draft' ? (
                            <Input
                              type="number"
                              min={0}
                              max={100000}
                              aria-label={`Cantidad encontrada de ${r.name} ${r.color} ${r.size}`}
                              value={r.counted}
                              onChange={(e) =>
                                setSelected({
                                  ...selected,
                                  items: selected.items.map(
                                    (line: Row, i: number) =>
                                      i === index
                                        ? { ...line, counted: e.target.value }
                                        : line,
                                  ),
                                })
                              }
                            />
                          ) : (
                            r.counted
                          )}
                        </td>
                        <td>{Number(r.counted) - r.expected}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <ExportActions
                name="diferencias-inventario"
                sheets={[
                  {
                    name: 'Conteo',
                    columns: [
                      'SKU',
                      'Producto',
                      'Color',
                      'Talle',
                      'Sistema',
                      'Encontrado',
                      'Diferencia',
                    ],
                    rows: selected.items.map((r: Row) => [
                      r.sku,
                      r.name,
                      r.color,
                      r.size,
                      r.expected,
                      Number(r.counted),
                      Number(r.counted) - r.expected,
                    ]),
                  },
                ]}
              />
              {selected.status === 'draft' && (
                <Button
                  disabled={busy}
                  onClick={() =>
                    mutate('inventory-edit', {
                      id: selected.id,
                      items: selected.items.map((r: Row) => ({
                        id: r.id,
                        counted: Number(r.counted),
                      })),
                    })
                  }
                >
                  Guardar conteo
                </Button>
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
              <div className="profile-contact">
                <span>
                  <strong>Email</strong>
                  {selected.metrics?.email || 'Sin cargar'}
                </span>
                <span>
                  <strong>Localidad</strong>
                  {selected.metrics?.locality || 'Sin cargar'}
                </span>
                <span>
                  <strong>Talles habituales</strong>
                  {selected.metrics?.usualSizes || 'Sin cargar'}
                </span>
                <span>
                  <strong>Observaciones</strong>
                  {selected.metrics?.notes || 'Sin observaciones'}
                </span>
              </div>
              <h3>Club FRAGUAN</h3>
              <div className="metric-grid profile-metrics">
                <Metric
                  title="Cashback disponible"
                  value={money(selected.balances?.cashbackBalance)}
                  detail="Saldo vigente para próximas compras"
                />
                <Metric
                  title="Saldo a favor"
                  value={money(selected.balances?.balance)}
                  detail="Crédito vigente por devoluciones"
                />
                <Metric
                  title="Cashback del nivel"
                  value={`${(selected.config?.loyalty?.cashbackBps?.[selected.metrics?.loyaltyLevel] ?? 0) / 100}%`}
                  detail={`Vigencia: ${selected.config?.loyalty?.cashbackExpiryDays ?? 365} días`}
                />
              </div>
              {!!selected.config?.loyalty?.benefits?.[
                selected.metrics?.loyaltyLevel
              ]?.length && (
                <ul>
                  {selected.config.loyalty.benefits[
                    selected.metrics.loyaltyLevel
                  ].map((benefit: string, index: number) => (
                    <li key={`${index}-${benefit}`}>{benefit}</li>
                  ))}
                </ul>
              )}
              <h3>Acreditaciones de cashback</h3>
              {selected.cashback?.length ? (
                <div className="data-table profile-history">
                  <table>
                    <caption className="quiet">
                      Últimas 250 acreditaciones. El saldo disponible incluye
                      todas las vigentes.
                    </caption>
                    <thead>
                      <tr>
                        <th>Fecha / ticket</th>
                        <th>Origen</th>
                        <th>Acreditado</th>
                        <th>Saldo</th>
                        <th>Vencimiento</th>
                        <th>Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selected.cashback.map((reward: Row) => (
                        <tr key={reward.id}>
                          <td>
                            {date(reward.createdAt)}
                            <small>#{reward.ticket}</small>
                          </td>
                          <td>
                            {reward.refundId
                              ? 'Reintegro por devolución'
                              : 'Compra'}
                          </td>
                          <td>{money(reward.amount)}</td>
                          <td>{money(reward.balance)}</td>
                          <td>
                            {reward.expiresAt
                              ? date(reward.expiresAt)
                              : 'Sin vencimiento'}
                          </td>
                          <td>
                            {(
                              {
                                active: 'Disponible',
                                used: 'Sin saldo',
                                expired: 'Vencido',
                              } as Record<string, string>
                            )[reward.status] ?? reward.status}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="quiet">
                  Este cliente todavía no tiene acreditaciones de cashback.
                </p>
              )}
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
              {modal === 'loyalty-config' && (
                <>
                  <p>
                    Definí las condiciones acumuladas en la ventana del Club.
                    Los niveles superiores deben mantener requisitos iguales o
                    mayores.
                  </p>
                  {field('loyaltyWindowDays', 'Ventana de evaluación (días)', {
                    type: 'number',
                  })}
                  {field(
                    'cashbackExpiryDays',
                    'Vencimiento del cashback (días)',
                    {
                      type: 'number',
                    },
                  )}
                  <h3>Cashback y beneficios</h3>
                  {field('fraguanCashback', 'FRAGUAN · cashback (%)', {
                    type: 'number',
                  })}
                  {field(
                    'fraguanBenefits',
                    'FRAGUAN · beneficios (separados por coma)',
                    {
                      optional: true,
                    },
                  )}
                  <h3>Silver</h3>
                  {field('silverSpend', 'Gasto mínimo (pesos)', {
                    type: 'number',
                  })}
                  {field('silverPurchases', 'Compras mínimas', {
                    type: 'number',
                  })}
                  {field('silverPoints', 'Puntos mínimos', {
                    type: 'number',
                  })}
                  {field('silverCashback', 'Silver · cashback (%)', {
                    type: 'number',
                  })}
                  {field('silverBenefits', 'Silver · beneficios', {
                    optional: true,
                  })}
                  <h3>Gold</h3>
                  {field('goldSpend', 'Gasto mínimo (pesos)', {
                    type: 'number',
                  })}
                  {field('goldPurchases', 'Compras mínimas', {
                    type: 'number',
                  })}
                  {field('goldPoints', 'Puntos mínimos', {
                    type: 'number',
                  })}
                  {field('goldCashback', 'Gold · cashback (%)', {
                    type: 'number',
                  })}
                  {field('goldBenefits', 'Gold · beneficios', {
                    optional: true,
                  })}
                  <h3>Black</h3>
                  {field('blackSpend', 'Gasto mínimo (pesos)', {
                    type: 'number',
                  })}
                  {field('blackPurchases', 'Compras mínimas', {
                    type: 'number',
                  })}
                  {field('blackPoints', 'Puntos mínimos', {
                    type: 'number',
                  })}
                  {field('blackCashback', 'Black · cashback (%)', {
                    type: 'number',
                  })}
                  {field('blackBenefits', 'Black · beneficios', {
                    optional: true,
                  })}
                </>
              )}
              {modal === 'product-import' && (
                <>
                  <div className="import-actions">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={downloadProductTemplate}
                    >
                      <Download size={15} /> Descargar plantilla
                    </Button>
                    <small>
                      CSV con separador punto y coma. No admite columnas de
                      fotos.
                    </small>
                  </div>
                  <label>
                    Archivo CSV
                    <Input
                      type="file"
                      accept=".csv,text/csv"
                      required
                      onChange={async (event) => {
                        const file = event.target.files?.[0];
                        if (!file) return;
                        try {
                          const importRows = parseProductCsv(await file.text());
                          setError('');
                          setForm({
                            ...form,
                            importRows,
                            importPreview: null,
                            importFileName: file.name,
                          });
                        } catch (e: any) {
                          setForm({
                            ...form,
                            importRows: [],
                            importPreview: null,
                          });
                          setError(e.message);
                        }
                      }}
                    />
                  </label>
                  {field('mode', 'Tratamiento de coincidencias', {
                    choices: [
                      ['create_only', 'Solo altas nuevas'],
                      ['upsert', 'Crear y actualizar existentes'],
                    ],
                    value: 'create_only',
                  })}
                  {field('stockMode', 'Stock del archivo', {
                    choices: [
                      ['ignore', 'No modificar stock'],
                      ['set', 'Ajustar al stock informado'],
                    ],
                    value: 'ignore',
                  })}
                  {form.importRows?.length > 0 && (
                    <p>
                      <strong>{form.importFileName}</strong> ·{' '}
                      {form.importRows.length} variantes leídas.
                    </p>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    disabled={busy || !form.importRows?.length}
                    onClick={previewProductImport}
                  >
                    <Check size={15} /> Validar archivo
                  </Button>
                  {form.importPreview?.summary && (
                    <div className="import-preview">
                      <strong>Archivo válido</strong>
                      <span>
                        {form.importPreview.summary.newProducts} productos
                        nuevos · {form.importPreview.summary.newVariants}{' '}
                        variantes nuevas
                      </span>
                      <span>
                        {form.importPreview.summary.updatedProducts} productos y{' '}
                        {form.importPreview.summary.updatedVariants} variantes a
                        actualizar
                      </span>
                      <span>
                        {form.importPreview.summary.stockAdjustments} ajustes de
                        stock trazables
                      </span>
                    </div>
                  )}
                </>
              )}
              {modal === 'edit-product' && (
                <>
                  {field('name', 'Nombre')}
                  {field('internalCode', 'Código interno', { optional: true })}
                  {field('category', 'Categoría')}
                  {field('subcategory', 'Subcategoría', { optional: true })}
                  {field('brand', 'Marca')}
                  {field('season', 'Temporada', { optional: true })}
                  {field('collection', 'Colección', { optional: true })}
                  {field('location', 'Ubicación en el local', {
                    optional: true,
                  })}
                  {field('supplierId', 'Proveedor', {
                    choices: supplierChoices,
                    optional: true,
                  })}
                </>
              )}
              {modal === 'edit-online-product' && selected && (
                <>
                  <div className="stock-adjust-summary">
                    <strong>{selected.name}</strong>
                    <span>
                      {selected.variants} variantes · {selected.stock} unidades
                    </span>
                  </div>
                  <div className="online-price-editor">
                    {field('onlinePrice', 'Precio online (pesos)', {
                      type: 'number',
                      optional: Boolean(form.useLocalPrice),
                    })}
                    <label className="admin-check-line">
                      <input
                        type="checkbox"
                        checked={Boolean(form.useLocalPrice)}
                        onChange={(event) =>
                          setForm({
                            ...form,
                            useLocalPrice: event.target.checked,
                          })
                        }
                      />
                      Usar automáticamente el precio del local
                    </label>
                    <small>
                      Precio local actual: {money(selected.localPrice)}. El
                      precio online se aplica a todos los talles y colores de
                      este producto.
                    </small>
                  </div>
                  {field('slug', 'Enlace del producto')}
                  {field('section', 'Sección de la tienda')}
                  {field('shortDescription', 'Descripción breve')}
                  <label>
                    Descripción completa
                    <textarea
                      rows={5}
                      value={form.description ?? ''}
                      onChange={(event) =>
                        setForm({ ...form, description: event.target.value })
                      }
                    />
                  </label>
                  {field('fit', 'Calce')}
                  {field('material', 'Material', { optional: true })}
                  {field('care', 'Cuidados', { optional: true })}
                  {field('sortOrder', 'Orden de aparición', { type: 'number' })}
                  <label className="admin-check-line">
                    <input
                      type="checkbox"
                      checked={Boolean(form.featured)}
                      onChange={(event) =>
                        setForm({ ...form, featured: event.target.checked })
                      }
                    />
                    Destacar en la tienda
                  </label>
                  <label className="admin-check-line">
                    <input
                      type="checkbox"
                      checked={Boolean(form.published)}
                      onChange={(event) =>
                        setForm({ ...form, published: event.target.checked })
                      }
                    />
                    Producto publicado
                  </label>
                </>
              )}
              {modal === 'newsletter-campaign' && (
                <>
                  {field('subject', 'Asunto')}
                  {field('preheader', 'Texto de vista previa', {
                    optional: true,
                  })}
                  <label>
                    Contenido
                    <textarea
                      rows={9}
                      value={form.content ?? ''}
                      onChange={(event) =>
                        setForm({ ...form, content: event.target.value })
                      }
                      placeholder="Escribí un mensaje breve. Cada salto de línea se convierte en un párrafo."
                      required
                    />
                  </label>
                  {field('ctaLabel', 'Texto del botón', { optional: true })}
                  {field('ctaUrl', 'Enlace del botón', { optional: true })}
                  <p className="quiet">
                    Se envía únicamente a suscriptores activos. Cada email
                    incluye un enlace para darse de baja.
                  </p>
                </>
              )}
              {modal === 'edit-variant' && (
                <>
                  <p>
                    {selected?.name} · stock actual: {selected?.stock}
                  </p>
                  {field('color', 'Color')}
                  {field('size', 'Talle')}
                  {field('sku', 'SKU')}
                  {field('barcode', 'Código de barras')}
                  {field('price', 'Precio (pesos)', { type: 'number' })}
                  {field('onlinePrice', 'Precio online (pesos)', {
                    type: 'number',
                    optional: true,
                  })}
                  <small>
                    Si queda vacío, la tienda online usa automáticamente el
                    precio del local.
                  </small>
                  {field('cost', 'Costo (pesos)', { type: 'number' })}
                  {field('minimum', 'Stock mínimo', { type: 'number' })}
                  {field('ideal', 'Stock ideal', { type: 'number' })}
                  {field('entryAt', 'Fecha de ingreso', {
                    type: 'date',
                    optional: true,
                  })}
                </>
              )}
              {modal === 'edit-customer' && (
                <>
                  {field('name', 'Nombre')}
                  {field('surname', 'Apellido')}
                  {field('phone', 'Teléfono')}
                  {field('email', 'Email', { type: 'email', optional: true })}
                  {field('birthday', 'Cumpleaños', {
                    type: 'date',
                    optional: true,
                  })}
                  {field('locality', 'Localidad', { optional: true })}
                  {field('usualSizes', 'Talles habituales', { optional: true })}
                  {field('notes', 'Observaciones', { optional: true })}
                </>
              )}
              {modal === 'edit-supplier' && (
                <>
                  {field('name', 'Nombre comercial')}
                  {field('company', 'Empresa / razón social', {
                    optional: true,
                  })}
                  {field('contact', 'Persona de contacto', { optional: true })}
                  {field('phone', 'Teléfono', { optional: true })}
                  {field('email', 'Email', { type: 'email', optional: true })}
                  {field('brands', 'Marcas', { optional: true })}
                  {field('terms', 'Condiciones comerciales', {
                    optional: true,
                  })}
                  {field('discountPercent', 'Descuento habitual (%)', {
                    type: 'number',
                    optional: true,
                  })}
                  {field('paymentDays', 'Días de pago', {
                    type: 'number',
                    optional: true,
                  })}
                  {field('notes', 'Observaciones', { optional: true })}
                </>
              )}
              {modal === 'master-active' && (
                <p>
                  {selected?.active ? 'Se archivará' : 'Se reactivará'}{' '}
                  <strong>
                    {selected?.name ??
                      `${selected?.surname ?? ''} ${selected?.phone ?? ''}`}
                  </strong>
                  . El historial relacionado se conserva completo.
                </p>
              )}
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
                  {field('ideal', 'Stock ideal', {
                    type: 'number',
                    optional: true,
                    value: 6,
                  })}
                  {field('entryAt', 'Fecha de ingreso', {
                    type: 'date',
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
              {modal === 'recurring-expense' && (
                <>
                  {field('description', 'Concepto')}
                  {field('category', 'Categoría', {
                    choices: [
                      'Alquiler',
                      'Servicios',
                      'Impuestos',
                      'Sueldos y cargas',
                      'Marketing',
                      'Logística',
                      'Mantenimiento',
                      'Otros gastos',
                    ].map((value) => [value, value]),
                    value: 'Servicios',
                  })}
                  {field('amount', 'Importe (pesos)', { type: 'number' })}
                  {field('frequency', 'Frecuencia', {
                    choices: [
                      ['monthly', 'Mensual'],
                      ['weekly', 'Semanal'],
                    ],
                    value: 'monthly',
                  })}
                  {field('interval', 'Cada cuántos períodos', {
                    type: 'number',
                    value: 1,
                  })}
                  {field('startsOn', 'Primer vencimiento', {
                    type: 'date',
                    value: new Intl.DateTimeFormat('en-CA', {
                      timeZone: 'America/Argentina/Buenos_Aires',
                    }).format(new Date()),
                  })}
                  {field('endsOn', 'Último vencimiento', {
                    type: 'date',
                    optional: true,
                  })}
                  {field('supplierId', 'Proveedor', {
                    choices: supplierChoices,
                    optional: true,
                  })}
                  {field('methodId', 'Medio previsto', {
                    choices: paymentChoices,
                    optional: true,
                  })}
                </>
              )}
              {modal === 'installment-obligation' && (
                <>
                  {field('description', 'Concepto')}
                  {field('total', 'Importe total (pesos)', {
                    type: 'number',
                  })}
                  {field('installmentCount', 'Cantidad de cuotas', {
                    type: 'number',
                    value: 3,
                  })}
                  {field('firstDueOn', 'Primer vencimiento', {
                    type: 'date',
                    value: new Intl.DateTimeFormat('en-CA', {
                      timeZone: 'America/Argentina/Buenos_Aires',
                    }).format(new Date()),
                  })}
                  {field('intervalMonths', 'Meses entre cuotas', {
                    type: 'number',
                    value: 1,
                  })}
                  {field('kind', 'Tipo de obligación', {
                    choices: [
                      'Proveedor',
                      'Transferencia',
                      'Cheque',
                      'eCheq',
                      'Servicio',
                      'Cuota',
                    ].map((value) => [value, value]),
                    value: 'Cuota',
                  })}
                  {field('supplierId', 'Proveedor', {
                    choices: supplierChoices,
                    optional: true,
                  })}
                </>
              )}
              {modal === 'create' && (
                <>
                  {section === 'products' && (
                    <>
                      {field('name', 'Nombre')}
                      {field('internalCode', 'Código interno', {
                        optional: true,
                      })}
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
                      {field('subcategory', 'Subcategoría', { optional: true })}
                      {field('brand', 'Marca', { optional: true })}
                      {field('season', 'Temporada', { optional: true })}
                      {field('collection', 'Colección', { optional: true })}
                      {field('location', 'Ubicación en el local', {
                        optional: true,
                      })}
                      {field('supplierId', 'Proveedor', {
                        choices: supplierChoices,
                        optional: true,
                      })}
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
                      {field('ideal', 'Stock ideal', {
                        type: 'number',
                        optional: true,
                        value: 6,
                      })}
                      {field('entryAt', 'Fecha de ingreso', {
                        type: 'date',
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
                      {field('notes', 'Observaciones', { optional: true })}
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
                      {field('name', 'Nombre comercial')}
                      {field('company', 'Empresa / razón social', {
                        optional: true,
                      })}
                      {field('contact', 'Persona de contacto', {
                        optional: true,
                      })}
                      {field('phone', 'Teléfono', { optional: true })}
                      {field('email', 'Email', {
                        type: 'email',
                        optional: true,
                      })}
                      {field('brands', 'Marcas', { optional: true })}
                      {field('terms', 'Condiciones comerciales', {
                        optional: true,
                      })}
                      {field('discountPercent', 'Descuento habitual (%)', {
                        type: 'number',
                        optional: true,
                      })}
                      {field('paymentDays', 'Días de pago', {
                        type: 'number',
                        optional: true,
                      })}
                      {field('notes', 'Observaciones', { optional: true })}
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
                      {field(
                        'paymentTerms',
                        'Condiciones de pago adicionales',
                        { optional: true },
                      )}
                      {field('expectedAt', 'Entrega prevista', {
                        type: 'date',
                        optional: true,
                      })}
                      {field('carrier', 'Transportista', { optional: true })}
                      {field('trackingReference', 'Referencia de seguimiento', {
                        optional: true,
                      })}
                      {field('deliveryAddress', 'Dirección de entrega', {
                        optional: true,
                      })}
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
                      <InventoryLines
                        lines={
                          form.countLines ?? [{ variantId: '', counted: '' }]
                        }
                        choices={variantChoices}
                        onChange={(countLines) =>
                          setForm({ ...form, countLines })
                        }
                      />
                    </>
                  )}
                </>
              )}
              {modal === 'stock-adjust' && selected && (
                <>
                  <div className="stock-adjust-summary">
                    <strong>{selected.name}</strong>
                    <span>
                      {selected.color} · {selected.size} · SKU {selected.sku}
                    </span>
                    <span>Stock actual: {selected.stock}</span>
                  </div>
                  {field('quantity', 'Unidades a sumar o restar', {
                    type: 'number',
                  })}
                  {field('reason', 'Motivo del ajuste (mín. 5 caracteres)')}
                  {field('notes', 'Observaciones', { optional: true })}
                  {field('locationId', 'Ubicación específica', {
                    choices: locationChoices,
                    optional: true,
                  })}
                </>
              )}
              {modal === 'storage-location' && (
                <>
                  {field('name', 'Nombre de la ubicación')}
                  {field('code', 'Código corto')}
                  {field('kind', 'Tipo', {
                    choices: [
                      ['store', 'Salón / área de venta'],
                      ['warehouse', 'Depósito'],
                      ['other', 'Otro sector'],
                    ],
                    value: 'warehouse',
                  })}
                  {field(
                    'detail',
                    'Detalle: estante, módulo, caja o perchero',
                    {
                      optional: true,
                    },
                  )}
                </>
              )}
              {modal === 'storage-transfer' && selected && (
                <>
                  <div className="stock-adjust-summary">
                    <strong>{selected.name}</strong>
                    <span>
                      {selected.color} · {selected.size} · SKU {selected.sku}
                    </span>
                    <span>
                      Origen: {selected.location} · Disponible:{' '}
                      {selected.quantity}
                    </span>
                  </div>
                  {field('toLocationId', 'Mover hacia', {
                    choices: locationChoices.filter(
                      ([locationId]) => locationId !== selected.locationId,
                    ),
                  })}
                  {field('quantity', 'Cantidad', {
                    type: 'number',
                    value: 1,
                  })}
                  {field('notes', 'Observaciones', { optional: true })}
                </>
              )}
              <Button
                type="submit"
                className="activate"
                disabled={
                  busy || (modal === 'product-import' && !form.importPreview)
                }
              >
                {busy
                  ? 'Guardando…'
                  : modal === 'product-import'
                    ? 'Aplicar importación'
                    : modal.startsWith('edit-')
                      ? 'Guardar cambios'
                      : modal === 'master-active'
                        ? selected?.active
                          ? 'Archivar'
                          : 'Reactivar'
                        : modal === 'refund'
                          ? 'Confirmar devolución'
                          : modal === 'recurring-expense'
                            ? 'Crear gasto recurrente'
                            : modal === 'installment-obligation'
                              ? 'Crear plan de cuotas'
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
