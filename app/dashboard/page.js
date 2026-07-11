import { auth } from '../../auth.js';
import { getDb } from '@/src/db.js';
import { getDashboardCredits } from '@/src/dashboard-keys.js';
import DashboardClient from './DashboardClient.js';

export const metadata = {
  title: 'Dashboard | Url2Design',
};

async function loadDashboardData(userId) {
  if (!userId) {
    return { remainingCredits: null, hasStripeCustomer: false };
  }

  try {
    const db = await getDb();
    const [remainingCredits, { rows }] = await Promise.all([
      getDashboardCredits(db, userId),
      db.execute({
        sql: `SELECT stripe_customer_id
              FROM users
              WHERE id = ?
              LIMIT 1`,
        args: [userId],
      }),
    ]);
    return {
      remainingCredits,
      hasStripeCustomer: Boolean(rows[0]?.stripe_customer_id),
    };
  } catch (error) {
    console.error('[dashboard] Failed to load dashboard data:', error);
    return { remainingCredits: null, hasStripeCustomer: false };
  }
}

export default async function DashboardPage() {
  const session = await auth();
  const user = session?.user?.id
    ? {
        id: session.user.id,
        name: session.user.name || null,
        email: session.user.email || null,
        image: session.user.image || null,
      }
    : null;
  const { remainingCredits, hasStripeCustomer } = await loadDashboardData(user?.id);

  return (
    <DashboardClient
      user={user}
      remainingCredits={remainingCredits}
      hasStripeCustomer={hasStripeCustomer}
    />
  );
}
