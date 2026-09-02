import { env } from 'cloudflare:workers';
export function db(): D1Database {
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
