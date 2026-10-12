import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import BrandLockup from './BrandLockup';

describe('BrandLockup', () => {
  it('shows the wordmark beside a decorative mark', () => {
    const { container } = render(<BrandLockup />);
    expect(screen.getByText('mousetail')).toBeInTheDocument();
    expect(screen.queryByRole('heading')).toBeNull();
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it('hides the drawn word with its dotless i from assistive tech', () => {
    const { container } = render(<BrandLockup />);
    const drawn = container.querySelector('.brand-i')?.closest('[aria-hidden="true"]');
    expect(drawn).toHaveTextContent('mousetaıl');
  });

  it('only plays the pour when asked', () => {
    const { container, rerender } = render(<BrandLockup />);
    expect(container.firstChild).not.toHaveClass('brand-pour');
    rerender(<BrandLockup pour />);
    expect(container.firstChild).toHaveClass('brand-lockup', 'brand-pour');
  });

  it('is the page heading when asked', () => {
    render(<BrandLockup heading />);
    expect(screen.getByRole('heading', { level: 1, name: 'mousetail' })).toBeInTheDocument();
  });
});
