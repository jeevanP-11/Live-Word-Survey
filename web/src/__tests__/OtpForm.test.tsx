import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import OtpForm from '../components/OtpForm';
import * as api from '../api';

vi.mock('../api', async () => {
  const actual = await vi.importActual<typeof api>('../api');
  return {
    ...actual,
    requestOtp: vi.fn(),
    verifyOtp: vi.fn()
  };
});

describe('OtpForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('requests an OTP and shows the test-bed code', async () => {
    vi.mocked(api.requestOtp).mockResolvedValue({
      otp: '123456',
      expiresAt: new Date().toISOString(),
      testBedNotice: 'test'
    });

    const user = userEvent.setup();
    render(<OtpForm slug="my-survey" onVerified={vi.fn()} />);

    await user.type(screen.getByLabelText(/mobile number/i), '9876543210');
    await user.click(screen.getByRole('button', { name: /send code/i }));

    await waitFor(() => expect(screen.getByTestId('test-otp-banner')).toBeInTheDocument());
    expect(screen.getByText('123456')).toBeInTheDocument();
    expect(api.requestOtp).toHaveBeenCalledWith('my-survey', '9876543210');
  });

  it('calls onVerified with the session token after a correct code', async () => {
    vi.mocked(api.requestOtp).mockResolvedValue({
      otp: '123456',
      expiresAt: new Date().toISOString(),
      testBedNotice: 'test'
    });
    vi.mocked(api.verifyOtp).mockResolvedValue({ token: 'session-jwt' });

    const onVerified = vi.fn();
    const user = userEvent.setup();
    render(<OtpForm slug="my-survey" onVerified={onVerified} />);

    await user.type(screen.getByLabelText(/mobile number/i), '9876543210');
    await user.click(screen.getByRole('button', { name: /send code/i }));
    await waitFor(() => expect(screen.getByLabelText(/6-digit code/i)).toBeInTheDocument());

    await user.type(screen.getByLabelText(/6-digit code/i), '123456');
    await user.click(screen.getByRole('button', { name: /verify & continue/i }));

    await waitFor(() => expect(onVerified).toHaveBeenCalledWith('session-jwt'));
  });

  it('shows an error message when verification fails', async () => {
    vi.mocked(api.requestOtp).mockResolvedValue({
      otp: '123456',
      expiresAt: new Date().toISOString(),
      testBedNotice: 'test'
    });
    vi.mocked(api.verifyOtp).mockRejectedValue(new api.ApiError('Incorrect OTP', 400));

    const user = userEvent.setup();
    render(<OtpForm slug="my-survey" onVerified={vi.fn()} />);

    await user.type(screen.getByLabelText(/mobile number/i), '9876543210');
    await user.click(screen.getByRole('button', { name: /send code/i }));
    await waitFor(() => expect(screen.getByLabelText(/6-digit code/i)).toBeInTheDocument());

    await user.type(screen.getByLabelText(/6-digit code/i), '000000');
    await user.click(screen.getByRole('button', { name: /verify & continue/i }));

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Incorrect OTP'));
  });
});
