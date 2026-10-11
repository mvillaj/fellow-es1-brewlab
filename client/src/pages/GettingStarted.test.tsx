import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RECOMMENDED_MACHINES, sortByPrice } from '@brewlab/shared';
import GettingStarted from './GettingStarted';

const markOnboarded = vi.fn(async () => {});
const reload = vi.fn(async () => {});
let machines: { id: string; name: string; isDefault: boolean }[] = [];

vi.mock('../lib/auth', () => ({
  useAuth: () => ({ markOnboarded }),
}));

vi.mock('../lib/machines', () => ({
  useMachines: () => ({
    machines,
    active: machines[0] ?? null,
    capabilities: { profiling: 'none', cloud: null },
    ready: true,
    reload,
  }),
}));

const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });

function stubFetch() {
  const fetch = vi.fn(async (_url: string, _init?: RequestInit) => json([]));
  vi.stubGlobal('fetch', fetch);
  return fetch;
}

const renderPage = (path = '/getting-started') =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/getting-started" element={<GettingStarted />} />
        <Route path="/" element={<h1>Dashboard</h1>} />
      </Routes>
    </MemoryRouter>,
  );

const machineNames = () =>
  within(screen.getByRole('region', { name: 'Machines' }))
    .getAllByRole('heading', { level: 3 })
    .map((h) => h.textContent);

beforeEach(() => {
  machines = [];
  window.scrollTo = vi.fn() as typeof window.scrollTo;
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('Getting started', () => {
  it('shows a beginner the basics before asking about gear', () => {
    stubFetch();
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /I'm new to it/ }));
    expect(screen.getByRole('heading', { name: 'Espresso in four ideas' })).toBeTruthy();
    expect(screen.getByText('Step 2 of 4')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /Got it/ }));
    expect(screen.getByRole('heading', { name: 'Do you have an espresso machine?' })).toBeTruthy();
  });

  it('takes someone who has pulled shots straight to their gear', () => {
    stubFetch();
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /I've pulled shots/ }));
    expect(screen.getByRole('heading', { name: 'Do you have an espresso machine?' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Espresso in four ideas' })).toBeNull();
    expect(screen.getByText('Step 2 of 3')).toBeTruthy();
  });

  it('shows a shopping guide without a machine, and sorts it by price both ways', () => {
    stubFetch();
    renderPage('/getting-started?step=gear');
    fireEvent.click(screen.getByRole('button', { name: /Not yet/ }));

    const name = (r: (typeof RECOMMENDED_MACHINES)[number]) => `${r.brand} ${r.model}`;
    expect(machineNames()).toEqual(sortByPrice(RECOMMENDED_MACHINES, 'asc').map(name));

    fireEvent.click(screen.getByRole('button', { name: 'High to low' }));
    expect(machineNames()).toEqual(sortByPrice(RECOMMENDED_MACHINES, 'desc').map(name));
  });

  it('puts a grinder on the bench from the guide', async () => {
    const fetch = stubFetch();
    renderPage('/getting-started?step=shop');
    const grinders = within(screen.getByRole('region', { name: 'Grinders' }));
    fireEvent.click(grinders.getAllByRole('button', { name: 'I have this' })[0]);

    await waitFor(() => expect(grinders.getByText('On your bench')).toBeTruthy());
    const [url, init] = fetch.mock.calls.find(([u]) => u === '/api/grinders')!;
    expect(url).toBe('/api/grinders');
    expect(JSON.parse(String(init?.body))).toMatchObject({
      builtInId: 'timemore-c3-esp',
      isDefault: true,
    });
  });

  it('adds the machine and grinder someone already owns', async () => {
    const fetch = stubFetch();
    renderPage('/getting-started?step=gear');
    fireEvent.click(screen.getByRole('button', { name: /Yes, I have one/ }));

    const save = await screen.findByRole('button', { name: 'Add to my bench' });
    await waitFor(() => expect((save as HTMLButtonElement).disabled).toBe(false));
    fireEvent.change(screen.getByLabelText('Machine'), { target: { value: 'gaggia-classic-pro' } });
    fireEvent.change(screen.getByLabelText('Grinder'), { target: { value: 'niche-zero' } });
    fireEvent.click(save);

    await waitFor(() => expect(reload).toHaveBeenCalled());
    const posts = fetch.mock.calls.filter(([, init]) => init?.method === 'POST');
    const body = (path: string) => JSON.parse(String(posts.find(([u]) => u === path)![1]!.body));
    // Not an ES1, so it goes on as the generic machine under its real name.
    expect(body('/api/machines')).toMatchObject({
      builtInId: 'generic-espresso',
      name: 'Gaggia Classic Pro',
      isDefault: true,
    });
    expect(body('/api/grinders')).toMatchObject({ builtInId: 'niche-zero', isDefault: true });
  });

  it('skipping marks getting started done and goes to the dashboard', async () => {
    stubFetch();
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Skip for now' }));
    await screen.findByRole('heading', { name: 'Dashboard' });
    expect(markOnboarded).toHaveBeenCalledTimes(1);
  });

  it('without a machine, the first-shot walkthrough ends in Finish', async () => {
    stubFetch();
    renderPage('/getting-started?step=shot');
    expect(screen.getByRole('heading', { name: 'Your first shot' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /log it/i })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Finish' }));
    await screen.findByRole('heading', { name: 'Dashboard' });
    expect(markOnboarded).toHaveBeenCalledTimes(1);
  });

  it('with a machine already on the bench, says so instead of asking', () => {
    machines = [{ id: 'mch_1', name: 'Fellow Espresso Series 1', isDefault: true }];
    stubFetch();
    renderPage('/getting-started?step=gear');
    expect(screen.getByRole('heading', { name: "You're set up" })).toBeTruthy();
    expect(screen.getByText(/Fellow Espresso Series 1/)).toBeTruthy();
  });
});
