'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  X, Save, Plus, Trash2, ArrowUp, ArrowDown, FileText,
  Loader2, RotateCcw, Edit3, AlertCircle,
} from 'lucide-react';
import { hrFetch, hrUrl } from '@/lib/hr/hr-client';
import { toast } from '@/components/ui/toast';
import { useModuleContext } from '@/hooks/useModuleContext';
import { motion, AnimatePresence } from 'framer-motion';

const PRIMARY = '#1A2BA6';

interface Article {
  title: string;
  content: string;
}

interface ContractEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  contract: any;
}

export function ContractEditorModal({
  isOpen,
  onClose,
  onSuccess,
  contract,
}: ContractEditorModalProps) {
  const { tenant } = useModuleContext();
  const [articles, setArticles] = useState<Article[]>([]);
  const [originalArticles, setOriginalArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  const contractId = contract?.id;
  const isSigned = !!contract?.signedAt;

  // Load articles when modal opens
  useEffect(() => {
    if (isOpen && contractId && tenant?.id) {
      loadArticles();
    }
  }, [isOpen, contractId, tenant?.id]);

  // Track changes
  useEffect(() => {
    if (originalArticles.length === 0) return;
    const changed = JSON.stringify(articles) !== JSON.stringify(originalArticles);
    setHasChanges(changed);
  }, [articles, originalArticles]);

  async function loadArticles() {
    try {
      setLoading(true);
      const data = await hrFetch<Article[]>(
        hrUrl(`contracts/${contractId}/articles`, { tenantId: tenant.id })
      );
      setArticles(data || []);
      setOriginalArticles(JSON.parse(JSON.stringify(data || [])));
      setHasChanges(false);
    } catch (err) {
      console.error('Error loading articles:', err);
      toast({ variant: 'error', title: 'Erreur lors du chargement des articles.' });
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!contractId || !tenant?.id) return;
    try {
      setSaving(true);
      await hrFetch<any>(
        hrUrl(`contracts/${contractId}/articles`, { tenantId: tenant.id }),
        {
          method: 'PUT',
          body: { articles },
        }
      );
      toast({ variant: 'success', title: 'Articles du contrat enregistrés avec succès.' });
      setOriginalArticles(JSON.parse(JSON.stringify(articles)));
      setHasChanges(false);
      onSuccess();
    } catch (err: any) {
      toast({
        variant: 'error',
        title: 'Erreur lors de la sauvegarde.',
        description: err?.message,
      });
    } finally {
      setSaving(false);
    }
  }

  function handleReset() {
    setArticles(JSON.parse(JSON.stringify(originalArticles)));
    setHasChanges(false);
  }

  const addArticle = useCallback(() => {
    setArticles(prev => [
      ...prev,
      { title: `Article ${prev.length + 1} — Nouveau`, content: '' },
    ]);
  }, []);

  const removeArticle = useCallback((index: number) => {
    setArticles(prev => prev.filter((_, i) => i !== index));
  }, []);

  const moveArticle = useCallback((index: number, direction: 'up' | 'down') => {
    const nextIndex = direction === 'up' ? index - 1 : index + 1;
    if (nextIndex < 0 || nextIndex >= articles.length) return;
    setArticles(prev => {
      const updated = [...prev];
      const temp = updated[index];
      updated[index] = updated[nextIndex];
      updated[nextIndex] = temp;
      return updated;
    });
  }, [articles.length]);

  const updateArticle = useCallback((index: number, field: 'title' | 'content', value: string) => {
    setArticles(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  }, []);

  const insertPlaceholder = useCallback((placeholder: string) => {
    if (focusedIndex === null) return;
    updateArticle(focusedIndex, 'content', (articles[focusedIndex]?.content || '') + placeholder);
  }, [focusedIndex, articles, updateArticle]);

  if (!isOpen) return null;

  const inputClass =
    'w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:border-[#1A2BA6] focus:ring-2 focus:ring-[#1A2BA6]/10 transition';

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-start justify-center bg-black/50 backdrop-blur-sm overflow-y-auto py-4"
          onClick={(e) => { if (e.target === e.currentTarget && !hasChanges) onClose(); }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="w-full max-w-4xl bg-white rounded-2xl shadow-2xl my-4"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <div className="flex items-center gap-3">
                <div
                  className="p-2 rounded-xl"
                  style={{ backgroundColor: PRIMARY + '15', color: PRIMARY }}
                >
                  <Edit3 className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">
                    Édition du Contrat
                  </h2>
                  <p className="text-xs text-slate-500">
                    Modifiez les articles du contrat ligne par ligne avant la signature
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-slate-100 rounded-xl transition"
              >
                <X className="h-5 w-5 text-slate-400" />
              </button>
            </div>

            {/* Contract info banner */}
            <div
              className="px-6 py-3 flex items-center justify-between"
              style={{ background: `linear-gradient(135deg, ${PRIMARY}10 0%, ${PRIMARY}05 100%)` }}
            >
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4" style={{ color: PRIMARY }} />
                <span className="text-sm font-semibold" style={{ color: PRIMARY }}>
                  {contract?.staff?.firstName} {contract?.staff?.lastName} — {contract?.contractType}
                </span>
              </div>
              {isSigned && (
                <span className="text-xs font-semibold text-amber-700 bg-amber-100 px-2 py-1 rounded-lg">
                  Contrat déjà signé — lecture seule
                </span>
              )}
            </div>

            {/* Content */}
            <div className="px-6 py-5 max-h-[65vh] overflow-y-auto space-y-4">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin" style={{ color: PRIMARY }} />
                </div>
              ) : articles.length === 0 ? (
                <div className="text-center py-12">
                  <FileText className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-sm text-slate-500">Aucun article trouvé.</p>
                </div>
              ) : (
                <>
                  {/* Explanation */}
                  <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-xs text-blue-700 flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold">Mode édition</p>
                      <p className="mt-0.5">
                        Vous pouvez modifier le titre et le contenu de chaque article. Les variables{' '}
                        <code className="font-mono bg-blue-100 px-1 rounded">{'{{staffFullName}}'}</code>,{' '}
                        <code className="font-mono bg-blue-100 px-1 rounded">{'{{baseSalary}}'}</code>, etc. seront remplacées automatiquement lors de la génération du PDF.
                        Cliquez sur les balises ci-dessous pour les insérer dans l&apos;article en cours d&apos;édition.
                      </p>
                    </div>
                  </div>

                  {/* Articles */}
                  {articles.map((art, idx) => (
                    <div
                      key={idx}
                      className="p-4 bg-slate-50/50 border border-slate-200 rounded-xl space-y-3 relative"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-500">
                          Article #{idx + 1}
                        </span>
                        {!isSigned && (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              disabled={idx === 0}
                              onClick={() => moveArticle(idx, 'up')}
                              className="p-1 hover:bg-slate-200 disabled:opacity-30 rounded text-slate-600 transition"
                            >
                              <ArrowUp className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              disabled={idx === articles.length - 1}
                              onClick={() => moveArticle(idx, 'down')}
                              className="p-1 hover:bg-slate-200 disabled:opacity-30 rounded text-slate-600 transition"
                            >
                              <ArrowDown className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => removeArticle(idx)}
                              className="p-1 hover:bg-rose-100 text-rose-600 rounded transition"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        )}
                      </div>

                      <div>
                        <input
                          type="text"
                          required
                          disabled={isSigned}
                          placeholder="Titre de l'article (ex : Article 3 — Rémunération)"
                          className={inputClass + ' bg-white font-semibold text-slate-800'}
                          value={art.title}
                          onChange={(e) => updateArticle(idx, 'title', e.target.value)}
                        />
                      </div>

                      <div>
                        <textarea
                          required
                          rows={4}
                          disabled={isSigned}
                          placeholder="Saisissez le texte de l'article ici..."
                          className={inputClass + ' bg-white leading-relaxed resize-y min-h-[80px]'}
                          value={art.content}
                          onFocus={() => setFocusedIndex(idx)}
                          onChange={(e) => updateArticle(idx, 'content', e.target.value)}
                        />
                      </div>

                      {!isSigned && focusedIndex === idx && (
                        <div className="pt-2 border-t border-slate-100">
                          <p className="text-[10px] text-slate-400 mb-1.5 font-semibold uppercase">
                            Insérer une variable (cliquez pour ajouter dans cet article) :
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {[
                              { tag: '{{staffFullName}}', label: 'Nom Employé' },
                              { tag: '{{staffPosition}}', label: 'Poste/Fonction' },
                              { tag: '{{baseSalary}}', label: 'Salaire Brut' },
                              { tag: '{{currency}}', label: 'Devise' },
                              { tag: '{{paymentMode}}', label: 'Mode Paiement' },
                              { tag: '{{startDate}}', label: 'Date Début' },
                              { tag: '{{endDate}}', label: 'Date Fin' },
                              { tag: '{{schoolName}}', label: 'Nom École' },
                              { tag: '{{employeeNumber}}', label: 'Matricule' },
                              { tag: '{{cnssNumber}}', label: 'N° CNSS' },
                              { tag: '{{academicYear}}', label: 'Année Scolaire' },
                              { tag: '{{contractTypeLabel}}', label: 'Type Contrat' },
                              { tag: '{{civilite}}', label: 'Civilité' },
                              { tag: '{{staffBirthDate}}', label: 'Date Naissance' },
                              { tag: '{{staffEmail}}', label: 'Email' },
                              { tag: '{{staffPhone}}', label: 'Téléphone' },
                            ].map((item) => (
                              <button
                                key={item.tag}
                                type="button"
                                onClick={() => insertPlaceholder(item.tag)}
                                className="text-[10px] font-semibold bg-white hover:bg-indigo-50 border border-slate-200 hover:border-indigo-200 text-slate-600 hover:text-[#1A2BA6] px-2 py-0.5 rounded transition shadow-sm"
                              >
                                {item.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}

                  {/* Add article button */}
                  {!isSigned && (
                    <button
                      type="button"
                      onClick={addArticle}
                      className="w-full flex items-center justify-center gap-1.5 py-2.5 bg-slate-50 hover:bg-slate-100 border border-dashed border-slate-300 hover:border-slate-400 rounded-xl text-xs font-bold text-slate-600 transition"
                    >
                      <Plus className="h-4 w-4" /> Ajouter un article
                    </button>
                  )}
                </>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                {hasChanges && (
                  <span className="text-xs font-semibold text-amber-700 bg-amber-50 px-2 py-1 rounded-lg">
                    Modifications non enregistrées
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3">
                {hasChanges && (
                  <button
                    type="button"
                    onClick={handleReset}
                    className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold bg-slate-100 text-slate-600 hover:bg-slate-200 rounded-xl transition"
                  >
                    <RotateCcw className="h-4 w-4" />
                    Réinitialiser
                  </button>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-sm font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-xl transition"
                >
                  Fermer
                </button>
                {!isSigned && (
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving || !hasChanges}
                    className="flex items-center gap-2 px-5 py-2 text-sm font-bold text-white rounded-xl hover:opacity-90 transition disabled:opacity-50"
                    style={{ backgroundColor: PRIMARY }}
                  >
                    {saving ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    {saving ? 'Enregistrement...' : 'Enregistrer les modifications'}
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
