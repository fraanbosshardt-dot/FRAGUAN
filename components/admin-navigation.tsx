'use client';

import {
  ArrowUpRight,
  BarChart3,
  Boxes,
  CalendarClock,
  ClipboardList,
  Globe2,
  LayoutDashboard,
  Package,
  PackageCheck,
  Plus,
  Receipt,
  RefreshCw,
  ShieldCheck,
  ShoppingBag,
  SlidersHorizontal,
  Sparkles,
  Tag,
  TrendingUp,
  Truck,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { InternalSignOut } from '@/components/internal-sign-out';

export type NavigationItem = readonly [string, string, LucideIcon];
export type NavigationGroup = {
  label: string;
  items: readonly NavigationItem[];
  primaryCount: number;
};

export const navigationGroups: readonly NavigationGroup[] = [
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
      ['banking', 'Bancos', Wallet],
      ['expenses', 'Gastos', Receipt],
      ['payables', 'Cuentas a pagar', CalendarClock],
      ['financial-calendar', 'Calendario financiero', CalendarClock],
      ['cash-flow', 'Flujo de fondos', TrendingUp],
      ['personal-finance', 'Centro financiero', SlidersHorizontal],
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

export const navigation = navigationGroups.flatMap((group) => group.items);

type AdminSession = {
  openAccess?: boolean;
  permissions?: unknown[];
  user?: { name?: string; role?: string };
} | null;

export function AdminSidebar({
  session,
  section,
}: {
  session: AdminSession;
  section: string;
}) {
  const permissions = Array.isArray(session?.permissions)
    ? session.permissions
    : [];
  const userName = String(session?.user?.name ?? 'FRAGUAN');
  const role = String(session?.user?.role ?? '');

  return (
    <aside className="sidebar">
      <a className="wordmark" href="/admin">
        FRAGUAN<span>ADMINISTRACIÓN</span>
      </a>
      <a className="new-sale-link" href="/pos">
        <Plus size={16} /> Nueva venta <ArrowUpRight size={15} />
      </a>
      <nav aria-label="Áreas de administración">
        {navigationGroups.map((group) => {
          const items = group.items.filter(([key]) =>
            permissions.includes(key),
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
                  href={key === 'dashboard' ? '/admin' : '/admin/' + key}
                  className={section === key ? 'active' : ''}
                  aria-current={section === key ? 'page' : undefined}
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
                  <summary>Ver más</summary>
                  {secondary.map(([key, label, Icon]) => (
                    <a
                      key={key}
                      href={key === 'dashboard' ? '/admin' : '/admin/' + key}
                      className={section === key ? 'active' : ''}
                      aria-current={section === key ? 'page' : undefined}
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
        <span className="avatar">{userName[0] ?? 'F'}</span>
        <span>
          {userName.split('@')[0]}
          <small>{role}</small>
        </span>
        {!session?.openAccess && <InternalSignOut />}
      </div>
    </aside>
  );
}
