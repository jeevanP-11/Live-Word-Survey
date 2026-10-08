import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import WordSubmitForm from '../components/WordSubmitForm';
import * as api from '../api';

vi.mock('../api', async () => {
  const actual = await vi.importActual<typeof api>('../api');
  return {
    ...actual,
    submitResponses: vi.fn()
  };
});

const questions = [
  { id: 'q1', text: 'Favorite word?', order: 0 },
  { id: 'q2', text: 'Mood today?', order: 1 }
];

describe('WordSubmitForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders one input per question', () => {
    render(
      <WordSubmitForm slug="s" sessionToken="tok" questions={questions} onSubmitted={vi.fn()} />
    );
    expect(screen.getByLabelText('Favorite word?')).toBeInTheDocument();
    expect(screen.getByLabelText('Mood today?')).toBeInTheDocument();
  });

  it('submits all answers and calls onSubmitted', async () => {
    vi.mocked(api.submitResponses).mockResolvedValue({ success: true });
    const onSubmitted = vi.fn();
    const user = userEvent.setup();

    render(
      <WordSubmitForm slug="my-survey" sessionToken="tok" questions={questions} onSubmitted={onSubmitted} />
    );

    await user.type(screen.getByLabelText('Favorite word?'), 'sunshine');
    await user.type(screen.getByLabelText('Mood today?'), 'excited');
    await user.click(screen.getByRole('button', { name: /submit answer/i }));

    await waitFor(() => expect(onSubmitted).toHaveBeenCalled());
    expect(api.submitResponses).toHaveBeenCalledWith('my-survey', 'tok', [
      { questionId: 'q1', word: 'sunshine' },
      { questionId: 'q2', word: 'excited' }
    ]);
  });

  it('shows a server error message on submission failure (e.g. already answered)', async () => {
    vi.mocked(api.submitResponses).mockRejectedValue(
      new api.ApiError("You've already answered this survey", 409)
    );
    const user = userEvent.setup();

    render(
      <WordSubmitForm slug="s" sessionToken="tok" questions={[questions[0]]} onSubmitted={vi.fn()} />
    );

    await user.type(screen.getByLabelText('Favorite word?'), 'sunshine');
    await user.click(screen.getByRole('button', { name: /submit answer/i }));

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent("You've already answered this survey")
    );
  });
});
