import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useAuth as useClerkAuth } from '@clerk/clerk-react';
import type { PublicUser } from '@brewlab/shared';
import { api, setTokenGetter } from './api';

interface AuthState {
  /** The local profile row, not the Clerk one — routes key off `users.id`. */
  user: PublicUser | null;
  ready: boolean;
  logout: () => void;
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
  const [ready, setReady] = useState(false);

  // Registered during render rather than in an effect on purpose: React runs
  // child effects before the parent's, so MachineProvider's first fetch would
  // otherwise go out before the getter existed and get a 401.
  setTokenGetter(getToken);

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      setUser(null);
      setReady(true);
      return;
    }

    let cancelled = false;
    setReady(false);
    api<PublicUser>('/auth/me')
      .then((u) => {
        if (!cancelled) setUser(u);
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
      logout: () => {
        setUser(null);
        void signOut();
      },
    }),
    [user, ready, signOut],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
