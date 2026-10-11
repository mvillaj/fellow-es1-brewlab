import { useEffect, useRef, useState } from 'react';
import { useClerk, useUser } from '@clerk/clerk-react';
import type { PublicUser } from '@brewlab/shared';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useClerkAppearance } from '../lib/clerkAppearance';
import { Banner, Field } from '../components/ui';
import { FinishPicker, ThemeToggle } from '../components/Appearance';

const memberSince = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });

/**
 * The Mousetail account itself, as opposed to the Fellow one below it in the
 * nav. Clerk owns everything here: the name form goes through our server to
 * Clerk so the local copy stays in step, and email, password and sign-in
 * methods open Clerk's own dialog, which handles verification for us.
 */
export default function Account() {
  const { user, setUser, logout } = useAuth();
  const { user: clerkUser } = useUser();
  const clerk = useClerk();
  const appearance = useClerkAppearance();

  const [firstName, setFirstName] = useState(clerkUser?.firstName ?? '');
  const [lastName, setLastName] = useState(clerkUser?.lastName ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // Clerk's dialog changes the account without telling our server. When Clerk
  // reports a newer profile than the one this page opened with, or an email the
  // local copy does not have yet, pull it across.
  const stamp = clerkUser?.updatedAt?.getTime();
  const clerkEmail = clerkUser?.primaryEmailAddress?.emailAddress;
  const seen = useRef<number | undefined>(stamp);
  const checkedEmail = useRef(false);
  useEffect(() => {
    const emailStale = !checkedEmail.current && clerkEmail !== undefined && clerkEmail !== user?.email;
    checkedEmail.current = true;
    if (!emailStale && stamp === seen.current) return;
    seen.current = stamp;
    api<PublicUser>('/auth/me/sync', { method: 'POST' })
      .then(setUser)
      .catch(() => {
        // Best effort: the next visit tries again, and nothing here depends on it.
      });
    // `user` is left out on purpose: syncing replaces it, and a conflict that
    // keeps the old email must not turn into a loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stamp, clerkEmail, setUser]);

  const manageSignIn = () => clerk.openUserProfile({ appearance });

  const dirty = firstName.trim() !== (clerkUser?.firstName ?? '') || lastName.trim() !== (clerkUser?.lastName ?? '');

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const next = await api<PublicUser>('/auth/me', {
        method: 'PATCH',
        body: { firstName: firstName.trim(), lastName: lastName.trim() },
      });
      setUser(next);
      // Refresh Clerk's copy so the form's baseline matches, and remember the
      // new stamp so the sync above does not fire for our own change.
      const fresh = await clerkUser?.reload();
      seen.current = fresh?.updatedAt?.getTime() ?? seen.current;
      setFirstName(fresh?.firstName ?? firstName.trim());
      setLastName(fresh?.lastName ?? lastName.trim());
      setSaved(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="account-page">
      <div className="page-head">
        <h1>My account</h1>
        <p>
          Your Mousetail profile, sign-in and appearance. This is separate from any Fellow account you connect.
        </p>
      </div>

      <section className="card">
        <div className="card-head">
          <h2>Profile</h2>
          {user ? <span className="small faint">Member since {memberSince(user.createdAt)}</span> : null}
        </div>
        <form onSubmit={save} className="stack account-form">
          <div className="grid grid-2">
            <Field label="First name">
              <input
                value={firstName}
                onChange={(e) => {
                  setFirstName(e.target.value);
                  setSaved(false);
                }}
                autoComplete="given-name"
                maxLength={256}
                required
              />
            </Field>
            <Field label="Last name">
              <input
                value={lastName}
                onChange={(e) => {
                  setLastName(e.target.value);
                  setSaved(false);
                }}
                autoComplete="family-name"
                maxLength={256}
              />
            </Field>
          </div>
          {/* Not an input: Clerk has to verify a new address, so the change
              happens in its dialog and this only shows where to go. */}
          <Field label="Email">
            <div className="account-email">
              <span>{clerkEmail ?? user?.email}</span>
              <button className="btn btn-ghost btn-sm" type="button" onClick={manageSignIn}>
                Change
              </button>
            </div>
          </Field>
          {error ? <Banner kind="bad">{error}</Banner> : null}
          {saved ? <Banner kind="good">Saved.</Banner> : null}
          <div>
            <button className="btn btn-primary" type="submit" disabled={busy || !dirty || !firstName.trim()}>
              {busy ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </form>
      </section>

      <section className="card">
        <div className="card-head">
          <h2>Sign-in and security</h2>
        </div>
        <div className="account-rows">
          <div className="account-row">
            <p className="small dim">
              Email addresses, password, connected Google or Apple accounts, and the devices you are signed in on.
            </p>
            <button className="btn btn-sm" type="button" onClick={manageSignIn}>
              Manage sign-in
            </button>
          </div>
          <div className="account-row">
            <p className="small dim">Sign out of Mousetail on this device.</p>
            <button className="btn btn-ghost btn-sm" type="button" onClick={logout}>
              Sign out
            </button>
          </div>
        </div>
      </section>

      <section className="card">
        <div className="card-head">
          <h2>Appearance</h2>
        </div>
        <div className="grid grid-2">
          <div className="stack-sm">
            <h3 className="small dim">Theme</h3>
            <ThemeToggle />
          </div>
          <div className="stack-sm">
            <h3 className="small dim">Colour</h3>
            <FinishPicker />
          </div>
        </div>
      </section>
    </div>
  );
}
