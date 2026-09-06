import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, readdirSync, unlinkSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  migrate,
  migrations,
  snapshot,
  verify,
} from './scripts/database-tools.mjs';
test('clean migration, replay, checksum guard and verified backup restoration', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'fraguan-recovery-'));
  try {
    const source = join(dir, 'source.sqlite'),
      copy = join(dir, 'backup.sqlite'),
      restored = join(dir, 'restored.sqlite');
    const db = new DatabaseSync(source);
    try {
      migrate(db);
      migrate(db);
      verify(db);
      assert.equal(
        db.prepare('SELECT COUNT(*) AS n FROM _fraguan_migrations').get().n,
        migrations().length,
      );
      db.prepare('INSERT INTO settings(key,value) VALUES (?,?)').run(
        'recovery-test',
        'conservado',
      );
      db.prepare(
        "UPDATE _fraguan_migrations SET hash='changed' WHERE name=?",
      ).run(migrations()[0].name);
      assert.throws(() => migrate(db), /modificada/);
      db.prepare('UPDATE _fraguan_migrations SET hash=? WHERE name=?').run(
        migrations()[0].hash,
        migrations()[0].name,
      );
    } finally {
      db.close();
    }
    await snapshot(source, copy);
    await snapshot(copy, restored);
    await assert.rejects(() => snapshot(source, copy), /no se sobrescriben/);
    const recovered = new DatabaseSync(restored);
    try {
      assert.equal(
        recovered
          .prepare("SELECT value FROM settings WHERE key='recovery-test'")
          .get().value,
        'conservado',
      );
      verify(recovered);
    } finally {
      recovered.close();
    }
    const legacy = new DatabaseSync(':memory:');
    try {
      legacy.exec('CREATE TABLE legacy(id TEXT)');
      assert.throws(() => migrate(legacy), /sin historial/);
    } finally {
      legacy.close();
    }
  } finally {
    for (const file of readdirSync(dir)) unlinkSync(join(dir, file));
    rmdirSync(dir);
  }
});
