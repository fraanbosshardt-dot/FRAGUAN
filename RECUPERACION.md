# Respaldo y recuperación local

Estas herramientas trabajan sobre archivos SQLite explícitos. No conectan ni reemplazan la base definitiva. Ejecutar desde `app/`, con Node 22.13 o superior.

## Instalación limpia

`node scripts/database.mjs initialize outputs/nueva.sqlite`

El destino debe ser nuevo y su carpeta debe existir. Aplica todos los SQL de `drizzle/` en orden, una transacción por archivo, y registra nombre y SHA-256 en `_fraguan_migrations`. El motor de migración detecta archivos previamente aplicados que fueron modificados. No adopta bases antiguas sin este historial.

Este historial independiente no reconcilia el journal de Drizzle ni habilita `drizzle-kit generate` para producción. No alternar ambos migradores sobre la misma base. La adopción de la demo existente y el adaptador de base definitiva requieren revisión específica.

## Copia consistente

`node scripts/database.mjs backup RUTA_ORIGEN outputs/copia.sqlite`

Usa la API de backup SQLite; verifica integridad y claves foráneas antes y después. Rechaza sobrescribir un destino. Las copias incluyen datos sensibles: conservar fuera de Git, con acceso restringido. `outputs/` está excluido del repositorio. Una copia en el mismo dispositivo no protege contra su pérdida: la política de almacenamiento externo y retención se define para producción.

## Ensayo de recuperación

`node scripts/database.mjs restore outputs/copia.sqlite outputs/restaurada.sqlite`

Restaura a un archivo nuevo y verifica integridad. No sustituye automáticamente la base activa. Comprobar registros y versión de la aplicación antes de un cambio de base planificado.

`node scripts/database.mjs verify outputs/restaurada.sqlite`

`node tests-database-recovery.mjs`

La prueba crea una base temporal, aplica y repite todas las migraciones, verifica detección de alteraciones, inserta un dato, copia y restaura, comprueba su conservación y rechaza sobrescrituras y adopciones sin historial. No toca la demo.
