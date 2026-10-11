import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { MoreSheet, navFor } from './App';
import { ThemeProvider } from './lib/theme';

vi.mock('./lib/auth', () => ({
  useAuth: () => ({ user: { displayName: 'Tester' }, logout: vi.fn() }),
}));

function renderSheet() {
  const onClose = vi.fn();
  const groups = navFor({ profiling: 'pressure', cloud: 'fellow' });
  const { container, unmount } = render(
    <MemoryRouter>
      <ThemeProvider>
        <MoreSheet groups={groups} onClose={onClose} />
      </ThemeProvider>
    </MemoryRouter>,
  );
  const overlay = container.querySelector('.sheet-overlay') as HTMLElement;
  return { onClose, overlay, unmount };
}

describe('MoreSheet', () => {
  // iOS Safari never sends mousedown for a tap on the backdrop, only click.
  it('closes when the backdrop is clicked', () => {
    const { onClose, overlay } = renderSheet();
    fireEvent.click(overlay);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('stays open when the sheet itself is clicked', () => {
    const { onClose } = renderSheet();
    fireEvent.click(screen.getByRole('dialog', { name: 'More' }));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('closes on Escape', () => {
    const { onClose } = renderSheet();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes from its Close button', () => {
    const { onClose } = renderSheet();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('holds the page still while open and releases it on close', () => {
    const { unmount } = renderSheet();
    expect(document.documentElement.style.overflow).toBe('hidden');
    unmount();
    expect(document.documentElement.style.overflow).toBe('');
  });
});

describe('navFor', () => {
  const links = (caps: Parameters<typeof navFor>[0]) =>
    navFor(caps).flatMap((g) => g.links.map((l) => l.to));

  it('always offers My account, with or without a Fellow machine', () => {
    expect(links({ profiling: 'none', cloud: null })).toContain('/account');
    expect(links({ profiling: 'pressure', cloud: 'fellow' })).toContain('/account');
  });

  it('lists My account first in Settings, above the Fellow one', () => {
    const account = navFor({ profiling: 'pressure', cloud: 'fellow' }).find((g) => g.section === 'Settings');
    expect(account?.links.map((l) => l.to)).toEqual(['/account', '/fellow']);
  });
});
