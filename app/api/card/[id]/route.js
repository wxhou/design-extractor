import { NextResponse } from 'next/server';
import { getDb } from '@/src/db.js';
import { isValidUUID } from '@/src/utils.js';

export async function GET(request, { params }) {
  const { id } = await params;
  if (!isValidUUID(id)) {
    return NextResponse.json({ error: 'Invalid card ID' }, { status: 400 });
  }
  try {
    const db = await getDb();
    const result = await db.execute({
      sql: 'SELECT * FROM cards WHERE id = ?',
      args: [id],
    });

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json(result.rows[0]);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
