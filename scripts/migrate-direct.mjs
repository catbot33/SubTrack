import { createHash, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import dotenv from 'dotenv';
import pg from 'pg';

const values = dotenv.parse(readFileSync(new URL('../.env', import.meta.url)));
if (!values.DATABASE_URL) throw new Error('DATABASE_URL is missing.');
const direct = new URL(values.DATABASE_URL.replace('-pooler.', '.'));
direct.searchParams.delete('channel_binding');
const migrationName = '20260904070000_add_user_subscriptions';
const sql = readFileSync(new URL('../prisma/migrations/' + migrationName + '/migration.sql', import.meta.url), 'utf8');
const client = new pg.Client({ connectionString: direct.toString() });
await client.connect();
try {
  const applied = await client.query('SELECT 1 FROM "_prisma_migrations" WHERE "migration_name" = $1 AND "rolled_back_at" IS NULL', [migrationName]);
  if (!applied.rowCount) {
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('INSERT INTO "_prisma_migrations" (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) VALUES ($1, $2, NOW(), $3, NULL, NULL, NOW(), 1)', [randomUUID(), createHash('sha256').update(sql).digest('hex'), migrationName]);
    await client.query('COMMIT');
    console.log('Applied migration:', migrationName);
  } else console.log('Migration already applied:', migrationName);
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally { await client.end(); }
