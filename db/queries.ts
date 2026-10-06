import { env } from 'cloudflare:workers';
import { Pool, types, type PoolClient, type QueryResult } from 'pg';

type QueryRow = Record<string, unknown>;

types.setTypeParser(20, Number);

const nodeEnvironment = () =>
  typeof process === 'undefined' ? undefined : process.env;

const postgresUrl = () =>
  env.DATABASE_URL?.trim() || nodeEnvironment()?.DATABASE_URL?.trim() || '';

const globalPool = globalThis as typeof globalThis & {
  __fraguanPostgresPool?: Pool;
};

function pool() {
  const connectionString = postgresUrl();
  if (!connectionString)
    throw new Error('DATABASE_URL no está configurada para PostgreSQL.');
  if (!globalPool.__fraguanPostgresPool) {
    const hostname = new URL(connectionString).hostname;
    globalPool.__fraguanPostgresPool = new Pool({
      connectionString,
      max: Number(
        env.DATABASE_POOL_SIZE || nodeEnvironment()?.DATABASE_POOL_SIZE || 10,
      ),
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
      ssl:
        hostname === 'localhost' || hostname === '127.0.0.1'
          ? false
          : { rejectUnauthorized: false },
    });
  }
  return globalPool.__fraguanPostgresPool;
}

function quoteCamelCaseIdentifiers(sql: string) {
  let output = '';
  let index = 0;
  let quote: "'" | '"' | '`' | null = null;
  while (index < sql.length) {
    const char = sql[index];
    if (quote) {
      if (quote === '`') {
        if (char === '`') {
          output += '"';
          quote = null;
        } else output += char;
      } else {
        output += char;
        if (char === quote) {
          if (sql[index + 1] === quote) {
            output += sql[index + 1];
            index += 1;
          } else quote = null;
        }
      }
      index += 1;
      continue;
    }
    if (char === "'" || char === '"' || char === '`') {
      quote = char;
      output += char === '`' ? '"' : char;
      index += 1;
      continue;
    }
    if (/[A-Za-z_]/.test(char)) {
      let end = index + 1;
      while (end < sql.length && /[A-Za-z0-9_$]/.test(sql[end])) end += 1;
      const word = sql.slice(index, end);
      // Legacy staff queries use SQLite's hidden rowid only to break ordering
      // ties. PostgreSQL tables have an explicit unique id instead. Preserve
      // quoted strings and the SQLite path while giving Postgres a stable key.
      output +=
        word.toLowerCase() === 'rowid'
          ? 'id'
          : /[a-z][A-Z]/.test(word)
            ? `"${word}"`
            : word;
      index = end;
      continue;
    }
    output += char;
    index += 1;
  }
  return output;
}

function numberedParameters(sql: string) {
  let output = '';
  let parameter = 0;
  let quote: "'" | '"' | null = null;
  for (let index = 0; index < sql.length; index += 1) {
    const char = sql[index];
    if (quote) {
      output += char;
      if (char === quote) {
        if (sql[index + 1] === quote) {
          output += sql[index + 1];
          index += 1;
        } else quote = null;
      }
      continue;
    }
    if (char === "'" || char === '"') {
      quote = char;
      output += char;
    } else if (char === '?') {
      parameter += 1;
      output += `$${parameter}`;
    } else output += char;
  }
  return output;
}

export function postgresSql(sql: string) {
  let translated = quoteCamelCaseIdentifiers(sql)
    .replace(
      /\bdate\(\s*("[^"]+"(?:\."[^"]+")?|[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)?|\?)\s*,\s*'-3 hours'\s*\)/gi,
      "($1::timestamptz AT TIME ZONE 'America/Argentina/Cordoba')::date",
    )
    .replace(/\bMAX\s*\(\s*0\s*,/gi, 'GREATEST(0,')
    .replace(
      /\bMIN\s*\(\s*warehouse\.(?:"quantity"|quantity)\s*,\s*GREATEST/gi,
      'LEAST(warehouse.quantity,GREATEST',
    );
  const ignore = /^\s*INSERT\s+OR\s+IGNORE\s+/i.test(translated);
  if (ignore) {
    translated = translated.replace(/^\s*INSERT\s+OR\s+IGNORE\s+/i, 'INSERT ');
    translated = `${translated.replace(/;\s*$/, '')} ON CONFLICT DO NOTHING`;
  }
  return numberedParameters(translated);
}

class PostgresStatement {
  constructor(
    readonly sql: string,
    readonly values: unknown[] = [],
  ) {}
  bind(...values: unknown[]) {
    return new PostgresStatement(this.sql, values);
  }
  private execute(client?: PoolClient) {
    return (client ?? pool()).query(postgresSql(this.sql), this.values);
  }
  async all<T = QueryRow>() {
    const result = await this.execute();
    return {
      success: true,
      results: result.rows as T[],
      meta: { changes: result.rowCount ?? 0 },
    };
  }
  async first<T = QueryRow>(column?: string) {
    const result = await this.execute();
    const row = result.rows[0] as T | undefined;
    if (!row) return null;
    return column ? ((row as QueryRow)[column] as T) : row;
  }
  async run() {
    return this.result(await this.execute());
  }
  async executeIn(client: PoolClient) {
    return this.result(await this.execute(client));
  }
  private result(result: QueryResult) {
    return {
      success: true,
      results: result.rows,
      meta: { changes: result.rowCount ?? 0 },
    };
  }
}

const postgresDatabase = {
  prepare(sql: string) {
    return new PostgresStatement(sql) as unknown as D1PreparedStatement;
  },
  async batch(statements: D1PreparedStatement[]) {
    const client = await pool().connect();
    try {
      await client.query('BEGIN');
      const results = [];
      for (const item of statements) {
        if (!(item instanceof PostgresStatement))
          throw new Error('No se pueden mezclar operaciones D1 y PostgreSQL.');
        results.push(await item.executeIn(client));
      }
      await client.query('COMMIT');
      return results;
    } catch (cause) {
      await client.query('ROLLBACK');
      throw cause;
    } finally {
      client.release();
    }
  },
};

export function usingPostgres() {
  return Boolean(postgresUrl());
}

export function db(): D1Database {
  if (usingPostgres()) return postgresDatabase as unknown as D1Database;
  if (!env.DB) throw new Error('No hay una base de datos configurada.');
  return env.DB;
}

export function statement(sql: string, ...values: unknown[]) {
  return db()
    .prepare(sql)
    .bind(...values);
}

export async function rows<T = Record<string, unknown>>(
  sql: string,
  ...values: unknown[]
): Promise<T[]> {
  return (await statement(sql, ...values).all<T>()).results;
}

export async function one<T = Record<string, unknown>>(
  sql: string,
  ...values: unknown[]
): Promise<T | null> {
  return statement(sql, ...values).first<T>();
}

export const id = () => crypto.randomUUID();
export const now = () => new Date().toISOString();

export function auditStatement(
  actor: string,
  action: string,
  entity: string,
  before: unknown = null,
  after: unknown = null,
) {
  return statement(
    'INSERT INTO audit_log (id,actorId,action,entityId,before,after,createdAt) VALUES (?,?,?,?,?,?,?)',
    id(),
    actor,
    action,
    entity,
    JSON.stringify(before),
    JSON.stringify(after),
    now(),
  );
}
