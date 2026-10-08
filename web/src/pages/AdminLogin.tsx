import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminLogin, ApiError } from '../api';
import { useAdminAuth } from '../hooks/useAdminAuth';

export default function AdminLogin() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { login } = useAdminAuth();
  const navigate = useNavigate();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await adminLogin(username.trim(), password);
      login(res.token);
      navigate('/admin');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Login failed. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4">
      <p className="mb-1 font-mono text-xs uppercase tracking-widest text-mute">Admin</p>
      <h1 className="mb-6 font-display text-2xl text-paper">Sign in to the dashboard</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-mono uppercase tracking-wide text-mute" htmlFor="username">
            Username
          </label>
          <input
            id="username"
            required
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="mt-1 w-full rounded border border-boardLine bg-board px-3 py-2 font-mono text-paper focus:outline-none focus:ring-2 focus:ring-signal"
          />
        </div>
        <div>
          <label className="block text-xs font-mono uppercase tracking-wide text-mute" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded border border-boardLine bg-board px-3 py-2 font-mono text-paper focus:outline-none focus:ring-2 focus:ring-signal"
          />
        </div>
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded bg-signal px-4 py-2 font-display font-semibold text-board hover:opacity-90 disabled:opacity-50"
        >
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
        {error && (
          <p role="alert" className="text-sm text-coral font-body">
            {error}
          </p>
        )}
      </form>
    </div>
  );
}
