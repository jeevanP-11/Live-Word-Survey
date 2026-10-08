import { Link, Navigate } from 'react-router-dom';
import { listSurveys } from '../api';
import { usePolling } from '../hooks/usePolling';
import { useAdminAuth } from '../hooks/useAdminAuth';
import StatusBadge from '../components/StatusBadge';

export default function AdminDashboard() {
  const { token, isAuthenticated, logout } = useAdminAuth();

  const activePoll = usePolling(() => listSurveys(token!, 'active'), 5000, isAuthenticated);
  const closedPoll = usePolling(() => listSurveys(token!, 'closed'), 15000, isAuthenticated);

  if (!isAuthenticated) {
    return <Navigate to="/admin/login" replace />;
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-mute mb-1">Admin</p>
          <h1 className="font-display text-2xl text-paper">Surveys</h1>
        </div>
        <div className="flex gap-3">
          <Link
            to="/admin/new"
            className="rounded bg-signal px-4 py-2 font-display text-sm font-semibold text-board hover:opacity-90"
          >
            New survey
          </Link>
          <button
            onClick={logout}
            className="rounded border border-boardLine px-4 py-2 font-display text-sm text-mute hover:text-paper"
          >
            Log out
          </button>
        </div>
      </div>

      <Section title="Active" surveys={activePoll.data?.surveys ?? []} />
      <Section title="Closed" surveys={closedPoll.data?.surveys ?? []} />
    </div>
  );
}

function Section({
  title,
  surveys
}: {
  title: string;
  surveys: { id: string; title: string; slug: string; status: 'active' | 'closed' }[];
}) {
  return (
    <div className="mb-10">
      <h2 className="mb-3 font-display text-lg text-paper">{title}</h2>
      {surveys.length === 0 ? (
        <p className="font-mono text-sm text-mute">Nothing here yet.</p>
      ) : (
        <ul className="space-y-2">
          {surveys.map((s) => (
            <li key={s.id}>
              <Link
                to={`/admin/surveys/${s.id}`}
                className="flex items-center justify-between rounded border border-boardLine bg-board/60 px-4 py-3 hover:border-signal/50"
              >
                <div>
                  <p className="font-display text-paper">{s.title}</p>
                  <p className="font-mono text-xs text-mute">/s/{s.slug}</p>
                </div>
                <StatusBadge status={s.status} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
