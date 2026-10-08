import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import StatusBadge from '../components/StatusBadge';

describe('StatusBadge', () => {
  it('shows "Live" for active surveys', () => {
    render(<StatusBadge status="active" />);
    expect(screen.getByText('Live')).toBeInTheDocument();
  });

  it('shows "Closed" for closed surveys', () => {
    render(<StatusBadge status="closed" />);
    expect(screen.getByText('Closed')).toBeInTheDocument();
  });
});
