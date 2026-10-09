# Revisión de FRAGUAN — 07/10/2026

Este documento conserva la revisión anterior. La auditoría vigente de Admin,
correcciones y límites comprobados del 08/10/2026 están en
[AUDITORIA_ADMIN_2026-10-08.md](docs/AUDITORIA_ADMIN_2026-10-08.md).
El listado actual de pendientes está en NEGOCIO-PENDIENTES.md.

## Alcance y límites

Lectura de tienda, checkout, cuenta, pedidos, catálogo, marketing, caja, ventas,
permisos, consultas SQL y configuración de publicación. Comprobación HTTP de 14
rutas públicas y entradas protegidas, sin crear compras ni modificar stock real.
Pruebas aisladas de POS, caja, métodos de pago, cobros programados, etiquetas,
códigos, acceso, SQL y Resend. No constituye una prueba exhaustiva de cada
formulario con datos productivos. No se enviaron campañas de prueba a clientes.

## Cambios realizados en esta revisión

- Checkout: casillas junto a su texto y operables desde la etiqueta; creación
  con Google dentro del formulario sin recarga. Resumen siempre abierto, sin
  desplegable; importes con dos decimales cuando tienen centavos. Verificación
  por email desde noreply@fraguan.com, con plantilla de código de seis dígitos y
  prueba al destinatario interno desde Admin. Google ya verifica sus cuentas;
  el código sigue correspondiendo a la verificación del checkout.
- Reserva: contador absoluto de vencimiento en checkout y seguimiento, con los
  tokens del tema. Aviso de stock liberado, recuperación con precios/disponibilidad
  actuales y conservación de otros productos del carrito. No reinicia vigencia al
  recargar ni reserva al retomar; la validación final sigue en servidor. Pago
  informado no ofrece repetir compra. Plazo de transferencia aún por definir.
- Retirado el anuncio superior de descuento por transferencia y envíos. El
  cálculo comercial de transferencia permanece como estaba por decisión previa.
- Recuperación: consentimiento separado de analytics; email de cuenta autenticada
  o verificado en checkout. Ya no se toma un email de otro formulario ni se usa
  el email aportado por telemetría como autorización para enviar.
- Dos recordatorios, mínimos de 2 y 24 horas desde actividad; separación entre
  avisos si la primera ejecución llega tarde. Sin cupones o beneficios prometidos.
- Ejecución programada cada cinco minutos en el servidor Railway. No depende de
  Codex. Desactivación y edición de horarios y presupuesto desde Crecimiento online.
- Se omiten pedidos ya creados, bajas y carritos vacíos; cart snapshots con
  consentimiento conservan datos reales. Carritos históricos sin autorización
  verificable no se incorporan automáticamente. Enlaces vencen por inactividad
  de siete días. Máximo dos avisos por carrito/sesión.
- La recuperación consulta precios y disponibilidad actuales, descontando reservas
  activas; no restaura stock ficticio de 20 ni precios históricos del navegador.
- Exclusión de entregas aceptadas y bloqueo compartido para reducir duplicados.
  Error de un carrito no detiene el procesamiento de los siguientes. No se promete
  una transacción atómica entre el proveedor externo y nuestra base de datos.
- Métricas: vistas en navegación interna, conteo de vistas de producto separado de
  agregados al carrito; no se admiten compras inventadas desde el endpoint público.
- Generador de links UTM en Admin. Medición sujeta a aceptación de analytics.

## Pendientes prioritarios detectados

| Prioridad | Evidencia | Riesgo / siguiente trabajo |
|---|---|---|
| Corregido | `lib/sales.ts`, catálogo POS y migraciones `0024` / PostgreSQL `0005` | POS descuenta reservas vigentes al mostrar/cotizar. La base valida disponibilidad al guardar, compartiendo bloqueo de variante con creación de reservas. Un pedido online exige su reserva válida y excluye únicamente la propia; las demás siguen protegidas. |
| Corregido | `lib/document-numbers.ts`, migraciones `0025` / PostgreSQL `0006` | Contadores compartidos, bloqueados dentro de la transacción que guarda el pedido o venta. POS y confirmación online comparten tickets. Se conservan históricos, referencias de transferencia e idempotencia; rollback restaura el contador. Pruebas de servicios aisladas y 6 conexiones SQLite concurrentes (120 tickets y 120 pedidos). PostgreSQL comprobado con PGlite: migración, asignación y rollback; no certifica intercalado de múltiples backends PostgreSQL. |
| Media | `lib/online-store.ts`, preferencia de pago posterior a persistir pedido | Sin Mercado Pago configurado, puede quedar pedido pendiente sin enlace para pagar. Integración pospuesta; controlar disponibilidad del método y ofrecer recuperación/reintento desde Admin. |
| Media | `lib/store-growth.ts`, reseña comprobada por email y orderId | Reforzar prueba de compra con sesión o token del pedido antes de marcar una reseña como verificada. No se observó explotación. |
| Media | Emails aceptados por proveedor | `sent` no significa entregado. Falta webhook de entrega/rebote, cola duradera de reintentos para emails de pedido y reconciliación si proveedor acepta pero falla el registro local. |
| Media | Creación automática de perfiles online | Revisar descripción/material y publicación explícita antes de mostrar prendas reales; no asumir características del producto. |

## CyberMonday

No se encontró campaña temporal completa ni botón de restauración. Existen
promociones y precio online por variante, pero no una instantánea por campaña del
precio anterior, vigencia y restauración. Implementar desde Admin: seleccionar
prendas, guardar precios reales anteriores, vista previa, programar inicio/fin,
restaurar, auditar actor/cambios y proteger modificaciones posteriores. Mostrar
precio anterior real y precio promocional; evitar fabricar una referencia inflada.

## SEO

En lectura pública, las páginas quedaron en `www.fraguan.com` y las etiquetas
canonical/sitemap usan `fraguan.com`. Elegir una versión y alinear redirects,
metadata, sitemap y datos estructurados. Revisar páginas inexistentes que muestran
contenido vacío sin un 404 real, y `lastModified` generado con fecha de consulta.
Revisar mensajes de Club/beneficios no definidos y datos de contacto/origen no
confirmados antes de usarlos como datos estructurados.

Con Search Console: revisar indexación, enviar sitemap de la versión elegida,
inspeccionar home/categoría/producto real, revisar resultados enriquecidos,
rendimiento móvil y consultas. Luego mejorar títulos/descripciones propios, fotos,
enlaces y datos Product/Offer basados en precios y stock reales. No se accedió a
informes privados de Search Console en esta revisión.

Referencia oficial: [URLs para ecommerce y canonical](https://developers.google.com/search/docs/specialty/ecommerce/designing-a-url-structure-for-ecommerce-sites).

## Envíos, crecimiento y automatizaciones

Andreani y Correo Argentino quedan pospuestos: faltan alta/API, dirección de origen
confirmada y embalajes/pesos. Cotización, etiquetas y seguimiento automático deben
integrarse juntos; no presentar una tarifa estimada como respuesta del transportista.

Bienvenida y estados de pedido usan la plantilla existente. Recuperación se agrega
con las condiciones anteriores. Rutinas antiguas de reposición, winback, navegación,
postcompra y nurture no se ejecutan desde el nuevo botón: requieren consentimiento
verificable, baja y reglas reales. Las solicitudes de reposición siguen visibles.
Club, cupones y campañas aún necesitan definición comercial; no se activan descuentos.
Meta Ads y Empresa en Google/Maps conservan prioridad posterior.

## Resend y distribución gratuita

Declarado por el dueño y contrastado con [Resend](https://resend.com/pricing):
3.000 emails/mes, 100/día; Marketing hasta 1.000 contactos. Los actuales envíos
van por `/emails`; bienvenida y recuperación comparten el cupo con pedidos,
aunque tengan remitente `hola@fraguan.com`. No usan todavía `/broadcasts`.

Presupuesto inicial de recuperación: 30 diarios y 900 mensuales, editable desde
Admin. Se posponen recordatorios al alcanzar 80 diarios o 2.400 mensuales de
emails aceptados registrados por esta aplicación. Margen para pedidos y códigos;
no es una reserva garantizada ni un límite global del proveedor. Los contadores
usan día/mes calendario UTC, no necesariamente el período de facturación de
Resend. Envíos externos y aceptación sin registro pueden no contarse; contrastar
siempre con el panel del proveedor. Pedidos no se bloquean por este presupuesto.
Si crece el volumen, contratar manualmente y adaptar los límites; no hay compras
automáticas. Tras contratar un plan en Resend, Admin permite desactivar el margen
gratuito y ajustar presupuestos sin editar código. Las campañas manuales existentes
no reciben una cola nueva aquí.

## Validación

11 pruebas previas aisladas de POS/caja/pagos/accesos/etiquetas/SQL/Resend pasaron.
Nueva `scripts/test-cart-recovery.mjs`: consentimiento verificado, precios reales,
2h/24h, baja, creación de pedido, pausa, exclusión mutua, duplicados, error del
proveedor, presupuesto diario y carrito vacío. TypeScript y lint de archivos
modificados. Builds finales de API Railway y frontend Vercel completados con éxito.
La prueba HTTP pública inicial es anterior
a esta publicación; no certifica las interacciones privadas de Admin.

## Stock compartido — continuación del 07/10/2026

Se conserva stock físico en inventario; POS muestra el disponible sin reservas
vigentes. Reservas vencidas/canceladas dejan de inmovilizar unidades. El guard de
venta protege el guardado aun si el catálogo/cotización quedaron desactualizados;
rollback de ventas, artículos, pagos y movimientos si falta disponibilidad.
Precio online conservado según el pedido y costo validado según variante.
La confirmación de pago consume la reserva dentro de la misma transacción.

Pruebas nuevas: seis escenarios con servicios reales y SQLite descartable,
incluyendo dos llamadas simultáneas y reserva creada después de cotizar.
`scripts/test-shared-stock-postgres.mjs` ejecuta los guards PostgreSQL reales
en un motor local WASM y prueba disponibilidad, reserva propia, vencimiento,
precio y rollback. Este motor tiene una sola conexión: no certifica interleaving
de dos conexiones PostgreSQL productivas. La protección PostgreSQL utiliza
el bloqueo de variante existente en creación de reservas y venta (`FOR UPDATE`).
No se insertan datos ni se hacen cobros de prueba en producción. Las migraciones
solo reemplazan la regla; no alteran cantidades ni ventas históricas.

La suite antigua `tests-cashback-regressions.mjs` contiene fixtures que solicitan
un medio cashback actualmente deshabilitado; al importarla, esas pruebas fallan
por «Medio de pago no disponible». No se reactivó ese medio en producción.
Las nuevas pruebas usan un fixture independiente con los métodos vigentes.
Runtime opcional del test PostgreSQL: `@electric-sql/pglite`, instalado solamente
en `outputs/pg-stock-tests`; no se añade al despliegue ni a dependencias del negocio.

## Revisión del 08/10/2026 — tienda, Administración y POS

Correcciones: los estados `unfulfilled`, `ready_pickup` y `delivered` ahora se muestran correctamente en seguimiento y Mis pedidos. Los talles agotados permanecen en el catálogo, con SIN STOCK y sin permitir elegirlos. No se borraron productos, variantes ni movimientos.

Rendimiento: el encabezado consulta solo la sesión, evitando cargar pedidos, direcciones y beneficios en cada navegación. Admin y operaciones reutilizan los datos iniciales del servidor, evitando una segunda lectura inmediata. No se afirma una mejora porcentual sin medición comparativa.

Comprobaciones aisladas: caja POS, medios de pago, etiquetas, códigos de variantes, autenticación y rutas del personal, consultas PostgreSQL, recuperación de carritos, acreditaciones programadas y numeración concurrente. Guards de stock compartido en PostgreSQL local: reservas, disponibilidad, vencimiento, precio y rollback. Emails de pedidos/bienvenida/verificación probados con proveedor simulado; se corrigió un import faltante en el fixture de Resend, no en el envío productivo. Estados y propiedad de pedidos con email verificado comprobados. No se crearon ventas ni se enviaron emails de prueba en producción.

Entrega: el seguimiento muestra PEDIDO ENTREGADO y el último paso marcado. Para retiro, un operador autorizado registra la entrega desde POS/Admin; queda evento con usuario y fecha y se dispara el email correspondiente. Para domicilio falta la integración con Correo Argentino y no hay hoy una acción equivalente para confirmar entrega manual de un envío despachado. No se debe inferir entrega por el mero paso del tiempo.

Pendientes: seguimiento automático del transportista, cotizaciones reales y embalajes; enlace seguro al seguimiento interno en emails; reducir el peso del CSS global (aprox. 407 KB sin comprimir) y favicon (aprox. 327 KB), y separar recursos de Admin de las rutas públicas. El video ya usa versión móvil, loop silencioso y pausa fuera de pantalla. Las pruebas aisladas no certifican todas las interacciones privadas del Admin/POS con cuentas reales ni la concurrencia de múltiples conexiones PostgreSQL productivas.

## Velocidad — 08/10/2026

- Favicon derivado del mismo logo: JPEG original 327.571 bytes → PNG 64×64 de 5.264 bytes. El logo original se conserva para la organización/SEO y otros usos.
- CSS principal compilado: 407.793 → 363.022 bytes, aproximadamente 11% menos. Se retiró únicamente el import de animate.css sin usuarios (las animaciones FRAGUAN propias permanecen). 234 reglas internas se trasladaron sin cambiar declaraciones a internal-workspace.css, cargado por Admin, POS y acceso del personal. Se compararon todas las reglas originales con las dos hojas resultantes: ninguna perdida.
- Módulo admin-workspace compilado: 500.992 → 143.176 bytes. Los gráficos (327.581 bytes) y Centro financiero (32.030 bytes) usan carga diferida con Suspense; se descargan cuando se renderiza la sección que los necesita. Los gráficos conservan exactamente las opciones y datos previos. No se eliminan funciones.
- Tamaños sin compresión; no son porcentaje de mejora de tiempo total ni Core Web Vitals. La latencia de base de datos/backend y la conexión siguen influyendo.
- TypeScript y builds web/API correctos. Gráfico diferido renderizado en navegador con datos locales descartables y sin desborde. Se mantiene pendiente la prueba integral autenticada de todos los formularios de Admin/POS; no se registraron operaciones reales.
