import { auth } from '../../../../auth.js';
import { getDb } from '@/src/db.js';
import {
  createDashboardApiKey,
  listDashboardApiKeys,
  revokeDashboardApiKey,
} from '@/src/dashboard-keys.js';

function getUserId(session) {
  return session?.user?.id || null;
}

function unauthorized() {
  return Response.json({ error: 'Unauthorized' }, { status: 401 });
}

function serverError(error) {
  console.error('[dashboard keys] Error:', error);
  return Response.json({ error: 'Internal server error' }, { status: 500 });
}

export async function GET() {
  const session = await auth();
  const userId = getUserId(session);
  if (!userId) {
    return unauthorized();
  }

  try {
    const db = await getDb();
    const keys = await listDashboardApiKeys(db, userId);
    return Response.json(keys);
  } catch (error) {
    return serverError(error);
  }
}

export async function POST(request) {
  const session = await auth();
  const userId = getUserId(session);
  if (!userId) {
    return unauthorized();
  }

  try {
    const body = await request.json().catch(() => ({}));
    const db = await getDb();
    const result = await createDashboardApiKey(db, userId, {
      name: body?.name,
    });

    return Response.json(result, { status: 201 });
  } catch (error) {
    return serverError(error);
  }
}

export async function DELETE(request) {
  const session = await auth();
  const userId = getUserId(session);
  if (!userId) {
    return unauthorized();
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) {
    return Response.json({ error: 'Missing id' }, { status: 400 });
  }

  try {
    const db = await getDb();
    const key = await revokeDashboardApiKey(db, userId, id);
    if (!key) {
      return Response.json({ error: 'Key not found' }, { status: 404 });
    }

    return Response.json({ key });
  } catch (error) {
    return serverError(error);
  }
}
