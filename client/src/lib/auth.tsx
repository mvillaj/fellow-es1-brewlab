import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useAuth as useClerkAuth } from '@clerk/clerk-react';
import type { Machine, Me, PublicUser } from '@brewlab/shared';
import { api, setTokenGetter } from './api';

interface AuthState {
  /** The local profile row, not the Clerk one — routes key off `users.id`. */
  user: PublicUser | null;
  ready: boolean;
  /** Clerk has a session, whether or not `/auth/me` has answered yet. */
  signedIn: boolean;
  /**
   * The bench as `/auth/me` returned it, so MachineProvider can start from it
   * instead of asking again. Null until then, and after sign-out.
   */
  initialMachines: Machine[] | null;
  logout: () => void;
  /** Swap in the profile the server returned after an account change. */
  setUser: (user: PublicUser) => void;
  /** Getting started is done or skipped; stop sending them there. */
  markOnboarded: () => Promise<void>;
}

const Ctx = createContext<AuthState | null>(null);

/**
 * Bridges Clerk's session into the shape the app already speaks. Clerk answers
 * "who is signed in"; `/auth/me` answers "which local bench is theirs", and
 * calling it is also what provisions that bench the first time.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn, getToken, signOut } = useClerkAuth();
  const [user, setUser] = useState<PublicUser | null>(null);
  const [initialMachines, setInitialMachines] = useState<Machine[] | null>(null);
  const [ready, setReady] = useState(false);

  // Registered during render rather than in an effect on purpose: React runs
  // child effects before the parent's, so MachineProvider's first fetch would
  // otherwise go out before the getter existed and get a 401.
  setTokenGetter(getToken);

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      setUser(null);
      setInitialMachines(null);
      setReady(true);
      return;
    }

    let cancelled = false;
    setReady(false);
    api<Me>('/auth/me')
      .then(({ machines, ...u }) => {
        if (cancelled) return;
        setInitialMachines(machines);
        setUser(u);
      })
      .catch(() => {
        if (!cancelled) setUser(null);
      })
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn]);

  const value = useMemo<AuthState>(
    () => ({
      user,
      ready,
      signedIn: Boolean(isLoaded && isSignedIn),
      initialMachines,
      logout: () => {
        setUser(null);
        setInitialMachines(null);
        void signOut();
      },
      setUser,
      markOnboarded: async () => {
        setUser(await api<PublicUser>('/auth/me/onboarded', { method: 'POST' }));
      },
    }),
    [user, ready, isLoaded, isSignedIn, initialMachines, signOut],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
