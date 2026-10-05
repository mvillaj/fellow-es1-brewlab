import { createClerkClient } from '@clerk/backend';
import { clerkSetup } from '@clerk/testing/playwright';
import { E2E_EMAIL } from './constants';

export default async function globalSetup() {
  const secretKey = process.env.CLERK_SECRET_KEY ?? '';
  // This setup creates a user, and the suite then writes coffees as them. That is
  // fine on a development instance and never fine on production.
  if (!secretKey.startsWith('sk_test_')) {
    throw new Error('E2E tests need a Clerk development instance: CLERK_SECRET_KEY must be an sk_test_ key.');
  }

  // Fetches a testing token so Clerk's bot protection lets the browser through.
  await clerkSetup();

  // Make sure the test user exists, so a fresh Clerk instance or CI needs no
  // manual step. Sign-in uses a backend-issued ticket, so it has no password.
  const clerk = createClerkClient({ secretKey });
  const { data } = await clerk.users.getUserList({ emailAddress: [E2E_EMAIL] });
  if (data.length === 0) {
    await clerk.users.createUser({
      emailAddress: [E2E_EMAIL],
      firstName: 'E2E',
      lastName: 'Brewer',
      skipPasswordRequirement: true,
    });
  }
}
