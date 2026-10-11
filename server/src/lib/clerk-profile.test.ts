import assert from 'node:assert/strict';
import { test } from 'node:test';
import { clerkErrorMessage, profileFromClerk, type ClerkProfile } from './clerk-profile.ts';

const base: ClerkProfile = {
  firstName: null,
  lastName: null,
  username: null,
  primaryEmailAddress: null,
  emailAddresses: [],
};

test('first and last name make the display name', () => {
  const out = profileFromClerk('user_1', {
    ...base,
    firstName: 'Ada',
    lastName: 'Lovelace',
    primaryEmailAddress: { emailAddress: 'ada@example.com' },
  });
  assert.deepEqual(out, { email: 'ada@example.com', displayName: 'Ada Lovelace' });
});

test('a first name alone has no trailing space', () => {
  assert.equal(
    profileFromClerk('user_1', { ...base, firstName: 'Ada', lastName: '' }).displayName,
    'Ada',
  );
});

test('without a name it falls back to username, then the email local part', () => {
  assert.equal(profileFromClerk('user_1', { ...base, username: 'ada' }).displayName, 'ada');
  assert.equal(
    profileFromClerk('user_1', {
      ...base,
      emailAddresses: [{ emailAddress: 'lovelace@example.com' }],
    }).displayName,
    'lovelace',
  );
  assert.equal(profileFromClerk('user_1', base).displayName, 'Brewer');
});

test('the primary email wins over the first one on the list', () => {
  const out = profileFromClerk('user_1', {
    ...base,
    primaryEmailAddress: { emailAddress: 'new@example.com' },
    emailAddresses: [{ emailAddress: 'old@example.com' }, { emailAddress: 'new@example.com' }],
  });
  assert.equal(out.email, 'new@example.com');
});

test('an account with no email gets a per-user synthetic one', () => {
  assert.equal(profileFromClerk('user_9', base).email, 'user_9@clerk.local');
});

test("Clerk's long message is what the user sees", () => {
  const err = {
    errors: [{ message: 'is invalid', longMessage: 'first_name is not a valid parameter' }],
  };
  assert.equal(clerkErrorMessage(err), 'first_name is not a valid parameter');
  assert.equal(clerkErrorMessage({ errors: [{ message: 'is invalid' }] }), 'is invalid');
  assert.match(clerkErrorMessage(new Error('boom')), /would not save/);
});
