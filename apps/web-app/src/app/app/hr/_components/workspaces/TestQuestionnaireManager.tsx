'use client';

/**
 * ============================================================================
 * TEST QUESTIONNAIRE MANAGER
 * ============================================================================
 * Composant pour gérer les questionnaires de test en ligne :
 *   - Créer un questionnaire (titre, durée, questions QCM/Vrai-Faux/texte)
 *   - Publier le questionnaire
 *   - Envoyer à un candidat (génère un lien + email)
 *   - Voir les réponses reçues + score auto + notation manuelle
 * ============================================================================
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Plus, Trash2, Save, Send, Eye, Loader2, Clock,
  CheckCircle, AlertCircle, FileText, Award, ChevronDown, ChevronRight,
  Edit2, Play, X,
} from 'lucide-react';
import { hrFetch, hrUrl } from '@/lib/hr/hr-client';
import { useModuleContext } from '@/hooks/useModuleContext';
import { toast } from '@/components/ui/toast';
import { motion, AnimatePresence } from 'framer-motion';

const PRIMARY = '#1A2BA6';

interface Question {
  id: string;
  type: 'SINGLE_CHOICE' | 'MULTIPLE_CHOICE' | 'TRUE_FALSE' | 'SHORT_TEXT' | 'LONG_TEXT';
  question: string;
  options?: string[];
  correctAnswers?: number[];
  points: number;
  explanation?: string;
}

interface Questionnaire {
  id: string;
  title: string;
  description?: string;
  testType?: string;
  durationMinutes: number;
  questions: Question[];
  status: string;
  passingScore: number;
  maxScore: number;
  instructions?: string;
  createdAt: string;
}

interface TestResponse {
  id: string;
  candidateName: string;
  candidateEmail: string;
  status: string;
  startedAt?: string;
  submittedAt?: string;
  autoScore?: number;
  autoScoreMax?: number;
  autoScorePercent?: number;
  recruiterScore?: number;
  recruiterFeedback?: string;
  responses?: any[];
}

export function TestQuestionnaireManager() {
  const { tenant } = useModuleContext();
  const [questionnaires, setQuestionnaires] = useState<Questionnaire[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEditor, setShowEditor] = useState(false);
  const [editingQ, setEditingQ] = useState<Questionnaire | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [responses, setResponses] = useState<Record<string, TestResponse[]>>({});
  const [sendModal, setSendModal] = useState<{ qId: string; candidates: any[] } | null>(null);
  const [scoreModal, setScoreModal] = useState<{ responseId: string; response: TestResponse } | null>(null);

  const fetchQuestionnaires = useCallback(async () => {
    if (!tenant?.id) return;
    try {
      setLoading(true);
      const data = await hrFetch<any[]>(hrUrl('recruitment/questionnaires', { tenantId: tenant.id }));
      setQuestionnaires(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error('Error fetching questionnaires:', err);
    } finally { setLoading(false); }
  }, [tenant?.id]);

  useEffect(() => { fetchQuestionnaires(); }, [fetchQuestionnaires]);

  async function fetchResponses(qId: string) {
    if (!tenant?.id) return;
    try {
      const data = await hrFetch<any[]>(hrUrl(`recruitment/questionnaires/${qId}/responses`, { tenantId: tenant.id }));
      setResponses(prev => ({ ...prev, [qId]: Array.isArray(data) ? data : [] }));
    } catch (err: any) {
      toast({ variant: 'error', title: 'Erreur', description: err.message });
    }
  }

  async function handlePublish(qId: string) {
    if (!tenant?.id) return;
    try {
      await hrFetch(hrUrl(`recruitment/questionnaires/${qId}/publish`, { tenantId: tenant.id }), { method: 'PUT' });
      toast({ variant: 'success', title: 'Questionnaire publié !' });
      fetchQuestionnaires();
    } catch (err: any) {
      toast({ variant: 'error', title: 'Erreur', description: err.message });
    }
  }

  async function handleDelete(qId: string) {
    if (!confirm('Supprimer ce questionnaire et toutes ses réponses ?')) return;
    if (!tenant?.id) return;
    try {
      await hrFetch(hrUrl(`recruitment/questionnaires/${qId}`, { tenantId: tenant.id }), { method: 'DELETE' });
      toast({ variant: 'success', title: 'Questionnaire supprimé' });
      fetchQuestionnaires();
    } catch (err: any) {
      toast({ variant: 'error', title: 'Erreur', description: err.message });
    }
  }

  async function handleSend(qId: string, candidateId: string) {
    if (!tenant?.id) return;
    try {
      const res = await hrFetch<any>(hrUrl(`recruitment/questionnaires/${qId}/send`, { tenantId: tenant.id }), {
        method: 'POST', body: { candidateId },
      });
      toast({ variant: 'success', title: 'Test envoyé !', description: `Lien: ${res.testUrl}` });
      setSendModal(null);
    } catch (err: any) {
      toast({ variant: 'error', title: 'Erreur', description: err.message });
    }
  }

  async function handleScore(responseId: string, score: number, feedback: string) {
    if (!tenant?.id) return;
    try {
      await hrFetch(hrUrl(`recruitment/test-responses/${responseId}/score`, { tenantId: tenant.id }), {
        method: 'PUT', body: { recruiterScore: score, recruiterFeedback: feedback },
      });
      toast({ variant: 'success', title: 'Note enregistrée !' });
      setScoreModal(null);
      if (expandedId) fetchResponses(expandedId);
    } catch (err: any) {
      toast({ variant: 'error', title: 'Erreur', description: err.message });
    }
  }

  return (
    <div className="space-y-4">
      {/* Header unifié */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h3 className="text-base font-bold text-slate-900">Tests d'évaluation & Questionnaires</h3>
          <p className="text-xs text-slate-500 mt-0.5">Créez des questionnaires en ligne, programmez-les pour les candidats, suivez les résultats.</p>
        </div>
        <button
          onClick={() => { setEditingQ(null); setShowEditor(true); }}
          className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white rounded-xl shadow-sm transition"
          style={{ backgroundColor: PRIMARY }}
        >
          <Plus className="h-3.5 w-3.5" /> Créer un questionnaire
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>
      ) : questionnaires.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-8 text-center">
          <FileText className="h-8 w-8 text-slate-300 mx-auto mb-2" />
          <p className="text-xs text-slate-500">Aucun questionnaire créé. Cliquez sur "Créer un questionnaire" pour commencer.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {questionnaires.map((q) => (
            <div key={q.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              {/* Header row */}
              <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-50 transition"
                onClick={() => { setExpandedId(expandedId === q.id ? null : q.id); if (expandedId !== q.id) fetchResponses(q.id); }}>
                <div className="flex items-center gap-3">
                  {expandedId === q.id ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-bold text-slate-900">{q.title}</p>
                      {q.testType && (
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase border ${
                          q.testType === 'Technique' ? 'bg-blue-50 text-blue-700 border-blue-100' :
                          q.testType === 'Pédagogique' ? 'bg-amber-50 text-amber-700 border-amber-100' :
                          q.testType === 'RH / Psychotechnique' ? 'bg-purple-50 text-purple-700 border-purple-100' :
                          q.testType === 'Anglais' ? 'bg-cyan-50 text-cyan-700 border-cyan-100' :
                          q.testType === 'Entretien RH' ? 'bg-rose-50 text-rose-700 border-rose-100' :
                          'bg-orange-50 text-orange-700 border-orange-100'
                        }`}>{q.testType}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-[10px] text-slate-400 mt-0.5">
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {q.durationMinutes} min</span>
                      <span>{q.questions.length} question{q.questions.length !== 1 ? 's' : ''}</span>
                      <span>Seuil: {q.passingScore}%</span>
                      {q.maxScore && <span>Max: {q.maxScore}</span>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                    q.status === 'PUBLISHED' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : q.status === 'CLOSED' ? 'bg-red-50 text-red-600 border border-red-200'
                    : 'bg-slate-50 text-slate-500 border border-slate-200'}`}>
                    {q.status === 'PUBLISHED' ? 'Publié' : q.status === 'CLOSED' ? 'Fermé' : 'Brouillon'}
                  </span>
                  {q.status === 'DRAFT' && (
                    <button onClick={(e) => { e.stopPropagation(); handlePublish(q.id); }}
                      className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition" title="Publier">
                      <Play className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <button onClick={(e) => { e.stopPropagation(); setEditingQ(q); setShowEditor(true); }}
                    className="p-1.5 rounded-lg bg-slate-50 text-slate-500 hover:bg-slate-100 transition" title="Modifier">
                    <Edit2 className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); handleDelete(q.id); }}
                    className="p-1.5 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 transition" title="Supprimer">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {/* Expanded content */}
              <AnimatePresence>
                {expandedId === q.id && (
                  <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
                    <div className="border-t border-slate-100 p-4 space-y-3">
                      {/* Questions preview */}
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Questions</p>
                        {q.questions.map((question, i) => (
                          <div key={question.id} className="bg-slate-50 rounded-lg p-3 mb-2">
                            <p className="text-xs font-semibold text-slate-700">Q{i+1}. {question.question}</p>
                            <p className="text-[10px] text-slate-400 mt-1">
                              Type: {question.type} · Points: {question.points}
                              {question.options && ` · ${question.options.length} options`}
                            </p>
                          </div>
                        ))}
                      </div>

                      {/* Send button */}
                      {q.status === 'PUBLISHED' && (
                        <button
                          onClick={() => setSendModal({ qId: q.id, candidates: [] })}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white rounded-lg transition"
                          style={{ backgroundColor: PRIMARY }}
                        >
                          <Send className="h-3.5 w-3.5" /> Envoyer à un candidat
                        </button>
                      )}

                      {/* Responses */}
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Réponses reçues</p>
                        {(responses[q.id] || []).length === 0 ? (
                          <p className="text-[10px] text-slate-400">Aucune réponse pour le moment.</p>
                        ) : (
                          <div className="space-y-2">
                            {(responses[q.id] || []).map((r) => (
                              <div key={r.id} className="bg-white border border-slate-200 rounded-lg p-3 flex items-center justify-between">
                                <div>
                                  <p className="text-xs font-bold text-slate-900">{r.candidateName}</p>
                                  <p className="text-[10px] text-slate-400">{r.candidateEmail}</p>
                                  <div className="flex items-center gap-2 mt-1">
                                    <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase ${
                                      r.status === 'SUBMITTED' ? 'bg-emerald-50 text-emerald-700'
                                      : r.status === 'IN_PROGRESS' ? 'bg-amber-50 text-amber-700'
                                      : r.status === 'EXPIRED' ? 'bg-red-50 text-red-600'
                                      : 'bg-slate-50 text-slate-500'}`}>
                                      {r.status}
                                    </span>
                                    {r.autoScorePercent != null && (
                                      <span className={`text-[10px] font-bold ${r.autoScorePercent >= q.passingScore ? 'text-emerald-600' : 'text-red-600'}`}>
                                        Score auto: {r.autoScorePercent}%
                                      </span>
                                    )}
                                    {r.recruiterScore != null && (
                                      <span className="text-[10px] font-bold text-[#1A2BA6]">Note: {r.recruiterScore}/100</span>
                                    )}
                                  </div>
                                </div>
                                {r.status === 'SUBMITTED' && (
                                  <button
                                    onClick={async () => {
                                      const detail = await hrFetch<any>(hrUrl(`recruitment/test-responses/${r.id}`, { tenantId: tenant?.id }));
                                      setScoreModal({ responseId: r.id, response: detail });
                                    }}
                                    className="px-2.5 py-1 text-[10px] font-bold text-[#1A2BA6] border border-[#1A2BA6]/20 rounded-lg hover:bg-[#1A2BA6]/5 transition"
                                  >
                                    {r.recruiterScore != null ? 'Voir / Modifier note' : 'Voir & Noter'}
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      )}

      {/* Editor Modal */}
      {showEditor && (
        <QuestionnaireEditor
          questionnaire={editingQ}
          tenantId={tenant?.id}
          onClose={() => { setShowEditor(false); setEditingQ(null); }}
          onSuccess={() => { setShowEditor(false); setEditingQ(null); fetchQuestionnaires(); }}
        />
      )}

      {/* Send Modal */}
      {sendModal && (
        <SendQuestionnaireModal
          qId={sendModal.qId}
          tenantId={tenant?.id}
          onClose={() => setSendModal(null)}
          onSend={handleSend}
        />
      )}

      {/* Score Modal */}
      {scoreModal && (
        <ScoreResponseModal
          response={scoreModal.response}
          onClose={() => setScoreModal(null)}
          onScore={handleScore}
        />
      )}
    </div>
  );
}

// ─── Questionnaire Editor Modal ────────────────────────────────────────────

function QuestionnaireEditor({ questionnaire, tenantId, onClose, onSuccess }: {
  questionnaire: Questionnaire | null;
  tenantId?: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [title, setTitle] = useState(questionnaire?.title || '');
  const [description, setDescription] = useState(questionnaire?.description || '');
  const [testType, setTestType] = useState(questionnaire?.testType || 'Technique');
  const [duration, setDuration] = useState(questionnaire?.durationMinutes || 30);
  const [passingScore, setPassingScore] = useState(questionnaire?.passingScore || 60);
  const [maxScore, setMaxScore] = useState(questionnaire?.maxScore || 100);
  const [instructions, setInstructions] = useState(questionnaire?.instructions || '');
  const [questions, setQuestions] = useState<Question[]>(questionnaire?.questions || []);
  const [saving, setSaving] = useState(false);

  function addQuestion() {
    setQuestions(prev => [...prev, {
      id: `q_${Date.now()}`,
      type: 'SINGLE_CHOICE',
      question: '',
      options: ['', ''],
      correctAnswers: [],
      points: 1,
    }]);
  }

  function updateQuestion(idx: number, updates: Partial<Question>) {
    setQuestions(prev => prev.map((q, i) => i === idx ? { ...q, ...updates } : q));
  }

  function removeQuestion(idx: number) {
    setQuestions(prev => prev.filter((_, i) => i !== idx));
  }

  async function handleSave() {
    if (!title.trim() || questions.length === 0) {
      toast({ variant: 'error', title: 'Titre et au moins une question requis' });
      return;
    }
    for (const q of questions) {
      if (!q.question.trim()) { toast({ variant: 'error', title: 'Toutes les questions doivent avoir un texte' }); return; }
    }
    setSaving(true);
    try {
      const body = { title, description, testType, durationMinutes: duration, passingScore, maxScore, instructions, questions };
      if (questionnaire) {
        await hrFetch(hrUrl(`recruitment/questionnaires/${questionnaire.id}`, { tenantId }), { method: 'PUT', body });
      } else {
        await hrFetch(hrUrl('recruitment/questionnaires', { tenantId }), { method: 'POST', body });
      }
      toast({ variant: 'success', title: 'Questionnaire sauvegardé !' });
      onSuccess();
    } catch (err: any) {
      toast({ variant: 'error', title: 'Erreur', description: err.message });
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-auto">
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between z-10">
          <h3 className="font-bold text-slate-900 text-sm">{questionnaire ? 'Modifier le test' : 'Nouveau test'}</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100"><X className="h-4 w-4 text-slate-400" /></button>
        </div>
        <div className="p-6 space-y-4">
          {/* Titre */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Titre du test *</label>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="Ex: Test de compétences pédagogiques"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold" />
          </div>

          {/* Type de test + Durée + Scores */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Type de test</label>
              <select value={testType} onChange={e => setTestType(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-2 py-2 text-sm">
                <option value="Technique">Technique</option>
                <option value="Pédagogique">Pédagogique</option>
                <option value="RH / Psychotechnique">RH / Psycho</option>
                <option value="Anglais">Anglais</option>
                <option value="Compétences transverses">Comp. transverses</option>
                <option value="Entretien RH">Entretien RH</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Durée (min)</label>
              <input type="number" value={duration} onChange={e => setDuration(parseInt(e.target.value) || 30)} min="1" max="180"
                className="w-full rounded-lg border border-slate-200 px-2 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Score max</label>
              <input type="number" value={maxScore} onChange={e => setMaxScore(parseInt(e.target.value) || 100)} min="1"
                className="w-full rounded-lg border border-slate-200 px-2 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Score min (%)</label>
              <input type="number" value={passingScore} onChange={e => setPassingScore(parseInt(e.target.value) || 60)} min="0" max="100"
                className="w-full rounded-lg border border-slate-200 px-2 py-2 text-sm" />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Description</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Description du test (optionnel)" rows={2}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
          </div>

          {/* Consignes */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Consignes pour le candidat</label>
            <textarea value={instructions} onChange={e => setInstructions(e.target.value)} placeholder="Ex: Lisez attentivement chaque question. Une minuterie démarrera..." rows={2}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
          </div>

          {/* Questions */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-slate-500 uppercase">Questions ({questions.length})</p>
              <button onClick={addQuestion} className="flex items-center gap-1 px-2 py-1 text-[10px] font-bold text-[#1A2BA6] border border-[#1A2BA6]/20 rounded-lg hover:bg-[#1A2BA6]/5 transition">
                <Plus className="h-3 w-3" /> Ajouter
              </button>
            </div>
            {questions.map((q, idx) => (
              <div key={q.id} className="bg-slate-50 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-400">Question {idx + 1}</span>
                  <button onClick={() => removeQuestion(idx)} className="p-1 text-red-400 hover:bg-red-50 rounded"><Trash2 className="h-3 w-3" /></button>
                </div>
                <input type="text" value={q.question} onChange={e => updateQuestion(idx, { question: e.target.value })}
                  placeholder="Texte de la question" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
                <div className="grid grid-cols-3 gap-2">
                  <select value={q.type} onChange={e => {
                    const type = e.target.value as Question['type'];
                    updateQuestion(idx, { type, options: type === 'TRUE_FALSE' ? ['Vrai', 'Faux'] : (type === 'SINGLE_CHOICE' || type === 'MULTIPLE_CHOICE') ? (q.options || ['', '']) : undefined, correctAnswers: [] });
                  }} className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs">
                    <option value="SINGLE_CHOICE">QCM (choix unique)</option>
                    <option value="MULTIPLE_CHOICE">QCM (choix multiple)</option>
                    <option value="TRUE_FALSE">Vrai / Faux</option>
                    <option value="SHORT_TEXT">Texte court</option>
                    <option value="LONG_TEXT">Texte long</option>
                  </select>
                  <input type="number" value={q.points} onChange={e => updateQuestion(idx, { points: parseInt(e.target.value) || 1 })} min="1"
                    className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs" placeholder="Points" />
                </div>
                {/* Options pour QCM */}
                {(q.type === 'SINGLE_CHOICE' || q.type === 'MULTIPLE_CHOICE' || q.type === 'TRUE_FALSE') && q.options && (
                  <div className="space-y-1.5">
                    {q.options.map((opt, oi) => (
                      <div key={oi} className="flex items-center gap-2">
                        <button onClick={() => {
                          const correct = q.correctAnswers || [];
                          const newCorrect = q.type === 'SINGLE_CHOICE' || q.type === 'TRUE_FALSE'
                            ? [oi] : correct.includes(oi) ? correct.filter(c => c !== oi) : [...correct, oi];
                          updateQuestion(idx, { correctAnswers: newCorrect });
                        }} className={`p-1 rounded ${q.correctAnswers?.includes(oi) ? 'text-emerald-600' : 'text-slate-300'}`}>
                          <CheckCircle className="h-4 w-4" />
                        </button>
                        <input type="text" value={opt} onChange={e => {
                          const newOptions = [...q.options!]; newOptions[oi] = e.target.value;
                          updateQuestion(idx, { options: newOptions });
                        }} className="flex-1 rounded border border-slate-200 px-2 py-1 text-xs" placeholder={`Option ${oi + 1}`} />
                        {q.type !== 'TRUE_FALSE' && (
                          <button onClick={() => {
                            const newOptions = q.options!.filter((_, i) => i !== oi);
                            updateQuestion(idx, { options: newOptions, correctAnswers: (q.correctAnswers || []).filter(c => c !== oi) });
                          }} className="p-1 text-red-300 hover:text-red-500"><X className="h-3 w-3" /></button>
                        )}
                      </div>
                    ))}
                    {q.type !== 'TRUE_FALSE' && (
                      <button onClick={() => updateQuestion(idx, { options: [...(q.options || []), ''] })}
                        className="text-[10px] font-bold text-[#1A2BA6] hover:underline">+ Ajouter une option</button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
        <div className="sticky bottom-0 bg-white border-t border-slate-200 px-6 py-4 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition">Annuler</button>
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 px-5 py-2 text-sm font-bold text-white rounded-xl shadow-sm disabled:opacity-50 transition"
            style={{ backgroundColor: PRIMARY }}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Sauvegarder
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Send Questionnaire Modal ──────────────────────────────────────────────

function SendQuestionnaireModal({ qId, tenantId, onClose, onSend }: {
  qId: string; tenantId?: string; onClose: () => void; onSend: (qId: string, candidateId: string) => void;
}) {
  const [candidates, setCandidates] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tenantId) return;
    hrFetch<any[]>(hrUrl('recruitment/candidates', { tenantId }))
      .then(data => setCandidates(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [tenantId]);

  const filtered = candidates.filter(c =>
    `${c.firstName} ${c.lastName} ${c.email}`.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="px-6 py-4" style={{ background: 'linear-gradient(135deg, #0D1F6E 0%, #0D3B85 100%)' }}>
          <h3 className="text-white font-bold text-sm">Envoyer le test à un candidat</h3>
        </div>
        <div className="p-6 space-y-3">
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher un candidat..."
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
          {loading ? <Loader2 className="h-5 w-5 animate-spin text-slate-400 mx-auto" /> : (
            <div className="max-h-64 overflow-auto space-y-1">
              {filtered.map(c => (
                <button key={c.id} onClick={() => onSend(qId, c.id)}
                  className="w-full text-left p-3 rounded-lg border border-slate-100 hover:bg-slate-50 transition">
                  <p className="text-xs font-bold text-slate-900">{c.firstName} {c.lastName}</p>
                  <p className="text-[10px] text-slate-400">{c.email}</p>
                </button>
              ))}
              {filtered.length === 0 && <p className="text-xs text-slate-400 text-center py-4">Aucun candidat trouvé</p>}
            </div>
          )}
        </div>
        <div className="px-6 py-3 bg-slate-50 flex justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition">Fermer</button>
        </div>
      </div>
    </div>
  );
}

// ─── Score Response Modal ──────────────────────────────────────────────────

function ScoreResponseModal({ response, onClose, onScore }: {
  response: any; onClose: () => void; onScore: (responseId: string, score: number, feedback: string) => void;
}) {
  const [score, setScore] = useState(response?.recruiterScore ?? response?.autoScorePercent ?? 0);
  const [feedback, setFeedback] = useState(response?.recruiterFeedback || '');
  const [saving, setSaving] = useState(false);

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-auto" onClick={e => e.stopPropagation()}>
        <div className="px-6 py-4 sticky top-0 bg-white border-b border-slate-200" style={{ background: 'linear-gradient(135deg, #0D1F6E 0%, #0D3B85 100%)' }}>
          <h3 className="text-white font-bold text-sm">Réponses de {response?.candidateName}</h3>
          {response?.autoScorePercent != null && (
            <p className="text-white/70 text-xs mt-1">Score automatique: {response.autoScorePercent}% ({response.autoScore}/{response.autoScoreMax} points)</p>
          )}
        </div>
        <div className="p-6 space-y-3">
          {/* Afficher les réponses */}
          {(response?.responses || []).map((r: any, i: number) => {
            const question = response?.questionnaireQuestions?.[i];
            return (
              <div key={i} className="bg-slate-50 rounded-lg p-3">
                <p className="text-xs font-bold text-slate-900 mb-1">Q{i+1}. {question?.question}</p>
                <p className="text-xs text-slate-600">
                  Réponse: {Array.isArray(r.answer) ? r.answer.map((a: number) => question?.options?.[a] || a).join(', ') : question?.options?.[Number(r.answer)] || r.answer}
                </p>
                {r.isCorrect !== undefined && (
                  <p className={`text-[10px] font-bold mt-1 ${r.isCorrect ? 'text-emerald-600' : 'text-red-600'}`}>
                    {r.isCorrect ? '✓ Correct' : '✗ Incorrect'} — {r.pointsAwarded} pt(s)
                  </p>
                )}
                {r.explanation && <p className="text-[10px] text-slate-400 mt-1 italic">{r.explanation}</p>}
              </div>
            );
          })}

          {/* Notation manuelle */}
          <div className="border-t border-slate-100 pt-4 space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Note du recruteur (/100)</label>
              <input type="number" value={score} onChange={e => setScore(parseInt(e.target.value) || 0)} min="0" max="100"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Feedback (optionnel)</label>
              <textarea value={feedback} onChange={e => setFeedback(e.target.value)} rows={3}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
            </div>
          </div>
        </div>
        <div className="sticky bottom-0 bg-white border-t border-slate-200 px-6 py-4 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition">Annuler</button>
          <button onClick={() => { setSaving(true); onScore(response.id, score, feedback); }} disabled={saving}
            className="flex items-center gap-2 px-5 py-2 text-sm font-bold text-white rounded-xl shadow-sm disabled:opacity-50 transition"
            style={{ backgroundColor: PRIMARY }}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Enregistrer la note
          </button>
        </div>
      </div>
    </div>
  );
}
