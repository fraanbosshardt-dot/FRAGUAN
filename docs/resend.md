# Resend — FRAGUAN

Configuración acordada el 07/10/2026:

- Pedidos, sus estados, solicitudes de cambios/devoluciones y códigos de verificación:
  `FRAGUAN <pedidos@fraguan.com>` (`RESEND_FROM`).
- Bienvenida de cuenta nueva, bienvenida a newsletter y marketing:
  `FRAGUAN <hola@fraguan.com>` (`RESEND_MARKETING_FROM`).
- Una API key de Resend con permiso de envío para `fraguan.com`:
  `RESEND_API_KEY`, únicamente en el backend de Railway, servicio
  `fraguan-store-api`, proyecto `accomplished-adaptation`.
- `RESEND_ORDER_TO`: email interno para avisos de pedidos/solicitudes, pendiente de definir.

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

Pendiente para activar y validar en producción: API key cargada por el titular y
prueba real a un destinatario autorizado. Nunca guardar la clave en Git o en este documento.
