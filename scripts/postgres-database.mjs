import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import pg from 'pg';
import {
  migrate,
  migrations,
  verify as verifySqlite,
} from './database-tools.mjs';

const { Pool, types } = pg;
types.setTypeParser(20, Number);

const quote = (value) => `"${String(value).replaceAll('"', '""')}"`;

function sourceSchema() {
  const database = new DatabaseSync(':memory:');
  migrate(database);
  database.exec('DROP TABLE IF EXISTS sqlite_stat1');
  return database;
}

function identifiers(database) {
  const result = new Set();
  for (const { name } of database
    .prepare("SELECT name FROM sqlite_master WHERE type='table'")
    .all()) {
    if (name.startsWith('sqlite_') || name === '_fraguan_migrations') continue;
    result.add(name);
    for (const column of database
      .prepare(`PRAGMA table_info(${quote(name)})`)
      .all())
      result.add(column.name);
  }
  return result;
}

function quoteKnownIdentifiers(sql, known) {
  let output = '';
  let index = 0;
  let string = false;
  while (index < sql.length) {
    const character = sql[index];
    if (string) {
      output += character;
      if (character === "'") {
        if (sql[index + 1] === "'") output += sql[++index];
        else string = false;
      }
      index += 1;
      continue;
    }
    if (character === "'") {
      string = true;
      output += character;
      index += 1;
      continue;
    }
    if (character === '`' || character === '"') {
      const closing = character;
      let end = index + 1;
      while (end < sql.length && sql[end] !== closing) end += 1;
      const value = sql.slice(index + 1, end);
      output += quote(value);
      index = end + 1;
      continue;
    }
    if (/[A-Za-z_]/.test(character)) {
      let end = index + 1;
      while (end < sql.length && /[A-Za-z0-9_$]/.test(sql[end])) end += 1;
      const word = sql.slice(index, end);
      output +=
        known.has(word) && (/[a-z][A-Z]/.test(word) || word === 'interval')
          ? quote(word)
          : word;
      index = end;
      continue;
    }
    output += character;
    index += 1;
  }
  return output;
}

function tableSql(database, table, known) {
  const row = database
    .prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name=?")
    .get(table);
  let sql = quoteKnownIdentifiers(row.sql, known)
    .replace(/\bINTEGER\b/gi, 'BIGINT')
    .replace(/\bREAL\b/gi, 'DOUBLE PRECISION')
    .replace(/\bBLOB\b/gi, 'BYTEA')
    .replace(/\s+COLLATE\s+NOCASE/gi, '')
    .replace(
      /,?\s*FOREIGN\s+KEY\s*\([^)]*\)\s+REFERENCES\s+(?:"[^"]+"|[A-Za-z_][A-Za-z0-9_]*)\s*\([^)]*\)(?:\s+ON\s+(?:DELETE|UPDATE)\s+(?:CASCADE|RESTRICT|SET\s+NULL|NO\s+ACTION)){0,2}/gi,
      '',
    )
    .replace(
      /\s+REFERENCES\s+(?:"[^"]+"|[A-Za-z_][A-Za-z0-9_]*)\s*\([^)]*\)(?:\s+ON\s+(?:DELETE|UPDATE)\s+(?:CASCADE|RESTRICT|SET\s+NULL|NO\s+ACTION)){0,2}/gi,
      '',
    );
  sql = sql.replaceAll(`${quote(table)}.`, '');
  return `${sql};`;
}

function foreignKeys(database, table) {
  return database
    .prepare(`PRAGMA foreign_key_list(${quote(table)})`)
    .all()
    .map((key, index) => {
      const name = `fk_${table}_${key.from}_${index}`;
      const onDelete =
        key.on_delete && key.on_delete !== 'NO ACTION'
          ? ` ON DELETE ${key.on_delete}`
          : '';
      const onUpdate =
        key.on_update && key.on_update !== 'NO ACTION'
          ? ` ON UPDATE ${key.on_update}`
          : '';
      return `ALTER TABLE ${quote(table)} ADD CONSTRAINT ${quote(name)} FOREIGN KEY (${quote(key.from)}) REFERENCES ${quote(key.table)} (${quote(key.to)})${onDelete}${onUpdate};`;
    });
}

function buildSchema() {
  const database = sourceSchema();
  try {
    const known = identifiers(database);
    const tables = database
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name<>'_fraguan_migrations' ORDER BY name",
      )
      .all()
      .map(({ name }) => name);
    const tableStatements = tables.map((table) =>
      tableSql(database, table, known),
    );
    const relations = tables.flatMap((table) =>
      database
        .prepare(`PRAGMA foreign_key_list(${quote(table)})`)
        .all()
        .map((key) => ({
          child: table,
          column: key.from,
          parent: key.table,
          parentColumn: key.to,
        })),
    );
    const keys = tables.flatMap((table) => foreignKeys(database, table));
    const indexes = database
      .prepare(
        "SELECT sql FROM sqlite_master WHERE type='index' AND sql IS NOT NULL ORDER BY name",
      )
      .all()
      .map(
        ({ sql }) =>
          `${quoteKnownIdentifiers(sql, known).replace(/;\s*$/, '')};`,
      );
    indexes.push(
      'CREATE UNIQUE INDEX newsletter_subscribers_email_nocase ON newsletter_subscribers (LOWER(email));',
    );
    const statements = [...tableStatements, ...keys, ...indexes];
    return { sql: statements.join('\n\n'), statements, tables, relations };
  } finally {
    database.close();
  }
}

function connectionOptions() {
  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) throw new Error('Falta DATABASE_URL.');
  const hostname = new URL(connectionString).hostname;
  return {
    connectionString,
    max: 2,
    ssl:
      hostname === '127.0.0.1' || hostname === 'localhost'
        ? false
        : { rejectUnauthorized: false },
  };
}

async function assertEmpty(client) {
  const { rows } = await client.query(
    "SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename NOT IN ('fraguan_schema_migrations')",
  );
  if (rows.length)
    throw new Error(
      `La base no está vacía (${rows.length} tablas). No se sobrescribió nada.`,
    );
}

async function initialize(pool) {
  const schema = buildSchema();
  const checksum = createHash('sha256')
    .update(
      migrations()
        .map(({ hash }) => hash)
        .join(':'),
    )
    .update(schema.sql)
    .digest('hex');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      'CREATE TABLE IF NOT EXISTS fraguan_schema_migrations (name TEXT PRIMARY KEY, checksum TEXT NOT NULL, "appliedAt" TEXT NOT NULL)',
    );
    const existing = await client.query(
      'SELECT checksum FROM fraguan_schema_migrations WHERE name=$1',
      ['sqlite-compatible-schema-v1'],
    );
    if (existing.rows.length) {
      if (existing.rows[0].checksum !== checksum)
        throw new Error(
          'El esquema fuente cambió desde la migración aplicada.',
        );
      await client.query('COMMIT');
      console.log('El esquema PostgreSQL ya estaba inicializado y coincide.');
      return;
    }
    await assertEmpty(client);
    await client.query(schema.sql);
    await client.query(
      'INSERT INTO fraguan_schema_migrations(name,checksum,"appliedAt") VALUES($1,$2,$3)',
      ['sqlite-compatible-schema-v1', checksum, new Date().toISOString()],
    );
    await client.query('COMMIT');
    console.log(`Esquema PostgreSQL creado: ${schema.tables.length} tablas.`);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function installIntegrity(pool) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const files = readdirSync(resolve('drizzle-postgres'))
      .filter((name) => /^\d{4}_.+\.sql$/.test(name))
      .sort();
    let applied = 0;
    for (const file of files) {
      const name =
        file === '0001_integrity.sql'
          ? 'postgres-integrity-v1'
          : `postgres:${file}`;
      const sql = readFileSync(resolve('drizzle-postgres', file), 'utf8');
      const checksum = createHash('sha256')
        .update(sql.replaceAll('\r\n', '\n'))
        .digest('hex');
      const current = await client.query(
        'SELECT checksum FROM fraguan_schema_migrations WHERE name=$1',
        [name],
      );
      if (current.rows.length) {
        if (current.rows[0].checksum !== checksum)
          throw new Error(`La migración aplicada fue modificada: ${file}`);
        continue;
      }
      await client.query(sql);
      await client.query(
        'INSERT INTO fraguan_schema_migrations(name,checksum,"appliedAt") VALUES($1,$2,$3)',
        [name, checksum, new Date().toISOString()],
      );
      applied += 1;
    }
    await client.query('COMMIT');
    console.log(
      applied
        ? `Migraciones transaccionales instaladas: ${applied}.`
        : 'Las reglas transaccionales ya estaban instaladas.',
    );
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function verifyPostgres(pool) {
  const schema = buildSchema();
  const expected = schema.tables;
  const { rows } = await pool.query(
    "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename",
  );
  const found = new Set(rows.map(({ tablename }) => tablename));
  const missing = expected.filter((table) => !found.has(table));
  if (missing.length) throw new Error(`Faltan tablas: ${missing.join(', ')}`);
  const invalid = await pool.query(
    "SELECT conname FROM pg_constraint WHERE contype='f' AND NOT convalidated",
  );
  if (invalid.rows.length) throw new Error('Hay claves foráneas sin validar.');
  for (const relation of schema.relations) {
    const result = await pool.query(
      `SELECT COUNT(*) AS count FROM ${quote(relation.child)} child LEFT JOIN ${quote(relation.parent)} parent ON child.${quote(relation.column)}=parent.${quote(relation.parentColumn)} WHERE child.${quote(relation.column)} IS NOT NULL AND parent.${quote(relation.parentColumn)} IS NULL`,
    );
    if (Number(result.rows[0].count))
      throw new Error(
        `Referencia inválida: ${String(relation.child)}.${String(relation.column)} -> ${String(relation.parent)}.${String(relation.parentColumn)}`,
      );
  }
  const expectedTriggers = readdirSync(resolve('drizzle-postgres'))
    .filter((name) => /^\d{4}_.+\.sql$/.test(name))
    .flatMap((file) =>
      [
        ...readFileSync(resolve('drizzle-postgres', file), 'utf8').matchAll(
          /CREATE TRIGGER\s+([A-Za-z0-9_]+)/gi,
        ),
      ].map((match) => match[1]),
    );
  const installedTriggers = await pool.query(
    'SELECT tgname FROM pg_trigger WHERE NOT tgisinternal',
  );
  const installedNames = new Set(
    installedTriggers.rows.map(({ tgname }) => tgname),
  );
  const missingTriggers = expectedTriggers.filter(
    (name) => !installedNames.has(name),
  );
  if (missingTriggers.length)
    throw new Error(
      `Faltan reglas transaccionales: ${missingTriggers.join(', ')}`,
    );
  console.log(
    `PostgreSQL verificado: ${expected.length} tablas, ${expectedTriggers.length} reglas y claves foráneas válidas.`,
  );
}

async function status(pool) {
  const { rows } = await pool.query(
    "SELECT c.relname,c.relkind FROM pg_class c WHERE c.relnamespace='public'::regnamespace ORDER BY c.relname",
  );
  console.log(rows);
}

async function smoke(pool) {
  const client = await pool.connect();
  const expectFailure = async (label, sql, values, expected) => {
    await client.query('SAVEPOINT fraguan_smoke');
    let error;
    try {
      await client.query(sql, values);
    } catch (cause) {
      error = cause;
    }
    await client.query('ROLLBACK TO SAVEPOINT fraguan_smoke');
    await client.query('RELEASE SAVEPOINT fraguan_smoke');
    if (!error || !String(error.message).includes(expected))
      throw new Error(`La prueba ${label} no fue rechazada como se esperaba.`, {
        cause: error,
      });
  };
  try {
    await client.query('BEGIN');
    const variant = (
      await client.query('SELECT id,stock FROM variants ORDER BY id LIMIT 1')
    ).rows[0];
    const sale = (
      await client.query('SELECT id,total FROM sales ORDER BY id LIMIT 1')
    ).rows[0];
    if (!variant || !sale) throw new Error('Faltan datos de prueba migrados.');
    const instant = new Date().toISOString();
    await expectFailure(
      'conflicto de stock',
      'INSERT INTO stock_movements(id,"variantId",quantity,before,after,reason,"actorId","createdAt") VALUES($1,$2,1,$3,$4,$5,$6,$7)',
      [
        crypto.randomUUID(),
        variant.id,
        variant.stock,
        variant.stock + 2,
        'Prueba',
        'system',
        instant,
      ],
      'stock_conflict',
    );
    await expectFailure(
      'importe de pago',
      'INSERT INTO payments(id,"saleId","methodId",amount,commission,net,"dueAt",reference) SELECT $1,$2,id,1,2,-1,$3,$4 FROM payment_methods ORDER BY id LIMIT 1',
      [crypto.randomUUID(), sale.id, instant, 'smoke'],
      'invalid_payment_amounts',
    );
    await expectFailure(
      'devolución excesiva',
      'INSERT INTO refunds(id,"saleId",amount,reason,"actorId","createdAt") VALUES($1,$2,$3,$4,$5,$6)',
      [
        crypto.randomUUID(),
        sale.id,
        Number(sale.total) + 1,
        'Prueba',
        'system',
        instant,
      ],
      'refund_exceeds_sale',
    );
    await expectFailure(
      'total online',
      'INSERT INTO online_orders(id,"orderNumber",email,"customerName",phone,"paymentMethod",subtotal,discount,shipping,total,"shippingMethod","postalCode",address,city,province,"accessTokenHash","transferReference","expiresAt","createdAt","updatedAt") VALUES($1,999999999,$2,$3,$4,$5,1000,100,0,1000,$6,$7,$8,$9,$10,$11,$12,$13,$13,$13)',
      [
        crypto.randomUUID(),
        'smoke@fraguan.test',
        'Prueba',
        '1',
        'transfer',
        'pickup',
        '0000',
        '-',
        '-',
        '-',
        'hash',
        `SMOKE-${crypto.randomUUID()}`,
        instant,
      ],
      'invalid_online_order_totals',
    );
    await client.query('ROLLBACK');
    console.log(
      'Pruebas transaccionales superadas: stock, pagos, devoluciones y total online.',
    );
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function importSqlite(pool, filename) {
  const sourcePath = resolve(filename || '');
  if (!filename || !existsSync(sourcePath))
    throw new Error('Indicá una base SQLite existente.');
  const source = new DatabaseSync(sourcePath, { readOnly: true });
  verifySqlite(source);
  const schema = buildSchema();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const table of schema.tables) {
      const targetCount = Number(
        (await client.query(`SELECT COUNT(*) AS count FROM ${quote(table)}`))
          .rows[0].count,
      );
      if (targetCount)
        throw new Error(`La tabla ${String(table)} ya contiene datos.`);
    }
    await client.query('SET LOCAL session_replication_role = replica');
    for (const table of schema.tables) {
      const columns = source
        .prepare(`PRAGMA table_info(${quote(table)})`)
        .all()
        .map(({ name }) => name);
      const sourceRows = source.prepare(`SELECT * FROM ${quote(table)}`).all();
      if (!sourceRows.length) continue;
      const names = columns.map(quote).join(',');
      const batchSize = Math.max(1, Math.floor(10_000 / columns.length));
      for (let start = 0; start < sourceRows.length; start += batchSize) {
        const batch = sourceRows.slice(start, start + batchSize);
        const parameters = batch
          .map(
            (_, rowIndex) =>
              `(${columns.map((__, columnIndex) => `$${rowIndex * columns.length + columnIndex + 1}`).join(',')})`,
          )
          .join(',');
        await client.query(
          `INSERT INTO ${quote(table)} (${names}) VALUES ${parameters}`,
          batch.flatMap((row) => columns.map((column) => row[column])),
        );
      }
      console.log(`${String(table)}: ${sourceRows.length} filas`);
    }
    await client.query('SET LOCAL session_replication_role = origin');
    await client.query('COMMIT');
    console.log(`Datos importados desde ${sourcePath}.`);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    source.close();
    client.release();
  }
  await verifyPostgres(pool);
}

const command = process.argv[2];
const pool = new Pool(connectionOptions());
try {
  if (command === 'init') {
    await initialize(pool);
    await installIntegrity(pool);
  } else if (command === 'verify') await verifyPostgres(pool);
  else if (command === 'migrate') {
    await installIntegrity(pool);
    await verifyPostgres(pool);
  }
  else if (command === 'status') await status(pool);
  else if (command === 'smoke') await smoke(pool);
  else if (command === 'import-sqlite')
    await importSqlite(pool, process.argv[3]);
  else
    throw new Error(
      'Uso: postgres-database.mjs <init|migrate|verify|status|smoke|import-sqlite> [archivo.sqlite]',
    );
} finally {
  await pool.end();
}
