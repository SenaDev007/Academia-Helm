'use client';

/**
 * ============================================================================
 * HELM CONNECT V2.6 — Poll Creation Modal
 * ============================================================================
 * 
 * Création de sondage style Telegram :
 *   - Question
 *   - 2 à 10 options de réponse
 *   - Choix unique OU multiple
 *   - Anonyme (optionnel)
 *   - Expiration (1h, 8h, 1j, 1 semaine)
 * 
 * ⭐ Backend : POST /api/chat/v2/polls avec body { conversationId, question, options, ... }
 *    Le poll est créé comme un message spécial (type='POLL') avec metadata.
 * ============================================================================
 */

import React, { useState, useCallback } from 'react';
import { X, Plus, Trash2, BarChart3, Clock, Eye, EyeOff, Send, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface PollOption {
  id: string;
  text: string;
}

interface PollModalProps {
  currentUserId: string;
  conversationId: string | null;
  onClose: () => void;
  onPollCreated?: (pollId: string) => void;
}

export default function PollModal({
  currentUserId,
  conversationId,
  onClose,
  onPollCreated,
}: PollModalProps) {
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState<PollOption[]>([
    { id: '1', text: '' },
    { id: '2', text: '' },
  ]);
  const [multipleChoice, setMultipleChoice] = useState(false);
  const [anonymous, setAnonymous] = useState(false);
  const [expiry, setExpiry] = useState<'1H' | '8H' | '24H' | '7D' | 'NEVER'>('24H');
  const [creating, setCreating] = useState(false);

  const addOption = useCallback(() => {
    if (options.length >= 10) {
      toast.error('Maximum 10 options');
      return;
    }
    setOptions(prev => [...prev, { id: `${Date.now()}`, text: '' }]);
  }, [options.length]);

  const removeOption = useCallback((id: string) => {
    if (options.length <= 2) {
      toast.error('Minimum 2 options');
      return;
    }
    setOptions(prev => prev.filter(o => o.id !== id));
  }, [options.length]);

  const updateOption = useCallback((id: string, text: string) => {
    setOptions(prev => prev.map(o => (o.id === id ? { ...o, text } : o)));
  }, []);

  const handleCreate = async () => {
    if (!conversationId) {
      toast.error('Aucune conversation sélectionnée');
      return;
    }
    if (question.trim().length < 5) {
      toast.error('La question doit contenir au moins 5 caractères');
      return;
    }
    const filledOptions = options.filter(o => o.text.trim().length > 0);
    if (filledOptions.length < 2) {
      toast.error('Au moins 2 options sont requises');
      return;
    }

    setCreating(true);
    try {
      const res = await fetch('/api/chat/v2/polls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId,
          authorId: currentUserId,
          question: question.trim(),
          options: filledOptions.map(o => o.text.trim()),
          multipleChoice,
          anonymous,
          expiry,
        }),
        credentials: 'include',
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as any)?.backendError?.message || (err as any)?.message || `Erreur ${res.status}`);
      }
      const data = await res.json();
      toast.success('Sondage créé !');
      onPollCreated?.(data.id);
      onClose();
    } catch (e: any) {
      toast.error(`Échec : ${e.message}`);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-[#E6F4FF]">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center">
              <BarChart3 className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Nouveau sondage</h3>
              <p className="text-[11px] text-slate-500">Posez une question à vos destinataires</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-lg">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Question */}
          <div>
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wide block mb-1">
              Question
            </label>
            <textarea
              autoFocus
              placeholder="Saisissez votre question..."
              rows={2}
              maxLength={200}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#3B9EFF]/30 resize-none"
              value={question}
              onChange={e => setQuestion(e.target.value)}
            />
            <p className="text-[10px] text-slate-400 text-right mt-0.5">
              {question.length}/200
            </p>
          </div>

          {/* Options */}
          <div>
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wide block mb-1">
              Options de réponse ({options.filter(o => o.text.trim()).length}/{options.length})
            </label>
            <div className="space-y-2">
              {options.map((opt, idx) => (
                <div key={opt.id} className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-700 flex-shrink-0">
                    {idx + 1}
                  </span>
                  <input
                    type="text"
                    placeholder={`Option ${idx + 1}`}
                    maxLength={100}
                    className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#3B9EFF]/30"
                    value={opt.text}
                    onChange={e => updateOption(opt.id, e.target.value)}
                  />
                  {options.length > 2 && (
                    <button
                      onClick={() => removeOption(opt.id)}
                      className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg"
                      title="Supprimer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            {options.length < 10 && (
              <button
                onClick={addOption}
                className="mt-2 flex items-center gap-1 text-sm text-[#0958D9] font-semibold hover:underline"
              >
                <Plus className="w-4 h-4" /> Ajouter une option
              </button>
            )}
          </div>

          {/* Settings */}
          <div className="space-y-2 pt-2 border-t border-slate-100">
            <button
              onClick={() => setMultipleChoice(!multipleChoice)}
              className="w-full flex items-center justify-between p-3 hover:bg-slate-50 rounded-lg"
            >
              <div className="flex items-center gap-2 text-left">
                <BarChart3 className="w-4 h-4 text-slate-500" />
                <div>
                  <div className="text-sm font-semibold text-slate-900">Choix multiple</div>
                  <div className="text-[11px] text-slate-500">Autoriser plusieurs réponses</div>
                </div>
              </div>
              <div className={cn(
                'w-11 h-6 rounded-full relative transition-colors',
                multipleChoice ? 'bg-[#1677FF]' : 'bg-slate-300'
              )}>
                <div className={cn(
                  'absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform shadow',
                  multipleChoice ? 'translate-x-5' : 'translate-x-0.5'
                )} />
              </div>
            </button>

            <button
              onClick={() => setAnonymous(!anonymous)}
              className="w-full flex items-center justify-between p-3 hover:bg-slate-50 rounded-lg"
            >
              <div className="flex items-center gap-2 text-left">
                {anonymous ? <EyeOff className="w-4 h-4 text-slate-500" /> : <Eye className="w-4 h-4 text-slate-500" />}
                <div>
                  <div className="text-sm font-semibold text-slate-900">Sondage anonyme</div>
                  <div className="text-[11px] text-slate-500">Masquer l'identité des votants</div>
                </div>
              </div>
              <div className={cn(
                'w-11 h-6 rounded-full relative transition-colors',
                anonymous ? 'bg-[#1677FF]' : 'bg-slate-300'
              )}>
                <div className={cn(
                  'absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform shadow',
                  anonymous ? 'translate-x-5' : 'translate-x-0.5'
                )} />
              </div>
            </button>

            {/* Expiry */}
            <div className="p-3">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-4 h-4 text-slate-500" />
                <div className="text-sm font-semibold text-slate-900">Expiration</div>
              </div>
              <div className="grid grid-cols-5 gap-1.5">
                {([
                  { key: '1H', label: '1h' },
                  { key: '8H', label: '8h' },
                  { key: '24H', label: '24h' },
                  { key: '7D', label: '7j' },
                  { key: 'NEVER', label: '∞' },
                ] as const).map(opt => (
                  <button
                    key={opt.key}
                    onClick={() => setExpiry(opt.key)}
                    className={cn(
                      'py-1.5 text-xs font-bold rounded',
                      expiry === opt.key
                        ? 'bg-[#1677FF] text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-slate-100 text-slate-700 text-sm font-bold rounded-lg hover:bg-slate-200"
          >
            Annuler
          </button>
          <button
            onClick={handleCreate}
            disabled={creating || question.trim().length < 5 || options.filter(o => o.text.trim()).length < 2}
            className="flex-1 px-4 py-2 bg-[#1677FF] text-white text-sm font-bold rounded-lg hover:bg-[#0958D9] disabled:opacity-30 flex items-center justify-center gap-2"
          >
            {creating ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Création...</>
            ) : (
              <>Créer le sondage <Send className="w-3.5 h-3.5" /></>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
