export function getRemainingCredits(balance) {
  const monthlyRemaining = Math.max(0, balance.monthly_quota - balance.monthly_used);
  return monthlyRemaining + balance.pack_balance;
}

export function assertCanConsume(balance) {
  if (getRemainingCredits(balance) <= 0) {
    const err = new Error('Insufficient credits');
    err.code = 'insufficient_credits';
    throw err;
  }
}

export function computeConsume(balance) {
  assertCanConsume(balance);

  if (balance.monthly_used < balance.monthly_quota) {
    return { ...balance, monthly_used: balance.monthly_used + 1 };
  }

  return { ...balance, pack_balance: balance.pack_balance - 1 };
}
