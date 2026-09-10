# FRAGUAN — PostgreSQL en Railway

Actualizado: 10 de septiembre de 2026.

## Estado

La tienda online, el POS y Administración usan el mismo modelo de datos. PostgreSQL de
Railway ya contiene las 66 tablas, los índices, las claves foráneas, 29 reglas
transaccionales y una copia verificada de los datos locales existentes.

En desarrollo local se accede por el túnel SSH privado de Railway. PostgreSQL no necesita
Public Network y ninguna contraseña se guarda en Git, archivos `.env` ni documentación.

## Comandos

Con el túnel abierto y `DATABASE_URL` apuntando a `127.0.0.1`:

```powershell
npm run db:postgres:init
npm run db:postgres:verify
npm run db:postgres:smoke
```

Para importar una base SQLite nueva en un PostgreSQL vacío:

```powershell
npm run db:postgres:import -- RUTA_A_LA_BASE.sqlite
```

El importador rechaza tablas de destino con datos, trabaja en una sola transacción y
verifica después todas las relaciones. No mezcla dos historiales.

## Seguridad e integridad

- El acceso local usa una clave SSH exclusiva y el túnel cifrado de Railway.
- Los importes se guardan en centavos enteros.
- PostgreSQL rechaza conflictos de stock, sobreventa, pagos mal calculados, devoluciones
  superiores a la venta y totales online inconsistentes.
- Las migraciones tienen checksum. Una migración aplicada no puede modificarse; los
  cambios siguientes deben agregarse en un archivo nuevo dentro de `drizzle-postgres`.
- El catálogo del vendedor continúa sin costo, margen ni markup en su respuesta.

## Arquitectura para producción

`DATABASE_PRIVATE_URL` funciona solamente entre servicios del mismo proyecto Railway. Si
las interfaces se publican en Vercel, la opción recomendada es ejecutar la API de FRAGUAN
como servicio privado en Railway y exponer únicamente sus endpoints HTTPS autenticados.
La API se conecta a PostgreSQL por la red privada; tienda, POS y Administración nunca
reciben credenciales de base de datos.

No se habilitará esta arquitectura ni se hará deploy hasta que el responsable de FRAGUAN
lo autorice expresamente.

## Antes de producción

1. Rotar las credenciales de PostgreSQL porque una contraseña fue compartida durante la
   configuración inicial.
2. Crear respaldos automáticos y probar una restauración en una base separada.
3. Ejecutar pruebas sandbox y una compra real pequeña con Mercado Pago, transferencia,
   devolución y conciliación.
4. Configurar alertas de errores de base, webhooks e inconsistencias de pagos.
