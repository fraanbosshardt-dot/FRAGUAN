# Tienda pública

La tienda usa dos servicios del mismo repositorio. Administración y POS siguen
fuera del despliegue público: el proxy devuelve 404 para sus páginas y APIs.

## Vercel: fraguan-store

- Instalación: `npm ci`.
- Compilación: `npm run build:store`.
- Salida: `.vercel/output` (Build Output API de Nitro).
- `FRAGUAN_API_ORIGIN`: origen HTTPS del servicio Railway de la tienda.
- `SITE_ORIGIN`: `https://www.fraguan.com`.
- Variables públicas de acceso a clientes: `NEXT_PUBLIC_GOOGLE_CLIENT_ID`
  y/o `STORE_PASSWORD_AUTH_ENABLED`, coherentes con la API.

Vercel no necesita la URL de PostgreSQL: las lecturas y operaciones de clientes
se reenvían a Railway conservando las cookies de sesión y el Origin.

## Railway: accomplished-adaptation / fraguan-store-api

Configurar el servicio en su panel (los servicios nuevos ya no admiten
`railway.json`). No usar el proyecto de FiscalPyme.

- Compilación: `npm run build:store-api`.
- Inicio: `npm run start:store-api`.
- Comprobación de disponibilidad: `/api/store-health` (ejecuta `SELECT 1`).
- `DATABASE_URL`: `${{Postgres.DATABASE_PRIVATE_URL}}`.
- `DATABASE_POOL_SIZE`: `5`.
- `HOST`: `0.0.0.0`; Railway asigna `PORT`.
- `FRAGUAN_SURFACE`: `store`.
- `SITE_ORIGIN`: `https://www.fraguan.com`.
- No configurar `FRAGUAN_API_ORIGIN` en Railway para evitar un ciclo de reenvíos.

Configurar las credenciales reales de Mercado Pago, Resend y Correo Argentino,
los datos de transferencia y `STORE_EMAIL_VERIFICATION_SECRET` antes de validar
el checkout completo. Consultar `.env.example`. No guardar secretos en Git.
El despliegue no ejecuta migraciones ni importa datos de demostración.

## Validación

Ejecutar TypeScript y ambas compilaciones. Luego verificar catálogo, producto,
cuenta, checkout y seguimiento, más el 404 de `/pos`, `/admin/dashboard`,
`/admin-access`, `/acceso` y `/api/session`. No generar pagos reales para probar
la publicación.
