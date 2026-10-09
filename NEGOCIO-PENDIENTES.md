# Pendientes vigentes de FRAGUAN

Actualizado: 8 de octubre de 2026. Este listado reemplaza los estados históricos
contradictorios. Las decisiones anteriores se conservan en el historial Git.

## Pendientes externos y comerciales

1. Correo Argentino: cuenta/API, código postal de origen, embalaje, peso y medidas;
   cotización real, etiquetas y seguimiento automático. Andreani pospuesto y fuera
   de las modalidades que se muestran hoy. Preparación: 24 a 48 horas hábiles.
2. Conciliación: obtener movimientos reales de Mercado Pago y contrastar importe,
   comisión, neto y disponibilidad con los registros de Bancos. Las fechas del
   sistema son previstas; no certifican disponibilidad real.
3. Backups PostgreSQL: Railway muestra que crear backups/PITR requiere Pro.
   Elegir y habilitar una solución de copia con retención, y restaurar una copia
   en una base separada. No se comprobó una restauración productiva ni se contrató
   un plan. No restaurar sobre la base que usa el negocio.
4. Club FRAGUAN: definir beneficios, requisitos, niveles, vigencia, canjes y
   condiciones. Crear cuenta no concede beneficios. Sin beneficios se muestra
   «Todavía no tenemos beneficios disponibles para vos».
5. Marketing: definir campañas con ropa e importes reales; cupones, umbral de
   envío gratis y porcentaje de transferencia definitivo. Hoy se conserva 10%.
6. Cuotas: evaluar costos y condiciones del proveedor antes de habilitar cuotas
   con o sin interés. El control de comunicación ya existe; no contrata financiación.
7. Facturas de proveedores/gastos: definir documentación e imputación con las
   categorías reales del negocio. No hay integración contable certificada.
8. Rendimiento: medir en celulares reales y conexiones lentas; las comprobaciones
   responsive de navegador no sustituyen esa medición.
9. SEO: seguimiento de indexación y rendimiento en Search Console. Los títulos,
   descripciones, sitemap, fotos y revisión técnica se administran desde el sistema;
   los informes privados de Google no están sincronizados con Admin.
10. Perfil de Empresa Google/Maps: para el final. Meta Ads: más adelante, sin activar
    publicidad ni presupuestos por esta revisión.
11. Revisar con el cliente el uso real de todos los formularios y su manual. La guía
    de áreas está en Admin → Configuración. Las integraciones externas y backups
    requieren configurar servicios externos; no se presentan como ya completados.

## Implementado y comprobado

- Pagos con Mercado Pago: el dueño confirmó cobro real, pedido pagado y email.
  También informó como probados los pagos pendientes, rechazados y cancelados.
- Web: 3,39% de comisión y 18 días de disponibilidad, independiente de Point;
  editable en Configuración → Mercado Pago · Web. Aplica al total cobrado del
  checkout, incluido envío. Tasas informadas más IVA, sin retenciones; por decisión
  del dueño no se añade un cálculo automático de IVA. Alternativas informadas:
  6,29% inmediato, 4,39%/10 días, 3,39%/18 días, 1,49%/35 días. Cambiar FRAGUAN
  no cambia las condiciones contratadas con el proveedor.
- Point: débito 2,88%/2 días; crédito 4,40%/10 días; prepaga 3,68%/3 días.
  Destino Mercado Pago. Efectivo queda en Caja. Transferencia del local queda
  recibida al confirmar la venta. Solo transferencia online requiere confirmar pago.
- Precios local/POS y web independientes, con stock compartido. Compras anteriores
  conservan sus importes. Sin stock la variante permanece visible, sin compra.
- Reserva nueva: transferencia 10 minutos; tarjetas 30. Pedidos anteriores
  conservan su vencimiento. Agregar al carrito no reserva stock. Cuenta e invitado
  reciben los emails de su pedido; el historial vincula solo emails verificados.
- CyberMonday: referencia tachada editable, descuento, precio final, vista previa,
  programación y restauración de precios web con protección de cambios manuales.
  Probado en SQLite y PostgreSQL aislados; ninguna campaña real activada.
- Resend: pedidos@fraguan.com; bienvenida/marketing hola@fraguan.com;
  verificación noreply@fraguan.com. Cola persistente y reintentos; entregas reales
  del webhook comprobadas en Resend y Admin. Rebotes/fallos probados de forma aislada.
- Abandonos: 2 y 24 horas, consentimiento y email verificado; se detienen al crear
  pedido, vaciar carrito o darse de baja. Administrables desde Crecimiento online.
  Presupuesto inicial 30 recordatorios/día y 900/mes. Límite libre informado:
  3.000 emails/mes, 100/día y 1.000 contactos marketing. Reserva de margen a
  80 envíos/día y 2.400/mes registrados; comprobar consumo total en Resend.
- Fotos desde Admin: original hasta 3 MB; archivos mayores optimizados en alta
  calidad, hasta 3200 px, sin agrandar. Etiquetas Nictom IT02: papel 58 mm,
  impresión 48 mm. Códigos automáticos y autocompletado de valores reales.
- Caja diaria con apertura, cierre y responsables. Auditoría y permisos por rol.
- Auditoría de 33 áreas: alcance y límites en docs/AUDITORIA_ADMIN_2026-10-08.md.

## Decisiones vigentes

Retiro de compras web: pago online y retiro en tienda. Se cancela el pendiente
anterior de habilitar pago en efectivo al retirar; no implementar esa opción.
Todo se cobra por Mercado Pago, efectivo o transferencia según el canal; Payway
queda descartado. No se agrega ni queda pendiente la leyenda de exhibición fiscal.

Local: Sarmiento 785, Isla Verde, Córdoba; lunes a sábado 10:00–12:30 y 16:00–21:30.
Titular Cristian Jesús Bosshardt, CUIT 20-23758108-4; alias fraguan.tienda.ar.
Contacto hola@fraguan.com, sin teléfono ni WhatsApp. Cambios de talle/color: 7 días
corridos, sin uso y con etiquetas, sujeto a stock; diferencia si la nueva prenda
vale más. Se conservan los derechos legales por fallas y arrepentimiento online.
No agregar bordes azules decorativos; mantener la identidad y foco perceptible.
