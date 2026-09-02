# Estado de implementación — versión inicial

## Disponible

- POS responsive, búsqueda y lector de barras por teclado, filtros de categoría, selección de talle/color y cantidades.
- Carrito, cliente básico, medios de pago, cuotas, pago dividido, promociones porcentuales autorizadas, vuelto y validación de importes en servidor.
- Venta atómica con snapshots de precio/costo, pagos, caja, stock, puntos del cliente y auditoría. Reintentos idempotentes y protección de concurrencia.
- Ticket interno imprimible y consulta de ventas. Vendedor limitado a sus propias ventas de los últimos 30 días, configurable entre 1 y 90 por ADMIN.
- Alta de productos y variantes, precios/costos editables por administrador o gerente, stock por variante y ajustes con motivo y auditoría.
- Clientes con compras, gasto y puntos; acumulación de un punto por cada $1.000 por venta, con reversión en devolución completa.
- Proveedores; órdenes de compra en borrador; recepción completa atómica que ingresa stock, actualiza costo y crea deuda.
- Apertura/cierre de caja, efectivo esperado, contado y diferencias. Caja cerrada impide vender o registrar movimientos en esa sesión.
- Gastos, cuentas a pagar con vencimientos y registro de pago, retiros de socios separados de gastos.
- Promociones porcentuales con vigencia y condición por medio de pago; pausa/reactivación.
- Conteos físicos guardados sin aplicar stock; aprobación explícita y rechazo si cambió el stock desde el conteo.
- Devolución total autorizada a administrador/gerente: reversión de stock, caja y puntos, sin duplicar devoluciones.
- Dashboard y reportes básicos de ventas, costos, comisiones, inventario, productos y vendedores; CSV en listados.
- Insights básicos calculados a partir de datos persistidos, sin métricas inventadas.
- ADMIN, GERENTE, VENDEDOR, CAJA y STOCK, alta/desactivación de cuentas; control en servidor y auditoría.
- Configuración de recargos al cliente, comisiones internas, plazos y cuotas de los medios de pago.
- Base demo opcional con 50 productos, variantes, 24 ventas históricas, clientes, proveedor, gastos, compra y obligación pendiente.

## Límites de esta primera versión

- Es un inicio funcional del proyecto; no representa los 36 apartados del brief terminados.
- Los cobros y reintegros se registran manualmente después de comprobarlos en el medio externo. No se envían órdenes de cobro a bancos, terminales ni Mercado Pago.
- Ticket interno: no factura fiscal. Pendiente integración fiscal y numeración legal, así como WhatsApp y comprobantes externos.
- Cambios y devoluciones parciales, saldos a favor y autorizaciones específicas de gerente para ejecutar excepciones desde el perfil vendedor están pendientes. El vendedor no puede devolver ni anular mediante las APIs actuales.
- Club: falta canje, cashback, niveles configurables y segmentación automática; no se presentan esos beneficios como activos.
- Promociones complejas (2x1, segunda unidad, marca/categoría, cumpleaños, cupones) están pendientes.
- Compras: falta envío al proveedor, recepción parcial, estados intermedios, transporte e impuestos. El formulario inicial carga una línea; el servicio y modelo admiten múltiples líneas.
- Inventario: el formulario inicial guarda una variante por conteo; faltan sesiones de conteo masivo, edición y exportación de diferencias.
- Falta carga propia de imágenes, importaciones masivas, etiquetas con códigos, archivos adjuntos y gestión completa de colecciones/ubicaciones.
- Falta conciliación bancaria, saldo bancario real, liquidaciones de prestadores, flujo de fondos completo, gastos recurrentes y gestión avanzada de cheques/eCheq.
- Falta edición general/archivo de registros, reglas de impuestos, métricas comparativas por período, exportación XLSX/PDF, recomendaciones avanzadas y automatizaciones.
- Roles definidos en servidor mediante capacidades. No hay editor de matriz personalizada; la restricción del vendedor no puede ampliarse desde la interfaz.
- La app usa D1/Drizzle y auth de Sites; PostgreSQL/Prisma y cuentas de acceso independientes de ChatGPT no están implementados.

## Validación

Pruebas de integración contra el servidor local para permisos, listas de campos, ventas ajenas, solicitudes manipuladas, idempotencia, stock concurrente y devoluciones; ver script en `app/tests-integration.mjs`. Compilación TypeScript y build de producción.

No se realizó QA visual automatizado con navegador. La herramienta opcional WebMCP para preparar una búsqueda tiene detección de soporte; no se verificó en un contexto WebMCP disponible.

Las imágenes de productos son ilustrativas de Unsplash y se cargan externamente; no representan fotografías verificadas de mercadería real de FRAGUAN.
