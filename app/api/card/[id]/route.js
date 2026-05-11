import { NextResponse } from 'next/server';
import { getDb } from '../../../../src/db.js';

export async function GET(request, { params }) {
  const { id } = await params;
  try {
    const db = getDb();
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
