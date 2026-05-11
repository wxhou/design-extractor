import { createClient } from '@libsql/client/http';

let client = null;

export function getDb() {
  if (!client) {
    const url = process.env.TURSO_URL;
    const authToken = process.env.TURSO_AUTH_TOKEN;

    if (!url || !authToken) {
      throw new Error('Missing TURSO_URL or TURSO_AUTH_TOKEN environment variables');
    }

    const httpsUrl = url.replace(/^libsql:\/\//, 'https://');
    client = createClient({ url: httpsUrl, authToken });
  }
  return client;
}
