# FRAGUAN — guía de uso de Administración

Revisión: 6 de octubre de 2026. Esta guía describe las áreas que existen en el código, siguiendo el orden del menú. Un botón para enviar, cobrar o facturar no significa que el servicio externo ya esté conectado. Las credenciales, comisiones y reglas de FRAGUAN se deben validar antes del uso operativo.

## Cómo se usa el sistema en el día a día

Primero se cargan el equipo, los productos y sus variantes (color y talle), los proveedores, las ubicaciones y los medios de pago. Las compras y los conteos permiten registrar existencias. El POS registra las ventas del local; los pedidos de la web se gestionan en Pedidos online. Caja, Bancos y Gastos sirven para seguir el dinero. Reportes permite revisar lo vendido y los resultados.

Las existencias, las ventas y el dinero son cosas distintas: vender reduce stock, pero un pago con tarjeta puede acreditarse después y tener comisión. Vendido bruto es el importe cobrado de las ventas; el neto descontará comisiones y otros ajustes según la configuración. Los costos de compra de la mercadería afectan el margen, no el importe vendido bruto. Las devoluciones se revisan por separado en los resúmenes correspondientes.

## Todas las áreas del menú

| Grupo / área                              | Ruta                         | Para qué sirve y cómo se usa                                                                                                                                                                                                                                |
| ----------------------------------------- | ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Inicio — Vista general                    | /admin                       | Leer el resumen del negocio, indicadores y avisos. Sirve como punto de partida para detectar ventas, compromisos o stock que requieren atención.                                                                                                            |
| Tienda online — Pedidos online            | /admin/online-orders         | Revisar pedidos de la web, sus productos, datos de entrega y estados de pago y preparación. Abrir cada pedido y realizar las acciones disponibles según su estado. Un pago pendiente no equivale a dinero acreditado.                                       |
| Catálogo online                           | /admin/online-catalog        | Elegir y revisar qué productos se ofrecen en la web y su presentación. Se apoya en los productos y variantes del catálogo del negocio.                                                                                                                      |
| Crecimiento online                        | /admin/marketing             | Consultar actividad de la tienda y datos de seguimiento comercial. Sirve para analizar el recorrido de los compradores; su alcance depende de los eventos registrados y las integraciones habilitadas.                                                      |
| Ventas y clientes — Ventas y devoluciones | /admin/sales                 | Buscar ventas, abrir su detalle, revisar productos y pagos y gestionar devoluciones con los controles del sistema. Es el historial operativo de lo vendido.                                                                                                 |
| Clientes y Club                           | /admin/customers             | Registrar y buscar clientes, consultar su historial y administrar su relación con el Club. La información debe corresponder a clientes reales.                                                                                                              |
| Promociones                               | /admin/promotions            | Crear y gestionar reglas promocionales, vigencias y condiciones. Comprobar la aplicación en POS o tienda según el alcance de cada promoción antes de anunciarla.                                                                                            |
| Segmentos y fidelización                  | /admin/customer-intelligence | Consultar grupos de clientes según su actividad y comportamiento de compra. Ayuda a decidir a quién contactar y qué beneficio ofrecer.                                                                                                                      |
| Canjes del Club                           | /admin/club-rewards          | Administrar recompensas y canjes del programa de fidelización. Las reglas y beneficios deben definirse con FRAGUAN antes de cargar recompensas reales.                                                                                                      |
| Comunicaciones                            | /admin/communications        | Preparar y registrar contactos con clientes. Revisar destinatario y contenido antes de utilizar una acción de contacto; no asumir un envío automático sin comprobar el canal conectado.                                                                     |
| Email y newsletter                        | /admin/newsletter            | Gestionar suscriptores y comunicaciones por email. El envío efectivo depende de la configuración del proveedor de correo.                                                                                                                                   |
| Productos y compras — Productos y stock   | /admin/products              | Crear y editar prendas, categorías, marcas, precios, costos y variantes. Cada combinación de talle y color tiene su identificación y existencias; es la base del POS y del catálogo online.                                                                 |
| Ubicaciones y depósito                    | /admin/storage               | Organizar dónde está la mercadería y gestionar las operaciones de ubicación disponibles. Definir primero los lugares reales: local, depósito u otros sectores.                                                                                              |
| Compras                                   | /admin/purchases             | Registrar compras a proveedores y sus artículos. Revisar el estado de recepción y los pagos; no confundir una compra registrada con mercadería efectivamente recibida.                                                                                      |
| Proveedores                               | /admin/suppliers             | Guardar datos de contacto y condiciones de los proveedores, y consultar la relación de compras y compromisos.                                                                                                                                               |
| Movimientos de stock                      | /admin/stock-movements       | Consultar entradas, salidas y ajustes de mercadería. Sirve para explicar por qué cambió la existencia de una variante.                                                                                                                                      |
| Reposición sugerida                       | /admin/replenishment         | Revisar artículos que requieren reposición según los datos y parámetros disponibles. Usar la sugerencia como ayuda para decidir una compra, no como pedido automático al proveedor.                                                                         |
| Inventario físico                         | /admin/inventory             | Registrar conteos reales de prendas y comparar con el stock del sistema. Revisar diferencias antes de confirmar las acciones que ajustan existencias.                                                                                                       |
| Dinero y compromisos — Caja               | /admin/cash                  | Abrir y cerrar caja, consultar movimientos y comparar lo registrado con el efectivo contado. Definir quién puede operar cada caja y cómo se registran diferencias.                                                                                          |
| Bancos                                    | /admin/banking               | Registrar cuentas y movimientos, transferencias y conciliaciones disponibles. La carga manual no implica conexión automática con un banco ni ejecución de una transferencia real.                                                                           |
| Gastos                                    | /admin/expenses              | Registrar gastos del negocio con sus datos y clasificación, y revisar su impacto en los movimientos financieros. Diferenciar gastos comerciales de retiros personales.                                                                                      |
| Cuentas a pagar                           | /admin/payables              | Llevar compromisos pendientes y registrar sus pagos. Revisar importe, vencimiento y saldo antes de dar una deuda por cancelada.                                                                                                                             |
| Calendario financiero                     | /admin/financial-calendar    | Ver vencimientos y compromisos por fecha. Ayuda a planificar pagos y evitar olvidos.                                                                                                                                                                        |
| Flujo de fondos                           | /admin/cash-flow             | Consultar entradas y salidas de dinero y su evolución. Sirve para planificar disponibilidad; no equivale al margen de las ventas.                                                                                                                           |
| Centro financiero                         | /admin/personal-finance      | Cargar ingresos, gastos, reservas y deudas y comparar escenarios financieros. Incluye información personal y comercial: debe definirse si FRAGUAN quiere usar ambos ámbitos o sólo el negocio. No usar cifras precargadas como datos reales sin validarlas. |
| Retiros de socios                         | /admin/withdrawals           | Registrar dinero retirado por socios o propietarios y consultar su historial. Permite distinguir retiros de gastos del negocio.                                                                                                                             |
| Análisis — Reportes                       | /admin/reports               | Consultar y exportar información operativa y comercial con los filtros disponibles. Seleccionar el período y revisar cómo se presentan bruto, neto, devoluciones y costos antes de comparar resultados.                                                     |
| FRAGUAN Insights                          | /admin/insights              | Consultar análisis y señales generadas a partir de la información del sistema. Las recomendaciones requieren datos reales y revisión de quien toma la decisión.                                                                                             |
| Comisiones del equipo                     | /admin/seller-commissions    | Gestionar y consultar las comisiones de vendedores. **No es la comisión que cobra Mercado Pago por el posnet**: esa corresponde a la configuración de los medios de pago.                                                                                   |
| Sistema — Equipo                          | /admin/users                 | Administrar usuarios, sus roles y su estado activo. Con Google, el email debe coincidir con el de la cuenta habilitada; tener una cuenta de Google no concede acceso por sí solo.                                                                           |
| Configuración                             | /admin/settings              | Revisar parámetros del negocio y medios de pago, incluidos recargos, comisiones, cuotas y días de acreditación. Las tasas de ejemplo no deben tratarse como las condiciones reales de FRAGUAN.                                                              |
| Permisos por usuario                      | /admin/access                | Ajustar las áreas autorizadas de cada usuario dentro de su rol. Usar para distribuir tareas sin dar a todos acceso a información financiera o administración del sistema.                                                                                   |
| Auditoría                                 | /admin/audit                 | Consultar el registro de acciones del sistema, quién las realizó y cuándo. Sirve para investigar cambios; no es una pantalla para modificar las operaciones registradas.                                                                                    |

## POS: el trabajo de venta

En /pos se busca una prenda o se escanea el código de barras, se elige la variante y se agrega a la venta. Se revisan cantidades, cliente y promociones, se cobra con el medio que realmente usó el cliente y se confirma la operación. El resumen permite revisar vendido bruto y su desglose. Cobrar por el posnet de Mercado Pago y registrar ese cobro en POS son acciones distintas mientras el terminal no esté integrado.

Registrar el medio correcto es fundamental: efectivo, transferencia, débito, crédito y cuotas pueden tener costos y fechas de acreditación diferentes. Una comisión de vendedor y una comisión del procesador de pagos deben seguir siendo conceptos separados.

## Roles existentes

La operación definida para FRAGUAN usa **dos roles**: Dueño (Cristian y Fran, acceso completo) y Vendedor (sólo POS, para futuros empleados). El local 1 está en Isla Verde, Córdoba, Argentina; Cristian realiza ventas, compras y control de stock. El ingreso del personal se realiza con Google y exige una cuenta habilitada en Equipo. El dueño entra a Administración y POS sin PIN adicional. Las sesiones duran ocho horas; usar Cerrar sesión al terminar. Los nombres internos históricos que se describen abajo siguen existiendo en el código; no implican que esos roles estén dados de alta ni que haya empleados.

- **ADMIN:** acceso completo a la administración.
- **GERENTE:** gestión comercial, productos, compras, caja y varias áreas financieras y de análisis; no equivale a administrador total del sistema.
- **VENDEDOR:** POS, clientes, sus ventas y operaciones online habilitadas en POS.
- **CAJA:** POS, clientes, sus ventas y caja.
- **STOCK:** productos, stock, depósito, proveedores, compras, inventario y catálogo online.

Los permisos efectivos también pueden restringirse por usuario. Dar de alta un usuario no debe confundirse con crear una cuenta de Google.

## Datos que debemos definir juntos

1. Locales, depósitos y cajas reales; responsables de cada tarea.
2. Emails de Google del propietario y del equipo y sus roles.
3. Productos, categorías, talles, colores, códigos, precios, costos y stock inicial.
4. Proveedores, condiciones de compra y recepción de mercadería.
5. Medios de cobro reales y condiciones del posnet: porcentaje, IVA sobre comisión, retenciones, cuotas, recargos al cliente y días de acreditación. Confirmar qué conceptos se incluyen en cada tasa; no sumar impuestos dos veces.
6. Reglas de descuentos, promociones, Club, canjes y devoluciones.
7. Cuentas, caja inicial, deudas y gastos reales; decidir si se usa el módulo personal del Centro financiero.
8. Integraciones que se habilitarán después: cobros online, emails, envíos y facturación, según las cuentas y servicios que FRAGUAN elija.

## Estado de preparación

La limpieza se ejecutó el 6 de octubre de 2026 sólo sobre la base de FRAGUAN en **accomplished-adaptation**. Se vaciaron y verificaron las 62 tablas operativas, conservando la configuración y las dos cuentas de dueños. El proyecto de FiscalPyme quedó fuera de este trabajo.

Los dueños confirmaron que todos los datos cargados, incluidos gastos y deudas del Centro financiero, eran ejemplos. Se conserva la configuración estructural y se cargaron las cuatro tasas base de Point informadas por el dueño. IVA, retenciones y planes de financiación siguen pendientes de completar. Las filas originales quedaron respaldadas en el esquema privado `fraguan_before_real_setup_20261006` de la misma base. La copia se verificó antes de vaciar los datos operativos en una única transacción. El respaldo no se publica.

### Medios Point informados por el dueño

Estos cuatro medios se configuran en **Configuración → Medios de pago y planes de cuotas**. Usar **Editar** para cambiar comisión, días hasta acreditar, cuotas o recargo; **Pausar/Reactivar** controla si aparecen como disponibles para cobrar. La comisión es costo del negocio; el recargo es un adicional cobrado al cliente y no debe confundirse con ella.

| Medio           | Comisión base, sin IVA ni retenciones | Acreditación | Cuotas configuradas |
| --------------- | ------------------------------------- | ------------ | ------------------- |
| Point · Débito  | 2,88%                                 | 2 días       | 1                   |
| Point · Crédito | 4,40%                                 | 10 días      | 1                   |
| Point · Prepaga | 3,68%                                 | 3 días       | 1                   |
| Point · Pix     | 3,40%                                 | Al instante  | 1                   |

Los valores fueron indicados por el dueño para su cuenta; no se reemplazan por una tarifa genérica publicada en internet. No incluyen IVA ni retenciones. Hasta completar esos conceptos el importe neto del sistema es **estimado**, no una conciliación del dinero efectivamente acreditado. Los planes con interés y los procesadores antiguos que no se confirmaron quedan pausados.

### Códigos y etiquetas

En **Productos y stock → Crear producto** o **Agregar variante**, dejar vacíos SKU y código de barras para asignarlos automáticamente al guardar. Cada variante de talle y color obtiene su propio código interno numérico. Para reimprimir etiquetas se conserva el mismo código, sin generar otro. La opción **Imprimir etiquetas** permite indicar la cantidad y ver nombre, precio, talle, color, SKU y barras.

La impresora confirmada es una **Nictom IT02**, con papel de **58 mm** y ancho de impresión de **48 mm**. Las etiquetas se preparan en una sola columna para el rollo, con 5 mm a cada lado y altura adaptable al contenido. En el controlador elegir papel de 58 mm; en el diálogo de impresión usar escala 100%, sin encabezados ni pies de página. El sistema no ordena un corte automático. Queda pendiente la prueba física de impresión y lectura con la impresora y el lector del local.
