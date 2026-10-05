# POS del diseño entregado

Referencia: `docs/design/fraguan-pos.html` (archivo original conservado).

El POS React conserva el catálogo, variantes, stock, clientes, promociones autorizadas, cupones, cobros divididos, validación del backend, tickets y devoluciones. No utiliza productos ni ventas del JavaScript de demostración.

La presentación utiliza los tonos azules de la referencia, tema claro/oscuro, búsqueda en cabecera y tarjetas compactas. F2 enfoca el buscador y F4 abre el cobro (F8 también continúa funcionando). En celular el carrito se despliega desde su cabecera y deja el total y Cobrar visibles.

La pestaña Hoy consulta todos los tickets del vendedor del día en Argentina (UTC−3), sin el límite de 50 tickets del historial reciente, y sus cobros agrupados por medio. El resumen identifica devoluciones y expresa los importes antes de reintegros; no sustituye un cierre contable de caja. Se puede imprimir.

El descuento de la maqueta se conecta a las promociones porcentuales autorizadas. Las demás promociones y cupones siguen disponibles en Cobrar; el backend valida y muestra el importe final antes de confirmar.

El ticket animado sale exclusivamente de una venta confirmada o un ticket consultado, con productos, subtotal, descuento, total y medios de pago reales. Se respeta la preferencia de movimiento reducido.
