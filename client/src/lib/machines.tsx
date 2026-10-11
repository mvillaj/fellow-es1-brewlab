import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  activeMachine,
  capabilitiesOf,
  NO_MACHINE_CAPABILITIES,
  type Machine,
  type MachineCapabilities,
} from '@brewlab/shared';
import { api } from './api';
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
  const { user, initialMachines } = useAuth();
  const userId = user?.id ?? null;
  const [machines, setMachines] = useState<Machine[]>([]);
  // Whose bench `machines` is: null for signed out, undefined before any load.
  // `ready` used to be a plain boolean that the signed-out pass set before the
  // user had loaded, and nothing reset it when they arrived. For one render the
  // app had a user but no capabilities, so a deep link to /fellow or /profiles
  // matched no route and the catch-all sent it home.
  const [loadedFor, setLoadedFor] = useState<string | null | undefined>(undefined);

  const reload = useCallback(async () => {
    if (!userId) {
      setMachines([]);
      setLoadedFor(null);
      return;
    }
    let next: Machine[] = [];
    try {
      next = await api<Machine[]>('/machines');
    } catch {
      // A bench we cannot read is a bench with nothing on it: the app degrades to
      // the plain logbook rather than erroring out of the shell.
    }
    setMachines(next);
    setLoadedFor(userId);
  }, [userId]);

  // The first load for a user comes with /auth/me, so a reload of the page
  // costs one round trip rather than two in a row. Later reloads (after adding
  // a machine, say) go to /machines as before. Keyed on the user, not on
  // initialMachines, so an account update that swaps the user object leaves
  // the bench alone.
  useEffect(() => {
    if (userId && initialMachines) {
      setMachines(initialMachines);
      setLoadedFor(userId);
      return;
    }
    void reload();
    // Deliberately keyed on the user alone, through reload (see above).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reload]);

  const ready = loadedFor === userId;

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
