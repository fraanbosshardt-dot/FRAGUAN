# FRAGUAN · Business Studio

Ver `IMPLEMENTATION.md` y `SECURITY.md` para el alcance y las restricciones del vendedor.

Node.js >=22.13. Instalar con `npm install`. Aplicar la migración local a una base vacía con `npx wrangler d1 execute DB --local --config wrangler.local.jsonc --file drizzle/0000_eager_dexter_bennett.sql` y ejecutar `npm run dev -- --host 127.0.0.1`.

Las migraciones existentes son inmutables después de publicar. Generar nuevas con `npm run db:generate` y conservar los triggers de seguridad.

En producción, Sites autentica la identidad. `BOOTSTRAP_OWNER_EMAIL` debe coincidir con el propietario para permitir la primera activación. `SITE_ORIGIN` establece el origen absoluto de las vistas previas sociales. Copiar `.env.example` a `.env` únicamente para desarrollo; no subir secretos.

La primera activación permite cargar demostración o comenzar vacío. El servidor local admite la identidad de prueba de Sites. La aplicación no define contraseñas ni roles en el navegador.

Pruebas: `npm test` y `node tests-admin.mjs` con la demo local activada y el servidor ejecutándose. Las pruebas modifican datos de demostración. Verificación de tipos: `npx tsc --noEmit`. Publicación: `npm run build`.

El cobro se registra después de verificar el pago externo. El ticket es interno, no una factura fiscal. No se configuraron integraciones bancarias ni fiscales.
