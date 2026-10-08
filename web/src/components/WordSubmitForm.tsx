import { FormEvent, useState } from 'react';
import type { Question } from '../api';
import { submitResponses, ApiError } from '../api';

interface WordSubmitFormProps {
  slug: string;
  sessionToken: string;
  questions: Question[];
  onSubmitted: () => void;
}

export default function WordSubmitForm({ slug, sessionToken, questions, onSubmitted }: WordSubmitFormProps) {
  const [words, setWords] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const answers = questions.map((q) => ({ questionId: q.id, word: (words[q.id] ?? '').trim() }));
    if (answers.some((a) => a.word.length === 0)) {
      setError('Please answer every question with a single word.');
      return;
    }

    setBusy(true);
    try {
      await submitResponses(slug, sessionToken, answers);
      onSubmitted();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not submit your answer. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 rounded border border-boardLine bg-board/60 p-6">
      {questions.map((q) => (
        <div key={q.id}>
          <label className="block font-display text-paper mb-2" htmlFor={`q-${q.id}`}>
            {q.text}
          </label>
          <input
            id={`q-${q.id}`}
            type="text"
            required
            maxLength={60}
            value={words[q.id] ?? ''}
            onChange={(e) => setWords((prev) => ({ ...prev, [q.id]: e.target.value }))}
            placeholder="One word…"
            className="w-full rounded border border-boardLine bg-board px-3 py-2 font-mono text-paper focus:outline-none focus:ring-2 focus:ring-teal"
          />
        </div>
      ))}
      <button
        type="submit"
        disabled={busy}
        className="w-full rounded bg-teal px-4 py-2 font-display font-semibold text-board hover:opacity-90 disabled:opacity-50"
      >
        {busy ? 'Submitting…' : 'Submit answer'}
      </button>
      {error && (
        <p role="alert" className="text-sm text-coral font-body">
          {error}
        </p>
      )}
    </form>
  );
}
