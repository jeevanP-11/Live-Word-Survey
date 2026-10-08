import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import BubbleChart from '../components/BubbleChart';

describe('BubbleChart', () => {
  it('shows an empty state when there are no clusters', () => {
    render(<BubbleChart clusters={[]} isLive={true} />);
    expect(screen.getByTestId('bubble-chart-empty')).toBeInTheDocument();
  });

  it('renders one bubble per cluster with word and percentage', () => {
    render(
      <BubbleChart
        clusters={[
          { word: 'happy', count: 3, percentage: 75 },
          { word: 'excited', count: 1, percentage: 25 }
        ]}
        isLive={true}
      />
    );
    expect(screen.getByText('happy')).toBeInTheDocument();
    expect(screen.getByText('excited')).toBeInTheDocument();
    expect(screen.getByText('75% · 3')).toBeInTheDocument();
    expect(screen.getByText('25% · 1')).toBeInTheDocument();
  });

  it('renders the svg chart container when clusters are present', () => {
    render(<BubbleChart clusters={[{ word: 'happy', count: 1, percentage: 100 }]} isLive={false} />);
    expect(screen.getByTestId('bubble-chart')).toBeInTheDocument();
  });
});
