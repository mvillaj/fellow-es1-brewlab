import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  activeMachine,
  capabilitiesOf,
  NO_MACHINE_CAPABILITIES,
  type Machine,
  type MachineCapabilities,
} from '@brewlab/shared';
import { api, getToken } from './api';
import { useAuth } from './auth';

/**
 * What the bench can do, hoisted to the top of the app.
 *
 * The nav needs this before it renders a single link, and the shot form needs
 * the same list, so it is fetched once here rather than per page. Capabilities
 * come from the default machine — the one the shot form pre-selects — so what
 * you see in the sidebar always matches what you are about to log a shot on.
 */
interface MachineState {
  machines: Machine[];
  active: Machine | null;
  capabilities: MachineCapabilities;
  ready: boolean;
  reload: () => Promise<void>;
}

const Ctx = createContext<MachineState | null>(null);

export function MachineProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [machines, setMachines] = useState<Machine[]>([]);
  const [ready, setReady] = useState(false);

  const reload = useCallback(async () => {
    if (!getToken()) {
      setMachines([]);
      setReady(true);
      return;
    }
    try {
      setMachines(await api<Machine[]>('/machines'));
    } catch {
      // A bench we cannot read is a bench with nothing on it: the app degrades to
      // the plain logbook rather than erroring out of the shell.
      setMachines([]);
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload, user?.id]);

  const value = useMemo<MachineState>(() => {
    const active = activeMachine(machines);
    return {
      machines,
      active,
      capabilities: active ? capabilitiesOf(active) : NO_MACHINE_CAPABILITIES,
      ready,
      reload,
    };
  }, [machines, ready, reload]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useMachines(): MachineState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useMachines must be used inside MachineProvider');
  return ctx;
}
