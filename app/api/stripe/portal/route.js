import Stripe from 'stripe';
import { auth } from '../../../../auth.js';
import { getDb } from '@/src/db.js';

export const runtime = 'nodejs';

function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY is not configured');
  }
  return new Stripe(process.env.STRIPE_SECRET_KEY);
}

function getOrigin(request) {
  return process.env.AUTH_URL || new URL(request.url).origin;
}

export async function POST(request) {
  const session = await auth();
  const userId = session?.user?.id || null;
  if (!userId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const db = await getDb();
    const { rows } = await db.execute({
      sql: `SELECT stripe_customer_id
            FROM users
            WHERE id = ?
            LIMIT 1`,
      args: [userId],
    });
    const customer = rows[0]?.stripe_customer_id;
    if (!customer) {
      return Response.json({ error: 'No Stripe customer found' }, { status: 400 });
    }

    const portal = await getStripe().billingPortal.sessions.create({
      customer,
      return_url: `${getOrigin(request)}/dashboard`,
    });

    return Response.json({ url: portal.url });
  } catch (error) {
    console.error('[stripe portal] Error:', error);
    return Response.json({ error: 'Unable to open billing portal' }, { status: 500 });
  }
}
