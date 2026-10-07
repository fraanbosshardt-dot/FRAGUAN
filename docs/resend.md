# Resend — FRAGUAN

Configuración acordada el 07/10/2026:

- Pedidos, sus estados, solicitudes de cambios/devoluciones y códigos de verificación:
  `FRAGUAN <pedidos@fraguan.com>` (`RESEND_FROM`).
- Bienvenida de cuenta nueva, bienvenida a newsletter y marketing:
  `FRAGUAN <hola@fraguan.com>` (`RESEND_MARKETING_FROM`).
- Una API key de Resend con permiso de envío para `fraguan.com`:
  `RESEND_API_KEY`, en los entornos de servidor de Railway (`fraguan-store-api`,
  proyecto `accomplished-adaptation`) y Vercel (`fraguan-store`). Los pedidos y
  cuentas de la tienda se procesan en Railway; campañas y pruebas de Admin en
  Vercel. Configurar ambos remitentes y destinatario interno en ambos servicios.
  Nunca exponer la clave en variables NEXT_PUBLIC ni en código del navegador.
- `RESEND_ORDER_TO`: `hola@fraguan.com`, para avisos de pedidos/solicitudes y pruebas.

## Dominio

`fraguan.com` agregado y verificado en Resend (región São Paulo).
En Hostinger se agregaron el TXT `resend._domainkey` y los CNAME
`rsend` → `rsend-sae1.forge.rmta.net`, `send` → `send.forge.rmta.net`.
Se conservaron los registros de la web y los MX de Hostinger. Recepción en
Resend deshabilitada: los buzones y respuestas entrantes dependen de Hostinger.
Resend como remitente no crea buzones; verificar que `pedidos@fraguan.com`
exista como buzón o alias si se quieren recibir respuestas allí.

## Comportamiento

La bienvenida se envía al crear una cuenta; iniciar sesión en una cuenta existente
no dispara otra bienvenida. Es informativa y no concede beneficios ni promete
Club FRAGUAN. Las campañas requieren suscriptores activos y una acción de envío;
esta configuración no envía una campaña a clientes existentes.
Los emails de newsletter incluyen enlace para dejar de recibir novedades.
Si falta el remitente de marketing, no se usa el de pedidos como reemplazo.
Los envíos aceptados y errores del proveedor se registran en `email_deliveries`.
El estado `sent` indica aceptación por Resend, no certifica entrega a la bandeja.
No se añadió seguimiento de entrega por webhook en esta etapa.

## Validación

`scripts/test-resend-routing.mjs`: pruebas aisladas sin enviar emails reales,
con separación de remitentes, bienvenida, newsletter, baja, falta de configuración
y error del proveedor. TypeScript, lint de archivos modificados y builds.

API key cargada por el titular. El 07/10/2026 el dueño confirmó la recepción
de los emails de prueba en hola@fraguan.com. Nunca guardar la clave en Git.

En Admin → Email y newsletter se muestran los remitentes y hay dos botones
para enviar una prueba al email interno, sin enviar campañas ni crear pedidos.

## Identidad de emails

Plantilla compartida en lib/email-template.ts para todos los envíos existentes.
Usa la paleta real de app/store-design.css: negro #14110f, azul #2440ff,
lavanda #93a3ff, crema #f2eee6 y fondo secundario #e4ded1. Cabecera negra,
franja azul sin promociones prometidas, títulos Anton con fuentes de respaldo,
texto DM Sans/Arial, botón azul y pie con ayuda, cuenta y tienda.
Maquetación con tablas, estilos inline, ancho máximo de 600px y adaptación móvil.
Las fuentes web son una mejora opcional: la lectura no depende de su descarga.
Conserva los enlaces de baja de las campañas y no agrega beneficios de Club.

Vista previa local sin envío: ejecutar node scripts/preview-email.mjs;
genera outputs/fraguan-email-preview.html. Pendiente definir el contenido y
diseño específico de recuperación, promociones y Club con las decisiones reales
del negocio. Bienvenida de cuenta y estados de compra implementados:
pedido recibido (pago aún pendiente), compra confirmada (pago confirmado),
preparación, listo para retirar, despacho y entrega. Incluyen los productos,
variantes, cantidades, subtotal, descuento realmente aplicado, envío y total
guardados en el pedido; no calculan ni conceden promociones nuevas.
El despacho muestra el código cargado y, cuando corresponde a Correo Argentino,
el enlace oficial https://www.correoargentino.com.ar/formularios/e-commerce
para ingresarlo. No inventa URLs individuales ni permite ver pedidos privados
sin autenticación. Andreani y actualizaciones automáticas del transportista
siguen pendientes de integración. Los avisos usan los eventos existentes.
