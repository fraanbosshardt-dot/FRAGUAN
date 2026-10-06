# FRAGUAN — Política obligatoria del rol VENDEDOR

Esta política tiene prioridad sobre cualquier permiso más amplio o ambiguo de los requisitos del sistema y del POS. Sus controles principales están implementados y verificados; la lista final de infraestructura productiva figura al final del documento.

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
- Gastos, cuentas a pagar o retiros de socios.
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

Se permiten campos comerciales adicionales necesarios para buscar y presentar el producto, como SKU, código de barras, marca y categoría. FRAGUAN no utiliza fotos ni URLs de imágenes para productos, variantes, clientes o comprobantes. Las opciones de pago muestran precios finales al cliente, cuotas y descuentos aplicables, nunca comisiones internas, acreditaciones netas o fórmulas de rentabilidad.

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

## Endurecimiento aplicado el 11 de septiembre de 2026

- La sesión de Administración se firma con HMAC-SHA256, queda ligada al usuario interno, vence criptográficamente a las ocho horas y viaja en una cookie `HttpOnly`, `SameSite=Strict` y `Secure` bajo HTTPS. Alterar la cookie, copiarla a otro usuario o superar su vencimiento invalida el acceso.
- En el modo tradicional se requieren un `ADMIN_PIN` de seis dígitos y un `ADMIN_SESSION_SECRET` aleatorio de al menos 32 caracteres. Con `INTERNAL_AUTH_MODE=google`, un dueño activo obtiene la sesión administrativa sólo después de verificar su token de Google, sin PIN adicional; el secreto de firma sigue siendo obligatorio.
- Las APIs administrativas exigen la sesión de Administración ligada al usuario. Google no otorga esa sesión a un vendedor. Clientes y ventas usan un alcance `scope=pos` separado: este solo devuelve datos básicos de clientes y ventas recientes del usuario autenticado. Agregar el parámetro a mano no amplía permisos.
- La identidad temporal basada en encabezados queda cerrada fuera de desarrollo salvo que `INTERNAL_AUTH_TRUST_PROXY=true`. Esa opción solo corresponde al entorno anterior detrás de un proxy confiable; Google Auth con whitelist es ahora el mecanismo interno preparado para Administración y POS.
- Google Auth usa clientes OAuth separados para compradores y personal. El backend verifica la firma RS256 contra las claves públicas de Google, emisor, audiencia específica, vencimiento y email verificado. El acceso interno exige además que el email corresponda a un usuario activo de FRAGUAN y crea una sesión propia firmada de ocho horas; desactivar al usuario corta sus permisos en la siguiente solicitud. En modo Google, ni la contraseña ni los encabezados de identidad permiten entrar. El build de producción cierra el acceso público por defecto.
- Las escrituras exigen origen exacto y JSON, limitan bytes reales aunque falte `Content-Length`, acotan profundidad y cantidad de nodos, y rechazan claves de contaminación de prototipos. Formularios públicos limitan longitud, formato y caracteres de control.
- Inicio de sesión, verificación de email, checkout, newsletter, reposición, reseñas, devoluciones, PIN y webhooks tienen límites por dirección; los objetivos sensibles suman límites por cuenta. El proceso también limita la memoria destinada a esos contadores.
- El login por contraseña queda deshabilitado fuera de desarrollo salvo activación expresa con `STORE_PASSWORD_AUTH_ENABLED=true`. La comparación de contraseña usa tiempo constante y ejecuta una derivación ficticia cuando la cuenta no existe.
- El propietario configurado es el único que puede crear otro ADMIN. No puede desactivarse al propietario, y otro administrador solo puede ser desactivado por ese propietario.
- Los webhooks de Mercado Pago validan HMAC, identificador, ventana temporal, moneda, referencia, estado e importe; después consultan el pago directamente al proveedor antes de acreditar. Las llamadas externas tienen timeout.
- Las páginas privadas y todas las APIs usan `no-store`. Se aplican CSP, HSTS bajo HTTPS, bloqueo de marcos, aislamiento de origen, `nosniff` y política restrictiva de permisos; `TRACE` y `CONNECT` se rechazan.

## Obligatorio antes de producción

1. Cargar la whitelist real del personal, configurar un `INTERNAL_SESSION_SECRET` productivo, activar MFA en las cuentas autorizadas y cerrar definitivamente la autenticación temporal.
2. Generar secretos productivos independientes, rotarlos si alguno fue compartido, guardarlos únicamente en el gestor de secretos y verificar que `.env` no se suba a Git.
3. Colocar rate limiting distribuido y WAF en el borde. El limitador actual vive por instancia y funciona como defensa adicional, pero no coordina múltiples procesos.
4. Restringir PostgreSQL a la red privada de Railway, usar SSL para accesos externos temporales, mínimo privilegio, backups y prueba de restauración.
5. Probar webhooks reales de Mercado Pago, Correo Argentino y Resend en entornos de prueba, con reintentos e importes controlados.
6. Ejecutar pruebas de autorización con cuentas reales de cada rol y una revisión externa antes de habilitar ventas.

Ningún sistema conectado a Internet puede considerarse imposible de vulnerar. Este diseño reduce superficies conocidas, niega por defecto y conserva verificaciones de negocio en el servidor.
