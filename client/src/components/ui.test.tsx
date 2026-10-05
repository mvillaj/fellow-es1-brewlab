import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Modal, RatingInput, Stars, Working } from './ui';

describe('Stars', () => {
  it('labels the rating for screen readers', () => {
    render(<Stars value={4} />);
    expect(screen.getByRole('img', { name: '4 of 5 stars' })).toBeInTheDocument();
  });

  it('says unrated when there is no value', () => {
    render(<Stars value={null} />);
    expect(screen.getByText('unrated')).toBeInTheDocument();
  });
});

describe('RatingInput', () => {
  it('reports the clicked star', async () => {
    const onChange = vi.fn();
    render(<RatingInput value={null} onChange={onChange} />);
    await userEvent.click(screen.getByRole('button', { name: '3 stars' }));
    expect(onChange).toHaveBeenCalledWith(3);
  });

  it('clears the rating when the current star is clicked again', async () => {
    const onChange = vi.fn();
    render(<RatingInput value={3} onChange={onChange} />);
    await userEvent.click(screen.getByRole('button', { name: '3 stars' }));
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('marks stars up to the value as pressed', () => {
    render(<RatingInput value={2} onChange={() => {}} />);
    expect(screen.getByRole('button', { name: '2 stars' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: '3 stars' })).toHaveAttribute('aria-pressed', 'false');
  });
});

describe('Modal', () => {
  it('closes on Escape and on the close button', async () => {
    const onClose = vi.fn();
    render(
      <Modal title="Edit shot" onClose={onClose}>
        body
      </Modal>,
    );
    expect(screen.getByRole('dialog', { name: 'Edit shot' })).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('does not close when clicking inside the dialog', async () => {
    const onClose = vi.fn();
    render(
      <Modal title="Edit shot" onClose={onClose}>
        body
      </Modal>,
    );
    await userEvent.click(screen.getByText('body'));
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe('Working', () => {
  it('only shows the clock once the wait is worth mentioning', () => {
    const { rerender } = render(<Working label="Thinking" seconds={3} />);
    expect(screen.queryByText('3s')).not.toBeInTheDocument();
    rerender(<Working label="Thinking" seconds={4} />);
    expect(screen.getByText('4s')).toBeInTheDocument();
  });
});
