'use client';

/**
 * ============================================================================
 * POLL CARD — Sondage intégré dans le fil de messages
 * ============================================================================
 * Vote (mono/multi) + résultats en direct + barres de progression.
 * Le vote met à jour localement les résultats (réponse API).
 * ============================================================================
 */

import { useState } from 'react';
import { BarChart3, Check, Clock } from 'lucide-react';
import { communityApi, type CommunityMessage } from '@/lib/community/client';

export function PollCard({ message }: { message: CommunityMessage }) {
  const poll = message.poll!;
  const [selection, setSelection] = useState<string[]>([]);
  const [results, setResults] = useState<{ id: string; label: string; votes: number; mine: boolean }[] | null>(null);
  const [voted, setVoted] = useState(false);
  const [total, setTotal] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  const expired = poll.expiresAt ? new Date(poll.expiresAt) < new Date() : false;

  const submit = async () => {
    if (!selection.length || busy) return;
    setBusy(true);
    try {
      const res = await communityApi.votePoll(message.id, selection);
      setResults(res.results);
      setTotal(res.totalVotes);
      setVoted(true);
    } finally {
      setBusy(false);
    }
  };

  // Rendu après vote (ou résultats du vote perso en session)
  if (results) {
    const totalVotes = total ?? results.reduce((acc, r) => acc + r.votes, 0);
    const max = Math.max(...results.map((r) => r.votes), 1);
    return (
      <div className="mt-2 p-3 rounded-xl border border-slate-200 bg-white space-y-2 w-fit min-w-[260px]">
        <div className="flex items-center gap-1.5">
          <BarChart3 size={13} className="text-navy" />
          <span className="text-[13px] font-bold text-slate-800">{poll.question}</span>
        </div>
        {results.map((r) => (
          <div key={r.id} className="relative">
            <div className="flex items-center justify-between text-[12px] mb-0.5">
              <span className={`flex items-center gap-1 ${r.mine ? 'font-bold text-navy' : 'text-slate-600'}`}>
                {r.mine && <Check size={11} />} {r.label}
              </span>
              <span className="text-slate-400">{Math.round((r.votes / (totalVotes || 1)) * 100)}%</span>
            </div>
            <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${r.mine ? 'bg-navy' : 'bg-slate-300'}`}
                style={{ width: `${(r.votes / max) * 100}%` }}
              />
            </div>
          </div>
        ))}
        <p className="text-[10.5px] text-slate-400 pt-0.5">
          {totalVotes} vote{totalVotes > 1 ? 's' : ''} · votre réponse est enregistrée
        </p>
      </div>
    );
  }

  // Rendu avant vote
  return (
    <div className="mt-2 p-3 rounded-xl border border-slate-200 bg-white space-y-2 w-fit min-w-[260px]">
      <div className="flex items-center gap-1.5">
        <BarChart3 size={13} className="text-navy" />
        <span className="text-[13px] font-bold text-slate-800">{poll.question}</span>
      </div>
      {poll.options.map((o) => (
        <label
          key={o.id}
          className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border cursor-pointer transition-colors text-[12.5px] ${
            selection.includes(o.id)
              ? 'border-navy bg-navy/5 text-navy font-medium'
              : 'border-slate-200 hover:border-slate-300 text-slate-700'
          } ${expired ? 'opacity-60 cursor-not-allowed' : ''}`}
        >
          <input
            type={poll.isMulti ? 'checkbox' : 'radio'}
            name={`poll-${message.id}`}
            checked={selection.includes(o.id)}
            disabled={expired}
            onChange={() =>
              setSelection((prev) =>
                poll.isMulti
                  ? prev.includes(o.id)
                    ? prev.filter((x) => x !== o.id)
                    : [...prev, o.id]
                  : [o.id],
              )
            }
            className="accent-navy"
          />
          {o.label}
        </label>
      ))}
      <div className="flex items-center gap-2 pt-1">
        {!expired ? (
          <button
            onClick={submit}
            disabled={!selection.length || busy}
            className="px-4 py-1.5 rounded-lg bg-navy text-white text-[12px] font-medium disabled:opacity-40"
          >
            {busy ? '…' : 'Voter'}
          </button>
        ) : (
          <span className="flex items-center gap-1 text-[11px] text-slate-400">
            <Clock size={11} /> Sondage expiré
          </span>
        )}
        {poll.isMulti && <span className="text-[10.5px] text-slate-400">Plusieurs choix possibles</span>}
      </div>
    </div>
  );
}
