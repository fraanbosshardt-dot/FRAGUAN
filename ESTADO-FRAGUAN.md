# FRAGUAN — Estado del proyecto y continuidad

**Actualizado:** 2 de septiembre de 2026.  
**Estado general:** desarrollo pausado por pedido del propietario; continuar mañana.  
**Entrega actual:** primera versión funcional local, con módulos de demostración. El sistema completo todavía NO está terminado.

## Decisiones vigentes del negocio

1. **No debe haber fotos.** El catálogo debe mostrar texto, variantes, precio y stock. Se retiraron las fotografías del POS y la imagen fotográfica de presentación.
2. Continuar desarrollando los módulos antes de conectar servicios definitivos.
3. **La base de datos definitiva, Google Auth / Google Login, Vercel y las APIs externas se conectarán al final.** No retomar la publicación en Sites como destino final.
4. No volver a pedir confirmación para avanzar con el alcance ya solicitado. Se detiene ahora únicamente porque el propietario pidió continuar mañana.
5. El vendedor solo puede vender y consultar información comercial. Nunca debe recibir costos, márgenes o información administrativa, ni siquiera en respuestas API.

## Resumen de lo creado

| Área | Estado | Qué existe |
| --- | --- | --- |
| Diseño del POS | Creado, con mejoras pendientes | Estética sobria, clara y verde oliva; catálogo y carrito; adaptación a celular; sin fotos. |
| Productos y variantes | Funcional inicial | Alta de producto, alta de variantes, SKU, código de barras, talle, color, precio y stock. |
| Búsqueda y carrito | Funcional | Búsqueda, categorías, lectura de código por teclado, cantidades, eliminación de productos y atajos. |
| Venta y cobro | Funcional inicial | Efectivo, transferencia, tarjetas, QR, cuotas, pago dividido, descuento autorizado, revisión y confirmación. |
| Ticket | Funcional interno | Ticket imprimible y consulta de ventas; todavía no es factura fiscal. |
| Seguridad del vendedor | Implementada y probada en servidor local | Listas explícitas de campos, acceso denegado, ventas propias, precios calculados por servidor. |
| Stock | Funcional inicial | Movimientos con trazabilidad, ajustes con motivo y control de stock negativo. |
| Clientes | Funcional básico | Alta rápida, búsqueda, compras, gasto y puntos para administración; vendedor limitado a datos básicos. |
| Club FRAGUAN | Parcial | Acumulación y reversión de puntos. Faltan niveles, canje, cashback y beneficios. |
| Proveedores | Funcional básico | Alta y listado de contactos y condiciones. |
| Compras | Funcional inicial | Órdenes en borrador, recepción completa, ingreso de stock y generación de cuenta a pagar. |
| Caja | Funcional inicial | Apertura, cierre, efectivo esperado, contado, diferencia y movimientos. |
| Gastos | Funcional básico | Alta, clasificación, listado y movimiento asociado. |
| Cuentas a pagar | Funcional inicial | Vencimientos, importes comprometidos y registro de pagos. |
| Retiros de socios | Funcional básico | Separados de gastos, con motivo y trazabilidad. |
| Promociones | Parcial | Porcentaje, vigencia y medio de pago; activación y pausa. |
| Devoluciones | Parcial | Devolución total por administrador/gerente con reversión de stock, caja y puntos. |
| Inventario físico | Funcional inicial | Guardar conteo sin modificar stock; aprobar después; rechazar si el stock cambió. |
| Dashboard y reportes | Parcial | Ventas, costos, comisiones, inventario, productos, medios de pago y vendedores; exportación CSV en listados. |
| Insights | Parcial | Indicadores básicos derivados de los datos existentes. |
| Usuarios y permisos | Funcional inicial con acceso temporal | Roles y desactivación; falta reemplazar la autenticación temporal por Google al final. |
| Auditoría | Funcional inicial | Registro de ventas, ajustes y acciones administrativas. |
| Flujo de fondos | Pendiente | Se anunció como siguiente módulo; todavía NO está desarrollado. |
| Clasificación automática de clientes | Pendiente | Se anunció como siguiente trabajo; todavía NO está desarrollada. |

**Importante:** “funcional inicial” significa que hay pantallas y lógica local utilizables; no implica cierre de todos los requisitos del brief ni preparación para operar dinero real.

## Datos de demostración

La activación inicial permite crear una base vacía o cargar 50 productos, variantes, 24 ventas históricas, clientes, proveedor, gastos, una compra y una obligación pendiente. Las pruebas locales también crearon ventas y movimientos de prueba. No utilizar estos datos como registros reales del negocio.

Los pagos son registros internos: el sistema todavía no cobra ni reintegra dinero en bancos, terminales o aplicaciones externas.

## Validaciones realizadas

- Compilación de producción de la primera versión: correcta antes del último cambio visual para retirar fotos.
- Tipos TypeScript: comprobados durante el desarrollo; se ejecutó una última comprobación después de retirar las fotos.
- Pruebas de permisos: vendedor rechazado en administración, costos excluidos del catálogo/ticket, acceso a ventas ajenas rechazado.
- Pruebas de ventas: datos manipulados rechazados, reintento sin duplicación, devolución y concurrencia sobre la última unidad.
- Pruebas administrativas: recepción de compra una sola vez, conteo aprobado una sola vez, rechazo de conteo desactualizado, gasto en caja, pago de obligación y cierre de caja.
- Dependencias de producción: última auditoría sin vulnerabilidades reportadas. Persistían cuatro avisos moderados de herramientas de desarrollo.
- No se hizo una revisión visual automatizada con navegador. Pendiente revisar la interfaz sin fotos al retomar.

## Pendientes del negocio

### Operación comercial

- Cambios de talle/color/producto, devoluciones parciales, saldos a favor y autorizaciones específicas del gerente.
- Promociones 2x1, segunda unidad, categoría/marca, cumpleaños, cupones y reglas de combinación.
- Club completo: niveles, cashback, canje, beneficios y criterios configurables.
- Segmentación de clientes, edición completa, historial detallado y observaciones.
- Etiquetas y códigos de barras para imprimir, importación masiva, archivo/edición general de productos y registros.
- Mantener el catálogo **sin fotos**, también en las pantallas nuevas.

### Administración

- Flujo de fondos, saldos y conciliación bancaria, cobros futuros y proyecciones por período.
- Compras con múltiples líneas en la interfaz, recepción parcial, estados intermedios, transporte, impuestos y condiciones.
- Conteos masivos y edición de inventarios.
- Gastos recurrentes, obligaciones en cuotas y gestión completa de cheques/eCheq.
- Reportes con filtros de fecha y comparaciones, rentabilidad detallada, XLSX/PDF y recomendaciones de reposición.
- Reglas de permisos más detalladas para roles administrativos, conservando la restricción absoluta del vendedor.

### Conexiones al final, según la última instrucción

- Base de datos definitiva y migraciones.
- Google Auth / Google Login.
- Vercel.
- Facturación fiscal y APIs bancarias/comerciales si son necesarias.
- WhatsApp y envío de comprobantes si se decide integrarlo.
- Pruebas de extremo a extremo, recuperación, backups y revisión de seguridad antes de operar con datos reales.

## Estado técnico real para retomar

- Proyecto ejecutable: `app/`.
- Requisitos del negocio: `docs/requisitos-sistema.md`, `docs/requisitos-pos.md` y `docs/permisos-vendedor.md`.
- La implementación actual usa **React/TypeScript + Vinext (rutas compatibles con Next), Tailwind, shadcn, D1 local y Drizzle**.
- **Todavía existe autenticación temporal de Sites/ChatGPT. No se eliminó ni se migró a Google.** El pedido de cambiar el enfoque llegó justo antes de la pausa.
- No se instaló Next.js real: solamente se consultó su versión disponible para evaluar la transición.
- No se conectó Google Login ni Vercel, y no se configuró la base definitiva.
- Hay pruebas locales en `app/tests-integration.mjs` y `app/tests-admin.mjs`. Deben adaptarse si cambia la autenticación o el almacenamiento.
- La base local de prueba actual queda bajo `app/.wrangler/`; no borrar ni confundir con datos reales.
- El proyecto ejecutable tiene su propio repositorio Git dentro de `app/`; el repositorio de la carpeta superior contiene los documentos y el lanzador.

### Publicación anterior

Antes del cambio de instrucciones se intentó publicar una versión privada en Sites. **Falló con `incomplete input: SQLITE_ERROR`; no hay publicación exitosa ni URL de entrega.** No repetir el despliegue al retomar: el propietario indicó Vercel al final.

La migración local funcionó, pero no se verificó qué parte llegó a aplicarse remotamente. No reescribir migraciones remotas suponiendo que están vacías. La versión guardada en Sites es anterior al retiro de fotografías y no debe publicarse como entrega actual.

Referencias técnicas del intento anterior, solo para trazabilidad:

- Sitio: `appgprj_6a988fb957508191856c64d2d87d2523`.
- Versión guardada: `appgprj_6a988fb957508191856c64d2d87d2523~appgver_f8568f7706a48191a98ce86661c651f3`.
- Despliegue fallido: `appgdep_6a98909a88548191a28ae154528ddbb1`.
- No guardar tokens ni credenciales en este documento.

## Por dónde continuar mañana

1. Leer este archivo antes de trabajar y respetar las últimas decisiones: **sin fotos; conexiones externas al final**.
2. Arrancar el proyecto local y revisar el catálogo sin fotografías.
3. Separar el acceso/datos de demostración de la integración de producción para poder trabajar sin depender de ChatGPT Login. Definir la transición a Next.js/Vercel sin conectar todavía servicios externos.
4. Desarrollar flujo de fondos y segmentación de clientes, y continuar con los pendientes funcionales de las tablas anteriores.
5. Mantener actualizados los estados “pendiente”, “parcial”, “funcional” y “probado”; no marcar todo como completado por tener una pantalla.

### Arranque del estado actual

Desde la carpeta principal:

```powershell
npm run dev -- --host 127.0.0.1
```

Si el lanzador no reenvía el parámetro, usar:

```powershell
cd app
npm run dev -- --host 127.0.0.1
```

Abrir la URL informada por el servidor. El arranque todavía corresponde al entorno temporal existente; revisar el punto 3 antes de la integración final.
