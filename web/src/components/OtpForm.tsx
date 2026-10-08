import { FormEvent, useState } from 'react';
import { requestOtp, verifyOtp, ApiError } from '../api';

interface OtpFormProps {
  slug: string;
  onVerified: (sessionToken: string) => void;
}

export default function OtpForm({ slug, onVerified }: OtpFormProps) {
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [stage, setStage] = useState<'phone' | 'otp'>('phone');
  const [testOtp, setTestOtp] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleRequestOtp(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await requestOtp(slug, phone.trim());
      setTestOtp(res.otp);
      setStage('otp');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not request an OTP. Try again.');
    } finally {
      setBusy(false);
    }
  }

  async function handleVerifyOtp(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await verifyOtp(slug, phone.trim(), otp.trim());
      onVerified(res.token);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not verify OTP. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded border border-boardLine bg-board/60 p-6">
      <h2 className="font-display text-lg text-paper mb-1">Verify your number</h2>
      <p className="text-sm text-mute mb-4 font-body">
        One submission per phone number. We'll send a 6-digit code — this test build shows it
        on-page instead of sending a real text.
      </p>

      {stage === 'phone' && (
        <form onSubmit={handleRequestOtp} className="space-y-3">
          <label className="block text-xs font-mono uppercase tracking-wide text-mute" htmlFor="phone">
            Mobile number
          </label>
          <input
            id="phone"
            type="tel"
            required
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+15551234567"
            className="w-full rounded border border-boardLine bg-board px-3 py-2 font-mono text-paper focus:outline-none focus:ring-2 focus:ring-signal"
          />
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded bg-signal px-4 py-2 font-display font-semibold text-board hover:opacity-90 disabled:opacity-50"
          >
            {busy ? 'Sending…' : 'Send code'}
          </button>
        </form>
      )}

      {stage === 'otp' && (
        <form onSubmit={handleVerifyOtp} className="space-y-3">
          {testOtp && (
            <div
              data-testid="test-otp-banner"
              className="rounded border border-signal/40 bg-signal/10 px-3 py-2 font-mono text-sm text-signal"
            >
              Test code: <span className="font-semibold">{testOtp}</span>
            </div>
          )}
          <label className="block text-xs font-mono uppercase tracking-wide text-mute" htmlFor="otp">
            6-digit code
          </label>
          <input
            id="otp"
            type="text"
            inputMode="numeric"
            required
            maxLength={6}
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
            className="w-full rounded border border-boardLine bg-board px-3 py-2 font-mono tracking-[0.3em] text-paper focus:outline-none focus:ring-2 focus:ring-signal"
          />
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded bg-teal px-4 py-2 font-display font-semibold text-board hover:opacity-90 disabled:opacity-50"
          >
            {busy ? 'Verifying…' : 'Verify & continue'}
          </button>
          <button
            type="button"
            onClick={() => setStage('phone')}
            className="w-full text-xs text-mute underline underline-offset-2"
          >
            Use a different number
          </button>
        </form>
      )}

      {error && (
        <p role="alert" className="mt-3 text-sm text-coral font-body">
          {error}
        </p>
      )}
    </div>
  );
}
