import Stripe from 'stripe';
import { auth } from '../../../../auth.js';
import { getDb } from '@/src/db.js';
import {
  findBlockingCheckoutSubscription,
  getOrCreateStripeCustomer,
} from '@/src/stripe-billing.js';

export const runtime = 'nodejs';

const PLAN_PRICES = {
  starter: 'STRIPE_PRICE_STARTER',
  pro: 'STRIPE_PRICE_PRO',
};

function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY is not configured');
  }
  return new Stripe(process.env.STRIPE_SECRET_KEY);
}

function getOrigin(request) {
  return process.env.AUTH_URL || new URL(request.url).origin;
}

function getSessionUser(session) {
  const id = session?.user?.id;
  if (!id) return null;
  return {
    id,
    email: session.user.email || null,
    name: session.user.name || null,
  };
}

export async function POST(request) {
  const session = await auth();
  const user = getSessionUser(session);
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const plan = body?.plan;
  const priceEnv = PLAN_PRICES[plan];
  const price = priceEnv ? process.env[priceEnv] : null;
  if (!price) {
    return Response.json({ error: 'Invalid plan' }, { status: 400 });
  }

  try {
    const db = await getDb();
    const blockingSubscription = await findBlockingCheckoutSubscription(db, user.id);
    if (blockingSubscription) {
      return Response.json({
        error: 'You already have an active subscription. Use the Customer Portal to manage billing.',
      }, { status: 409 });
    }

    const stripe = getStripe();
    const customer = await getOrCreateStripeCustomer({ db, stripe, user });
    const origin = getOrigin(request);
    const checkout = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer,
      line_items: [{ price, quantity: 1 }],
      success_url: `${origin}/dashboard?checkout=success`,
      cancel_url: `${origin}/dashboard?checkout=cancel`,
      metadata: { user_id: user.id, plan },
      subscription_data: {
        metadata: { user_id: user.id, plan },
      },
      allow_promotion_codes: true,
    });

    return Response.json({ url: checkout.url });
  } catch (error) {
    console.error('[stripe checkout] Error:', error);
    return Response.json({ error: 'Unable to start checkout' }, { status: 500 });
  }
}
