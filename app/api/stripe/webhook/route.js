import Stripe from 'stripe';
import { getDb } from '@/src/db.js';
import {
  applySubscriptionEntitlement,
  findUserIdByStripeCustomer,
  getPlanForPrice,
  getStripeId,
  getSubscriptionPeriodEnd,
  getSubscriptionPriceId,
} from '@/src/stripe-billing.js';

export const runtime = 'nodejs';

function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY is not configured');
  }
  return new Stripe(process.env.STRIPE_SECRET_KEY);
}

async function getSubscription(stripe, subscription) {
  if (!subscription) return null;
  if (typeof subscription === 'string') {
    return stripe.subscriptions.retrieve(subscription);
  }
  return subscription;
}

async function resolveUserId(db, customerId, metadataUserId) {
  if (metadataUserId) return metadataUserId;
  return findUserIdByStripeCustomer(db, customerId);
}

async function syncSubscription(db, subscription, options = {}) {
  const customerId = getStripeId(subscription.customer);
  const userId = await resolveUserId(db, customerId, subscription.metadata?.user_id);
  if (!userId) {
    throw new Error(`No user found for Stripe customer ${customerId || 'unknown'}`);
  }

  const canceled = options.canceled || subscription.status === 'canceled';
  const priceId = getSubscriptionPriceId(subscription);
  const plan = getPlanForPrice(priceId) || 'free';
  return applySubscriptionEntitlement(db, {
    userId,
    customerId,
    subscriptionId: getStripeId(subscription),
    plan,
    status: subscription.status,
    periodEnd: getSubscriptionPeriodEnd(subscription),
    canceled,
  });
}

async function handleCheckoutCompleted(stripe, db, checkoutSession) {
  const subscription = await getSubscription(stripe, checkoutSession.subscription);
  if (!subscription) return;

  if (!subscription.metadata?.user_id && checkoutSession.metadata?.user_id) {
    subscription.metadata = {
      ...(subscription.metadata || {}),
      user_id: checkoutSession.metadata.user_id,
    };
  }

  await syncSubscription(db, subscription);
}

export async function POST(request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return Response.json({ error: 'Stripe webhook is not configured' }, { status: 500 });
  }

  const stripe = getStripe();
  const signature = request.headers.get('stripe-signature');
  const body = await request.text();
  let event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (error) {
    console.error('[stripe webhook] Signature verification failed:', error.message);
    return Response.json({ error: 'Invalid signature' }, { status: 400 });
  }

  try {
    const db = await getDb();
    if (event.type === 'checkout.session.completed') {
      await handleCheckoutCompleted(stripe, db, event.data.object);
    } else if (event.type === 'customer.subscription.updated') {
      await syncSubscription(db, event.data.object);
    } else if (event.type === 'customer.subscription.deleted') {
      await syncSubscription(db, event.data.object, { canceled: true });
    }

    return Response.json({ received: true });
  } catch (error) {
    console.error('[stripe webhook] Error:', error);
    return Response.json({ error: 'Webhook handling failed' }, { status: 500 });
  }
}
