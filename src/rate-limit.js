export const FREE_DAILY_LIMIT = 50;

export function getUtcDay(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

export function getFreeExtractIp(headers) {
  const forwardedFor = headers.get('x-forwarded-for');
  const firstForwardedIp = forwardedFor?.split(',')[0]?.trim();
  if (firstForwardedIp) return firstForwardedIp;

  const realIp = headers.get('x-real-ip')?.trim();
  return realIp || 'unknown';
}

export async function checkFreeIpLimit(db, ip, { limit = FREE_DAILY_LIMIT, day = getUtcDay() } = {}) {
  const result = await db.execute({
    sql: 'SELECT count FROM free_ip_usage WHERE ip = ? AND day = ?',
    args: [ip || 'unknown', day],
  });
  const rawCount = Number(result.rows[0]?.count ?? 0);
  const count = Number.isFinite(rawCount) ? rawCount : 0;
  const remaining = Math.max(limit - count, 0);

  return {
    allowed: count < limit,
    remaining,
    limit,
  };
}

export async function incrementFreeIpUsage(db, ip, day) {
  await db.execute({
    sql: `INSERT INTO free_ip_usage (ip, day, count)
          VALUES (?, ?, 1)
          ON CONFLICT(ip, day) DO UPDATE SET count = count + 1`,
    args: [ip || 'unknown', day],
  });
}
