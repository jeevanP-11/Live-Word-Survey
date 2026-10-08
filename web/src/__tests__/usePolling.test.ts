import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { usePolling } from '../hooks/usePolling';

describe('usePolling', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('fetches immediately on mount', async () => {
    const fetcher = vi.fn().mockResolvedValue({ value: 1 });
    const { result } = renderHook(() => usePolling(fetcher, 5000, true));

    await waitFor(() => expect(result.current.data).toEqual({ value: 1 }));
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('does not fetch when inactive', async () => {
    const fetcher = vi.fn().mockResolvedValue({ value: 1 });
    renderHook(() => usePolling(fetcher, 5000, false));

    await vi.advanceTimersByTimeAsync(6000);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('polls again after the interval elapses', async () => {
    const fetcher = vi.fn().mockResolvedValue({ value: 1 });
    renderHook(() => usePolling(fetcher, 5000, true));

    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
    await act(() => vi.advanceTimersByTimeAsync(5000));
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
  });

  it('surfaces an error without clearing previous data', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce({ value: 1 })
      .mockRejectedValueOnce(new Error('network down'));

    const { result } = renderHook(() => usePolling(fetcher, 5000, true));
    await waitFor(() => expect(result.current.data).toEqual({ value: 1 }));

    await act(() => vi.advanceTimersByTimeAsync(5000));
    await waitFor(() => expect(result.current.error).toBe('network down'));
    expect(result.current.data).toEqual({ value: 1 });
  });
});
