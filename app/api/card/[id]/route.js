import { NextResponse } from 'next/server';
import initSqlJs from 'sql.js';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

let SQL;

async function getSql() {
  if (!SQL) SQL = await initSqlJs();
  return SQL;
}

export async function GET(request, { params }) {
  const { id } = await params;
  try {
    const sqljs = await getSql();
    const dbPath = path.join(process.cwd(), 'refero.db');
    const fileBuffer = fs.readFileSync(dbPath);
    const db = new sqljs.Database(fileBuffer);

    const stmt = db.prepare('SELECT * FROM cards WHERE id = ?');
    stmt.bind([id]);

    if (!stmt.step()) {
      stmt.free();
      db.close();
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const columns = stmt.getColumnNames();
    const values = stmt.get();
    stmt.free();
    db.close();

    const card = Object.fromEntries(columns.map((col, i) => [col, values[i]]));
    return NextResponse.json(card);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
