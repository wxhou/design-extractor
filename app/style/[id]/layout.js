import { getDb } from '@/src/db.js';
import { SITE_URL } from '@/src/site-url.js';

async function getCard(id) {
  try {
    const db = await getDb();
    const result = await db.execute({
      sql: 'SELECT id, name, url, preview, north_star, color_scheme FROM cards WHERE id = ?',
      args: [id],
    });
    return result.rows[0] || null;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }) {
  const { id } = await params;
  const card = await getCard(id);
  if (!card) return { title: 'Style not found | Url2Design' };

  const title = `${card.name} design tokens | Url2Design`;
  const description = card.north_star
    ? `${card.name} — ${card.north_star}`
    : `Design tokens extracted from ${card.url}: colors, typography, spacing, and components.`;
  const image = card.preview ? new URL(card.preview, SITE_URL).toString() : undefined;

  return {
    title,
    description,
    alternates: { canonical: `/style/${card.id}` },
    openGraph: {
      title,
      description,
      type: 'article',
      url: `/style/${card.id}`,
      images: image ? [{ url: image }] : undefined,
    },
    twitter: { card: 'summary_large_image', images: image ? [image] : undefined },
  };
}

export default function StyleLayout({ children }) {
  return children;
}