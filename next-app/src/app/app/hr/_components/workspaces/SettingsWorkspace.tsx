'use client';

import { useState, useEffect } from 'react';
import { useConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  Save, Settings, ShieldAlert, CheckCircle2, Loader2,
  FileText, Plus, Trash2, Edit3, X, ArrowUp, ArrowDown,
} from 'lucide-react';
import { useModuleContext } from '@/hooks/useModuleContext';
import { hrFetch, hrUrl } from '@/lib/hr/hr-client';
import { toast } from '@/components/ui/toast';
import { motion, AnimatePresence } from 'framer-motion';

const PRIMARY = '#1A2BA6';

const CONTRACT_TYPES = [
  { value: 'CDI', label: 'CDI — Durée Indéterminée' },
  { value: 'CDD', label: 'CDD — Durée Déterminée' },
  { value: 'VACATAIRE', label: 'Vacataire' },
  { value: 'STAGE', label: 'Stage / Alternance' },
];

export function SettingsWorkspace() {
  const confirmDialog = useConfirmDialog();
  const { tenant } = useModuleContext();
  const [activeTab, setActiveTab] = useState<'payroll' | 'templates'>('payroll');

  // ── Payroll Settings ──────────────────────────────────────────────────────
  const [rates, setRates] = useState<any>({
    cnssEmployeeRate: 3.6,
    cnssEmployerRate: 6.4,
    taxRate: 10,
    effectiveFrom: new Date().toISOString().split('T')[0],
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  // ── Contract Templates ───────────────────────────────────────────────────
  const [templates, setTemplates] = useState<any[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [showNewTemplate, setShowNewTemplate] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<any>(null);
  const [newTemplate, setNewTemplate] = useState({ name: '', contractType: 'CDI', template: '' });
  const [savingTemplate, setSavingTemplate] = useState(false);

  const [articles, setArticles] = useState<{ title: string; content: string }[]>([]);
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);

  const insertPlaceholder = (placeholder: string) => {
    if (focusedIndex === null) return;
    const updated = [...articles];
    updated[focusedIndex].content = (updated[focusedIndex].content || '') + placeholder;
    setArticles(updated);
  };

  const addArticle = () => {
    setArticles([...articles, { title: `Article ${articles.length + 1} — Titre`, content: '' }]);
  };

  const removeArticle = (index: number) => {
    setArticles(articles.filter((_, i) => i !== index));
  };

  const moveArticle = (index: number, direction: 'up' | 'down') => {
    const nextIndex = direction === 'up' ? index - 1 : index + 1;
    if (nextIndex < 0 || nextIndex >= articles.length) return;
    const updated = [...articles];
    const temp = updated[index];
    updated[index] = updated[nextIndex];
    updated[nextIndex] = temp;
    setArticles(updated);
  };

  // Synchronise les articles lors du changement de showNewTemplate ou d'édition
  useEffect(() => {
    if (editingTemplate?.template) {
      try {
        const parsed = JSON.parse(editingTemplate.template);
        if (Array.isArray(parsed)) {
          setArticles(parsed);
        } else {
          setArticles([{ title: "Contenu du contrat", content: editingTemplate.template }]);
        }
      } catch (e) {
        setArticles([{ title: "Contenu du contrat", content: editingTemplate.template }]);
      }
    }
  }, [editingTemplate?.id]);

  useEffect(() => {
    if (showNewTemplate) {
      loadDefaultTemplate('CDI');
    } else {
      setArticles([]);
    }
  }, [showNewTemplate]);

  useEffect(() => {
    if (!tenant?.id) return;
    loadRates();
    loadTemplates();
  }, [tenant?.id]);

  async function loadRates() {
    try {
      setLoading(true);
      const data = await hrFetch<any>(hrUrl('payroll/rates/active', { tenantId: tenant.id }));
      if (data) {
        setRates({
          cnssEmployeeRate: data.cnssEmployeeRate || 3.6,
          cnssEmployerRate: data.cnssEmployerRate || 6.4,
          taxRate: data.taxRate || 10,
          effectiveFrom: data.effectiveFrom
            ? new Date(data.effectiveFrom).toISOString().split('T')[0]
            : new Date().toISOString().split('T')[0],
        });
      }
    } catch (err) {
      console.error('Error loading payroll rates:', err);
    } finally {
      setLoading(false);
    }
  }

  async function loadTemplates() {
    try {
      setTemplatesLoading(true);
      const data = await hrFetch<any[]>(hrUrl('contracts/templates/list', { tenantId: tenant.id }));
      setTemplates(data || []);
    } catch (err) {
      console.error('Error loading templates:', err);
    } finally {
      setTemplatesLoading(false);
    }
  }

  async function loadDefaultTemplate(type: string) {
    try {
      const data = await hrFetch<any>(hrUrl(`contracts/templates/default/${type}`, { tenantId: tenant.id }));
      if (editingTemplate) {
        setEditingTemplate({ ...editingTemplate, template: data.template });
      } else {
        setNewTemplate((prev) => ({ ...prev, template: data.template }));
      }
      try {
        const parsed = JSON.parse(data.template);
        if (Array.isArray(parsed)) {
          setArticles(parsed);
        } else {
          setArticles([{ title: "Contenu du contrat", content: data.template }]);
        }
      } catch (e) {
        setArticles([{ title: "Contenu du contrat", content: data.template }]);
      }
      toast({ variant: 'success', title: 'Modèle par défaut chargé.' });
    } catch {
      toast({ variant: 'error', title: 'Erreur lors du chargement.' });
    }
  }

  async function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault();
    if (!tenant?.id) return;
    try {
      setSaving(true);
      setSuccess(false);
      await hrFetch<any>(hrUrl('payroll/rates', { tenantId: tenant.id }), {
        method: 'POST',
        body: {
          cnssEmployeeRate: parseFloat(rates.cnssEmployeeRate),
          cnssEmployerRate: parseFloat(rates.cnssEmployerRate),
          taxRate: parseFloat(rates.taxRate),
          effectiveFrom: rates.effectiveFrom,
        },
      });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      toast({ variant: 'error', title: 'Erreur lors de la sauvegarde.' });
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveTemplate(e: React.FormEvent) {
    e.preventDefault();
    try {
      setSavingTemplate(true);
      const templatePayload = JSON.stringify(articles);
      if (editingTemplate) {
        await hrFetch<any>(hrUrl(`contracts/templates/${editingTemplate.id}`, { tenantId: tenant.id }), {
          method: 'PUT',
          body: { name: editingTemplate.name, template: templatePayload },
        });
        toast({ variant: 'success', title: 'Modèle mis à jour.' });
        setEditingTemplate(null);
      } else {
        await hrFetch<any>(hrUrl('contracts/templates', { tenantId: tenant.id }), {
          method: 'POST',
          body: {
            name: newTemplate.name,
            contractType: newTemplate.contractType,
            template: templatePayload,
          },
        });
        toast({ variant: 'success', title: 'Modèle créé avec succès.' });
        setNewTemplate({ name: '', contractType: 'CDI', template: '' });
        setShowNewTemplate(false);
      }
      loadTemplates();
    } catch (err) {
      toast({ variant: 'error', title: 'Erreur lors de la sauvegarde du modèle.' });
    } finally {
      setSavingTemplate(false);
    }
  }

  async function handleDeleteTemplate(id: string) {
    const ok = await confirmDialog.danger('Ce modèle de contrat sera définitivement supprimé.', 'Supprimer le modèle');
    if (!ok) return;
    try {
      await hrFetch<any>(hrUrl(`contracts/templates/${id}`, { tenantId: tenant.id }), { method: 'DELETE' });
      toast({ variant: 'success', title: 'Modèle supprimé.' });
      loadTemplates();
    } catch {
      toast({ variant: 'error', title: 'Erreur lors de la suppression.' });
    }
  }

  const inputClass =
    'w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:border-[#1A2BA6] focus:ring-2 focus:ring-[#1A2BA6]/10 transition';
  const labelClass = 'block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5';

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: PRIMARY }} />
      </div>
    );
  }

  return (
    <>
    {confirmDialog.dialog}
    <div className="max-w-3xl mx-auto space-y-6 pb-12">
      {/* Tab switcher */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
        {[
          { id: 'payroll', label: 'Taux & Cotisations', icon: Settings },
          { id: 'templates', label: 'Modèles de Contrats', icon: FileText },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id as 'payroll' | 'templates')}
            className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold transition-all"
            style={activeTab === id ? { backgroundColor: PRIMARY, color: 'white' } : { color: '#64748b' }}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {/* ── Payroll Settings ── */}
        {activeTab === 'payroll' && (
          <motion.div
            key="payroll"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4"
          >
            <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
              <div className="p-2 bg-indigo-50 text-indigo-700 rounded-lg">
                <Settings className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-base">Configuration des Taux & Cotisations</h3>
                <p className="text-xs text-slate-500">Définissez les taux de fiscalité (IPTS) et les charges patronales/salariales CNSS.</p>
              </div>
            </div>

            {success && (
              <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
                className="p-4 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-800 text-sm font-semibold flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                Paramètres enregistrés avec succès.
              </motion.div>
            )}

            <form onSubmit={handleSaveSettings} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>CNSS - Part Salariale (%)</label>
                  <input type="number" step="0.01" className={inputClass} value={rates.cnssEmployeeRate}
                    onChange={(e) => setRates({ ...rates, cnssEmployeeRate: e.target.value })} required />
                </div>
                <div>
                  <label className={labelClass}>CNSS - Part Patronale (%)</label>
                  <input type="number" step="0.01" className={inputClass} value={rates.cnssEmployerRate}
                    onChange={(e) => setRates({ ...rates, cnssEmployerRate: e.target.value })} required />
                </div>
              </div>
              <div>
                <label className={labelClass}>Taux Moyen d'Imposition (IPTS) (%)</label>
                <input type="number" step="0.1" className={inputClass} value={rates.taxRate}
                  onChange={(e) => setRates({ ...rates, taxRate: e.target.value })} required />
              </div>
              <div>
                <label className={labelClass}>Date de prise d'effet</label>
                <input type="date" className={inputClass} value={rates.effectiveFrom}
                  onChange={(e) => setRates({ ...rates, effectiveFrom: e.target.value })} required />
              </div>
              <div className="p-4 rounded-xl bg-amber-50/50 border border-amber-100/80 flex gap-3 text-amber-800 text-xs">
                <ShieldAlert className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">Attention</p>
                  <p className="mt-0.5 text-amber-700 leading-relaxed">
                    Les modifications de taux s'appliqueront rétroactivement à toutes les fiches de paie générées pour la période en cours.
                  </p>
                </div>
              </div>
              <div className="flex justify-end pt-4 border-t border-slate-100">
                <button type="submit" disabled={saving}
                  className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:opacity-90 transition"
                  style={{ backgroundColor: PRIMARY }}>
                  <Save className="h-4 w-4" />
                  {saving ? 'Enregistrement...' : 'Enregistrer les paramètres'}
                </button>
              </div>
            </form>
          </motion.div>
        )}

        {/* ── Contract Templates ── */}
        {activeTab === 'templates' && (
          <motion.div
            key="templates"
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            className="space-y-4"
          >
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-50 text-indigo-700 rounded-lg">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-base">Modèles de Contrats</h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Personnalisez les contrats générés automatiquement. Les variables{' '}
                      <code className="font-mono bg-slate-100 px-1 rounded text-[10px]">{'{{staffFullName}}'}</code>,{' '}
                      <code className="font-mono bg-slate-100 px-1 rounded text-[10px]">{'{{baseSalary}}'}</code>{' '}
                      sont injectées automatiquement.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => { setShowNewTemplate(!showNewTemplate); setEditingTemplate(null); }}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white rounded-xl shadow-sm hover:opacity-90 transition whitespace-nowrap shrink-0"
                  style={{ backgroundColor: PRIMARY }}
                >
                  {showNewTemplate ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                  {showNewTemplate ? 'Annuler' : 'Nouveau modèle'}
                </button>
              </div>
            </div>

            {/* New / Edit template form */}
            <AnimatePresence>
              {(showNewTemplate || editingTemplate) && (
                <motion.form
                  key="template-form"
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  onSubmit={handleSaveTemplate}
                  className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden"
                >
                  <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                    <h4 className="text-sm font-bold text-slate-900">
                      {editingTemplate ? 'Modifier le modèle' : 'Nouveau modèle de contrat'}
                    </h4>
                    <button type="button" onClick={() => { setShowNewTemplate(false); setEditingTemplate(null); }}>
                      <X className="h-4 w-4 text-slate-400" />
                    </button>
                  </div>
                  <div className="p-5 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className={labelClass}>Nom du modèle</label>
                        <input
                          type="text"
                          required
                          placeholder="Ex : CDI Enseignant standard"
                          className={inputClass}
                          value={editingTemplate ? editingTemplate.name : newTemplate.name}
                          onChange={(e) => editingTemplate
                            ? setEditingTemplate({ ...editingTemplate, name: e.target.value })
                            : setNewTemplate({ ...newTemplate, name: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className={labelClass}>Type de contrat</label>
                        <select
                          className={inputClass}
                          value={editingTemplate ? editingTemplate.contractType : newTemplate.contractType}
                          disabled={!!editingTemplate}
                          onChange={(e) => setNewTemplate({ ...newTemplate, contractType: e.target.value })}
                        >
                          {CONTRACT_TYPES.map((t) => (
                            <option key={t.value} value={t.value}>{t.label}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <label className={labelClass + ' mb-0 text-sm'}>Articles & Clauses du Contrat</label>
                        <button
                          type="button"
                          onClick={() => loadDefaultTemplate(editingTemplate?.contractType || newTemplate.contractType)}
                          className="text-xs font-semibold hover:underline"
                          style={{ color: PRIMARY }}
                        >
                          ↓ Charger les articles par défaut
                        </button>
                      </div>
                      
                      {/* Note explanation */}
                      <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 mb-4 text-xs text-slate-500">
                        ℹ️ Rédigez uniquement les clauses textuelles (le corps) du contrat. 
                        Le système injecte automatiquement le design premium, l'en-tête de l'école, 
                        les informations des parties (Article 1), le bloc de signature électronique 
                        et le QR code de vérification.
                      </div>

                      {/* Articles list */}
                      <div className="space-y-4 mb-4">
                        {articles.map((art, idx) => (
                          <div key={idx} className="p-4 bg-slate-50/50 border border-slate-200 rounded-xl space-y-3 relative">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-slate-500">Clause #{idx + 1}</span>
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
                            </div>

                            <div>
                              <input
                                type="text"
                                required
                                placeholder="Titre de la clause (ex : Article 3 — Horaires et congés)"
                                className={inputClass + " bg-white font-semibold text-slate-800"}
                                value={art.title || ''}
                                onChange={(e) => {
                                  const updated = [...articles];
                                  updated[idx].title = e.target.value;
                                  setArticles(updated);
                                }}
                              />
                            </div>

                            <div>
                              <textarea
                                required
                                rows={4}
                                placeholder="Saisissez le texte de l'article ici... Utilisez les balises pour insérer des informations de l'employé."
                                className={inputClass + " bg-white leading-relaxed resize-y"}
                                value={art.content || ''}
                                onFocus={() => setFocusedIndex(idx)}
                                onChange={(e) => {
                                  const updated = [...articles];
                                  updated[idx].content = e.target.value;
                                  setArticles(updated);
                                }}
                              />
                            </div>

                            {focusedIndex === idx && (
                              <div className="pt-1.5 border-t border-slate-100">
                                <p className="text-[10px] text-slate-400 mb-1.5 font-semibold uppercase">Balises magiques (Cliquez pour insérer dans cette clause) :</p>
                                <div className="flex flex-wrap gap-1">
                                  {[
                                    { tag: '{{staffFullName}}', label: '👤 Nom Employé' },
                                    { tag: '{{staffPosition}}', label: '💼 Poste/Fonction' },
                                    { tag: '{{baseSalary}}', label: '💵 Salaire Brut' },
                                    { tag: '{{paymentMode}}', label: '💳 Mode Paiement' },
                                    { tag: '{{startDate}}', label: '📅 Date Début' },
                                    { tag: '{{endDate}}', label: '📅 Date Fin' },
                                    { tag: '{{schoolName}}', label: '🏫 Nom École' },
                                    { tag: '{{currency}}', label: '🪙 Devise' },
                                    { tag: '{{academicYear}}', label: '📅 Année Scolaire' },
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
                      </div>

                      <button
                        type="button"
                        onClick={addArticle}
                        className="w-full flex items-center justify-center gap-1.5 py-2.5 bg-slate-50 hover:bg-slate-100 border border-dashed border-slate-300 hover:border-slate-400 rounded-xl text-xs font-bold text-slate-600 transition"
                      >
                        <Plus className="h-4 w-4" /> Ajouter un article / clause
                      </button>
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 mt-6">
                      <button
                        type="button"
                        onClick={() => { setShowNewTemplate(false); setEditingTemplate(null); }}
                        className="px-4 py-2 text-sm font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-xl transition"
                      >
                        Annuler
                      </button>
                      <button
                        type="submit"
                        disabled={savingTemplate}
                        className="flex items-center gap-2 px-5 py-2 text-sm font-bold text-white rounded-xl hover:opacity-90 transition"
                        style={{ backgroundColor: PRIMARY }}
                      >
                        {savingTemplate ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        {editingTemplate ? 'Enregistrer les modifications' : 'Créer le modèle'}
                      </button>
                    </div>
                  </div>
                </motion.form>
              )}
            </AnimatePresence>

            {/* List */}
            {templatesLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin" style={{ color: PRIMARY }} />
              </div>
            ) : templates.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/30 p-12 text-center">
                <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm mb-3">
                  <FileText className="h-8 w-8 text-slate-300" />
                </div>
                <h3 className="text-sm font-bold text-slate-700">Aucun modèle personnalisé</h3>
                <p className="text-xs text-slate-400 mt-1.5 max-w-xs">
                  Le système utilise le modèle par défaut. Créez un modèle pour l'adapter à votre établissement.
                </p>
                <button
                  onClick={() => setShowNewTemplate(true)}
                  className="mt-4 flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white rounded-xl hover:opacity-90 transition"
                  style={{ backgroundColor: PRIMARY }}
                >
                  <Plus className="h-4 w-4" /> Créer un modèle
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {templates.map((tmpl, idx) => (
                  <motion.div
                    key={tmpl.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.04 }}
                    className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center text-xs font-bold shrink-0"
                        style={{ backgroundColor: PRIMARY + '15', color: PRIMARY }}
                      >
                        {tmpl.contractType?.[0]}
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-slate-900 text-sm truncate">{tmpl.name}</p>
                        <p className="text-xs text-slate-400">
                          {CONTRACT_TYPES.find((t) => t.value === tmpl.contractType)?.label || tmpl.contractType}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => { setEditingTemplate(tmpl); setShowNewTemplate(false); }}
                        className="p-2 text-slate-400 hover:text-[#1A2BA6] rounded-lg hover:bg-slate-50 transition"
                        title="Modifier"
                      >
                        <Edit3 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteTemplate(tmpl.id)}
                        className="p-2 text-slate-400 hover:text-rose-500 rounded-lg hover:bg-rose-50 transition"
                        title="Supprimer"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
    </>
  );
}
