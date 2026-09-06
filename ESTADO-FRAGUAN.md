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
| Club FRAGUAN | Cashback implementado y probado | Tasas y vencimiento configurables por nivel, acumulación por venta, uso como medio de pago y reversión proporcional en devoluciones sucesivas. Perfil administrativo con saldo vigente, acreditaciones, ticket, origen, vencimiento y beneficios descriptivos. |
| Reposición | Implementada y probada | Recomendaciones por stock mínimo/ideal, ventas netas, cobertura, proveedor y prioridad. |
| Reportes | Implementados y probados | Ventas, líneas, productos, categorías, marcas, proveedores, medios, vendedores, costos, rentabilidad y devoluciones con filtros. |
| Dashboard | Implementado y probado | Ventas confirmadas/parcialmente devueltas, neto, unidades retenidas, costo prorrateado, comisiones, medios de pago y comparaciones Argentina. |
| Auditoría | Funcional | Cambios sensibles, importaciones, stock, ventas, compras, devoluciones, planes y datos maestros registran actor y detalle. |
| Usuarios y permisos | Funcional local | Roles ADMIN, GERENTE, VENDEDOR, CAJA y STOCK con validación server-side; autenticación actual temporal. |

## Pruebas ejecutadas

Pasaron las pruebas unitarias y de integración de reglas comerciales, stock, calendario financiero, planificación, reporting, dashboard, CSV, Club FRAGUAN y seguridad del vendedor. También pasaron `tests-master-data.mjs` y `tests-cashback.mjs`, que cubren CRUD de datos maestros, archivo/reactivación, edición de variante sin stock directo, importación CSV, aislamiento del vendedor, acumulación y reversión de cashback. `npx tsc --noEmit` pasa después de los cambios actuales.

La base usada es una D1 local de demostración bajo `app/.wrangler/`. El script de aplicación manual de migraciones deja el journal de Drizzle sin reconciliar; antes de conectar una base definitiva habrá que generar/aplicar el historial de forma única y verificable.

### Último bloque: cashback y perfil del cliente

- Corregida la segunda y posteriores devoluciones parciales: se descuenta únicamente el incremento proporcional de cada devolución.
- El reintegro de un pago con cashback se conserva separado de la recompensa generada por esa compra. Su nueva vigencia respeta los días configurados en el Club.
- Perfil de cliente con saldo a favor, cashback vigente y últimas 250 acreditaciones, diferenciando compra y reintegro. Los vencidos se identifican como tales y no suman al saldo disponible.
- `tests-cashback-regressions.mjs`: seis escenarios con servicios reales y todas las migraciones sobre SQLite desechable. Incluye devoluciones sucesivas, pago mixto, vencimiento, consumo, reintentos, saldo no negativo y reintegro íntegro en cashback con caja cerrada. No altera la base de demostración.
- TypeScript y compilación de producción verificados. La validación visual final sigue pendiente.
- Regla actual: si la recompensa original ya se gastó, la devolución revierte hasta el saldo remanente de esa recompensa; no crea deuda automática. Debe definirse antes de producción cómo recuperar cashback gastado y si los pagos con cashback deben generar nuevas recompensas.

## Pendientes de negocio

- Club FRAGUAN: canje de puntos, beneficios accionables por canal y comunicaciones automáticas de cumpleaños/promociones.
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

## Actualización — 5 de septiembre de 2026

Este bloque reemplaza los pendientes anteriores cuando se superponen. El sistema continúa en desarrollo local; no está habilitado para operación productiva.

| Entrega | Estado y alcance |
| --- | --- |
| Búsqueda global | Implementada con Ctrl/Cmd-K, enlaces a registros y permisos en servidor. Vendedor excluido de búsqueda administrativa. |
| Tema | Alternancia claro/oscuro persistida en administración y POS. Sin fotos. |
| Exportaciones | CSV, Excel XLSX real con varias hojas e impresión para guardar PDF. Texto tratado como texto para evitar fórmulas inyectadas. |
| Etiquetas | Barras Code39 SVG para códigos compatibles de hasta 24 caracteres. Codificación contrastada con ReportLab; falta probar impresora y lector físicos. |
| Inventario | Conteos de múltiples variantes, edición de borradores, diferencias y exportación. Aprobar aplica stock; aprobado queda congelado. |
| Bancos | Cuentas, saldo contable, movimientos idempotentes y conciliación manual contra importe, fecha y referencia del extracto. No consulta bancos externos. |
| Cheques/eCheq | Registro local, vencimientos, depósito, acreditación, rechazo y cancelación. Vinculación a deuda y pago único al acreditarse. No emite eCheq bancario. |
| Flujo de fondos | Integra saldos bancarios registrados y cheques; reemplaza la deuda vinculada sin duplicarla. Horizontes 7/30/60/90 días. |
| Club y puntos | Catálogo de beneficios, reserva de puntos, entrega y cancelación con restitución única. No modifica automáticamente stock ni genera ventas. |
| Permisos individuales | Administrador puede restringir capacidades del rol. Nunca amplía las capacidades base ni habilita finanzas al vendedor. |
| Proveedores | Historial de compras y rendimiento con ventas netas e inventario actual. |
| Comisiones de vendedores | Tasa configurable y estimación sobre ventas netas de devoluciones. La tasa actual se aplica al período consultado; no es liquidación de sueldos. |
| Comunicaciones | Sugerencias de cumpleaños y reactivación para revisar/copiar. No hay envío automático ni se enviaron mensajes. |
| Fechas de reportes | Corregidos límites del día argentino frente a timestamps UTC. |

### Verificación de este bloque

- TypeScript sin errores y compilación de producción completa.
- 17 escenarios en `tests-operations.mjs`, incluidos los 6 de cashback: canjes, concurrencia protegida por base, cheques, deudas, conciliación, inventario, comisiones, proveedores y fechas.
- Seguridad del vendedor verificada contra servidor local: no recibe costos ni métricas administrativas.
- Calendario, planificación y reporting verificados; integración, administración y reglas avanzadas también ejecutadas durante el bloque.
- XLSX leído por una implementación independiente (openpyxl); barras Code39 contrastadas con ReportLab.
- Sin revisión visual automatizada ni validación física de tickets/etiquetas. Estas pruebas no certifican seguridad productiva.

### Pendientes efectivos para cierre

- QA visual y recorrido integral con dispositivos, impresora y lector de la tienda; accesibilidad y adaptación de las pantallas extensas.
- Compras: condiciones logísticas avanzadas, transporte, impuestos y envío al proveedor.
- Comunicación automática de Club y beneficios integrados a canales externos.
- Definir recuperación de cashback ya gastado al devolver y si pagos con cashback generan nuevas recompensas.
- Migraciones productivas: SQL local aplicado hasta `0010_check_payables.sql`; reconciliar journal de Drizzle y ensayar instalación limpia, respaldo y restauración.
- Base definitiva, Google Login y Vercel al final. El runtime actual es Vinext/Cloudflare D1: Vercel necesita adaptación del almacenamiento y runtime; no alcanza con cargar variables.
- Integración fiscal y APIs de cobro/bancos/mensajería solo cuando se definan. Ticket actual es interno; saldos bancarios son contables registrados.
- Backups, observabilidad, secretos, recuperación y revisión de seguridad antes de datos reales.
