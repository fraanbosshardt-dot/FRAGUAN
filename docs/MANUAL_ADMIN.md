# FRAGUAN — guía para administrar el negocio

La guía de las 33 áreas también está dentro de **Admin → Configuración → Guía
de administración**. Abrí cada título para consultar su uso e ir al área.

## Producto nuevo

En Productos y stock, agregá la prenda y sus variantes de talle/color. Revisá el
costo, precio local y precio web antes de guardar. Los códigos se generan y las
etiquetas quedan disponibles después del guardado. La etiqueta y el POS usan el
precio local. La tienda y su checkout usan el web. El stock es compartido.
Podés cargar o reemplazar la foto desde la edición. Luego completá la publicación
en Catálogo online. Una variante sin stock sigue visible pero no se puede comprar.
Los ajustes de stock se registran con motivo; no son ediciones del precio.

## Venta y caja del local

Abrí caja en POS con el efectivo inicial. Registrá cada venta con su medio de
pago. Efectivo queda en caja; tarjetas Point y transferencias van a Mercado Pago.
Si confirmás una transferencia del local, se considera recibida. Al terminar,
contá el efectivo y cerrá caja. El sistema registra responsables y diferencias.
Los cambios de comisiones y plazos se hacen en Configuración y aplican a nuevos
cobros. Las ventas anteriores conservan las condiciones guardadas.

## Pedido de la web

En Pedidos online consultá pago, referencia y estado. Mercado Pago confirma
tarjetas automáticamente. Una transferencia requiere que verifiques el dinero
recibido y confirmes el pago. Un aviso/comprobante del cliente no es una aprobación.
Pasá a preparación cuando corresponda. Para envío, cargá el seguimiento real y
registrá despacho; confirmá entrega cuando tengas evidencia. El transportista
todavía no actualiza automáticamente el sistema. Para retiro, avisá cuando esté
listo y registrá la entrega. Los pedidos web se pagan online; no hay cobro en
efectivo al retirar. No vuelvas a cargar una venta POS por un pedido ya pagado.

La reserva inicial de una transferencia dura 10 minutos y la de tarjetas 30.
Recargar la página no la renueva. Un pago tardío requiere revisar el pedido y el
stock; no crear otra venta o aprobar algo sin comprobarlo.

## Precios temporales, cuotas y fotos

En Catálogo online configurá CyberMonday: seleccioná variantes, precio tachado
de referencia real, descuento, inicio y fin. Revisá la vista previa antes de
programar. El sistema conserva el precio web previo y permite restaurarlo;
protege cambios manuales hechos después. El precio del local no se modifica.

Las cuotas sin interés están desactivadas. Habilitá su comunicación solo cuando
las condiciones estén confirmadas en Mercado Pago. El control no contrata una
promoción con el proveedor. Fotos originales hasta 3 MB; archivos mayores se
optimizan en alta calidad hasta 3200 px, sin agrandarse.

## Emails y crecimiento

En Email y newsletter revisá número de pedido, asunto, destinatario y estado.
Aceptado por Resend significa recibido por el proveedor; entregado significa
aceptado por el servidor del destinatario, no leído ni garantizado en bandeja.
La cola reintenta automáticamente fallos transitorios. Un rebote o reclamo no se
reenvía automáticamente. Antes de autorizar un reintento manual, verificá que el
aviso no fue aceptado en Resend para evitar duplicados.

En Crecimiento online administrá recuperación a 2 y 24 horas, pausa y presupuesto.
Se requiere consentimiento y email verificado. Crear pedido, vaciar carrito o
darse de baja detiene los avisos. Los límites dejan margen para pedidos y códigos.
Comprobá también consumo total en Resend; no se contrata un plan automáticamente.
Creá enlaces UTM para identificar fuentes y campañas. La medición de navegación
requiere consentimiento. Los informes de Google se consultan en Search Console.

## Dinero, control y permisos

Bancos reúne destinos y fechas previstas de cobros. Compará con movimientos
reales de Mercado Pago; una fecha calculada no confirma disponibilidad bancaria.
Gastos, compras, cuentas a pagar, calendario y flujo usan datos cargados: mantenelos
actualizados. Retiros y Centro financiero separan movimientos del dueño y personales.
Auditoría permite investigar quién cambió algo. Equipo y Permisos administran los
accesos. Los dueños acceden a todo; vendedores operan en POS según autorización.

Antes de cambiar algo importante, revisá el estado y responsable actual. Conservá
exportaciones cuando corresponda, pero una exportación no reemplaza el backup de
PostgreSQL. Las copias, retención y restauración separada siguen pendientes de
configurar en el servicio de base de datos. No restaurar sobre la base operativa.

Club, campañas comerciales, integración de transportistas y comprobantes contables
dependen de decisiones o servicios todavía pendientes. Consultá
NEGOCIO-PENDIENTES.md para su estado vigente.
