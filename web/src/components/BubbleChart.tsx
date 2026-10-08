import { useMemo } from 'react';
import type { ClusterResult } from '../api';

interface BubbleChartProps {
  clusters: ClusterResult[];
  isLive: boolean;
}

const PALETTE = ['#f0a838', '#4fb8ac', '#e8615a', '#8fb8e0', '#c792ea', '#7fd88f'];

// Simple deterministic packing: place bubbles left-to-right, top-to-bottom
// on a grid, sized by percentage share. No external chart library needed,
// which keeps this dependency-free and easy to unit test.
function layoutBubbles(clusters: ClusterResult[], width: number, height: number) {
  const maxRadius = Math.min(width, height) / 4.2;
  const minRadius = 26;
  const cols = Math.max(1, Math.ceil(Math.sqrt(clusters.length)));
  const rows = Math.max(1, Math.ceil(clusters.length / cols));
  const cellW = width / cols;
  const cellH = height / rows;

  return clusters.map((cluster, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const cx = cellW * col + cellW / 2;
    const cy = cellH * row + cellH / 2;
    const ratio = cluster.percentage / 100;
    const radius = Math.max(minRadius, Math.min(maxRadius, minRadius + ratio * (maxRadius - minRadius)));
    return { ...cluster, cx, cy, radius, color: PALETTE[i % PALETTE.length] };
  });
}

export default function BubbleChart({ clusters, isLive }: BubbleChartProps) {
  const width = 640;
  const height = 360;

  const bubbles = useMemo(() => layoutBubbles(clusters, width, height), [clusters]);

  if (clusters.length === 0) {
    return (
      <div
        data-testid="bubble-chart-empty"
        className="flex h-64 items-center justify-center rounded border border-dashed border-boardLine text-mute font-mono text-sm"
      >
        No responses yet — results will appear here as they come in.
      </div>
    );
  }

  return (
    <svg
      data-testid="bubble-chart"
      viewBox={`0 0 ${width} ${height}`}
      className="w-full"
      role="img"
      aria-label="Bubble chart of word responses"
    >
      {bubbles.map((b) => (
        <g key={b.word} className="bubble-enter">
          <circle
            cx={b.cx}
            cy={b.cy}
            r={b.radius}
            fill={b.color}
            fillOpacity={0.22}
            stroke={b.color}
            strokeWidth={2}
          />
          {isLive && (
            <circle cx={b.cx} cy={b.cy} r={4} fill={b.color} className="pulse-dot" />
          )}
          <text
            x={b.cx}
            y={b.cy - 4}
            textAnchor="middle"
            className="font-display"
            fill="#eef1ee"
            fontSize={Math.max(12, Math.min(20, b.radius / 2.4))}
          >
            {b.word}
          </text>
          <text
            x={b.cx}
            y={b.cy + 16}
            textAnchor="middle"
            className="font-mono"
            fill={b.color}
            fontSize={12}
          >
            {b.percentage}% · {b.count}
          </text>
        </g>
      ))}
    </svg>
  );
}
