# FRAGUAN — Política obligatoria del rol VENDEDOR

Esta política tiene prioridad sobre cualquier permiso más amplio o ambiguo de los requisitos del sistema y del POS. Describe requisitos de implementación; no implica que exista un backend implementado o verificado.

## Acceso y experiencia

Al iniciar sesión, el vendedor entra directamente a **POS / Nueva venta** (`/pos`). Su navegación contiene solamente las funciones necesarias para vender y una opción secundaria para consultar sus propias ventas recientes. No accede a la navegación administrativa.

El rol VENDEDOR tiene una lista cerrada de capacidades. Todo acceso no permitido expresamente se deniega por defecto. No se pueden sumar permisos administrativos conservando este perfil restringido.

## Funciones permitidas

- Abrir el POS y buscar productos por nombre, código, SKU, código de barras, marca o filtros comerciales.
- Consultar producto, variante, precio al cliente y stock disponible; seleccionar talle y color.
- Agregar o quitar productos del carrito y modificar cantidades dentro de la disponibilidad validada por el servidor.
- Identificar un cliente mediante una búsqueda acotada o crearlo con datos básicos: nombre, apellido y teléfono. DNI solo si se habilita expresamente para esta finalidad.
- Seleccionar medios de pago y cuotas habilitados, consultar el total que paga el cliente, dividir pagos y calcular vuelto.
- Aplicar únicamente descuentos previamente autorizados y vigentes para la operación.
- Finalizar la venta y emitir o reimprimir su ticket/comprobante dentro del alcance autorizado.
- Consultar sus propias ventas recientes cuando sea necesario para cambios o devoluciones autorizadas, sin reportes ni agregados de rendimiento.

La ventana de ventas recientes será una configuración administrativa obligatoria antes de habilitar esta consulta. Hasta definirla, la consulta se deniega; nunca se interpreta como historial ilimitado.

Consultar una venta no autoriza a anularla, cambiarla o devolverla. Cada cambio o devolución necesita autorización específica validada en el servidor. Una operación sobre ventas de otro vendedor corresponde a un usuario con permisos suficientes.

## Información y acciones prohibidas

El vendedor no puede consultar:

- Costos de productos o proveedores, margen, markup, ganancia ni rentabilidad.
- Facturación total del negocio, ventas globales o métricas de otros vendedores.
- Caja total, saldos bancarios, flujo de fondos ni información financiera.
- Gastos, cuentas a pagar, cheques, eCheq o retiros de socios.
- Compras, condiciones internas ni información administrativa de proveedores.
- Reportes generales, dashboards ejecutivos ni auditoría.
- Configuración del sistema, usuarios o permisos.
- CRM completo, historial global del cliente, total gastado, ticket promedio ni segmentación administrativa.

Tampoco puede modificar precios, ajustar manualmente stock, configurar promociones, autorizar sus propios descuentos excepcionales ni administrar caja. Registrar automáticamente el movimiento de caja y stock de una venta no concede acceso a esos módulos.

## Seguridad en el servidor

La interfaz simplificada es una decisión de experiencia de uso. La seguridad se aplica en el backend para páginas protegidas, APIs, acciones del servidor, búsquedas, archivos, exportaciones y comprobantes.

- Validar sesión, rol, capacidad y alcance del recurso en cada operación. Obtener la identidad del vendedor de la sesión verificada, nunca de un ID o rol enviado por el navegador.
- Responder `401` sin autenticación y `403` ante un acceso autenticado no autorizado, sin datos internos en el cuerpo ni en los errores.
- Filtrar las ventas por el vendedor autenticado y la ventana temporal autorizada en el servidor, tanto en listados como en detalles y tickets. Cambiar un ID o un filtro no puede ampliar ese alcance.
- Usar una lista explícita de campos permitidos en consultas y respuestas del POS. No serializar entidades completas del ORM ni eliminar solamente algunos campos mediante una lista de exclusión.
- No enviar datos internos mediante JSON, HTML, propiedades de componentes, datos precargados, respuestas de errores, descargas o suscripciones en tiempo real. No incluirlos en almacenamiento ni cachés del navegador del vendedor.
- Aislar las cachés por identidad y permisos; limpiar el estado privado al cerrar sesión o cambiar de usuario para evitar reutilizar respuestas administrativas.
- Rechazar campos de entrada no permitidos. El backend calcula precios, descuentos, totales, cuotas y disponibilidad; no confía en importes o indicadores de autorización enviados por el frontend.
- La venta confirmada actualiza stock y caja como parte de una transacción atómica, genera trazabilidad y evita duplicados ante reintentos. No permite usar este flujo para ajustes manuales.

Las autorizaciones excepcionales deben provenir de un usuario habilitado y vincularse a la operación concreta: alcance, importe o límite, vigencia y uso. El servidor comprueba esas condiciones al confirmar. Un PIN validado exclusivamente en el navegador o un campo `authorized: true` no constituyen autorización. Autorizar una operación no cambia el rol del vendedor ni expone información administrativa.

## Contrato comercial del POS

Ejemplo de respuesta permitida para una variante:

```json
{
  "variantId": "var_oxford_celeste_l",
  "productName": "Camisa Oxford",
  "color": "Celeste",
  "size": "L",
  "customerPriceMinor": 5990000,
  "currency": "ARS",
  "availableStock": 3
}
```

El dinero se representa en centavos enteros: `5990000` equivale a **$59.900**. La presentación es: **Camisa Oxford / Celeste / L / $59.900 / Stock: 3**.

Se permiten campos comerciales adicionales necesarios para buscar y presentar el producto, como imagen, SKU, código de barras, marca y categoría. Las opciones de pago muestran precios finales al cliente, cuotas y descuentos aplicables, nunca comisiones internas, acreditaciones netas o fórmulas de rentabilidad.

No puede existir `cost`, `margin`, `markup`, `profit`, datos de proveedor ni información equivalente, tampoco dentro de objetos anidados. Esta restricción alcanza catálogo, detalle, carrito cotizado, venta confirmada, ventas recientes y tickets.

## Criterios de aceptación de implementación

1. Una sesión VENDEDOR ingresa a `/pos` y solo recibe navegación comercial.
2. Acceder por URL directa o API a módulos prohibidos devuelve acceso denegado sin datos, aunque se manipule el frontend.
3. Inspeccionar respuestas del catálogo, cotizaciones, ventas y tickets confirma una lista exacta de campos permitidos, incluyendo objetos anidados.
4. Intentar consultar otra venta, su ticket o ventas fuera de la ventana autorizada falla aunque se cambien IDs, filtros o paginación.
5. Enviar precios alterados, descuentos no autorizados, otra identidad de vendedor o campos internos no permite cambiar la operación.
6. Un descuento autorizado deja de aplicarse si vence o si cambia la operación de forma que incumpla su alcance. Cambios y devoluciones sin autorización fallan.
7. Buscar o crear un cliente solo devuelve datos básicos necesarios, sin métricas ni historial global.
8. Iniciar una sesión de vendedor después de una administrativa no recupera datos internos desde cachés o estado previo.
9. Una venta válida sigue funcionando y genera sus movimientos automáticos sin conceder permisos de ajuste de stock o caja.

Estas pruebas deben ejecutarse contra el servidor con sesiones reales de prueba y solicitudes manipuladas. Verificar únicamente botones ocultos no satisface estos criterios.
