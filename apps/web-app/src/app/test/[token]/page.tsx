'use client';

/**
 * ============================================================================
 * PAGE PUBLIQUE DE TEST EN LIGNE — /test/[token]
 * ============================================================================
 *
 * Le candidat accède à cette page via le lien envoyé par email.
 *
 * Flow :
 *   1. Au chargement → GET /api/tests-public/:token/start
 *      → Retourne les questions SANS les réponses correctes + temps restant
 *   2. Minuterie compte à rebours (basée sur startedAt en DB)
 *   3. Le candidat répond aux questions
 *   4. Soumission → POST /api/tests-public/:token/submit
 *      → Correction auto (QCM/Vrai-Faux) + score
 *   5. Affichage du résultat + réponses correctes
 *
 * Sécurité :
 *   - Si temps écoulé → auto-submit
 *   - Si token déjà soumis → message d'erreur
 *   - Si token expiré → message d'erreur
 * ============================================================================
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import {
  Clock, Loader2, AlertCircle, CheckCircle, XCircle,
  Send, Award, ArrowRight,
} from 'lucide-react';

type PageState = 'loading' | 'test' | 'submitting' | 'result' | 'expired' | 'submitted' | 'error';

interface TestData {
  token: string;
  title: string;
  description?: string;
  durationMinutes: number;
  timeRemainingSeconds: number;
  questions: Array<{
    id: string;
    type: string;
    question: string;
    options?: string[];
    points: number;
  }>;
  status: string;
}

interface SubmitResult {
  status: string;
  autoScore: number;
  autoScoreMax: number;
  autoScorePercent: number;
  passed: boolean;
  correctedResponses: Array<{
    questionId: string;
    isCorrect: boolean;
    pointsAwarded: number;
    correctAnswers?: number[];
    explanation?: string;
  }>;
}

export default function TestPage() {
  const params = useParams();
  const token = params.token as string;

  const [state, setState] = useState<PageState>('loading');
  const [testData, setTestData] = useState<TestData | null>(null);
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [timeLeft, setTimeLeft] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const autoSubmitRef = useRef(false);

  // ─── Démarrer le test ────────────────────────────────────────────────────
  const startTest = useCallback(async () => {
    try {
      setState('loading');
      const res = await fetch(`/api/tests-public/${token}/start`);
      const data = await res.json();
      if (!res.ok) {
        const msg = data.message || data.error || 'Erreur';
        if (msg.includes('expiré') || msg.includes('expir')) {
          setState('expired');
        } else if (msg.includes('déjà') || msg.includes('soumis')) {
          setState('submitted');
        } else {
          setErrorMsg(msg);
          setState('error');
        }
        return;
      }
      setTestData(data);
      setTimeLeft(data.timeRemainingSeconds || 0);
      setState('test');
    } catch (err: any) {
      setErrorMsg(err.message || 'Erreur réseau');
      setState('error');
    }
  }, [token]);

  useEffect(() => { startTest(); }, [startTest]);

  // ─── Minuterie ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (state !== 'test' || timeLeft <= 0) return;

    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          if (!autoSubmitRef.current) {
            autoSubmitRef.current = true;
            handleSubmit(true);
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [state, timeLeft]);

  // ─── Soumission ──────────────────────────────────────────────────────────
  async function handleSubmit(isAutoSubmit = false) {
    if (state !== 'test' && !isAutoSubmit) return;
    if (timerRef.current) clearInterval(timerRef.current);
    setState('submitting');

    try {
      const responses = (testData?.questions || []).map(q => ({
        questionId: q.id,
        answer: answers[q.id] ?? (q.type === 'MULTIPLE_CHOICE' ? [] : ''),
      }));

      const res = await fetch(`/api/tests-public/${token}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ responses }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.message || data.error || 'Erreur de soumission');
        setState('error');
        return;
      }
      setResult(data);
      setState('result');
    } catch (err: any) {
      setErrorMsg(err.message || 'Erreur réseau');
      setState('error');
    }
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────
  function formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  function updateAnswer(questionId: string, value: string | string[]) {
    setAnswers(prev => ({ ...prev, [questionId]: value }));
  }

  const answeredCount = testData?.questions.filter(q => {
    const a = answers[q.id];
    return a !== undefined && a !== '' && (!Array.isArray(a) || a.length > 0);
  }).length || 0;

  // ─── Render ──────────────────────────────────────────────────────────────
  if (state === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <Loader2 className="h-10 w-10 animate-spin text-[#1A2BA6] mx-auto mb-4" />
          <p className="text-sm text-slate-500">Chargement du test...</p>
        </div>
      </div>
    );
  }

  if (state === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8 text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-lg font-bold text-slate-900 mb-2">Une erreur est survenue</h1>
          <p className="text-sm text-slate-500 mb-4">{errorMsg}</p>
          <p className="text-xs text-slate-400">Vérifiez que vous avez bien copié l'URL complète depuis votre email.</p>
        </div>
      </div>
    );
  }

  if (state === 'expired') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8 text-center">
          <Clock className="h-12 w-12 text-amber-500 mx-auto mb-4" />
          <h1 className="text-lg font-bold text-slate-900 mb-2">Test expiré</h1>
          <p className="text-sm text-slate-500">Le délai pour passer ce test est dépassé. Contactez l'établissement si vous pensez que c'est une erreur.</p>
        </div>
      </div>
    );
  }

  if (state === 'submitted') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8 text-center">
          <CheckCircle className="h-12 w-12 text-emerald-500 mx-auto mb-4" />
          <h1 className="text-lg font-bold text-slate-900 mb-2">Test déjà soumis</h1>
          <p className="text-sm text-slate-500">Vous avez déjà soumis ce test. Il n'est pas possible de le repasser.</p>
        </div>
      </div>
    );
  }

  if (state === 'submitting') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <Loader2 className="h-10 w-10 animate-spin text-[#1A2BA6] mx-auto mb-4" />
          <p className="text-sm text-slate-500">Correction en cours...</p>
        </div>
      </div>
    );
  }

  // ─── RÉSULTAT ────────────────────────────────────────────────────────────
  if (state === 'result' && result && testData) {
    return (
      <div className="min-h-screen bg-slate-50 py-8 px-4">
        <div className="max-w-2xl mx-auto">
          {/* Header résultat */}
          <div className="bg-white rounded-2xl shadow-lg overflow-hidden mb-6">
            <div className="p-8 text-center" style={{
              background: result.passed
                ? 'linear-gradient(135deg, #059669 0%, #10b981 100%)'
                : 'linear-gradient(135deg, #dc2626 0%, #ef4444 100%)'
            }}>
              {result.passed ? (
                <CheckCircle className="h-16 w-16 text-white mx-auto mb-3" />
              ) : (
                <XCircle className="h-16 w-16 text-white mx-auto mb-3" />
              )}
              <h1 className="text-2xl font-bold text-white mb-2">
                {result.passed ? 'Test réussi !' : 'Test non réussi'}
              </h1>
              <p className="text-white/80 text-sm">{testData.title}</p>
            </div>
            <div className="p-6 grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-3xl font-bold text-slate-900">{result.autoScorePercent}%</p>
                <p className="text-[10px] text-slate-400 uppercase mt-1">Score</p>
              </div>
              <div>
                <p className="text-3xl font-bold text-slate-900">{result.autoScore}/{result.autoScoreMax}</p>
                <p className="text-[10px] text-slate-400 uppercase mt-1">Points</p>
              </div>
              <div>
                <p className="text-3xl font-bold text-slate-900">{answeredCount}/{testData.questions.length}</p>
                <p className="text-[10px] text-slate-400 uppercase mt-1">Répondues</p>
              </div>
            </div>
          </div>

          {/* Détail des réponses */}
          <div className="bg-white rounded-2xl shadow-sm p-6">
            <h2 className="text-sm font-bold text-slate-900 mb-4">Détail des réponses</h2>
            <div className="space-y-3">
              {testData.questions.map((q, i) => {
                const correction = result.correctedResponses.find(c => c.questionId === q.id);
                const userAnswer = answers[q.id];
                return (
                  <div key={q.id} className={`rounded-xl p-4 border ${correction?.isCorrect ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
                    <div className="flex items-start gap-2">
                      {correction?.isCorrect
                        ? <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                        : <XCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />}
                      <div className="flex-1">
                        <p className="text-xs font-bold text-slate-900 mb-1">Q{i+1}. {q.question}</p>
                        <p className="text-[10px] text-slate-500">
                          Votre réponse : {Array.isArray(userAnswer) ? userAnswer.map(a => q.options?.[Number(a)] || a).join(', ') : q.options?.[Number(userAnswer)] || userAnswer || 'Non répondue'}
                        </p>
                        {!correction?.isCorrect && correction?.correctAnswers && q.options && (
                          <p className="text-[10px] text-emerald-700 mt-1">
                            Bonne réponse : {correction.correctAnswers.map(a => q.options?.[a]).join(', ')}
                          </p>
                        )}
                        {correction?.explanation && (
                          <p className="text-[10px] text-slate-400 mt-1 italic">{correction.explanation}</p>
                        )}
                        <p className="text-[10px] text-slate-400 mt-1">{correction?.pointsAwarded || 0} / {q.points} pt(s)</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <p className="text-center text-xs text-slate-400 mt-6">
            Votre test a été soumis. Le recruteur recevra vos résultats et vous contactera prochainement.
          </p>
        </div>
      </div>
    );
  }

  // ─── TEST EN COURS ───────────────────────────────────────────────────────
  if (state === 'test' && testData) {
    const timeWarning = timeLeft < 60;
    const timeCritical = timeLeft < 30;

    return (
      <div className="min-h-screen bg-slate-50 py-6 px-4">
        <div className="max-w-2xl mx-auto">
          {/* Header avec minuterie */}
          <div className="bg-white rounded-2xl shadow-sm p-5 mb-4 flex items-center justify-between sticky top-4 z-10">
            <div>
              <h1 className="text-base font-bold text-slate-900">{testData.title}</h1>
              <p className="text-[10px] text-slate-400">{answeredCount}/{testData.questions.length} questions répondues</p>
            </div>
            <div className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm ${
              timeCritical ? 'bg-red-100 text-red-700 animate-pulse'
              : timeWarning ? 'bg-amber-100 text-amber-700'
              : 'bg-slate-100 text-slate-700'
            }`}>
              <Clock className="h-4 w-4" />
              {formatTime(timeLeft)}
            </div>
          </div>

          {testData.description && (
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 mb-4">
              <p className="text-xs text-blue-800">{testData.description}</p>
            </div>
          )}

          {/* Questions */}
          <div className="space-y-3">
            {testData.questions.map((q, i) => (
              <div key={q.id} className="bg-white rounded-xl shadow-sm p-5">
                <div className="flex items-start gap-2 mb-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-lg bg-[#1A2BA6] text-white text-xs font-bold flex items-center justify-center">
                    {i + 1}
                  </span>
                  <p className="text-sm font-bold text-slate-900 flex-1">{q.question}</p>
                  <span className="text-[10px] text-slate-400 font-medium">{q.points} pt</span>
                </div>

                {/* SINGLE_CHOICE / TRUE_FALSE */}
                {(q.type === 'SINGLE_CHOICE' || q.type === 'TRUE_FALSE') && q.options && (
                  <div className="space-y-2">
                    {q.options.map((opt, oi) => (
                      <button
                        key={oi}
                        onClick={() => updateAnswer(q.id, String(oi))}
                        className={`w-full text-left px-4 py-2.5 rounded-xl border-2 text-sm transition ${
                          answers[q.id] === String(oi)
                            ? 'border-[#1A2BA6] bg-[#1A2BA6]/5 text-[#1A2BA6] font-bold'
                            : 'border-slate-200 text-slate-700 hover:border-slate-300'
                        }`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                )}

                {/* MULTIPLE_CHOICE */}
                {q.type === 'MULTIPLE_CHOICE' && q.options && (
                  <div className="space-y-2">
                    {q.options.map((opt, oi) => {
                      const selected = Array.isArray(answers[q.id]) ? (answers[q.id] as string[]).includes(String(oi)) : false;
                      return (
                        <button
                          key={oi}
                          onClick={() => {
                            const current = Array.isArray(answers[q.id]) ? answers[q.id] as string[] : [];
                            updateAnswer(q.id, selected ? current.filter(c => c !== String(oi)) : [...current, String(oi)]);
                          }}
                          className={`w-full text-left px-4 py-2.5 rounded-xl border-2 text-sm transition flex items-center gap-2 ${
                            selected ? 'border-[#1A2BA6] bg-[#1A2BA6]/5 text-[#1A2BA6] font-bold' : 'border-slate-200 text-slate-700 hover:border-slate-300'
                          }`}
                        >
                          <span className={`w-4 h-4 rounded border-2 flex items-center justify-center ${selected ? 'border-[#1A2BA6] bg-[#1A2BA6]' : 'border-slate-300'}`}>
                            {selected && <CheckCircle className="h-3 w-3 text-white" />}
                          </span>
                          {opt}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* SHORT_TEXT */}
                {q.type === 'SHORT_TEXT' && (
                  <input
                    type="text"
                    value={answers[q.id] as string || ''}
                    onChange={e => updateAnswer(q.id, e.target.value)}
                    className="w-full rounded-xl border-2 border-slate-200 px-4 py-2.5 text-sm focus:border-[#1A2BA6] focus:outline-none"
                    placeholder="Votre réponse..."
                  />
                )}

                {/* LONG_TEXT */}
                {q.type === 'LONG_TEXT' && (
                  <textarea
                    value={answers[q.id] as string || ''}
                    onChange={e => updateAnswer(q.id, e.target.value)}
                    rows={4}
                    className="w-full rounded-xl border-2 border-slate-200 px-4 py-2.5 text-sm focus:border-[#1A2BA6] focus:outline-none"
                    placeholder="Votre réponse détaillée..."
                  />
                )}
              </div>
            ))}
          </div>

          {/* Submit button */}
          <div className="mt-6 mb-8">
            <button
              onClick={() => handleSubmit(false)}
              disabled={answeredCount === 0}
              className="w-full flex items-center justify-center gap-2 px-6 py-3.5 text-sm font-bold text-white rounded-xl shadow-sm hover:opacity-90 disabled:opacity-40 transition"
              style={{ backgroundColor: '#0D1F6E' }}
            >
              <Send className="h-4 w-4" /> Soumettre le test ({answeredCount}/{testData.questions.length})
            </button>
            <p className="text-center text-[10px] text-slate-400 mt-2">
              Une fois soumis, vous ne pourrez plus modifier vos réponses.
              {timeLeft < 60 && ' ⚠ Le temps est presque écoulé, le test sera soumis automatiquement.'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
