'use client';

import { navigation } from '@/components/admin-navigation';

const usage: Record<string, string> = {
  dashboard:
    'Revisá ventas, resultados y tareas. Los gráficos y métricas usan los registros del negocio.',
  'online-orders':
    'Revisá pagos y comprobantes. Confirmá transferencias cuando veas el dinero; después pasá a preparación, despacho o entrega. Las tarjetas se confirman con Mercado Pago.',
  'online-catalog':
    'Publicá prendas, editá fotos y textos. Configurá cuotas y campañas temporales con vista previa. El precio web es independiente del local.',
  marketing:
    'Consultá origen de visitas y compras. Creá links UTM y administrá los avisos de abandono de 2 y 24 horas, sus límites y el SEO.',
  sales:
    'Buscá ventas, consultá tickets y registrá devoluciones autorizadas. No vuelvas a cargar como venta una compra online ya pagada.',
  customers:
    'Consultá y actualizá los datos del cliente y su historial. Una cuenta no concede automáticamente beneficios del Club.',
  promotions:
    'Definí condiciones y vigencia de promociones del POS. Las campañas temporales de precios web se administran en Catálogo online.',
  'customer-intelligence':
    'Consultá segmentos y comportamiento de compra. Configurá beneficios solo cuando las reglas del Club estén definidas.',
  'club-rewards':
    'Administrá canjes de beneficios configurados. Club FRAGUAN todavía no está lanzado.',
  communications:
    'Revisá las acciones de comunicación y las opciones disponibles para cada cliente.',
  newsletter:
    'Consultá suscriptores y el estado de emails de pedidos. Prepará y enviá campañas solo a suscriptores activos. Los reintentos de pedidos son automáticos.',
  products:
    'Creá productos y variantes de talle/color. Cargá precio local, precio web y costo; imprimí etiquetas después de guardar. El stock se ajusta con motivo, no editando el precio.',
  storage:
    'Identificá salón, depósito y ubicaciones. Registrá los traslados para conservar trazabilidad.',
  purchases:
    'Creá órdenes de compra y registrá las recepciones reales, incluidas las parciales.',
  suppliers:
    'Mantené datos y condiciones de proveedores para compras y reposición.',
  'stock-movements':
    'Consultá entradas, salidas, ajustes y responsables de cada movimiento.',
  replenishment:
    'Revisá faltantes y sugerencias según mínimos, objetivos y rotación antes de comprar.',
  inventory:
    'Registrá el conteo físico, compará diferencias y aprobá los ajustes una vez revisados.',
  cash: 'Abrí caja con el efectivo inicial, registrá movimientos y cerrá con el efectivo contado. Se conserva quién abrió y cerró.',
  banking:
    'Revisá el destino de cobros y fechas previstas. Compará con movimientos reales de Mercado Pago. La fecha prevista no certifica una acreditación bancaria.',
  expenses: 'Registrá gastos con concepto, importe y categoría del negocio.',
  payables: 'Revisá compromisos registrados y sus vencimientos antes de pagar.',
  'financial-calendar':
    'Consultá vencimientos y compromisos por fecha; mantené actualizados los planes recurrentes.',
  'cash-flow':
    'Consultá fondos previstos a partir de cobros y compromisos registrados. Es una proyección.',
  'personal-finance':
    'Mantené las obligaciones personales separadas de las cuentas operativas del negocio.',
  withdrawals: 'Registrá retiros del dueño separados de los gastos operativos.',
  reports:
    'Elegí fechas y revisá ventas, costos, márgenes y medios de pago. Podés exportar los resultados.',
  insights:
    'Revisá alertas y oportunidades antes de tomar decisiones; dependen de los datos cargados.',
  'seller-commissions':
    'Configurá y revisá comisiones del equipo cuando haya vendedores.',
  users:
    'Administrá integrantes y roles. Los dueños tienen acceso completo; los vendedores operan en POS según sus permisos.',
  settings:
    'Editá medios de pago, destino, comisión y plazo. Mercado Pago · Web usa condiciones separadas de Point. Cambiar aquí no cambia el contrato del proveedor.',
  access:
    'Administrá los controles de acceso disponibles; conservá las cuentas autorizadas y los roles correctos.',
  audit: 'Consultá quién hizo cada operación y cuándo para investigar cambios.',
};

export function AdminAreaGuide() {
  return (
    <section className="panel admin-tool-panel">
      <h2>Guía de administración</h2>
      <p>
        Abrí el área que quieras consultar. Las acciones disponibles dependen de
        tu rol.
      </p>
      {navigation.map(([key, label]) => (
        <details key={key} className="admin-area-guide">
          <summary>{label}</summary>
          <p>{usage[key]}</p>
          <a href={key === 'dashboard' ? '/admin' : `/admin/${key}`}>
            Ir a {label.toLowerCase()} →
          </a>
        </details>
      ))}
    </section>
  );
}
