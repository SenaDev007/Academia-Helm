'use client';

import { useState, useEffect } from 'react';
import { useConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  Save, Settings, ShieldAlert, CheckCircle2, Loader2,
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
  //    sur demande utilisateur — il ne reste que 'Taux & Cotisations'.
  const [activeTab, setActiveTab] = useState<'payroll'>('payroll');

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
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id as 'payroll')}
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

      </AnimatePresence>
    </div>
    </>
  );
}
