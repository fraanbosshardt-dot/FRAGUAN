# Implementación FRAGUAN

Consultar `ESTADO-FRAGUAN.md` para la matriz completa, las verificaciones y pendientes. La actualización del 5 de septiembre de 2026 prevalece sobre notas históricas.

## Desarrollo local

Aplicación React/Vinext con rutas de servidor, Drizzle y SQLite/D1 local. Ejecutar `npm run dev -- --host 127.0.0.1`. Sin fotos. Autenticación temporal del entorno; Google Login y base definitiva pendientes.

POS con variantes, pago dividido, promociones avanzadas, ventas atómicas, devoluciones autorizadas, cashback y ticket interno. Administración con datos maestros, importación CSV, compras multilínea y recepciones parciales, inventario editable antes de aprobar, caja, gastos, planes financieros, cheques, bancos, reportes, búsqueda global y exportaciones CSV/XLSX/impresión PDF. Club con canje de puntos y sugerencias de comunicación; proveedores con historial y comisiones estimadas por vendedor.

## Seguridad

Capacidades validadas en servidor. Respuestas del vendedor con lista explícita de campos comerciales; no incluyen costos ni márgenes. Ventas propias y recursos administrativos separados. Restricciones individuales solo quitan capacidades. Operaciones monetarias importantes cuentan con idempotencia, restricciones y auditoría.

## Comprobaciones

`npx tsc --noEmit` y `npm run build` pasan. `node tests-operations.mjs` verifica 17 casos sobre SQLite desechable con todas las migraciones. `node tests-seller-security.mjs` necesita servidor local. Pruebas adicionales en `tests-*.mjs` cubren reglas comerciales e integración.

`tests-workbook.mjs` y `tests-barcode.mjs` usan Python con openpyxl y ReportLab; se puede indicar su ejecutable mediante FRAGUAN_TEST_PYTHON. Validan archivos y codificación con lectores independientes. No sustituyen pruebas de impresión física.

## Paso a producción

No desplegado. Reconciliar migraciones manuscritas con journal Drizzle, ensayar base limpia y recuperación, sustituir autenticación temporal, adaptar runtime/almacenamiento para Vercel y verificar permisos con identidades reales. Las credenciales se configuran fuera del repositorio.

Los cheques y movimientos bancarios son registros locales; no mueven fondos externos. Comunicaciones se preparan para copiar, no se envían. Comisiones son estimaciones a tasa actual. PDF se obtiene mediante diálogo de impresión del navegador. La revisión visual y los pendientes comerciales detallados en el estado aún no están cerrados.
