import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PublicUser } from '@brewlab/shared';
import { ThemeProvider } from '../lib/theme';
import Account from './Account';

const local: PublicUser = {
  id: 'usr_1',
  email: 'ada@example.com',
  displayName: 'Ada Lovelace',
  createdAt: '2026-01-02T00:00:00.000Z',
  isAdmin: false,
  onboardedAt: '2026-01-02T00:00:00.000Z',
};

const setUser = vi.fn();
const logout = vi.fn();
const openUserProfile = vi.fn();
let clerkUser: {
  firstName: string | null;
  lastName: string | null;
  updatedAt: Date;
  primaryEmailAddress: { emailAddress: string } | null;
  reload: ReturnType<typeof vi.fn>;
};

vi.mock('../lib/auth', () => ({
  useAuth: () => ({ user: local, setUser, logout }),
}));

vi.mock('@clerk/clerk-react', () => ({
  useUser: () => ({ user: clerkUser }),
  useClerk: () => ({ openUserProfile }),
}));

const json = (status: number, body?: unknown) =>
  new Response(body === undefined ? null : JSON.stringify(body), { status });

function stubFetch(handler: (url: string, init?: RequestInit) => Response) {
  const fetch = vi.fn(async (url: string, init?: RequestInit) => handler(url, init));
  vi.stubGlobal('fetch', fetch);
  return fetch;
}

const renderPage = () =>
  render(
    <MemoryRouter>
      <ThemeProvider>
        <Account />
      </ThemeProvider>
    </MemoryRouter>,
  );

beforeEach(() => {
  clerkUser = {
    firstName: 'Ada',
    lastName: 'Lovelace',
    updatedAt: new Date('2026-10-01T00:00:00Z'),
    primaryEmailAddress: { emailAddress: 'ada@example.com' },
    reload: vi.fn(async () => ({ ...clerkUser, firstName: 'Augusta', updatedAt: new Date('2026-10-11T00:00:00Z') })),
  };
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('Account page', () => {
  it("prefills the form from Clerk and won't save until something changes", () => {
    stubFetch(() => json(404));
    renderPage();
    expect(screen.getByLabelText('First name')).toHaveValue('Ada');
    expect(screen.getByLabelText('Last name')).toHaveValue('Lovelace');
    // Shown, not editable: there is no email textbox to type into.
    expect(screen.getByRole('group', { name: 'Email' })).toHaveTextContent('ada@example.com');
    expect(screen.getAllByRole('textbox')).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled();
  });

  it('will not save a blank first name', () => {
    stubFetch(() => json(404));
    renderPage();
    fireEvent.change(screen.getByLabelText('First name'), { target: { value: '   ' } });
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled();
  });

  it('sends trimmed names to the server and takes the profile it returns', async () => {
    const renamed = { ...local, displayName: 'Augusta Lovelace' };
    const fetch = stubFetch((url, init) =>
      url === '/api/auth/me' && init?.method === 'PATCH' ? json(200, renamed) : json(404),
    );
    renderPage();

    fireEvent.change(screen.getByLabelText('First name'), { target: { value: '  Augusta ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByText('Saved.')).toBeInTheDocument();
    const patch = fetch.mock.calls.find(([url]) => url === '/api/auth/me');
    expect(JSON.parse(String(patch?.[1]?.body))).toEqual({ firstName: 'Augusta', lastName: 'Lovelace' });
    expect(setUser).toHaveBeenCalledWith(renamed);
    expect(clerkUser.reload).toHaveBeenCalled();
    // Our own save must not set off a second round trip to resync.
    expect(fetch.mock.calls.some(([url]) => url === '/api/auth/me/sync')).toBe(false);
  });

  it("shows Clerk's refusal and leaves the local profile alone", async () => {
    stubFetch(() => json(422, { error: 'first_name is not a valid parameter' }));
    renderPage();
    fireEvent.change(screen.getByLabelText('First name'), { target: { value: 'Augusta' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByText('first_name is not a valid parameter')).toBeInTheDocument();
    expect(setUser).not.toHaveBeenCalled();
  });

  it("opens Clerk's own dialog for email, password and sign-in", () => {
    stubFetch(() => json(404));
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Manage sign-in' }));
    fireEvent.click(screen.getByRole('button', { name: 'Change' }));
    expect(openUserProfile).toHaveBeenCalledTimes(2);
  });

  it('pulls the account across when Clerk has an email the local copy lacks', async () => {
    clerkUser.primaryEmailAddress = { emailAddress: 'new@example.com' };
    const synced = { ...local, email: 'new@example.com' };
    const fetch = stubFetch((url) => (url === '/api/auth/me/sync' ? json(200, synced) : json(404)));
    renderPage();
    await waitFor(() => expect(setUser).toHaveBeenCalledWith(synced));
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('does not sync on open when nothing has changed', async () => {
    const fetch = stubFetch(() => json(404));
    renderPage();
    await new Promise((r) => setTimeout(r, 0));
    expect(fetch).not.toHaveBeenCalled();
  });
});
