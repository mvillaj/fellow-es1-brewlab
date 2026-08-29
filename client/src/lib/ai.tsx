import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { AiStatus } from '@brewlab/shared';
import { api } from './api';

/**
 * Whether the server has a model key. Fetched once and shared, because two
 * separate pages need it before they decide whether their control is usable.
 */
const Ctx = createContext<AiStatus>({ enabled: false });

export function AiProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AiStatus>({ enabled: false });

  useEffect(() => {
    api<AiStatus>('/ai/status')
      .then(setStatus)
      // A server that cannot answer is a server without the feature.
      .catch(() => setStatus({ enabled: false, reason: 'The server did not report AI status.' }));
  }, []);

  const value = useMemo(() => status, [status]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAi(): AiStatus {
  return useContext(Ctx);
}
