import { DatabaseSync, backup } from 'node:sqlite';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';

export function migrations() {
  return readdirSync(resolve('drizzle'))
    .filter((name) => /^\d{4}_.+\.sql$/.test(name))
    .sort()
    .map((name) => {
      const sql = readFileSync(resolve('drizzle', name), 'utf8');
      return {
        name,
        sql,
        hash: createHash('sha256')
          .update(sql.replaceAll('\r\n', '\n'))
          .digest('hex'),
      };
    });
}
export function migrate(database) {
  database.exec('PRAGMA foreign_keys=ON');
  const existing = database
    .prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
    )
    .all();
  if (
    existing.length &&
    !existing.some((row) => row.name === '_fraguan_migrations')
  )
    throw new Error(
      'Base existente sin historial verificable. No se adopta automáticamente; usar una base nueva y migrar los datos con revisión.',
    );
  database.exec(
    'CREATE TABLE IF NOT EXISTS _fraguan_migrations(name TEXT PRIMARY KEY, hash TEXT NOT NULL, appliedAt TEXT NOT NULL)',
  );
  const files = migrations(),
    known = new Map(files.map((file) => [file.name, file]));
  for (const row of database
    .prepare('SELECT name,hash FROM _fraguan_migrations ORDER BY name')
    .all()) {
    if (known.get(row.name)?.hash !== row.hash)
      throw new Error(`Migración ausente o modificada: ${row.name}`);
  }
  for (const file of files) {
    if (
      database
        .prepare('SELECT name FROM _fraguan_migrations WHERE name=?')
        .get(file.name)
    )
      continue;
    database.exec('BEGIN IMMEDIATE');
    try {
      database.exec(file.sql);
      const violations = database.prepare('PRAGMA foreign_key_check').all();
      if (violations.length)
        throw new Error(`Integridad referencial inválida en ${file.name}`);
      database
        .prepare('INSERT INTO _fraguan_migrations VALUES (?,?,?)')
        .run(file.name, file.hash, new Date().toISOString());
      database.exec('COMMIT');
    } catch (error) {
      database.exec('ROLLBACK');
      throw error;
    }
  }
}
export function verify(database) {
  const integrity = database.prepare('PRAGMA integrity_check').all();
  if (integrity.length !== 1 || integrity[0].integrity_check !== 'ok')
    throw new Error('Falló la integridad SQLite');
  if (database.prepare('PRAGMA foreign_key_check').all().length)
    throw new Error('Falló la integridad referencial');
}
export async function snapshot(source, target) {
  if (existsSync(target))
    throw new Error('El destino ya existe; no se sobrescriben copias.');
  const database = new DatabaseSync(source, { readOnly: true });
  try {
    verify(database);
    await backup(database, target);
  } finally {
    database.close();
  }
  const copy = new DatabaseSync(target, { readOnly: true });
  try {
    verify(copy);
  } finally {
    copy.close();
  }
}
