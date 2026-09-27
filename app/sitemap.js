import { getDb } from '@/src/db.js';
import { SITE_URL } from '@/src/site-url.js';

export default async function sitemap() {
  const entries = [
    { url: SITE_URL, changeFrequency: 'daily', priority: 1 },
    { url: `${SITE_URL}/dashboard`, changeFrequency: 'weekly', priority: 0.5 },
  ];

  try {
    const db = await getDb();
    const result = await db.execute('SELECT id, created_at FROM cards ORDER BY created_at DESC');
    const styleEntries = result.rows.map(row => ({
      url: `${SITE_URL}/style/${row.id}`,
      lastModified: row.created_at ? new Date(row.created_at) : undefined,
      changeFrequency: 'monthly',
      priority: 0.7,
    }));
    return [...entries, ...styleEntries];
  } catch {
    // No database at build time (no Turso, no local refero.db) — base routes only
    return entries;
  }
}