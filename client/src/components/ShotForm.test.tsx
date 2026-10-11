import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { GRINDERS_BY_ID, type Grinder } from '@brewlab/shared';
import ShotForm from './ShotForm';

vi.mock('../lib/machines', () => ({
  useMachines: () => ({ machines: [], active: null, capabilities: { profiling: 'none', cloud: null } }),
}));

function grinder(builtInId: string): Grinder {
  const spec = GRINDERS_BY_ID[builtInId];
  return {
    id: `grd_${builtInId}`,
    userId: 'usr_1',
    builtInId,
    name: `${spec.brand} ${spec.model}`,
    burrType: spec.burrType,
    scale: spec.scale,
    calibration: spec.calibration,
    isDefault: true,
    notes: null,
    createdAt: '2026-10-11T00:00:00Z',
  };
}

function renderForm(g: Grinder) {
  render(<ShotForm coffees={[]} grinders={[g]} profiles={[]} onSaved={() => {}} />);
  return screen.getByLabelText(/Grind setting/);
}

describe('ShotForm grind setting', () => {
  it('shows the micron estimate for a setting on the dial', async () => {
    const input = renderForm(grinder('fellow-opus-2'));
    await userEvent.type(input, '1');
    expect(screen.getByText(/≈ 300 µm/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /log shot/i })).toBeEnabled();
  });

  it('blocks a setting past the end of the dial', async () => {
    const input = renderForm(grinder('fellow-opus-2'));
    await userEvent.type(input, '12');
    expect(screen.getByText('Fellow Opus 2 goes from 0 to 10')).toBeInTheDocument();
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('button', { name: /log shot/i })).toBeDisabled();
  });

  it('blocks a half click on a clicked dial', async () => {
    const input = renderForm(grinder('fellow-opus'));
    await userEvent.type(input, '4.5');
    expect(screen.getByText('Fellow Opus moves in steps of 1')).toBeInTheDocument();
  });
});
