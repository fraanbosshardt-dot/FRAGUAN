import { DatabaseSync } from 'node:sqlite';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { migrate, snapshot, verify } from './database-tools.mjs';
const [action, sourceArg, targetArg] = process.argv.slice(2);
if (
  !sourceArg ||
  !['initialize', 'backup', 'restore', 'verify'].includes(action)
)
  throw new Error(
    'Uso: node scripts/database.mjs initialize|verify RUTA | backup|restore ORIGEN DESTINO',
  );
const source = resolve(sourceArg);
if (action === 'initialize') {
  if (existsSync(source))
    throw new Error('La inicialización requiere un archivo nuevo.');
  const database = new DatabaseSync(source);
  try {
    migrate(database);
    verify(database);
  } finally {
    database.close();
  }
} else if (action === 'verify') {
  if (!existsSync(source)) throw new Error('Base no encontrada.');
  const database = new DatabaseSync(source, { readOnly: true });
  try {
    verify(database);
  } finally {
    database.close();
  }
} else {
  if (!existsSync(source) || !targetArg)
    throw new Error('Se requiere origen existente y destino nuevo.');
  await snapshot(source, resolve(targetArg));
}
console.log(`Operación ${action} completada y verificada.`);
