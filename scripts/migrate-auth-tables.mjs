#!/usr/bin/env node
/**
 * migrate-auth-tables.mjs
 *
 * Apply src/schema-auth.sql to Turso.
 *
 * Usage:
 *   node scripts/migrate-auth-tables.mjs
 *
 * Requires TURSO_URL and TURSO_AUTH_TOKEN (e.g. from .env.local).
 */

import { createClient } from '@libsql/client/http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCHEMA_PATH = path.join(__dirname, '..', 'src', 'schema-auth.sql');

function getTursoClient() {
  const url = process.env.TURSO_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  if (!url || !authToken) return null;
  const httpsUrl = url.replace(/^libsql:\/\//, 'https://');
  return createClient({ url: httpsUrl, authToken });
}

function splitStatements(sql) {
  return sql
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

async function main() {
  const client = getTursoClient();
  if (!client) {
    console.error('TURSO_URL and TURSO_AUTH_TOKEN are required.');
    console.error('Set them in .env.local or use the turso CLI against a remote database.');
    process.exit(1);
  }

  const sql = fs.readFileSync(SCHEMA_PATH, 'utf8');
  const statements = splitStatements(sql);

  for (const statement of statements) {
    await client.execute(statement);
  }

  console.log(`Applied ${statements.length} statements from schema-auth.sql`);
}

main().catch((err) => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
