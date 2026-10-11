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
  const { container } = render(
    <MemoryRouter>
      <ThemeProvider>
        <MoreSheet groups={groups} onClose={onClose} />
      </ThemeProvider>
    </MemoryRouter>,
  );
  const overlay = container.querySelector('.sheet-overlay') as HTMLElement;
  return { onClose, overlay };
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
});
