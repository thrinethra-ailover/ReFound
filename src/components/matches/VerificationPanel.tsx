import { useEffect, useState } from 'react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Spinner } from '../ui/Spinner';
import {
  fetchVerificationAttempts,
  finalizeVerification,
  getVerificationQuestions,
  submitVerificationAnswer,
} from '../../lib/matchService';
import { summarizeVerification, type VerificationAttempt } from '../../lib/matching';
import { useToast } from '../../hooks/useToast';
import {
  ID_CARD_ABSENT_VALUE,
  ID_CARD_PRESENT_VALUE,
  isIdCardPresenceAttribute,
} from '../../lib/matching/verificationAttributes';

interface VerificationPanelProps {
  matchId: string;
  /** Claimant answers the found report's private prompts; finder reviews and decides. */
  role: 'CLAIMANT' | 'FINDER';
  onDecided: () => void;
}

type AnswerState = 'idle' | 'checking' | 'correct' | 'incorrect';

export function VerificationPanel({ matchId, role, onDecided }: VerificationPanelProps) {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [questions, setQuestions] = useState<{ key: string; attemptsUsed: number }[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [answerStates, setAnswerStates] = useState<Record<string, AnswerState>>({});
  const [attempts, setAttempts] = useState<VerificationAttempt[]>([]);
  const [deciding, setDeciding] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      if (role === 'CLAIMANT') {
        const { questions: rows, error } = await getVerificationQuestions(matchId);
        if (!cancelled) {
          if (error) showToast(error, 'error');
          setQuestions(rows);
        }
      } else {
        const { attempts: rows, error } = await fetchVerificationAttempts(matchId);
        if (!cancelled) {
          if (error) showToast(error, 'error');
          setAttempts(rows.map((r) => ({
            attributeKey: r.attribute_key,
            isCorrect: r.is_correct,
            attemptsUsed: r.attempts_used,
          })));
        }
      }
      if (!cancelled) setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchId, role]);

  const handleSubmitAnswer = async (key: string) => {
    const value = isIdCardPresenceAttribute(key)
      ? answers[key] === ID_CARD_PRESENT_VALUE ? ID_CARD_PRESENT_VALUE : ID_CARD_ABSENT_VALUE
      : answers[key]?.trim();
    if (!value) return;

    setAnswerStates((prev) => ({ ...prev, [key]: 'checking' }));
    const { correct, error } = await submitVerificationAnswer(matchId, key, value);
    if (error) {
      showToast(error, 'error');
      setAnswerStates((prev) => ({ ...prev, [key]: 'idle' }));
      return;
    }
    setQuestions((previous) => previous.map((question) => question.key === key
      ? { ...question, attemptsUsed: question.attemptsUsed + 1 }
      : question));
    setAnswerStates((prev) => ({ ...prev, [key]: correct ? 'correct' : 'incorrect' }));
  };

  const handleDecision = async (decision: 'VERIFIED' | 'REJECTED') => {
    setDeciding(true);
    const { error } = await finalizeVerification(matchId, decision);
    setDeciding(false);
    if (error) {
      showToast(error, 'error');
      return;
    }
    showToast(
      decision === 'VERIFIED' ? 'Ownership verified — you can arrange a handoff now.' : 'Verification marked unsuccessful.',
      decision === 'VERIFIED' ? 'success' : 'info'
    );
    onDecided();
  };

  if (loading) return <Spinner label="Loading verification…" />;

  if (role === 'CLAIMANT') {
    if (questions.length === 0) {
      return (
        <p className="text-sm text-slate">
          The finder didn&rsquo;t add private verification details to this found report, so ReFound can&rsquo;t
          verify this claim. Contact the finder and confirm identifying details before arranging a handoff.
        </p>
      );
    }
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-slate">
          Answer each prompt with the identifying detail you know. You can use your own words;
          capitalization, word order, common grammar, and familiar terms such as “decal” for “sticker”
          are handled. The key identifying words still need to line up. Your answers are checked
          privately — you&rsquo;ll only see whether each one matched, never the finder&rsquo;s original detail.
          You get up to five tries per detail.
        </p>
        {questions.map(({ key, attemptsUsed }) => {
          const state = answerStates[key] ?? 'idle';
          const isIdCardQuestion = isIdCardPresenceAttribute(key);
          return (
            <div key={key} className="flex items-end gap-2">
              {isIdCardQuestion ? (
                <label className="flex min-h-10 flex-1 cursor-pointer items-center gap-2 rounded-lg border border-border bg-white px-3 py-2 text-sm text-ink">
                  <input
                    type="checkbox"
                    checked={answers[key] === ID_CARD_PRESENT_VALUE}
                    onChange={(event) => setAnswers((prev) => ({
                      ...prev,
                      [key]: event.target.checked ? ID_CARD_PRESENT_VALUE : ID_CARD_ABSENT_VALUE,
                    }))}
                    disabled={state === 'checking' || attemptsUsed >= 5 || state === 'correct'}
                    className="h-4 w-4 accent-signal"
                  />
                  My item had an ID card or equivalent inside
                </label>
              ) : (
                <Input
                  label={key}
                  placeholder="Describe what you observed…"
                  value={answers[key] ?? ''}
                  onChange={(e) => setAnswers((prev) => ({ ...prev, [key]: e.target.value }))}
                  disabled={state === 'checking' || attemptsUsed >= 5 || state === 'correct'}
                  className="flex-1"
                />
              )}
              <Button
                type="button"
                size="sm"
                variant="secondary"
                loading={state === 'checking'}
                onClick={() => handleSubmitAnswer(key)}
                disabled={(!isIdCardQuestion && !answers[key]?.trim()) || state === 'correct' || attemptsUsed >= 5}
              >
                Check
              </Button>
              {state === 'correct' && (
                <span className="mb-2.5 flex h-6 w-6 items-center justify-center rounded-full bg-signal/10 text-signal">
                  ✓
                </span>
              )}
              {state === 'incorrect' && (
                <span className="mb-2.5 flex h-6 w-6 items-center justify-center rounded-full bg-coral/10 text-coral-dark">
                  ✕
                </span>
              )}
              <span className="mb-2.5 whitespace-nowrap text-[11px] text-slate-light">
                {Math.max(0, 5 - attemptsUsed)} tries left
              </span>
            </div>
          );
        })}
        <p className="text-xs text-slate-light">
          The finder can accept the claim only after every private detail matches, then arrange the handoff.
        </p>
      </div>
    );
  }

  // Finder review view
  const summary = summarizeVerification(attempts);
  const reviewedAttributes = attempts;

  return (
    <div className="flex flex-col gap-4">
      {summary.totalQuestions === 0 ? (
        <p className="text-sm text-slate">This found report has no private verification details, so ReFound can&rsquo;t validate this claim.</p>
      ) : (
        <>
          <div className="rounded-lg border border-border bg-paper/60 p-3">
            <p className="text-sm font-medium text-ink">
              {summary.correctAnswers} of {summary.totalQuestions} details confirmed
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {reviewedAttributes.map((a) => (
                <span
                  key={a.attributeKey}
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    a.isCorrect ? 'bg-signal/10 text-signal-dark'
                      : a.attemptsUsed === 0 ? 'bg-paper text-slate'
                        : 'bg-coral/10 text-coral-dark'
                  }`}
                >
                  {a.attributeKey}: {a.isCorrect ? 'matched' : a.attemptsUsed === 0 ? 'waiting' : 'not matched'}
                </span>
              ))}
            </div>
          </div>
          <p className="text-xs text-slate">
            You&rsquo;re shown only whether each detail matched — never the claimant&rsquo;s answers or your
            saved private details. Every detail must match before you can accept the claim.
          </p>
        </>
      )}
      <div className="flex gap-2">
        <Button
          onClick={() => handleDecision('VERIFIED')}
          loading={deciding}
          size="sm"
          disabled={summary.totalQuestions === 0 || !summary.allCorrect}
        >
          Accept claim
        </Button>
        <Button onClick={() => handleDecision('REJECTED')} variant="ghost" loading={deciding} size="sm">
          Reject claim
        </Button>
      </div>
    </div>
  );
}
