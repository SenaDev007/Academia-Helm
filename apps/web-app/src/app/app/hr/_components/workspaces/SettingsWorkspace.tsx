'use client';

import { useState, useEffect } from 'react';
import { useConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  Save, Settings, ShieldAlert, CheckCircle2, Loader2, Briefcase, Plus, X, Info,
} from 'lucide-react';
import { useModuleContext } from '@/hooks/useModuleContext';
import { hrFetch, hrUrl } from '@/lib/hr/hr-client';
import { toast } from '@/components/ui/toast';
import { motion, AnimatePresence } from 'framer-motion';

const PRIMARY = '#1A2BA6';

export function SettingsWorkspace() {
  const confirmDialog = useConfirmDialog();
  const { tenant } = useModuleContext();
  // ⭐ Sous-tabs 'Modèles de Contrats' et 'Promoteur' supprimés définitivement
  //    sur demande utilisateur — il reste 'Taux & Cotisations' + 'Embauche &
  //    Contrats' (CDC §9 — paramétrage par école, sans toucher au code).
  const [activeTab, setActiveTab] = useState<'payroll' | 'contrats'>('payroll');

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

  useEffect(() => {
    if (!tenant?.id) return;
    loadRates();
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

  // ── Paramétrage « Embauche & Contrats » (CDC §9) ──────────────────
  const [contratSettings, setContratSettings] = useState<any>({
    cddMotifs: [],
    stageTypes: [],
    cddDureeMaxMois: 24,
    cddRenouvellementsMax: 1,
    indemniteFinContratPct: 6,
    testQualificationEnabled: true,
  });
  const [contratSaving, setContratSaving] = useState(false);
  const [newMotif, setNewMotif] = useState('');
  const [newStageType, setNewStageType] = useState('');

  useEffect(() => {
    if (!tenant?.id) return;
    hrFetch<any>(hrUrl('contracts/settings', { tenantId: tenant.id }))
      .then((data) => {
        if (data) {
          setContratSettings({
            cddMotifs: Array.isArray(data.cddMotifs) ? data.cddMotifs : [],
            stageTypes: Array.isArray(data.stageTypes) ? data.stageTypes : [],
            cddDureeMaxMois: data.cddDureeMaxMois ?? 24,
            cddRenouvellementsMax: data.cddRenouvellementsMax ?? 1,
            indemniteFinContratPct: data.indemniteFinContratPct ?? 6,
            testQualificationEnabled: data.testQualificationEnabled !== false,
          });
        }
      })
      .catch(() => {});
  }, [tenant?.id]);

  async function saveContratSettings(patch: any) {
    if (!tenant?.id) return;
    try {
      setContratSaving(true);
      const updated = await hrFetch<any>(hrUrl('contracts/settings', { tenantId: tenant.id }), {
        method: 'PUT',
        body: patch,
      });
      if (updated) {
        setContratSettings((prev: any) => ({
          ...prev,
          cddMotifs: Array.isArray(updated.cddMotifs) ? updated.cddMotifs : prev.cddMotifs,
          stageTypes: Array.isArray(updated.stageTypes) ? updated.stageTypes : prev.stageTypes,
          cddDureeMaxMois: updated.cddDureeMaxMois ?? prev.cddDureeMaxMois,
          cddRenouvellementsMax: updated.cddRenouvellementsMax ?? prev.cddRenouvellementsMax,
          indemniteFinContratPct: updated.indemniteFinContratPct ?? prev.indemniteFinContratPct,
          testQualificationEnabled: updated.testQualificationEnabled !== false,
        }));
      }
      toast({ variant: 'success', title: 'Paramètres enregistrés' });
    } catch (err: any) {
      toast({ variant: 'error', title: 'Enregistrement impossible', description: err?.message });
    } finally {
      setContratSaving(false);
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
      {/* Tab switcher — sous-tabs 'Modèles de Contrats' et 'Promoteur' supprimés définitivement */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
        {[
          { id: 'payroll', label: 'Taux & Cotisations', icon: Settings },
          { id: 'contrats', label: 'Embauche & Contrats', icon: Briefcase },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id as 'payroll' | 'contrats')}
            className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all"
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

        {/* ── Embauche & Contrats (CDC §9 — paramétrage par école, zéro code) ── */}
        {activeTab === 'contrats' && (
          <motion.div
            key="contrats"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-6"
          >
            <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
              <div className="p-2 bg-blue-50 text-blue-700 rounded-lg">
                <Briefcase className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-base">Embauche &amp; Contrats — paramétrage de votre école</h3>
                <p className="text-xs text-slate-500">
                  Motifs de CDD, types de stage, seuils d&apos;alerte et test d&apos;aide à la qualification :
                  modifiables ici, sans intervention sur le code.
                </p>
              </div>
            </div>

            {/* Motifs de CDD suggérés (§9) */}
            <div className="space-y-3">
              <div>
                <label className={labelClass}>Motifs de CDD proposés en suggestion</label>
                <p className="text-[11px] text-slate-400 mb-2">
                  Le champ « Motif du CDD » reste en texte libre — ces libellés apparaissent en suggestions
                  à la saisie. Ajustez-les aux pratiques réelles de votre établissement.
                </p>
                <div className="flex flex-wrap gap-2">
                  {contratSettings.cddMotifs.map((m: string, i: number) => (
                    <span key={i} className="inline-flex items-center gap-1.5 pl-3 pr-1.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-xs font-medium text-slate-700">
                      {m}
                      <button
                        type="button"
                        onClick={() => saveContratSettings({ cddMotifs: contratSettings.cddMotifs.filter((_: string, j: number) => j !== i) })}
                        className="p-0.5 rounded hover:bg-slate-200 text-slate-400 hover:text-rose-500 transition"
                        title="Retirer cette suggestion"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                  {contratSettings.cddMotifs.length === 0 && (
                    <p className="text-xs text-slate-400 italic">Aucune suggestion — texte libre uniquement.</p>
                  )}
                </div>
                <div className="flex gap-2 mt-2">
                  <input
                    className={inputClass}
                    placeholder="Ex : Remplacement d'un salarié en congé maternité"
                    value={newMotif}
                    onChange={(e) => setNewMotif(e.target.value)}
                  />
                  <button
                    type="button"
                    disabled={!newMotif.trim() || contratSaving}
                    onClick={() => {
                      saveContratSettings({ cddMotifs: [...contratSettings.cddMotifs, newMotif.trim()] });
                      setNewMotif('');
                    }}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-white shrink-0 disabled:opacity-50"
                    style={{ backgroundColor: PRIMARY }}
                  >
                    <Plus className="h-3.5 w-3.5" /> Ajouter
                  </button>
                </div>
              </div>
            </div>

            {/* Types de stage (§6/§9) */}
            <div className="space-y-3 border-t border-slate-100 pt-4">
              <div>
                <label className={labelClass}>Types de stage proposés (flux Stagiaires)</label>
                <p className="text-[11px] text-slate-400 mb-2">
                  Suggestions du champ « Type de stage » dans le module Stagiaires — texte libre toujours accepté
                  (les pratiques varient selon les établissements).
                </p>
                <div className="flex flex-wrap gap-2">
                  {contratSettings.stageTypes.map((t: string, i: number) => (
                    <span key={i} className="inline-flex items-center gap-1.5 pl-3 pr-1.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-xs font-medium text-slate-700">
                      {t}
                      <button
                        type="button"
                        onClick={() => saveContratSettings({ stageTypes: contratSettings.stageTypes.filter((_: string, j: number) => j !== i) })}
                        className="p-0.5 rounded hover:bg-slate-200 text-slate-400 hover:text-rose-500 transition"
                        title="Retirer ce type"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2 mt-2">
                  <input
                    className={inputClass}
                    placeholder="Ex : Stage d'immersion professionnelle"
                    value={newStageType}
                    onChange={(e) => setNewStageType(e.target.value)}
                  />
                  <button
                    type="button"
                    disabled={!newStageType.trim() || contratSaving}
                    onClick={() => {
                      saveContratSettings({ stageTypes: [...contratSettings.stageTypes, newStageType.trim()] });
                      setNewStageType('');
                    }}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-white shrink-0 disabled:opacity-50"
                    style={{ backgroundColor: PRIMARY }}
                  >
                    <Plus className="h-3.5 w-3.5" /> Ajouter
                  </button>
                </div>
              </div>
            </div>

            {/* Seuils & taux (§9) */}
            <div className="space-y-4 border-t border-slate-100 pt-4">
              <div>
                <label className={labelClass}>Seuil d&apos;alerte — durée cumulée CDD (mois)</label>
                <div className="flex gap-2 items-center">
                  <input
                    type="number"
                    min="1"
                    max="600"
                    className={inputClass + ' max-w-[140px]'}
                    value={contratSettings.cddDureeMaxMois}
                    onChange={(e) => setContratSettings((prev: any) => ({ ...prev, cddDureeMaxMois: e.target.value }))}
                  />
                  <button
                    type="button"
                    disabled={contratSaving}
                    onClick={() => saveContratSettings({ cddDureeMaxMois: parseInt(contratSettings.cddDureeMaxMois, 10) || 24 })}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-white shrink-0 disabled:opacity-50"
                    style={{ backgroundColor: PRIMARY }}
                  >
                    <Save className="h-3.5 w-3.5" /> Appliquer
                  </button>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Défaut loi béninoise : 24 mois. Au-delà, la relation est réputée CDI — l&apos;alerte s&apos;affiche
                  sans bloquer. Modifiable si la loi de référence change (ou pour un autre pays).
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Renouvellements CDD max (chaîne)</label>
                  <input
                    type="number"
                    min="0"
                    max="10"
                    className={inputClass}
                    value={contratSettings.cddRenouvellementsMax}
                    onChange={(e) => setContratSettings((prev: any) => ({ ...prev, cddRenouvellementsMax: e.target.value }))}
                    onBlur={() => saveContratSettings({ cddRenouvellementsMax: parseInt(contratSettings.cddRenouvellementsMax, 10) || 0 })}
                  />
                </div>
                <div>
                  <label className={labelClass}>Indemnité de fin de contrat CDD (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.5"
                    className={inputClass}
                    value={contratSettings.indemniteFinContratPct}
                    onChange={(e) => setContratSettings((prev: any) => ({ ...prev, indemniteFinContratPct: e.target.value }))}
                    onBlur={() => saveContratSettings({ indemniteFinContratPct: parseFloat(contratSettings.indemniteFinContratPct) || 6 })}
                  />
                </div>
              </div>
            </div>

            {/* Test d'aide à la qualification (§5/§9) */}
            <div className="space-y-3 border-t border-slate-100 pt-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={contratSettings.testQualificationEnabled}
                  onChange={(e) => saveContratSettings({ testQualificationEnabled: e.target.checked })}
                  className="w-4 h-4 rounded"
                  style={{ accentColor: PRIMARY }}
                />
                <span className="text-sm font-semibold text-slate-700">
                  Activer le test d&apos;aide à la qualification à l&apos;embauche
                </span>
              </label>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex gap-2 text-[11px] text-slate-500 leading-relaxed">
                <Info className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
                <span>
                  Les écoles structurées avec un service RH expérimenté peuvent préférer un accès direct au
                  sélecteur sans passer par le test. Le test suggère un statut (salarié vs prestataire) mais
                  ne verrouille jamais le choix final.
                </span>
              </div>
            </div>
          </motion.div>
        )}

      </AnimatePresence>
    </div>
    </>
  );
}
