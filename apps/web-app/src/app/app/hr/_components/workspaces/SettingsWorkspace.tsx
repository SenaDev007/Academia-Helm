'use client';

import { useState, useEffect } from 'react';
import { Save, Settings, ShieldAlert, BadgeInfo, CheckCircle2, Loader2 } from 'lucide-react';
import { useModuleContext } from '@/hooks/useModuleContext';
import { apiFetch } from '@/lib/api/client';
import { motion } from 'framer-motion';

const PRIMARY = '#1A2BA6';

export function SettingsWorkspace() {
  const { tenant } = useModuleContext();
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
    async function loadRates() {
      if (!tenant?.id) return;
      try {
        setLoading(true);
        const data = await apiFetch<any>('/hr/payroll/rates/active');
        if (data) {
          setRates({
            cnssEmployeeRate: data.cnssEmployeeRate || 3.6,
            cnssEmployerRate: data.cnssEmployerRate || 6.4,
            taxRate: data.taxRate || 10,
            effectiveFrom: data.effectiveFrom ? new Date(data.effectiveFrom).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
          });
        }
      } catch (err) {
        console.error('Error loading payroll rates:', err);
      } finally {
        setLoading(false);
      }
    }
    loadRates();
  }, [tenant?.id]);

  async function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault();
    if (!tenant?.id) return;
    try {
      setSaving(true);
      setSuccess(false);
      await apiFetch('/hr/payroll/rates', {
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
      console.error('Error saving payroll settings:', err);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <Loader2 className="h-8 w-8 text-[#1A2BA6] animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-12">
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
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
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="p-4 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-800 text-sm font-semibold flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            Paramètres enregistrés avec succès.
          </motion.div>
        )}

        <form onSubmit={handleSaveSettings} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                CNSS - Part Salariale (%)
              </label>
              <input
                type="number"
                step="0.01"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:border-[#1A2BA6]"
                value={rates.cnssEmployeeRate}
                onChange={(e) => setRates({ ...rates, cnssEmployeeRate: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                CNSS - Part Patronale (%)
              </label>
              <input
                type="number"
                step="0.01"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:border-[#1A2BA6]"
                value={rates.cnssEmployerRate}
                onChange={(e) => setRates({ ...rates, cnssEmployerRate: e.target.value })}
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              Taux Moyen d'Imposition (IPTS) (%)
            </label>
            <input
              type="number"
              step="0.1"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:border-[#1A2BA6]"
              value={rates.taxRate}
              onChange={(e) => setRates({ ...rates, taxRate: e.target.value })}
              required
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              Date de prise d'effet
            </label>
            <input
              type="date"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none"
              value={rates.effectiveFrom}
              onChange={(e) => setRates({ ...rates, effectiveFrom: e.target.value })}
              required
            />
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
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:opacity-90 transition"
              style={{ backgroundColor: PRIMARY }}
            >
              <Save className="h-4 w-4" />
              {saving ? 'Enregistrement...' : 'Enregistrer les paramètres'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
