import { createClient } from '@libsql/client';

let client = null;

export function getDb() {
  if (!client) {
    const url = process.env.TURSO_URL;
    const authToken = process.env.TURSO_AUTH_TOKEN;

    if (!url || !authToken) {
      throw new Error('Missing TURSO_URL or TURSO_AUTH_TOKEN environment variables');
    }

    client = createClient({ url, authToken });
  }
  return client;
}
