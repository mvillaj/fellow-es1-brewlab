import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { AuthResponse, PublicUser } from '@brewlab/shared';
import { api, getToken, setToken } from './api';

interface AuthState {
  user: PublicUser | null;
  ready: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, displayName: string) => Promise<void>;
  logout: () => void;
}

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!getToken()) {
      setReady(true);
      return;
    }
    api<PublicUser>('/auth/me')
      .then(setUser)
      .catch(() => setToken(null))
      .finally(() => setReady(true));
  }, []);

  const authenticate = useCallback(async (path: string, body: unknown) => {
    const res = await api<AuthResponse>(path, { method: 'POST', body });
    setToken(res.token);
    setUser(res.user);
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      user,
      ready,
      login: (email, password) => authenticate('/auth/login', { email, password }),
      signup: (email, password, displayName) =>
        authenticate('/auth/signup', { email, password, displayName }),
      logout: () => {
        setToken(null);
        setUser(null);
      },
    }),
    [user, ready, authenticate],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
