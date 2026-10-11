import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MachineProvider, useMachines } from './machines';

let currentUser: { id: string } | null = null;
let initialMachines: unknown[] | null = null;
vi.mock('./auth', () => ({ useAuth: () => ({ user: currentUser, initialMachines }) }));

function Probe() {
  const { ready, capabilities } = useMachines();
  return <div data-testid="probe">{ready ? `ready:${capabilities.cloud}` : 'loading'}</div>;
}

const es1 = {
  id: 'mac_1',
  userId: 'usr_1',
  builtInId: 'fellow-es1',
  name: 'ES1',
  capabilities: { profiling: 'pressure', cloud: 'fellow' },
  limits: {},
  isDefault: true,
  notes: null,
  createdAt: '2026-10-11T00:00:00Z',
};

afterEach(() => {
  vi.unstubAllGlobals();
  currentUser = null;
  initialMachines = null;
});

describe('MachineProvider', () => {
  // The /fellow deep-link bug: ready from the signed-out pass carried over to
  // the signed-in render before the bench loaded, so the route was not mounted.
  it('is not ready for a newly signed-in user until their bench has loaded', async () => {
    let resolve: ((r: Response) => void) | undefined;
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise<Response>((r) => (resolve = r))),
    );

    const { rerender } = render(
      <MachineProvider>
        <Probe />
      </MachineProvider>,
    );
    expect(await screen.findByText('ready:null')).toBeInTheDocument();

    currentUser = { id: 'usr_1' };
    rerender(
      <MachineProvider>
        <Probe />
      </MachineProvider>,
    );
    expect(screen.getByTestId('probe')).toHaveTextContent('loading');

    await waitFor(() => expect(resolve).toBeDefined());
    expect(screen.getByTestId('probe')).toHaveTextContent('loading');
    await act(async () => resolve!(new Response(JSON.stringify([es1]), { status: 200 })));
    expect(screen.getByTestId('probe')).toHaveTextContent('ready:fellow');
  });

  // /auth/me already carries the bench, so a page reload should not wait on a
  // second request before the shell can draw.
  it('starts from the bench /auth/me sent instead of fetching it again', () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    currentUser = { id: 'usr_1' };
    initialMachines = [es1];

    render(
      <MachineProvider>
        <Probe />
      </MachineProvider>,
    );
    expect(screen.getByTestId('probe')).toHaveTextContent('ready:fellow');
    expect(fetch).not.toHaveBeenCalled();
  });
});
