# FRAGUAN — estado actual

Actualizado: 10 de septiembre de 2026 · PostgreSQL Railway conectado en local y dominio configurado.

Esta es la referencia vigente. Reemplaza las listas históricas de pendientes de versiones anteriores. El historial de cambios se conserva en Git.

## Identidad visual

Logo oficial recibido: isotipo circular negro con monograma `FG` en marfil y logotipo
`FRAGUAN`. Su aplicación está prevista para la tienda online, POS, administración,
comprobantes, emails de Resend, favicon y packaging. La decisión de no usar fotos de
productos se mantiene; el logo es un activo de marca.

La tienda ya aplica la dirección editorial acordada: fondos hueso y crema, carbón como
contraste principal, arena y acero para grandes superficies, y cobre usado de forma puntual.
Los titulares son más grandes y condensados, los textos operativos mantienen tamaños
legibles y el catálogo se compactó a cuatro columnas en escritorio. La especificación
completa está en `BRANDING-FRAGUAN.md`.

## Estado general

Implementación local conectada a PostgreSQL privado en Railway. La tienda, el POS y la administración comparten 66 tablas, datos migrados y reglas transaccionales. En producción, las tres superficies muestran “Próximamente disponible” mediante `VERCEL_ENV=production` (o `FRAGUAN_COMING_SOON=true`) mientras no exista `FRAGUAN_DEPLOY_ENABLED=true`. En local el ecommerce completo está disponible en `/`, junto con POS y administración, para desarrollo. Sin fotografías. El dominio ya está conectado al proyecto de espera de Vercel; Google Login y las demás integraciones externas siguen reservados para la etapa final solicitada.

### Tienda online: estado local terminado

La experiencia local cubre el recorrido completo: navegación editorial, catálogo, búsqueda,
secciones, filtros, ordenamiento, favoritos, agregado rápido, ficha de producto, variantes,
asistente orientativo de talle, carrito, umbral de envío gratis, checkout invitado, cuenta,
edición de datos, Club, pedidos y seguimiento privado. Incluye páginas de envíos, cambios,
pagos, talles, contacto, términos, privacidad y cookies; Botón de arrepentimiento público
con código trazable; Google Sign-In preparado; metadata, datos estructurados de producto,
cabeceras de seguridad, `robots.txt` y sitemap.

La etapa de crecimiento también está implementada en local: colecciones rastreables,
sitemap dinámico, datos estructurados por variante, organización, breadcrumbs y devoluciones;
medición propia bajo consentimiento con embudo y atribución UTM; cupones online conectados
al motor central de promociones; direcciones guardadas; recuperación de carrito; avisos de
reposición; reseñas moderadas; panel `Crecimiento online`; automatizaciones de bienvenida,
navegación, carrito, poscompra y reactivación; skeletons, feedback, transiciones y barra fija
de compra móvil.

El lanzamiento real continúa condicionado a credenciales y servicios externos: base de datos
productiva, Google Auth, Mercado Pago, Correo Argentino, Resend y pruebas físicas.
Hasta autorización explícita, Vercel mantiene solamente “Próximamente disponible”.

## Funciones implementadas

| Área                    | Alcance local                                                                                                                                                                                                                                                                                                                        |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| POS                     | Búsqueda, SKU y código de barras por teclado, categorías, variantes, stock, carrito, cliente básico, promociones autorizadas, cuotas, pago dividido, cotización en servidor y venta atómica. Incluye una cola operativa de pedidos online pagos con preparación, ubicación de prendas, retiro y entrega.                                    |
| Vendedor                | Entrada directa al POS. Solo campos comerciales en APIs, ventas propias recientes, devoluciones autorizadas y preparación de pedidos online pagos. La API operativa omite importes, email, referencias bancarias, atribución, costos, margen, markup y finanzas.                                                                          |
| Productos y stock       | Pantalla unificada con ficha, variantes, edición, archivo/reactivación, costo administrativo, precio, margen, markup, existencias, mínimos/ideales, ubicación, ajuste trazable, etiquetas e importación CSV con vista previa.                                                                                                        |
| Stock                   | Movimientos trazables con historial exportable, motivo, observaciones, usuario, referencia y cantidades anterior/posterior. Reposición sugerida y alertas por demanda/disponibilidad. Conteos multilínea, diferencias y exportación. Aprobación con cantidades vigentes dentro de transacción; la base congela las líneas aprobadas. |
| Precios y medios        | Precio de variante, promociones por medio, recargos configurables, alta/pausa/reactivación de medios y planes de cuotas, comisiones y acreditación estimada. Importes enteros en centavos; visualización sin perder centavos.                                                                                                        |
| Ventas y devoluciones   | Devoluciones parciales/sucesivas/totales, autorización, stock, caja, saldo a favor y cashback. Cambios mediante devolución y nueva venta, usando saldo a favor cuando corresponde.                                                                                                                                                   |
| Clientes                | Perfil completo administrativo, historial, talles/preferencias, segmentos configurables, niveles del Club y saldos.                                                                                                                                                                                                                  |
| Club                    | Puntos, cashback por nivel con vencimiento, catálogo de beneficios, reserva, entrega y cancelación de canjes con restitución única.                                                                                                                                                                                                  |
| Tienda online           | Sitio público sin fotografías de producto, identidad y logo oficial, navegación mobile first, colecciones editoriales, búsqueda, filtros por sección/talle/color/disponibilidad, ordenamiento, favoritos locales, agregado rápido, ficha con variantes y asistente de talle, carrito con progreso de envío gratis, checkout invitado con datos completos de entrega, retiro o Correo Argentino, 10% por transferencia y tarjeta preparada para Mercado Pago. Cuenta con Google Sign-In preparado, pedidos, favoritos, nivel, puntos y cashback. |
| Legales y postventa     | Términos, privacidad, cookies, envíos, pagos, talles, contacto, cambios y devoluciones. Botón de arrepentimiento público y visible sin cuenta, validación de pedido/email, código inmediato, email, evento trazable y visualización desde el pedido administrativo. |
| Pedidos online          | Reserva de stock anti-sobreventa, referencia única de cobro, trazabilidad de prendas/cliente/ubicación, venta conectada, puntos/cashback, estados de preparación, listo para retirar, entrega, despacho, cancelación, página privada de seguimiento, tracking, emails y auditoría. Administración conserva el control completo y POS recibe una vista mínima específica. Catálogo web editable desde administración. |
| Promociones             | Porcentaje, monto fijo, 2x1, segunda unidad, categoría, marca, nivel, cumpleaños, cupones, prioridad y exclusividad. Vigencia hasta medianoche argentina. Reporte de resultado por promoción.                                                                                                                                        |
| Compras                 | Órdenes multilínea, impuestos, transporte, descuentos, vencimiento y condiciones. Entrega prevista, transportista, seguimiento y dirección. Recepción parcial/completa. Pago separado de recepción; una orden recibida y saldada se muestra pagada. Exportación de orden completa.                                                   |
| Proveedores             | Edición/archivo, historial, ventas netas, rentabilidad, capital actual en stock y cumplimiento de entregas con fecha pactada.                                                                                                                                                                                                        |
| Caja                    | Apertura/cierre, movimientos, efectivo esperado/contado y diferencias.                                                                                                                                                                                                                                                               |
| Gastos y retiros        | Gastos, planes recurrentes y retiros de propietarios separados de gastos operativos.                                                                                                                                                                                                                                                 |
| Cuentas a pagar         | Obligaciones, cuotas, vencimientos, calendario financiero y pagos registrados.                                                                                                                                                                                                                                                       |
| Bancos                  | Cuentas y saldos contables, movimientos y conciliación manual contra el extracto.                                                                                                                                                                                                                                                     |
| Flujo de fondos         | Caja, bancos registrados, cobros y obligaciones con proyecciones de 7/30/60/90 días.                                                                                                                                                                                                                                                 |
| Reportes e Insights     | Ventas, líneas, categorías, marcas, proveedores, vendedores, pagos, promociones, devoluciones y stock. Comparaciones por período y datos calculados de registros reales.                                                                                                                                                             |
| Comisiones              | Tasas configurables, estimaciones sobre venta neta de devoluciones y selector de período.                                                                                                                                                                                                                                            |
| Email y newsletter      | Suscripción, bajas, campañas, notificaciones transaccionales y automatizaciones de bienvenida, navegación, carrito, reposición, poscompra y reactivación con Resend. Sin WhatsApp.                                                                                                                                                    |
| Marketing y conversión  | Embudo consentido, UTMs, atribución, cupones online, carritos recuperables, direcciones guardadas, reposición, reseñas verificables y moderadas, interés por producto y facturación por origen. Se vincula con clientes, pedidos, promociones, variantes y stock centrales.                                                              |
| Administración          | Acceso protegido por PIN de seis dígitos y sesión HttpOnly de ocho horas, validado también en APIs administrativas. Menú segmentado por áreas, roles, restricciones individuales que solo quitan capacidades, auditoría, búsqueda global Ctrl/Cmd-K, tablas paginadas, tema claro/oscuro y estados de carga.                                                                   |
| Exportación e impresión | CSV, XLSX real y PDF mediante impresión del navegador. Tickets en documento separado y etiquetas Code39 en tandas de ocho por hoja A4.                                                                                                                                                                                               |
| Recuperación            | Instalación en archivo nuevo, historial de migraciones con hashes, respaldo consistente, verificación y restauración a destino nuevo. Instrucciones en RECUPERACION.md.                                                                                                                                                              |

## Reglas de negocio actuales

- Todo importe monetario persistido usa centavos enteros.
- La venta confirma pagos, caja, stock, cliente y fidelización de forma atómica. Los reintentos protegidos no deben duplicar efectos.
- Cada pedido online reserva stock durante 30 minutos. El pago confirmado crea una sola venta con canal online y vínculo al pedido.
- Cada variante puede tener un precio online propio. Si queda vacío, hereda el precio del local; el POS nunca toma el precio online y un pedido conserva el precio con el que fue creado.
- Los cupones online se validan en el servidor con las promociones centrales y quedan trazados en el pedido y la venta. La medición comercial nunca recibe costos, márgenes, datos completos de tarjeta ni información financiera interna.
- La transferencia usa referencia única e importe exacto. El adaptador de webhook concilia referencia, estado e importe antes de acreditar.
- La confirmación manual se limita a transferencias y exige referencia e importe bancario exacto. Tarjeta se acredita únicamente por webhook firmado de Mercado Pago. Pedidos cancelados, vencidos o sin reserva activa no pueden acreditarse; una referencia de pago no puede reutilizarse.
- El backend valida permisos; los costos nunca forman parte de las respuestas del vendedor. Las reglas completas de integridad monetaria están en `PAGOS-Y-TRANSACCIONES.md`.
- La cola de pedidos del POS usa un endpoint propio. Solo expone pedidos pagos y los datos necesarios para preparar o entregar; los cambios de estado se validan en servidor y quedan asociados al vendedor.
- Un conteo físico no ajusta stock hasta aprobarse; después queda congelado en base.
- Las comisiones son estimaciones usando la tasa actual para el período elegido; no liquidan sueldos.
- Una venta con varias promociones aparece en cada promoción. Esas filas no se suman entre sí; el reporte aclara esta atribución.
- El canje de puntos reserva beneficios; no genera automáticamente una venta o movimiento de mercadería.
- Si se devuelve una venta cuya recompensa de cashback ya fue gastada, se revierte hasta el saldo remanente y no se crea deuda. Actualmente los pagos con cashback pueden generar una nueva recompensa. Revisar esta política comercial antes de producción.
- Los registros bancarios, cobros y pagos son contables/manuales. No ordenan transferencias externas.
- Marcar una orden como enviada cambia el registro local; no envía mensajes al proveedor.
- El ticket es interno y no sustituye la factura fiscal.

## Verificación

- Los escenarios de `tests-operations.mjs` cubren cashback, devoluciones, inventario, movimientos de stock, ubicaciones, bancos, canjes, pagos anticipados, promociones, cuotas, cumplimiento y seguridad de solicitudes.
- Los escenarios de regresión y tienda online verifican reservas, sobreventa, referencia de transferencia, conciliación automática, venta conectada, cuenta, Club, newsletter, seguimiento privado, arrepentimiento, stock y permisos.
- 3 escenarios específicos verifican la cola online del POS, la ausencia de campos financieros, las transiciones válidas, la auditoría del vendedor y el bloqueo de saltos de estado.
- tests-seller-security.mjs contra servidor local, incluyendo altas/pausas de medios prohibidas para vendedor.
- tests-reporting.mjs: totales netos, filtros, productos sin ventas y permisos.
- tests-database-recovery.mjs: instalación limpia, repetición, detección de alteraciones, copia, restauración y conservación de datos.
- La batería completa `tests-*.mjs` pasa, incluidas integración, administración, reglas comerciales, caja, cashback, reportes, recuperación, stock y seguridad del vendedor.
- Lint, TypeScript y compilación de producción pasan; detalles técnicos en IMPLEMENTATION.md.
- XLSX contrastado con openpyxl y Code39 con ReportLab.
- Se realizó QA visual local de la tienda y del acceso administrativo en escritorio y una revisión responsive. Sigue pendiente la prueba física de impresora, lector y terminal del negocio.

## Lo que falta para operar

1. Revisión visual con la sesión y los datos definitivos de POS/Administración, más pruebas de impresora, lector USB y dispositivos del negocio.
2. Conectar autenticación Google con identidades/roles reales.
3. Extraer la API a un servicio Railway para producción y desplegar las interfaces en Vercel solamente cuando exista autorización explícita. La API usará la red privada de Railway hacia PostgreSQL.
4. Mantener las migraciones PostgreSQL incrementales y con checksum. La conexión, importación, recuperación y arquitectura están documentadas en `RAILWAY-DATABASE.md`.
5. Definir política comercial final de cashback, retención de respaldos externos, recuperación y operación.
6. Cargar credenciales productivas de Google Identity Services, Mercado Pago, MiCorreo y Resend, verificar el dominio remitente, configurar webhooks públicos, programar las automatizaciones y probar login/cobros/envíos/emails reales. Conectar factura fiscal y banco directo si se decide integrarlos.
7. Agregar fotografías reales por producto y variante; después habilitar Merchant Center y previsualizaciones sociales con esos activos.
8. Cargar razón social, CUIT, domicilio, email y horario reales del comercio y completar la revisión legal previa a ventas.

## Dominio y Vercel

- Dominio confirmado: `fraguan.com`, administrado con nameservers de Hostinger.
- Proyecto de Vercel asociado: `fraguan-store`.
- `www.fraguan.com` es el dominio principal y apunta al CNAME específico indicado por Vercel.
- `fraguan.com` apunta al registro A indicado por Vercel y redirige con estado 308 a `www.fraguan.com`.
- Se retiró el registro A de estacionamiento de Hostinger que competía con Vercel. Los registros MX, SPF, DKIM y DMARC de `hola@fraguan.com` no se modificaron.
- Los DNS autoritativos y los resolvedores públicos principales ya informan los destinos correctos. La emisión y propagación regional del certificado SSL puede tardar varias horas por el TTL anterior.
- Producción continúa mostrando exclusivamente “Próximamente disponible”. Esta configuración de dominio no autoriza el despliegue de la aplicación real.

## Continuidad

Repositorio: `https://github.com/fraanbosshardt-dot/FRAGUAN`.
Rama de trabajo y respaldo: `main`.
Inicio local: `npm run dev -- --host 127.0.0.1`.
Servidor local disponible durante esta auditoría.
Mantener datos reales fuera del entorno demo hasta completar la puesta en producción.

## Punto de reanudación

Continuar con QA visual local y pruebas de checkout/envío sobre PostgreSQL Railway. Cuando
el usuario habilite la etapa de integraciones, extraer la API al servicio Railway privado,
configurar Google Auth, Mercado Pago, Correo Argentino y Resend, cargar sus variables
secretas y validar nuevamente el certificado de `fraguan.com` una vez finalizada la propagación.

El diseño de referencia queda registrado: inspiración conceptual COS, SSENSE, Zara,
MILFSHAKES y Represent/Fear of God, con identidad propia FRAGUAN. Se mantiene la decisión
posterior de no usar fotos de productos y de no incluir WhatsApp.

## Regla de trabajo vigente

El desarrollo se realiza en local y los cambios se suben a GitHub. No se debe hacer ningún
deploy a Vercel, automático ni manual, hasta recibir autorización explícita del usuario.
El proyecto incluye `ignoreCommand` para que los pushes a GitHub no creen nuevos deploys por
defecto. Para habilitar un lanzamiento se deberá activar expresamente
`FRAGUAN_DEPLOY_ENABLED=true` y revisar la configuración productiva.

## Evolución futura: sucursales y usuarios

La operación actual contempla una sola tienda, una caja y un depósito. A futuro se
incorporará el modelo multi-sucursal con usuarios asignados a una o más tiendas y roles
con alcance por sucursal: vendedor, encargado y administración central. El stock, las
cajas, los pedidos, las transferencias y los reportes podrán filtrarse por tienda o
consolidarse globalmente sin cambiar la operación actual.

## Rol operativo actual

El POS tendrá por ahora un único rol: `VENDEDOR`. Este usuario puede realizar el flujo
completo de venta, consultar información comercial y gestionar únicamente las funciones
operativas autorizadas. La administración continúa separada y protegida. Los roles de
encargado, caja, depósito y alcance por sucursal quedan reservados para una etapa futura.

Cada empleado tendrá un usuario vendedor individual. En la terminal autorizada seleccionará
su nombre e ingresará un PIN personal corto; no se utilizará una cuenta compartida ni será
necesario Google Login para cada vendedor. Todas las ventas y acciones quedarán asociadas a
ese usuario. Google Auth y el PIN administrativo quedan reservados para Administración.
