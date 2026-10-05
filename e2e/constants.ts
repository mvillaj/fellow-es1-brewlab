/** Saved sign-in session, written by auth.setup.ts and loaded by signed-in specs. */
export const AUTH_FILE = 'e2e/.auth/user.json';

/**
 * A Clerk test address: `+clerk_test` marks it as a test identity in a
 * development instance, so it never receives real mail.
 */
export const E2E_EMAIL = process.env.E2E_CLERK_USER_EMAIL ?? 'e2e+clerk_test@example.com';
