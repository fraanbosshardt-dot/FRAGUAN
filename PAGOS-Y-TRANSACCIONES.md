# FRAGUAN — integridad de pagos y transacciones

Actualizado: 11 de septiembre de 2026.

Este documento define las reglas que deben mantenerse antes de habilitar cobros reales.

## Autoridad del servidor

- El carrito del navegador solo envía identificadores de variantes, cantidades, método de pago, entrega y datos del cliente.
- El servidor vuelve a leer precio online, publicación y stock desde la base. Calcula subtotal, promociones, 10% por transferencia, envío y total usando centavos enteros.
- Ningún subtotal, descuento, costo de envío o total enviado por el navegador se acepta como fuente contable.
- Todos los importes deben ser enteros seguros, no negativos y el total final debe ser positivo.
- El pedido conserva el precio calculado al crearse. Un cambio posterior de catálogo no altera una reserva ya emitida.

## Transferencias

- Cada pedido recibe una referencia `FRG-...` única y un importe exacto.
- Informar un comprobante no acredita dinero ni descuenta stock definitivamente; cambia el pedido a `reported` para revisión.
- Una referencia bancaria no puede asociarse a más de un pedido.
- La confirmación manual existe solo para transferencias. Administración debe ingresar la referencia bancaria y el importe efectivamente acreditado; el servidor exige coincidencia exacta con el total del pedido.
- Una confirmación bancaria firmada también debe coincidir en referencia, estado acreditado, importe y medio de pago.
- Hasta conectar una API bancaria o conciliador autorizado, la transferencia no es totalmente automática: una captura enviada por el cliente nunca constituye por sí sola confirmación de fondos.

## Tarjetas y proveedor de pago

- Administración no puede marcar una tarjeta como pagada manualmente.
- Solo se acredita mediante webhook firmado del proveedor elegido.
- El adaptador actual está preparado para Mercado Pago. Antes de conectar credenciales se definirá si el proveedor final será Mercado Pago o Naranja X y se mantendrá una sola autoridad de cobro por pedido.
- El backend valida la firma, vuelve a consultar el pago al proveedor, exige moneda ARS, estado aprobado, referencia del pedido e importe exacto en centavos.
- Un evento del proveedor de tarjetas no puede acreditar un pedido configurado como transferencia.

## Stock, venta y contabilidad

- Crear el pedido reserva stock sin descontarlo de forma definitiva.
- Acreditar exige que el pedido siga vigente, no esté cancelado y conserve todas sus reservas activas por las cantidades originales.
- Venta online, renglones, pago, movimiento, consumo de reserva, descuento de stock, estado del pedido, puntos, cashback y auditoría se escriben en una transacción atómica.
- El vínculo único entre pedido y venta evita una segunda venta ante reintentos.
- Las referencias y eventos de proveedor son idempotentes. Un reintento no vuelve a vender ni vuelve a descontar stock.

## Antes de producción

1. Configurar credenciales productivas fuera del repositorio y verificar remitentes, webhooks y dominios.
2. Probar importes límite, pago duplicado, demora, rechazo, devolución, contracargo y caída de red con cuentas sandbox.
3. Realizar una compra real de importe pequeño y conciliar pedido, proveedor, venta, caja, stock y devolución.
4. Activar alertas sobre webhooks rechazados, diferencias de importe, referencias ambiguas y pedidos pagados sin venta.
5. Ejecutar conciliación diaria entre pedidos, ventas y liquidaciones del proveedor.
6. Mantener el despliegue bloqueado hasta la aprobación explícita del responsable de FRAGUAN.
