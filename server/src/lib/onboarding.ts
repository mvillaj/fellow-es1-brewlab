import type { DatabaseSync } from 'node:sqlite';

/**
 * Records that a user finished or skipped getting started. Only the first call
 * writes: replaying the page later must not move the date they joined in.
 * The database is passed in so this can be tested against an in-memory one.
 */
export function markOnboarded(db: DatabaseSync, userId: string, now: string) {
  db.prepare('UPDATE users SET onboarded_at = ? WHERE id = ? AND onboarded_at IS NULL').run(now, userId);
}
