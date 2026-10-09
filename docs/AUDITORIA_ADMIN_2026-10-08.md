# Auditoría de Admin — 8 de octubre de 2026

## Alcance comprobado

Se inició sesión con una cuenta dueña y se recorrieron las 33 áreas del menú:
Vista general; Pedidos online; Catálogo online; Crecimiento online; Ventas y
devoluciones; Clientes y Club; Promociones; Segmentos y fidelización; Canjes del
Club; Comunicaciones; Email y newsletter; Productos y stock; Ubicaciones y
depósito; Compras; Proveedores; Movimientos de stock; Reposición sugerida;
Inventario físico; Caja; Bancos; Gastos; Cuentas a pagar; Calendario financiero;
Flujo de fondos; Centro financiero; Retiros; Reportes; Insights; Comisiones del
equipo; Equipo; Configuración; Permisos por usuario; Auditoría.

Se comprobaron encabezados, controles visibles, tablas y alertas en el navegador
autenticado, con ancho disponible de 674 px. Productos se comprobó también a
1280 px y se abrió el formulario de variante sin guardar datos. No hubo alertas
de carga, controles cortados ni desbordamiento horizontal de la página en el
recorrido. Las tablas extensas conservan desplazamiento dentro de su contenedor.
Los controles reutilizados de fotos, cuotas, CyberMonday, emails y SEO se
inspeccionaron en una maqueta local con iframes de 320, 390 y 768 px: no
desbordaron ni se cortaron los textos de botones y selectores. Esto es una
comprobación de navegador; no una medición en teléfonos físicos.

## Correcciones

- Confirmación de transferencias informadas: el estado `reported` conservaba la
  reserva pero el guardado transaccional solo aceptaba `pending`. Se admiten
  ambos estados con la reserva propia activa y no vencida. Se conserva la
  protección ante ventas concurrentes, importes incorrectos y falta de stock.
- Fechas de gráficos: PostgreSQL puede devolver una fecha como ISO completo.
  Las etiquetas y ayudas ahora muestran día/mes, en lugar de fragmentos ISO.
- Emails: la cola muestra número de pedido y asunto legible, en lugar de UUID
  y código técnico de plantilla. Los permisos y reintentos no cambian.
- Importes de Admin: los valores con centavos muestran dos decimales.
- Guía de áreas disponible dentro de Configuración, sin credenciales ni datos
  de clientes. No habilita funciones pendientes ni cambia permisos.

## Evidencia y pruebas

Resend y Admin muestran eventos reales entregados para el pedido #1009. El
webhook respondió HTTP 200 con `ok: true`. No se generaron rebotes ni fallos
reales a clientes para probarlos: firmas, duplicados y estados terminales se
probaron en una base aislada. Recuperación automática configurada a 2 y 24
horas; al actualizar el panel se observó avanzar la última ejecución sin errores.

Pasaron 54 pruebas de tienda, pedidos, operaciones, cashback y stock compartido.
Los fallos históricos de cashback correspondían a una preparación de pruebas
que no activaba el medio usado por ese escenario. Se corrigió solo esa base
aislada; Club y cashback no se activaron en producción. El fallo de transferencia
sí requirió corregir el sistema. La suite HTTP de vendedores requiere su servidor
local y no se contabiliza como validada por esas 54 pruebas.

Pasaron además las pruebas aisladas de caja POS, comisiones web (3,39%/18 días,
Point separado), recuperación de carritos, remitentes Resend y herramientas de
Admin. PostgreSQL aislado validó migraciones, almacenamiento de fotos, campañas,
restauración de precios y reservas. CyberMonday está implementado y probado:
referencia editable, porcentaje, vista previa, programación y restauración con
protección de cambios manuales posteriores. No se activó una campaña real.

## Límites que siguen abiertos

- No se guardaron formularios ni se generaron pedidos, cobros, emails o stock
  artificiales en producción. Por eso no se certifica cada combinación posible
  de datos en cada formulario ni todos los estados comerciales futuros.
- Conciliación: el sistema calcula estimaciones con la configuración; no se
  obtuvo un extracto real de Mercado Pago para compararlo movimiento por movimiento.
- Backups: la pantalla de Railway indica que crear backups/PITR requiere Pro.
  No quedó comprobada una copia restaurable con retención configurada. No se
  contrató un plan ni se restauró sobre la base operativa. Una prueba de restauración
  productiva debe hacerse en una base separada después de disponer de una copia.
- Telefonía real y conexiones lentas: pendiente de medición; el navegador usado
  no ofrece una emulación efectiva de red. No se atribuyen tiempos inventados.
- Correo Argentino y seguimiento automático siguen pendientes de cuenta/API,
  origen y embalaje. La información y estados manuales ya están disponibles.
