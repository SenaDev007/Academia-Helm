/**
 * ============================================================================
 * LIBRARY SETTINGS — Branché sur backend réel
 * ============================================================================
 *
 * Endpoint (lecture)  : GET /modules-complementaires/library/settings
 * Endpoint (écriture) : PUT /modules-complementaires/library/settings
 * ============================================================================
 */

'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Settings, Bell, ShieldCheck, Clock, CreditCard, Save, Loader2 } from 'lucide-react';
import { useModuleContext } from '@/hooks/useModuleContext';
import { modulesApi, buildModulesApiOptions } from '@/lib/modules-complementaires/client';

interface LibrarySettingsData {
  maxLoanDurationDays?: number;
  maxBooksPerReader?: number;
  reservationDurationHours?: number;
  maxRenewals?: number;
  lateFeePerDay?: number;
  autoBlockThreshold?: number;
  sendReminders?: boolean;
  requireParentalValidation?: boolean;
  [key: string]: any;
}

export default function LibrarySettings() {
  const { academicYear } = useModuleContext();
  const [settings, setSettings] = useState<LibrarySettingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!academicYear?.id) return;
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const data = await modulesApi.get<LibrarySettingsData>(
          'library/settings',
          buildModulesApiOptions(academicYear.id),
        );
        if (!cancelled) {
          setSettings(data ?? {});
          setError(null);
        }
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message || 'Erreur de chargement des paramètres');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [academicYear?.id]);

  const handleSave = async () => {
    if (!academicYear?.id) return;
    try {
      setSaving(true);
      await modulesApi.put(
        'library/settings',
        settings ?? {},
        buildModulesApiOptions(academicYear.id),
      );
      setError(null);
    } catch (e: any) {
      setError(e?.message || 'Erreur lors de l\'enregistrement');
    } finally {
      setSaving(false);
    }
  };

  const update = <K extends keyof LibrarySettingsData>(key: K, value: LibrarySettingsData[K]) => {
    setSettings((prev) => ({ ...(prev ?? {}), [key]: value }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        <span className="ml-2 text-gray-600">Chargement des paramètres...</span>
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-8">
      {error && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          ⚠ {error}
        </div>
      )}

      <div className="flex justify-between items-center">
        <div className="space-y-1">
          <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter flex items-center">
            <Settings className="w-6 h-6 mr-3 text-slate-400" />
            Paramètres de la Bibliothèque
          </h3>
          <p className="text-slate-500 text-sm font-medium">Configurez les règles de circulation et de gestion.</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-blue-700 transition-all shadow-xl shadow-blue-600/20 disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          <span>{saving ? 'Enregistrement…' : 'Enregistrer'}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {/* Loan Rules */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm space-y-8"
        >
          <div className="flex items-center gap-4 border-b border-slate-50 pb-6">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-lg font-black text-slate-900 uppercase tracking-tight">Règles d'Emprunt</h4>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Définissez les limites standards</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-3">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Durée maximale d'emprunt (Jours)</label>
              <input
                type="number"
                value={settings?.maxLoanDurationDays ?? 14}
                onChange={(e) => update('maxLoanDurationDays', Number(e.target.value))}
                className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl text-slate-900 font-black outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
              />
            </div>
            <div className="space-y-3">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Nombre maximal de livres / lecteur</label>
              <input
                type="number"
                value={settings?.maxBooksPerReader ?? 3}
                onChange={(e) => update('maxBooksPerReader', Number(e.target.value))}
                className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl text-slate-900 font-black outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
              />
            </div>
            <div className="space-y-3">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Durée de réservation (Heures)</label>
              <input
                type="number"
                value={settings?.reservationDurationHours ?? 48}
                onChange={(e) => update('reservationDurationHours', Number(e.target.value))}
                className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl text-slate-900 font-black outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
              />
            </div>
            <div className="space-y-3">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Nombre d'extensions autorisées</label>
              <input
                type="number"
                value={settings?.maxRenewals ?? 1}
                onChange={(e) => update('maxRenewals', Number(e.target.value))}
                className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl text-slate-900 font-black outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
              />
            </div>
          </div>
        </motion.div>

        {/* Finance Rules */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm space-y-8"
        >
          <div className="flex items-center gap-4 border-b border-slate-50 pb-6">
            <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl">
              <CreditCard className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-lg font-black text-slate-900 uppercase tracking-tight">Pénalités & Amendes</h4>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Configuration financière</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-3">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Amende par jour de retard (F CFA)</label>
              <input
                type="number"
                value={settings?.lateFeePerDay ?? 500}
                onChange={(e) => update('lateFeePerDay', Number(e.target.value))}
                className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl text-slate-900 font-black outline-none focus:ring-2 focus:ring-amber-500/20 transition-all"
              />
            </div>
            <div className="space-y-3">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Seuil blocage automatique (F CFA)</label>
              <input
                type="number"
                value={settings?.autoBlockThreshold ?? 5000}
                onChange={(e) => update('autoBlockThreshold', Number(e.target.value))}
                className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl text-slate-900 font-black outline-none focus:ring-2 focus:ring-amber-500/20 transition-all"
              />
            </div>
          </div>
        </motion.div>

        {/* Automation & Security */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm"
        >
          <div className="space-y-6">
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
              <div className="flex items-center gap-4">
                <Bell className="w-5 h-5 text-blue-600" />
                <div>
                  <p className="text-sm font-black text-slate-900">Notifications de Rappel</p>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Envoyer SMS/Email 2 jours avant l'échéance</p>
                </div>
              </div>
              <button
                onClick={() => update('sendReminders', !settings?.sendReminders)}
                className={`w-12 h-6 rounded-full p-1 flex transition-all cursor-pointer ${settings?.sendReminders ? 'bg-blue-600 justify-end' : 'bg-slate-200 justify-start'}`}
              >
                <div className="w-4 h-4 bg-white rounded-full shadow-sm" />
              </button>
            </div>

            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
              <div className="flex items-center gap-4">
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
                <div>
                  <p className="text-sm font-black text-slate-900">Validation Parentale</p>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Requis pour les ressources payantes</p>
                </div>
              </div>
              <button
                onClick={() => update('requireParentalValidation', !settings?.requireParentalValidation)}
                className={`w-12 h-6 rounded-full p-1 flex transition-all cursor-pointer ${settings?.requireParentalValidation ? 'bg-blue-600 justify-end' : 'bg-slate-200 justify-start'}`}
              >
                <div className="w-4 h-4 bg-white rounded-full shadow-sm" />
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
