import { Link, Navigate, useParams } from 'react-router-dom';
import { getSurveyDetail } from '../api';
import { usePolling } from '../hooks/usePolling';
import { useAdminAuth } from '../hooks/useAdminAuth';
import BubbleChart from '../components/BubbleChart';
import StatusBadge from '../components/StatusBadge';

export default function AdminSurveyDetail() {
  const { id = '' } = useParams();
  const { token, isAuthenticated } = useAdminAuth();

  const poll = usePolling(() => getSurveyDetail(token!, id), 5000, isAuthenticated, [id]);

  if (!isAuthenticated) {
    return <Navigate to="/admin/login" replace />;
  }

  if (poll.loading && !poll.data) {
    return <p className="p-10 font-mono text-mute">Loading…</p>;
  }

  if (!poll.data) {
    return <p className="p-10 font-mono text-coral">{poll.error ?? 'Survey not found'}</p>;
  }

  const survey = poll.data;
  const isLive = survey.status === 'active';

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <Link to="/admin" className="mb-6 inline-block font-mono text-xs text-mute hover:text-paper">
        ← Back to dashboard
      </Link>

      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-mute mb-1">/s/{survey.slug}</p>
          <h1 className="font-display text-2xl text-paper">{survey.title}</h1>
        </div>
        <StatusBadge status={survey.status} />
      </div>

      <div className="mb-10 space-y-10">
        {survey.results.map((q) => (
          <div key={q.questionId}>
            <h2 className="font-display text-lg text-paper mb-2">{q.text}</h2>
            <p className="mb-3 font-mono text-xs text-mute">{q.totalResponses} response(s)</p>
            <BubbleChart clusters={q.clusters} isLive={isLive} />
          </div>
        ))}
      </div>

      <div>
        <h2 className="mb-3 font-display text-lg text-paper">
          Respondents ({survey.respondentPhones.length})
        </h2>
        {survey.respondentPhones.length === 0 ? (
          <p className="font-mono text-sm text-mute">No submissions yet.</p>
        ) : (
          <ul
            data-testid="respondent-list"
            className="grid grid-cols-2 gap-2 font-mono text-sm text-paper sm:grid-cols-3"
          >
            {survey.respondentPhones.map((phone) => (
              <li key={phone} className="rounded border border-boardLine bg-board/60 px-3 py-1.5">
                {phone}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
