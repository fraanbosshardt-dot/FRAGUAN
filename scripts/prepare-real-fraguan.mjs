import pg from 'pg';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const PROJECT = '7d7e0fda-e9bb-4360-bf4b-c55a6e7bf632';
const SERVICE = 'ee88ea60-1284-4bb0-9aac-82045cd5eca7';
const ENVIRONMENT = 'd915e5ca-4bf2-4dd9-94d9-3d02e3ad40e4';
const AUTHORIZATION = 'empty-demo-isla-verde-1-20261006';
const BACKUP = 'fraguan_before_real_setup_20261006';
const MARKER = 'real-setup:isla-verde-1:20261006';
const PRESERVED = new Set([
  'users',
  'settings',
  'payment_methods',
  'stock_locations',
  '_fraguan_migrations',
  'fraguan_schema_migrations',
]);
const quote = (name) => `"${name.replaceAll('"', '""')}"`;

export function assertTarget(runtime) {
  if (
    runtime.RAILWAY_PROJECT_ID !== PROJECT ||
    runtime.RAILWAY_SERVICE_ID !== SERVICE ||
    runtime.RAILWAY_ENVIRONMENT_ID !== ENVIRONMENT
  )
    throw new Error('El destino no es el servicio autorizado de FRAGUAN.');
  if (runtime.FRAGUAN_RESET_AUTHORIZATION !== AUTHORIZATION)
    throw new Error('Falta la autorización específica de esta limpieza.');
  if (
    !runtime.DATABASE_URL ||
    new URL(runtime.DATABASE_URL).hostname !== 'postgres.railway.internal'
  )
    throw new Error(
      'Se requiere la conexión privada existente de Postgres de FRAGUAN.',
    );
}

export function planReset(tables, known) {
  const unknown = tables.filter(
    (name) =>
      !known.has(name) &&
      !['_fraguan_migrations', 'fraguan_schema_migrations'].includes(name),
  );
  if (unknown.length)
    throw new Error(
      `Tablas desconocidas: ${unknown.join(', ')}. No se modificó la base.`,
    );
  for (const required of [
    'users',
    'settings',
    'products',
    'sales',
    'payment_methods',
    'stock_locations',
  ])
    if (!tables.includes(required))
      throw new Error(`Falta la tabla FRAGUAN ${required}.`);
  return tables.filter((name) => !PRESERVED.has(name));
}

function knownTables() {
  const names = new Set();
  for (const file of readdirSync(resolve('drizzle')).filter((name) =>
    /^\d{4}_.+\.sql$/.test(name),
  )) {
    const sql = readFileSync(resolve('drizzle', file), 'utf8');
    for (const match of sql.matchAll(
      /CREATE TABLE\s+(?:IF NOT EXISTS\s+)?[`"]?([a-z_][a-z0-9_]*)/gi,
    ))
      names.add(match[1]);
  }
  return names;
}

export function ownerAccounts(runtime) {
  const owners = JSON.parse(runtime.FRAGUAN_REAL_OWNERS ?? '[]');
  if (
    !Array.isArray(owners) ||
    owners.length !== 2 ||
    !owners.every(
      (owner) =>
        typeof owner?.email === 'string' &&
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(owner.email) &&
        typeof owner?.name === 'string' &&
        owner.name.trim(),
    )
  )
    throw new Error(
      'Se requieren las dos cuentas de dueños confirmadas por el propietario.',
    );
  const emails = owners.map((owner) => owner.email.trim().toLowerCase());
  if (new Set(emails).size !== 2)
    throw new Error('Los emails de los dueños deben ser distintos.');
  return owners.map((owner, index) => [
    `real-owner-${index + 1}`,
    emails[index],
    owner.name.trim(),
  ]);
}

export async function prepareRealFraguan(
  client,
  apply = false,
  runtime = process.env,
) {
  const { rows } = await client.query(
    "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename",
  );
  const tables = rows.map(({ tablename }) => tablename);
  const cleared = planReset(tables, knownTables());
  if (
    (await client.query('SELECT value FROM settings WHERE key=$1', [MARKER]))
      .rows.length
  ) {
    console.log('FRAGUAN_REAL_SETUP: already_complete; no writes.');
    return;
  }
  if (!apply) {
    console.log(
      JSON.stringify({
        mode: 'read-only',
        backupSchema: BACKUP,
        cleared,
        preserved: tables.filter((name) => PRESERVED.has(name)),
      }),
    );
    return;
  }
  const owners = ownerAccounts(runtime);
  await client.query('BEGIN');
  try {
    await client.query("SET LOCAL lock_timeout='30s'");
    await client.query("SET LOCAL statement_timeout='120s'");
    await client.query('SELECT pg_advisory_xact_lock(706202610)');
    await client.query(
      `LOCK TABLE ${tables.map((name) => `public.${quote(name)}`).join(', ')} IN ACCESS EXCLUSIVE MODE`,
    );
    if (
      (await client.query('SELECT value FROM settings WHERE key=$1', [MARKER]))
        .rows.length
    ) {
      await client.query('ROLLBACK');
      console.log('FRAGUAN_REAL_SETUP: already_complete; no writes.');
      return;
    }
    // No IF NOT EXISTS: an existing backup must never be overwritten or reused.
    await client.query(`CREATE SCHEMA ${quote(BACKUP)}`);
    const before = {};
    for (const name of tables) {
      await client.query(
        `CREATE TABLE ${quote(BACKUP)}.${quote(name)} AS TABLE public.${quote(name)}`,
      );
      const source = await client.query(
        `SELECT COUNT(*)::int AS n FROM public.${quote(name)}`,
      );
      const copied = await client.query(
        `SELECT COUNT(*)::int AS n FROM ${quote(BACKUP)}.${quote(name)}`,
      );
      if (source.rows[0].n !== copied.rows[0].n)
        throw new Error(`Respaldo incompleto: ${name}.`);
      before[name] = source.rows[0].n;
    }
    // Exact list, no CASCADE: an unexpected dependency aborts and rolls back.
    await client.query(
      `TRUNCATE TABLE ${cleared.map((name) => `public.${quote(name)}`).join(', ')} RESTART IDENTITY`,
    );
    for (const [id, email, name] of owners)
      await client.query(
        "INSERT INTO users(id,email,name,role,active) VALUES($1,$2,$3,'ADMIN',1) ON CONFLICT(email) DO UPDATE SET name=excluded.name,role=excluded.role,active=1",
        [id, email, name],
      );
    // The owner confirmed that all other loaded data is test data. The backup retains those accounts.
    await client.query(
      'DELETE FROM users WHERE LOWER(email) NOT IN ($1,$2)',
      owners.map((owner) => owner[1]),
    );
    const pointMethods = [
      ['debit', 'Point · Mercado Pago · Débito', 288, 2],
      ['credit', 'Point · Mercado Pago · Crédito · 1 pago', 440, 10],
      ['point-prepaid', 'Point · Mercado Pago · Prepaga', 368, 3],
      ['point-pix', 'Point · Mercado Pago · Pix', 340, 0],
    ];
    for (const [id, name, commissionBps, days] of pointMethods)
      await client.query(
        'INSERT INTO payment_methods(id,name,"surchargeBps","commissionBps",days,installments,active) VALUES($1,$2,0,$3,$4,1,1) ON CONFLICT(id) DO UPDATE SET name=excluded.name,"surchargeBps"=0,"commissionBps"=excluded."commissionBps",days=excluded.days,installments=1,active=1',
        [id, name, commissionBps, days],
      );
    // The owner has not authorized financing plans or the old sample processors.
    await client.query(
      'UPDATE payment_methods SET active=0 WHERE id NOT IN ($1,$2,$3,$4,$5,$6,$7,$8)',
      [
        'cash',
        'transfer',
        'store_credit',
        'cashback',
        ...pointMethods.map((method) => method[0]),
      ],
    );
    const emptyFinance = {
      availableMinor: 0,
      reserveMinor: 0,
      personalIncomeMinor: 0,
      livingCostsMinor: 0,
      businessIncomeMinor: 0,
      businessFixedCostsMinor: 0,
      businessExtraordinaryMinor: 0,
      businessContributionMarginBps: 0,
      expenses: [],
      debts: [],
      payments: [],
    };
    const timestamp = new Date().toISOString();
    for (const [key, value] of [
      ['owner', owners[0][1]],
      ['owners', JSON.stringify(owners.map((owner) => owner[1]))],
      ['demo', '0'],
      ['personal-finance', JSON.stringify(emptyFinance)],
      [
        'business-location',
        JSON.stringify({
          number: 1,
          city: 'Isla Verde',
          province: 'Córdoba',
          country: 'Argentina',
          operator: 'Cristian',
        }),
      ],
      ['payment-fees-status', 'point-base-rates-set-tax-pending'],
      [
        'point-fee-policy',
        JSON.stringify({
          provider: 'Mercado Pago Point',
          includesVat: false,
          includesWithholdings: false,
          financing: 'pending',
          source: 'owner-provided',
          recordedOn: '2026-10-06',
        }),
      ],
      [
        MARKER,
        JSON.stringify({ timestamp, backupSchema: BACKUP, before, cleared }),
      ],
    ])
      await client.query(
        'INSERT INTO settings(key,value) VALUES($1,$2) ON CONFLICT(key) DO UPDATE SET value=excluded.value',
        [key, value],
      );
    await client.query(
      "DELETE FROM settings WHERE key LIKE 'access:%' AND substring(key FROM 8) IN (SELECT id FROM users WHERE role='ADMIN')",
    );
    await client.query(
      'UPDATE stock_locations SET name=$1,code=$2,detail=$3 WHERE id=$4',
      [
        'Local 1 · Isla Verde',
        'LOCAL-1',
        'Isla Verde, Córdoba, Argentina. Responsable: Cristian.',
        'loc-salon',
      ],
    );
    await client.query(
      'DELETE FROM stock_locations WHERE id NOT IN ($1,$2,$3)',
      ['loc-salon', 'loc-deposito', 'loc-unassigned'],
    );
    for (const name of cleared) {
      const result = await client.query(
        `SELECT COUNT(*)::int AS n FROM public.${quote(name)}`,
      );
      if (result.rows[0].n !== 0)
        throw new Error(`La tabla no quedó vacía: ${name}.`);
    }
    await client.query('COMMIT');
    console.log(
      JSON.stringify({
        result: 'FRAGUAN_REAL_SETUP_COMPLETE',
        backupSchema: BACKUP,
        cleared: cleared.length,
        before,
        owners: owners.length,
        local: 1,
        financialData: 'empty',
        paymentFees: 'point-base-configured-tax-pending',
      }),
    );
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  assertTarget(process.env);
  const client = new pg.Client({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 15000,
    ssl: { rejectUnauthorized: false },
  });
  try {
    await client.connect();
    await prepareRealFraguan(client, process.argv.includes('--apply'));
  } finally {
    await client.end();
  }
}
