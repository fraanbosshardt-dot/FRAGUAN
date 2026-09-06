# Implementación FRAGUAN

Consultar `ESTADO-FRAGUAN.md` para la matriz completa, las verificaciones y pendientes. La actualización del 6 de septiembre de 2026 prevalece sobre notas históricas.

## Desarrollo local

Aplicación React/Vinext con rutas de servidor, Drizzle y SQLite/D1 local. Ejecutar `npm run dev -- --host 127.0.0.1`. Sin fotos. Autenticación temporal del entorno; Google Login y base definitiva pendientes.

POS con catálogo textual compacto, variantes, pago dividido, promociones avanzadas, ventas atómicas, devoluciones autorizadas, cashback y ticket interno. Administración protegida por PIN y segmentada por áreas. Productos, variantes, precios y stock comparten una pantalla con ajuste trazable; importación CSV, compras multilínea y recepciones parciales, inventario editable antes de aprobar, caja, gastos, planes financieros, cheques, bancos, reportes, búsqueda global y exportaciones CSV/XLSX/impresión PDF. Club con canje de puntos y sugerencias de comunicación; proveedores con historial, cumplimiento de entrega y comisiones estimadas por vendedor. Reportes incluyen atribución por promoción; compras separan estado logístico, pago y finalización. Configuración permite crear medios y planes de cuotas, pausarlos y reactivarlos.

## Seguridad

Capacidades validadas en servidor. Respuestas del vendedor con lista explícita de campos comerciales; no incluyen costos ni márgenes. Ventas propias y recursos administrativos separados. El ingreso administrativo requiere el PIN configurado y guarda una cookie HttpOnly, SameSite Strict, con vigencia de ocho horas. Restricciones individuales solo quitan capacidades. Operaciones monetarias importantes cuentan con idempotencia, restricciones y auditoría.

## Comprobaciones

`npm run lint`, `npx tsc --noEmit`, `npm run build` y la batería completa `tests-*.mjs` pasan. `node tests-operations.mjs` verifica 24 casos sobre SQLite desechable con todas las migraciones. `node tests-seller-security.mjs` necesita servidor local y también cubre las nuevas mutaciones de medios y el historial de stock. `tests-reporting.mjs` verifica reconciliación y filtros. Las demás suites cubren reglas comerciales, administración, recuperación e integración.

La API verifica los bytes reales de JSON hasta 100.000, incluso sin Content-Length, y diferencia un JSON inválido (400) de un tamaño excesivo (413). Las promociones usan el día argentino para consultar vigencia y el motor comprueba el horario completo. Los conteos aprobados están congelados por triggers. Ver `tests-database-recovery.mjs` y `RECUPERACION.md` para instalación y recuperación verificadas hasta la migración 0013.

La interfaz pagina los listados administrativos y conserva centavos en importes visibles. El historial de stock expone hasta los últimos 1.000 movimientos con observaciones y luego permite filtrar, paginar y exportar. La impresión usa documentos independientes para evitar recortes del modal; las etiquetas se organizan de ocho por hoja. No se ha verificado el diálogo de impresión ni la salida física.

`tests-workbook.mjs` y `tests-barcode.mjs` usan Python con openpyxl y ReportLab; se puede indicar su ejecutable mediante FRAGUAN_TEST_PYTHON. Validan archivos y codificación con lectores independientes. No sustituyen pruebas de impresión física.

## Paso a producción

No desplegado. Reconciliar migraciones manuscritas con journal Drizzle, ensayar base limpia y recuperación, sustituir autenticación temporal, adaptar runtime/almacenamiento para Vercel y verificar permisos con identidades reales. Las credenciales se configuran fuera del repositorio.

Los cheques y movimientos bancarios son registros locales; no mueven fondos externos. Comunicaciones se preparan para copiar, no se envían. Comisiones son estimaciones a tasa actual. PDF se obtiene mediante diálogo de impresión del navegador. La revisión visual y los pendientes comerciales detallados en el estado aún no están cerrados.
