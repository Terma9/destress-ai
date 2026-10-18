/**
 * Date helpers for streaks, greetings and weekly stats.
 * All date keys are local-time YYYY-MM-DD strings.
 */

export function dateKey(d: Date): string {
  const y = d.getFullYear();
  const m = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function todayKey(): string {
  return dateKey(new Date());
}

/**
 * Consecutive-day streak ending today (or yesterday, so the streak doesn't
 * show 0 before the user has checked in today).
 */
export function computeStreak(dates: string[]): number {
  if (dates.length === 0) return 0;
  const set = new Set(dates);
  const cursor = new Date();
  // Streak may start today or yesterday
  if (!set.has(dateKey(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
    if (!set.has(dateKey(cursor))) return 0;
  }
  let streak = 0;
  while (set.has(dateKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good Morning';
  if (h < 17) return 'Good Afternoon';
  return 'Good Evening';
}

/** Timestamp (ms) for 7 days ago — used for "this week" counts. */
export function startOfLast7Days(): number {
  return Date.now() - 7 * 24 * 60 * 60 * 1000;
}
