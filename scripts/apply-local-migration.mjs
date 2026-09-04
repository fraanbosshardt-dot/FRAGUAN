import { readFileSync, readdirSync } from 'node:fs';
import { resolve, relative, sep } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const root = process.cwd();
const migration = resolve(root, process.argv[2] ?? '');
const migrationRoot = resolve(root, 'drizzle') + sep;
if (!migration.startsWith(migrationRoot))
  throw new Error('La migración debe estar dentro de drizzle/.');

const databaseRoot = resolve(
  root,
  '.wrangler/state/v3/d1/miniflare-D1DatabaseObject',
);
const databases = readdirSync(databaseRoot)
  .filter((name) => name.endsWith('.sqlite') && name !== 'metadata.sqlite')
  .map((name) => resolve(databaseRoot, name));
if (databases.length !== 1)
  throw new Error(
    `Se esperaba una base D1 local y se encontraron ${databases.length}.`,
  );

const database = new DatabaseSync(databases[0]);
try {
  database.exec(readFileSync(migration, 'utf8'));
} finally {
  database.close();
}
console.log(
  `Migración local aplicada: ${relative(root, migration)} → ${relative(root, databases[0])}`,
);
