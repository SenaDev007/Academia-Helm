/**
 * ============================================================================
 * EDUCAST SETTINGS
 * ============================================================================
 */

'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Settings, Bell, ShieldCheck, Database, Layout, Save, RefreshCw, Trash2, Sliders, MonitorPlay, Loader2 } from 'lucide-react';
import { useModuleContext } from '@/hooks/useModuleContext';
import { modulesApi, buildModulesApiOptions } from '@/lib/modules-complementaires/client';

export default function EduCastSettings() {
  const { academicYear } = useModuleContext();
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!academicYear?.id) return;
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await modulesApi.get('educast/settings', buildModulesApiOptions(academicYear.id));
        if (!cancelled) setSettings(data);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Erreur de chargement');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [academicYear?.id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        <span className="ml-2 text-slate-600">Chargement des paramètres EduCast...</span>
      </div>
    );
  }

  const handleSave = async () => {
    try {
      setSaving(true);
      await modulesApi.put('educast/settings', settings ?? {}, buildModulesApiOptions(academicYear?.id));
      alert('Paramètres enregistrés');
    } catch (e: any) {
      alert(e?.message || 'Erreur lors de l\'enregistrement');
    } finally {
      setSaving(false);
    }
  };

  const toggleSetting = (key: string) => {
    setSettings((prev: any) => ({ ...(prev ?? {}), [key]: !prev?.[key] }));
  };

  return (
    <div className="max-w-4xl space-y-8">
      {error && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          ⚠ Impossible de charger les paramètres. {error}
        </div>
      )}

      <div className="flex justify-between items-center">
        <div className="space-y-1">
          <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter flex items-center">
            <Settings className="w-6 h-6 mr-3 text-slate-400" />
            Configuration EduCast
          </h3>
          <p className="text-slate-500 text-sm font-medium">Paramétrez les règles de diffusion et de stockage média.</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-blue-700 transition-all shadow-xl shadow-blue-600/20 disabled:opacity-60"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          <span>Enregistrer</span>
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {/* Publication Rules */}
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm space-y-8"
        >
          <div className="flex items-center gap-4 border-b border-slate-50 pb-6">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
              <MonitorPlay className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-lg font-black text-slate-900 uppercase tracking-tight">Règles de Publication</h4>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Contrôle des flux média</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-3">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Qualité Vidéo Maximale</label>
              <select defaultValue={settings?.maxVideoQuality || 'Full HD (1080p)'} className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl text-slate-900 font-black outline-none focus:ring-2 focus:ring-blue-500/20 transition-all appearance-none">
                <option>4K (2160p)</option>
                <option>Full HD (1080p)</option>
                <option>HD (720p)</option>
                <option>SD (480p)</option>
              </select>
            </div>
            <div className="space-y-3">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Durée Max Capsules (Minutes)</label>
              <input type="number" defaultValue={settings?.maxCapsuleDuration ?? 5} className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl text-slate-900 font-black outline-none focus:ring-2 focus:ring-blue-500/20 transition-all" />
            </div>
          </div>

          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
            <div className="flex items-center gap-4">
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
              <div>
                <p className="text-sm font-black text-slate-900">Modération Obligatoire</p>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Tout contenu élève doit être validé</p>
              </div>
            </div>
            <div className={`w-12 h-6 rounded-full p-1 flex cursor-pointer transition-colors ${settings?.mandatoryModeration ? 'bg-blue-600 justify-end' : 'bg-slate-300 justify-start'}`} onClick={() => toggleSetting('mandatoryModeration')}>
              <div className="w-4 h-4 bg-white rounded-full shadow-sm" />
            </div>
          </div>
        </motion.div>

        {/* Storage & Limits */}
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm space-y-8"
        >
          <div className="flex items-center gap-4 border-b border-slate-50 pb-6">
            <div className="p-3 bg-rose-50 text-rose-600 rounded-2xl">
              <Database className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-lg font-black text-slate-900 uppercase tracking-tight">Stockage & Quotas</h4>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Gestion de l'espace disque</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-3">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Quota par Enseignant (GB)</label>
              <input type="number" defaultValue={settings?.teacherQuotaGB ?? 50} className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl text-slate-900 font-black outline-none focus:ring-2 focus:ring-rose-500/20 transition-all" />
            </div>
            <div className="space-y-3">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Auto-archivage après (Mois)</label>
              <input type="number" defaultValue={settings?.autoArchiveMonths ?? 24} className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl text-slate-900 font-black outline-none focus:ring-2 focus:ring-rose-500/20 transition-all" />
            </div>
          </div>
        </motion.div>

        {/* Monetization Rules */}
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm space-y-8"
        >
          <div className="flex items-center gap-4 border-b border-slate-50 pb-6">
            <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl">
              <RefreshCw className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-lg font-black text-slate-900 uppercase tracking-tight">Règles de Monétisation</h4>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Configuration financière</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-3">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Commission École (%)</label>
              <input type="number" defaultValue={settings?.schoolCommissionPct ?? 20} className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl text-slate-900 font-black outline-none focus:ring-2 focus:ring-amber-500/20 transition-all" />
            </div>
            <div className="space-y-3">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Plafond Prix Vidéo (F CFA)</label>
              <input type="number" defaultValue={settings?.maxVideoPrice ?? 5000} className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl text-slate-900 font-black outline-none focus:ring-2 focus:ring-amber-500/20 transition-all" />
            </div>
          </div>

          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
            <div className="flex items-center gap-4">
              <ShieldCheck className="w-5 h-5 text-amber-600" />
              <div>
                <p className="text-sm font-black text-slate-900">Validation Vidéos Payantes</p>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">L'école doit valider tout contenu payant</p>
              </div>
            </div>
            <div className={`w-12 h-6 rounded-full p-1 flex cursor-pointer transition-colors ${settings?.paidVideoValidation ? 'bg-amber-600 justify-end' : 'bg-slate-300 justify-start'}`} onClick={() => toggleSetting('paidVideoValidation')}>
              <div className="w-4 h-4 bg-white rounded-full shadow-sm" />
            </div>
          </div>
        </motion.div>

        {/* Notifications */}
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
                  <p className="text-sm font-black text-slate-900">Notifications de Publication</p>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Alerter les élèves lors d'un nouveau cours</p>
                </div>
              </div>
              <div className={`w-12 h-6 rounded-full p-1 flex cursor-pointer transition-colors ${settings?.publishNotifications ? 'bg-blue-600 justify-end' : 'bg-slate-300 justify-start'}`} onClick={() => toggleSetting('publishNotifications')}>
                <div className="w-4 h-4 bg-white rounded-full shadow-sm" />
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
