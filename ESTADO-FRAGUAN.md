# FRAGUAN — estado actual

Actualizado: 7 de septiembre de 2026.

Esta es la referencia vigente. Reemplaza las listas históricas de pendientes de versiones anteriores. El historial de cambios se conserva en Git.

## Identidad visual

Logo oficial recibido: isotipo circular negro con monograma `FG` en marfil y logotipo
`FRAGUAN`. Su aplicación está prevista para la tienda online, POS, administración,
comprobantes, emails de Resend, favicon y packaging. La decisión de no usar fotos de
productos se mantiene; el logo es un activo de marca.

## Estado general

Implementación local con datos de demostración. En producción, la tienda, el POS y la administración muestran “Próximamente disponible” mediante `VERCEL_ENV=production` (o `FRAGUAN_COMING_SOON=true`). En local el ecommerce completo continúa accesible en `/tienda`, junto con POS y administración, para desarrollo. Los módulos detallados abajo están desarrollados; las comprobaciones ejecutadas no equivalen a habilitación productiva. Sin fotografías. Base definitiva, Google Login, Vercel e integraciones externas siguen reservados para la etapa final solicitada.

## Funciones implementadas

| Área                    | Alcance local                                                                                                                                                                                                                                                                                                                        |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| POS                     | Búsqueda, SKU y código de barras por teclado, categorías, variantes, stock, carrito, cliente básico, promociones autorizadas, cuotas, pago dividido, cotización en servidor y venta atómica.                                                                                                                                         |
| Vendedor                | Entrada directa al POS. Solo campos comerciales en APIs, ventas propias recientes y devoluciones autorizadas. Sin costos, margen, markup ni finanzas.                                                                                                                                                                                |
| Productos y stock       | Pantalla unificada con ficha, variantes, edición, archivo/reactivación, costo administrativo, precio, margen, markup, existencias, mínimos/ideales, ubicación, ajuste trazable, etiquetas e importación CSV con vista previa.                                                                                                        |
| Stock                   | Movimientos trazables con historial exportable, motivo, observaciones, usuario, referencia y cantidades anterior/posterior. Reposición sugerida y alertas por demanda/disponibilidad. Conteos multilínea, diferencias y exportación. Aprobación con cantidades vigentes dentro de transacción; la base congela las líneas aprobadas. |
| Precios y medios        | Precio de variante, promociones por medio, recargos configurables, alta/pausa/reactivación de medios y planes de cuotas, comisiones y acreditación estimada. Importes enteros en centavos; visualización sin perder centavos.                                                                                                        |
| Ventas y devoluciones   | Devoluciones parciales/sucesivas/totales, autorización, stock, caja, saldo a favor y cashback. Cambios mediante devolución y nueva venta, usando saldo a favor cuando corresponde.                                                                                                                                                   |
| Clientes                | Perfil completo administrativo, historial, talles/preferencias, segmentos configurables, niveles del Club y saldos.                                                                                                                                                                                                                  |
| Club                    | Puntos, cashback por nivel con vencimiento, catálogo de beneficios, reserva, entrega y cancelación de canjes con restitución única.                                                                                                                                                                                                  |
| Tienda online           | Sitio público sin fotografías, catálogo por secciones, búsqueda, filtros, ficha con talle/color/stock, precios online independientes, carrito, checkout, retiro o Correo Argentino, 10% por transferencia y pago con tarjeta preparado para Mercado Pago. Cuenta de cliente con historial, nivel, puntos y cashback.                 |
| Pedidos online          | Reserva de stock anti-sobreventa, referencia única de cobro, trazabilidad de prendas/cliente/ubicación, venta conectada, puntos/cashback, estados de preparación, despacho, cancelación, tracking y auditoría. Catálogo web editable desde administración.                                                                           |
| Promociones             | Porcentaje, monto fijo, 2x1, segunda unidad, categoría, marca, nivel, cumpleaños, cupones, prioridad y exclusividad. Vigencia hasta medianoche argentina. Reporte de resultado por promoción.                                                                                                                                        |
| Compras                 | Órdenes multilínea, impuestos, transporte, descuentos, vencimiento y condiciones. Entrega prevista, transportista, seguimiento y dirección. Recepción parcial/completa. Pago separado de recepción; una orden recibida y saldada se muestra pagada. Exportación de orden completa.                                                   |
| Proveedores             | Edición/archivo, historial, ventas netas, rentabilidad, capital actual en stock y cumplimiento de entregas con fecha pactada.                                                                                                                                                                                                        |
| Caja                    | Apertura/cierre, movimientos, efectivo esperado/contado y diferencias.                                                                                                                                                                                                                                                               |
| Gastos y retiros        | Gastos, planes recurrentes y retiros de propietarios separados de gastos operativos.                                                                                                                                                                                                                                                 |
| Cuentas a pagar         | Obligaciones, cuotas, vencimientos, calendario financiero y pagos registrados.                                                                                                                                                                                                                                                       |
| Bancos y cheques        | Cuentas y saldos contables, movimientos, conciliación manual, cheque/eCheq como registro local, depósito, acreditación/débito, rechazo, cancelación e historial. Cheque vinculado a deuda sin duplicar pago.                                                                                                                         |
| Flujo de fondos         | Caja, bancos registrados, cobros y obligaciones con proyecciones de 7/30/60/90 días.                                                                                                                                                                                                                                                 |
| Reportes e Insights     | Ventas, líneas, categorías, marcas, proveedores, vendedores, pagos, promociones, devoluciones y stock. Comparaciones por período y datos calculados de registros reales.                                                                                                                                                             |
| Comisiones              | Tasas configurables, estimaciones sobre venta neta de devoluciones y selector de período.                                                                                                                                                                                                                                            |
| Email y newsletter      | Suscripción pública, bajas, campañas para suscriptores activos y notificaciones transaccionales de pedidos con Resend. Sin WhatsApp.                                                                                                                                                                                                 |
| Administración          | Acceso protegido por PIN de seis dígitos y sesión HttpOnly de ocho horas. Menú segmentado por áreas, roles, restricciones individuales que solo quitan capacidades, auditoría, búsqueda global Ctrl/Cmd-K, tablas paginadas, tema claro/oscuro y estados de carga.                                                                   |
| Exportación e impresión | CSV, XLSX real y PDF mediante impresión del navegador. Tickets en documento separado y etiquetas Code39 en tandas de ocho por hoja A4.                                                                                                                                                                                               |
| Recuperación            | Instalación en archivo nuevo, historial de migraciones con hashes, respaldo consistente, verificación y restauración a destino nuevo. Instrucciones en RECUPERACION.md.                                                                                                                                                              |

## Reglas de negocio actuales

- Todo importe monetario persistido usa centavos enteros.
- La venta confirma pagos, caja, stock, cliente y fidelización de forma atómica. Los reintentos protegidos no deben duplicar efectos.
- Cada pedido online reserva stock durante 30 minutos. El pago confirmado crea una sola venta con canal online y vínculo al pedido.
- Cada variante puede tener un precio online propio. Si queda vacío, hereda el precio del local; el POS nunca toma el precio online y un pedido conserva el precio con el que fue creado.
- La transferencia usa referencia única e importe exacto. El adaptador de webhook concilia referencia, estado e importe antes de acreditar.
- El backend valida permisos; los costos nunca forman parte de las respuestas del vendedor.
- Un conteo físico no ajusta stock hasta aprobarse; después queda congelado en base.
- Las comisiones son estimaciones usando la tasa actual para el período elegido; no liquidan sueldos.
- Una venta con varias promociones aparece en cada promoción. Esas filas no se suman entre sí; el reporte aclara esta atribución.
- El canje de puntos reserva beneficios; no genera automáticamente una venta o movimiento de mercadería.
- Si se devuelve una venta cuya recompensa de cashback ya fue gastada, se revierte hasta el saldo remanente y no se crea deuda. Actualmente los pagos con cashback pueden generar una nueva recompensa. Revisar esta política comercial antes de producción.
- Los registros bancarios, cheques, cobros y pagos son contables/manuales. No ordenan transferencias ni emiten eCheq externos.
- Marcar una orden como enviada cambia el registro local; no envía mensajes al proveedor.
- El ticket es interno y no sustituye la factura fiscal.

## Verificación

- 25 escenarios en tests-operations.mjs sobre SQLite desechable con todas las migraciones: cashback, devoluciones, inventario, movimientos de stock, ubicaciones, cheques, canjes, pagos anticipados, promociones, cuotas, cumplimiento y seguridad de solicitudes.
- 11 escenarios de regresión y tienda online verifican reservas, sobreventa, referencia de transferencia, conciliación automática, venta conectada, cuenta, Club, newsletter, stock y permisos.
- tests-seller-security.mjs contra servidor local, incluyendo altas/pausas de medios prohibidas para vendedor.
- tests-reporting.mjs: totales netos, filtros, productos sin ventas y permisos.
- tests-database-recovery.mjs: instalación limpia, repetición, detección de alteraciones, copia, restauración y conservación de datos.
- La batería completa `tests-*.mjs` pasa, incluidas integración, administración, reglas comerciales, caja, cashback, reportes, recuperación, stock y seguridad del vendedor.
- Lint, TypeScript y compilación de producción pasan; detalles técnicos en IMPLEMENTATION.md.
- XLSX contrastado con openpyxl y Code39 con ReportLab.
- No se ha realizado QA visual con navegador ni prueba física de impresora/lector. La pregunta para incluir pruebas de navegador quedó planteada.

## Lo que falta para operar

1. Revisión visual completa de POS/administración y pruebas de impresora, lector USB y dispositivos del negocio.
2. Conectar base definitiva y autenticación Google con identidades/roles reales.
3. Adaptar y desplegar en Vercel. La implementación actual usa Vinext/Cloudflare D1; requiere adaptación de runtime y persistencia, no solo variables.
4. Reconciliar el historial Drizzle al elegir base definitiva. La demo local está aplicada hasta 0018_email_newsletter.sql. El migrador con hashes es independiente y no adopta automáticamente la demo.
5. Definir política comercial final de cashback, retención de respaldos externos, recuperación y operación.
6. Cargar credenciales productivas de Mercado Pago, MiCorreo y Resend, verificar el dominio remitente, configurar webhooks públicos y probar cobros/envíos/emails reales. Conectar factura fiscal y banco directo si se decide integrarlos.

## Continuidad

Repositorio: `https://github.com/fraanbosshardt-dot/FRAGUAN`.
Rama publicada: `main` (commit de documentación actual: `18aed33`).
Inicio local: `npm run dev -- --host 127.0.0.1`.
Servidor local detenido al pausar la sesión.
Mantener datos reales fuera del entorno demo hasta completar la puesta en producción.

## Punto de reanudación

Cuando se restablezca el límite diario, continuar en este orden: importar `main` en Vercel,
decidir el runtime definitivo (D1/Cloudflare o una base compatible con Vercel), crear la
base productiva y ejecutar las migraciones hasta `0018`, configurar Google Auth, Mercado
Pago, Correo Argentino y Resend, cargar sus variables secretas, conectar `fraguan.com`,
integrar el logo oficial en `public/` y ejecutar QA visual y pruebas de checkout/envío.

El diseño de referencia queda registrado: inspiración conceptual COS, SSENSE, Zara,
MILFSHAKES y Represent/Fear of God, con identidad propia FRAGUAN. Se mantiene la decisión
posterior de no usar fotos de productos y de no incluir WhatsApp.

## Regla de trabajo vigente

El desarrollo se realiza en local y los cambios se suben a GitHub. No se debe hacer ningún
deploy a Vercel, automático ni manual, hasta recibir autorización explícita del usuario.
El proyecto incluye `ignoreCommand` para que los pushes a GitHub no creen nuevos deploys por
defecto. Para habilitar un lanzamiento se deberá activar expresamente
`FRAGUAN_DEPLOY_ENABLED=true` y revisar la configuración productiva.
