# Tienda, POS y Administración

La aplicación usa dos servicios del mismo repositorio en el dominio existente
`https://www.fraguan.com`. El build publica la superficie `business`: tienda,
`/pos` y `/admin`. `/admin-access` y `/admin/dashboard` redirigen al único acceso `/admin`.

**Acceso del personal con Google.** El build usa `FRAGUAN_STAFF_OPEN_ACCESS=false`
por defecto. Railway requiere `INTERNAL_AUTH_MODE=google`, el cliente existente
`INTERNAL_GOOGLE_CLIENT_ID` del personal, `INTERNAL_SESSION_SECRET` y
`ADMIN_SESSION_SECRET` aleatorios de al menos 32 caracteres. No guardar secretos
en el repositorio. Los orígenes autorizados del cliente incluyen
`https://fraguan.com` y `https://www.fraguan.com`.

Google debe verificar el token y el email debe corresponder a un usuario activo
de FRAGUAN. Un dueño recibe también la sesión de Administración, sin pedir PIN;
un vendedor sólo puede entrar al POS. Las sesiones duran ocho horas. El modo
Google deshabilita el login por contraseña y la identidad basada en encabezados.
Las cuentas de clientes usan su cliente OAuth separado y no se alteran.

## Vercel: fraguan-store

- Instalación: `npm ci`.
- Compilación: `npm run build:store`.
- Salida: `.vercel/output` (Build Output API de Nitro).
- `FRAGUAN_API_ORIGIN`: origen HTTPS del servicio Railway de la tienda.
- `SITE_ORIGIN`: `https://www.fraguan.com`.
- Variables públicas de acceso a clientes: `NEXT_PUBLIC_GOOGLE_CLIENT_ID`
  y/o `STORE_PASSWORD_AUTH_ENABLED`, coherentes con la API.

Vercel no necesita PostgreSQL ni secretos de personal: las páginas internas y
sus APIs se reenvían a Railway conservando cookies HttpOnly y el Origin.
Se eliminan los encabezados de identidad/proxy enviados desde el navegador.
Las páginas internas usan `/staff-assets/_next/static/` para cargar también su
JavaScript y CSS desde Railway: los hashes del build Node pueden diferir de los
de Vercel. El proxy conserva esa misma procedencia en HTML, RSC y referencias de
los archivos; los recursos de la tienda continúan en Vercel.

## Railway: accomplished-adaptation / fraguan-store-api

Configurar el servicio en su panel (los servicios nuevos ya no admiten
`railway.json`). No usar el proyecto de FiscalPyme.

- Compilación: `npm run build:store-api`.
- Inicio: `npm run start:store-api`.
- Comprobación de disponibilidad: `/api/store-health` (ejecuta `SELECT 1`).
- `DATABASE_URL`: `${{Postgres.DATABASE_URL}}` (variable existente de este Postgres).
- `DATABASE_POOL_SIZE`: `5`.
- `HOST`: `0.0.0.0`; Railway asigna `PORT`.
- `FRAGUAN_SURFACE`: `business` (también fijado por el build de producción).
- `SITE_ORIGIN`: `https://www.fraguan.com`.
- No configurar `FRAGUAN_API_ORIGIN` en Railway para evitar un ciclo de reenvíos.

Configurar las credenciales reales de Mercado Pago, Resend y Correo Argentino,
los datos de transferencia y `STORE_EMAIL_VERIFICATION_SECRET` antes de validar
el checkout completo. Consultar `.env.example`. No guardar secretos en Git.
El despliegue no ejecuta migraciones ni importa datos de demostración.

## Acceso del propietario sin Google

Ejecutar localmente `powershell -ExecutionPolicy Bypass -File scripts/configure-staff-access.ps1`.
El propietario elige una contraseña de 12 a 128 caracteres y un PIN de 6 dígitos
diferente del PIN local. El script genera `outputs/staff-access.env`, ignorado por Git:
hash PBKDF2-SHA256 con 600.000 iteraciones, dos secretos aleatorios de sesión y PIN.
Agregar esas variables en Railway, servicio `fraguan-store-api`, sin borrar las
variables existentes. No pegarlas en el chat ni en el repositorio.

Con `FRAGUAN_STAFF_OPEN_ACCESS=false`, el login acepta únicamente el email del propietario **existente** en `settings.owner`
y un usuario ADMIN activo. No crea cuentas ni concede permisos. POS requiere esa
sesión; Administración además conserva su PIN. Las sesiones son firmadas, HttpOnly,
Secure y SameSite=Strict. No configurar `INTERNAL_AUTH_TRUST_PROXY=true` ni usar
credenciales de desarrollo en producción. Sin configuración el sistema falla cerrado.

Google continúa disponible solo si se configura expresamente su cliente interno;
el flujo con contraseña no necesita Google. La autenticación pública de clientes
es independiente y no se habilita con estas variables.

## Validación

Ejecutar TypeScript, `node scripts/test-staff-auth.mjs`,
`node scripts/test-staff-access.mjs` y ambas compilaciones.
En modo abierto verificar `/pos`, `/admin`, APIs y redirecciones de los enlaces
anteriores sin cookies. Las escrituras desde otro Origin siguen rechazándose.
Para `scripts/test-staff-routes.mjs` compilar primero la API con
`FRAGUAN_STAFF_OPEN_ACCESS=false`: verifica el modo cerrado, la pantalla de ingreso
unificada, redirecciones, bloqueo de APIs y encabezados falsos.
No generar ventas ni pagos reales para probar.
