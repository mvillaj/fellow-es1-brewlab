/**
 * The slice of a Clerk user this app reads. Structural rather than Clerk's own
 * `User` type, so the derivation can be tested with a plain object.
 */
export interface ClerkProfile {
  firstName: string | null;
  lastName: string | null;
  username: string | null;
  primaryEmailAddress?: { emailAddress: string } | null;
  emailAddresses: { emailAddress: string }[];
}

/**
 * What the local users row mirrors from Clerk: a name for the UI to show and an
 * email for the admin list. Shared by first-sight provisioning and by the
 * account page, so a renamed user reads the same as a newly signed-up one.
 */
export function profileFromClerk(
  clerkSubject: string,
  profile: ClerkProfile,
): { email: string; displayName: string } {
  const email =
    profile.primaryEmailAddress?.emailAddress ?? profile.emailAddresses[0]?.emailAddress ?? null;
  const displayName =
    [profile.firstName, profile.lastName].filter(Boolean).join(' ').trim() ||
    profile.username ||
    email?.split('@')[0] ||
    'Brewer';

  // `email` is UNIQUE and Clerk allows accounts without one (phone-only, some
  // OAuth providers). Fall back to a per-user synthetic address rather than
  // letting the insert fail and locking the account out of its own bench.
  return { email: email ?? `${clerkSubject}@clerk.local`, displayName };
}

/**
 * Clerk's API errors carry a readable `longMessage` per field ("first_name is
 * not a valid parameter for this request" when names are turned off for the
 * instance). Surface that rather than the generic "Unprocessable Entity".
 */
export function clerkErrorMessage(err: unknown): string {
  const first = (err as { errors?: { longMessage?: string; message?: string }[] })?.errors?.[0];
  return first?.longMessage ?? first?.message ?? 'Clerk would not save that change. Try again.';
}
