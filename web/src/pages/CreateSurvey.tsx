import { FormEvent, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { createSurvey, ApiError } from '../api';
import { useAdminAuth } from '../hooks/useAdminAuth';

export default function CreateSurvey() {
  const { token, isAuthenticated } = useAdminAuth();
  const navigate = useNavigate();

  const [title, setTitle] = useState('');
  const [questionCount, setQuestionCount] = useState<1 | 2>(1);
  const [q1, setQ1] = useState('');
  const [q2, setQ2] = useState('');
  const [duration, setDuration] = useState(10);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);

  if (!isAuthenticated) {
    return <Navigate to="/admin/login" replace />;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const questions = questionCount === 1 ? [{ text: q1 }] : [{ text: q1 }, { text: q2 }];
    setBusy(true);
    try {
      const res = await createSurvey(token!, { title, questions, durationMinutes: duration });
      setShareUrl(res.shareUrl);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create survey.');
    } finally {
      setBusy(false);
    }
  }

  if (shareUrl) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <p className="mb-2 font-mono text-xs uppercase tracking-widest text-teal">Survey is live</p>
        <h1 className="mb-4 font-display text-2xl text-paper">Share this link</h1>
        <code className="block rounded border border-boardLine bg-board/60 px-4 py-3 font-mono text-paper break-all">
          {window.location.origin}
          {shareUrl}
        </code>
        <button
          onClick={() => navigate('/admin')}
          className="mt-6 rounded bg-signal px-4 py-2 font-display font-semibold text-board hover:opacity-90"
        >
          Back to dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-10">
      <p className="mb-1 font-mono text-xs uppercase tracking-widest text-mute">Admin</p>
      <h1 className="mb-6 font-display text-2xl text-paper">Create a survey</h1>
      <form onSubmit={handleSubmit} className="space-y-5">
        <Field label="Title">
          <input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="input"
          />
        </Field>

        <Field label="Number of questions">
          <select
            value={questionCount}
            onChange={(e) => setQuestionCount(Number(e.target.value) as 1 | 2)}
            className="input"
          >
            <option value={1}>1</option>
            <option value={2}>2</option>
          </select>
        </Field>

        <Field label="Question 1">
          <input required value={q1} onChange={(e) => setQ1(e.target.value)} className="input" />
        </Field>

        {questionCount === 2 && (
          <Field label="Question 2">
            <input required value={q2} onChange={(e) => setQ2(e.target.value)} className="input" />
          </Field>
        )}

        <Field label="Duration (minutes)">
          <input
            type="number"
            min={1}
            required
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
            className="input"
          />
        </Field>

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded bg-signal px-4 py-2 font-display font-semibold text-board hover:opacity-90 disabled:opacity-50"
        >
          {busy ? 'Creating…' : 'Create survey'}
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-mono uppercase tracking-wide text-mute mb-1">{label}</label>
      {children}
    </div>
  );
}
