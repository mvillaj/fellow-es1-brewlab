import { act, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LOADING_DELAY_MS } from '../lib/delay';
import { ThemeProvider } from '../lib/theme';
import Dashboard from './Dashboard';

vi.mock('../lib/auth', () => ({
  useAuth: () => ({ user: { id: 'usr_1', displayName: 'Ada Lovelace' } }),
}));

// What each endpoint has answered so far. Null data with no error is still loading.
let answers: Record<string, unknown> = {};
vi.mock('../lib/api', () => ({
  useApi: (path: string) => ({
    data: path in answers ? answers[path] : null,
    error: null,
    loading: !(path in answers),
    reload: vi.fn(),
    setData: vi.fn(),
  }),
}));

const loaded = {
  '/shots?limit=200': [],
  '/shots/meta/stats': {
    total: 0,
    avgRating: null,
    avgTimeS: null,
    avgRatio: null,
    goodShots: 0,
    activeDaysLast30: 0,
  },
  '/coffees': [],
  '/grinders': [],
  '/profiles': [],
};

const renderPage = () =>
  render(
    <MemoryRouter>
      <ThemeProvider>
        <Dashboard />
      </ThemeProvider>
    </MemoryRouter>,
  );

beforeEach(() => {
  vi.useFakeTimers();
  answers = {};
});

afterEach(() => {
  vi.useRealTimers();
});

// Short placeholders that grew into full cards a moment later pushed the whole
// page down on every reload.
describe('Dashboard first load', () => {
  it('shows only the greeting while a quick load is in flight', () => {
    renderPage();
    expect(screen.getByRole('heading', { level: 1, name: /, Ada$/ })).toBeTruthy();
    expect(screen.queryByText('Loading your last shot…')).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Recent shots' })).toBeNull();
  });

  it('brings in the placeholders once the load runs long', () => {
    renderPage();
    act(() => vi.advanceTimersByTime(LOADING_DELAY_MS));
    expect(screen.getByText('Loading your last shot…')).toBeTruthy();
  });

  it('waits for the stats too, so their strip never slots in between the cards', () => {
    answers = { ...loaded };
    delete answers['/shots/meta/stats'];
    renderPage();
    expect(screen.queryByRole('heading', { name: 'Recent shots' })).toBeNull();
  });

  it('draws the cards at full size once everything is in', () => {
    answers = { ...loaded };
    renderPage();
    expect(screen.getByRole('heading', { name: 'Pull your first shot' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Recent shots' })).toBeTruthy();
    expect(screen.queryByText('Loading…')).toBeNull();
  });
});
