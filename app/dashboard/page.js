import { auth } from '../../auth.js';
import { getDb } from '@/src/db.js';
import { getDashboardCredits } from '@/src/dashboard-keys.js';
import DashboardClient from './DashboardClient.js';

export const metadata = {
  title: 'Dashboard | Design Extractor',
};

async function loadRemainingCredits(userId) {
  if (!userId) {
    return null;
  }

  try {
    const db = await getDb();
    return await getDashboardCredits(db, userId);
  } catch (error) {
    console.error('[dashboard] Failed to load credits:', error);
    return null;
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
  const remainingCredits = await loadRemainingCredits(user?.id);

  return (
    <DashboardClient
      user={user}
      remainingCredits={remainingCredits}
    />
  );
}
