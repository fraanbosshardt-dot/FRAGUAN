# FRAGUAN — Estado del proyecto y continuidad

**Actualizado:** 5 de septiembre de 2026.
**Estado general:** desarrollo activo local. El producto tiene una base funcional amplia y todavía quedan módulos de operación y conexiones de producción.

## Decisiones vigentes

1. **FRAGUAN no usa fotos.** El catálogo, el POS, la administración y las importaciones trabajan con producto, variante, precio y stock. La migración `0006_master_data_profiles.sql` elimina físicamente la columna fotográfica de `products`; las referencias a `image` en la primera migración son únicamente historial inmutable.
2. La base definitiva, Google Auth / Google Login, Vercel y las APIs externas se conectan al final.
3. El vendedor entra al POS y sólo recibe datos comerciales necesarios. Costos, márgenes, markup, ganancias, comisiones, stock editable, reportes y administración se bloquean en servidor y no se envían en las respuestas del catálogo vendedor.
4. Los estados de esta hoja distinguen lógica implementada, pruebas locales y pendientes de producción.

## Estado funcional

| Área | Estado actual | Evidencia |
| --- | --- | --- |
| POS y venta | Funcional y probado localmente | Búsqueda, variantes, carrito, clientes básicos, medios de pago, cuotas, pago dividido, descuentos autorizados, cotización y ticket interno. |
| Seguridad del vendedor | Implementada y probada | `tests-seller-security.mjs` cubre campos permitidos, URLs/API directas, filtros falsos, roles, ventas propias y rechazo de recursos administrativos. |
| Productos y variantes | Funcional | Alta, edición, SKU, código de barras, talle, color, precio, costo administrativo, stock mínimo/ideal, ingreso y archivo reversible. |
| Datos maestros | Implementados y probados | Productos, clientes y proveedores con campos extendidos, edición, archivo/reactivación, auditoría y listados administrativos. |
| Importación masiva | Implementada y probada | CSV con coma o punto decimal, separador auto-detectado, plantilla, vista previa, validación, create-only/upsert, máximo 200 filas, movimientos de stock trazables y rechazo explícito de columnas de fotos. |
| Etiquetas | Implementadas localmente | Impresión por variante con cantidad configurable, nombre, talle, color, precio, SKU y código de barras en texto; sin imágenes. |
| Stock | Funcional y trazable | Movimientos con motivo, actor, referencia, control de stock negativo y bloqueo de edición directa de stock desde variantes. |
| Ventas y devoluciones | Funcional con alcance avanzado | Devoluciones parciales/totales, autorización de gerente, saldo a favor, reversión de stock/caja/puntos y protección contra reintentos. |
| Promociones | Motor avanzado funcional | Porcentaje, monto fijo, 2x1, segunda unidad, categoría/marca, cupón, cumpleaños, nivel Club, vigencia, días/horarios, prioridad y exclusividad. |
| Compras | Backend y flujo principal funcional | Órdenes con múltiples líneas, estados, recepción completa/parcial, ingreso de stock, costo actualizado y cuenta a pagar. |
| Caja y gastos | Funcional y probado | Apertura/cierre, diferencia, gastos, retiros, pagos de cuentas y movimientos de caja. |
| Flujo de fondos | Implementado y probado | Entradas/salidas históricas, proyección de cobros y obligaciones con saldo acumulado por día. |
| Calendario financiero | Implementado y probado | Gastos recurrentes, obligaciones en cuotas, materialización idempotente, pausa/reactivación y disparo de cuentas pagables. |
| Clientes e inteligencia | Implementado y probado | Segmentos, niveles FRAGUAN/Silver/Gold/Black, métricas, historial, top clientes y configuración de umbrales. |
| Reposición | Implementada y probada | Recomendaciones por stock mínimo/ideal, ventas netas, cobertura, proveedor y prioridad. |
| Reportes | Implementados y probados | Ventas, líneas, productos, categorías, marcas, proveedores, medios, vendedores, costos, rentabilidad y devoluciones con filtros. |
| Dashboard | Implementado y probado | Ventas confirmadas/parcialmente devueltas, neto, unidades retenidas, costo prorrateado, comisiones, medios de pago y comparaciones Argentina. |
| Auditoría | Funcional | Cambios sensibles, importaciones, stock, ventas, compras, devoluciones, planes y datos maestros registran actor y detalle. |
| Usuarios y permisos | Funcional local | Roles ADMIN, GERENTE, VENDEDOR, CAJA y STOCK con validación server-side; autenticación actual temporal. |

## Pruebas ejecutadas

Pasaron las pruebas unitarias y de integración de reglas comerciales, stock, calendario financiero, planificación, reporting, dashboard, CSV y seguridad del vendedor. También pasó `tests-master-data.mjs`, que cubre CRUD de datos maestros, archivo/reactivación, edición de variante sin stock directo, importación CSV y aislamiento del vendedor. `npx tsc --noEmit` pasa después de los cambios actuales.

La base usada es una D1 local de demostración bajo `app/.wrangler/`. El script de aplicación manual de migraciones deja el journal de Drizzle sin reconciliar; antes de conectar una base definitiva habrá que generar/aplicar el historial de forma única y verificable.

## Pendientes de negocio

- Club FRAGUAN completo: cashback, canje, beneficios, vencimientos y reglas configurables desde administración.
- Atajo global Cmd/Ctrl-K y refinamiento de accesibilidad, skeletons y modo oscuro.
- Compras: interfaz de múltiples líneas más completa, estados logísticos, impuestos, transporte y condiciones avanzadas.
- Cheques/eCheq: ciclo de estados, vencimientos, depósitos, rechazos y conciliación bancaria.
- Reportes XLSX/PDF, exportaciones avanzadas y análisis histórico de proveedores.
- Permisos administrativos más granulares y configuración completa de medios/cuentas bancarias.
- Revisión visual automatizada final con navegador y pruebas de extremo a extremo.

## Conexiones reservadas para el final

- Base de datos definitiva y migraciones productivas.
- Google Auth / Google Login.
- Despliegue en Vercel.
- Facturación fiscal, bancos, terminales, WhatsApp y otras APIs únicamente si se decide integrarlas.
- Backups, recuperación, observabilidad y auditoría de seguridad antes de operar con datos reales.

## Cómo continuar

```powershell
cd app
npm run dev -- --host 127.0.0.1
```

Usar siempre el entorno local de demostración mientras se desarrollan los módulos pendientes. No cargar datos reales en esta base.
