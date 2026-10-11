import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { FellowConnectionStatus } from '@brewlab/shared';
import Fellow from './Fellow';

const json = (status: number, body?: unknown) =>
  new Response(body === undefined ? null : JSON.stringify(body), { status });

/** A tiny fake of the three Fellow routes the page touches before connecting. */
function fakeServer(initial: FellowConnectionStatus) {
  let status = initial;
  const fetch = vi.fn(async (url: string, init?: RequestInit) => {
    if (url === '/api/fellow/status') return json(200, status);
    if (url === '/api/fellow/opt-in' && init?.method === 'POST') {
      status = { ...status, optedIn: true };
      return json(204);
    }
    if (url === '/api/fellow/opt-out' && init?.method === 'POST') {
      status = { optedIn: false, connected: false, devices: [] };
      return json(204);
    }
    return json(404, { error: `unexpected ${url}` });
  });
  vi.stubGlobal('fetch', fetch);
  return fetch;
}

const renderPage = () =>
  render(
    <MemoryRouter>
      <Fellow />
    </MemoryRouter>,
  );

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Fellow page', () => {
  it('shows only the warning until the user opts in', async () => {
    fakeServer({ optedIn: false, connected: false, devices: [] });
    renderPage();
    expect(await screen.findByText(/read before turning on/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/fellow email/i)).not.toBeInTheDocument();
  });

  it('will not turn on until the box is ticked, then sends an explicit yes', async () => {
    const fetch = fakeServer({ optedIn: false, connected: false, devices: [] });
    renderPage();

    const enable = await screen.findByRole('button', { name: /turn on the fellow integration/i });
    expect(enable).toBeDisabled();

    fireEvent.click(screen.getByRole('checkbox', { name: /at my own risk/i }));
    expect(enable).toBeEnabled();
    fireEvent.click(enable);

    expect(await screen.findByLabelText(/fellow email/i)).toBeInTheDocument();
    const optIn = fetch.mock.calls.find(([url]) => url === '/api/fellow/opt-in');
    expect(JSON.parse(String(optIn?.[1]?.body))).toEqual({ accept: true });
  });

  it('turning it off brings the warning back', async () => {
    fakeServer({ optedIn: true, connected: false, devices: [] });
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: /^turn off$/i }));

    await waitFor(() => expect(screen.getByText(/read before turning on/i)).toBeInTheDocument());
    expect(screen.queryByLabelText(/fellow email/i)).not.toBeInTheDocument();
  });
});
