import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { getPublicSurvey, getResults, ApiError } from '../api';
import { usePolling } from '../hooks/usePolling';
import OtpForm from '../components/OtpForm';
import WordSubmitForm from '../components/WordSubmitForm';
import BubbleChart from '../components/BubbleChart';
import StatusBadge from '../components/StatusBadge';

type Phase = 'loading' | 'not-found' | 'auth' | 'answer' | 'results';

export default function SurveyPage() {
  const { slug = '' } = useParams();
  const [phase, setPhase] = useState<Phase>('loading');
  const [sessionToken, setSessionToken] = useState<string | null>(null);

  const survey = usePolling(() => getPublicSurvey(slug), 5000, phase !== 'not-found', [slug]);

  const surveyStatus = survey.data?.status;
  const isActive = surveyStatus === 'active';

  const resultsPoll = usePolling(
    () => getResults(slug),
    5000,
    phase === 'results' || surveyStatus === 'closed',
    [slug]
  );

  if (survey.loading && !survey.data) {
    return <CenteredMessage text="Loading survey…" />;
  }

  if (survey.error && survey.error.includes('not found')) {
    return <CenteredMessage text="This survey doesn't exist or the link is wrong." />;
  }

  if (!survey.data) {
    return <CenteredMessage text="Loading survey…" />;
  }

  const closed = survey.data.status === 'closed';
  const showResultsOnly = closed || phase === 'results';

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-mute mb-1">Live word survey</p>
          <h1 className="font-display text-2xl text-paper">{survey.data.title}</h1>
        </div>
        <StatusBadge status={survey.data.status} />
      </div>

      {!showResultsOnly && phase !== 'answer' && (
        <OtpForm
          slug={slug}
          onVerified={(token) => {
            setSessionToken(token);
            setPhase('answer');
          }}
        />
      )}

      {!showResultsOnly && phase === 'answer' && sessionToken && (
        <WordSubmitForm
          slug={slug}
          sessionToken={sessionToken}
          questions={survey.data.questions}
          onSubmitted={() => setPhase('results')}
        />
      )}

      {showResultsOnly && (
        <div className="space-y-8">
          {closed && (
            <p className="font-mono text-sm text-mute">
              This survey has closed. Showing final results.
            </p>
          )}
          {(resultsPoll.data?.results ?? []).map((q) => (
            <div key={q.questionId}>
              <h2 className="font-display text-lg text-paper mb-2">{q.text}</h2>
              <p className="mb-3 font-mono text-xs text-mute">{q.totalResponses} response(s)</p>
              <BubbleChart clusters={q.clusters} isLive={!closed} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CenteredMessage({ text }: { text: string }) {
  return (
    <div className="flex min-h-[50vh] items-center justify-center px-4">
      <p className="font-mono text-mute">{text}</p>
    </div>
  );
}

// Re-export for narrowing ApiError usages elsewhere if needed.
export { ApiError };
