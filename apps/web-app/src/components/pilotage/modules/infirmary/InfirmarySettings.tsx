/**
 * ============================================================================
 * INFIRMARY SETTINGS TAB
 * ============================================================================
 */

'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import {
  Settings,
  Bell,
  Lock,
  Database,
  HeartPulse,
  Activity,
  ChevronRight,
  ShieldCheck,
  Stethoscope,
  Save,
  MessageSquare,
  AlertCircle
} from 'lucide-react';
import { useModuleContext } from '@/hooks/useModuleContext';
import { modulesApi, buildModulesApiOptions } from '@/lib/modules-complementaires/client';

interface InfirmarySettingsData {
  defaultVisitReasons?: string[];
  stockAlertThreshold?: number;
  requireParentalAuthorization?: boolean;
  smsNotifications?: boolean;
  emailEmergencyAlerts?: boolean;
  restrictedAccess?: boolean;
  auditLogEnabled?: boolean;
  [key: string]: any;
}

const DEFAULT_SETTINGS: InfirmarySettingsData = {
  defaultVisitReasons: ['Maux de tête', 'Fièvre', 'Blessure', 'Douleurs'],
  stockAlertThreshold: 5,
  requireParentalAuthorization: true,
  smsNotifications: false,
  emailEmergencyAlerts: true,
  restrictedAccess: true,
  auditLogEnabled: true,
};

export default function InfirmarySettings() {
  const { academicYear } = useModuleContext();
  const [settings, setSettings] = useState<InfirmarySettingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!academicYear?.id) {
      setSettings(DEFAULT_SETTINGS);
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const data = await modulesApi.get<InfirmarySettingsData>(
          'infirmary/settings',
          buildModulesApiOptions(academicYear.id),
        );
        if (!cancelled) setSettings({ ...DEFAULT_SETTINGS, ...(data ?? {}) });
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.response?.data?.message || e?.message || 'Erreur de chargement');
          setSettings(DEFAULT_SETTINGS);
        }
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
        <span className="ml-2 text-slate-600">Chargement...</span>
      </div>
    );
  }

  const stockThreshold = settings?.stockAlertThreshold ?? DEFAULT_SETTINGS.stockAlertThreshold!;
  const requireAuth = settings?.requireParentalAuthorization ?? DEFAULT_SETTINGS.requireParentalAuthorization!;
  const smsNotif = settings?.smsNotifications ?? DEFAULT_SETTINGS.smsNotifications!;
  const emailAlerts = settings?.emailEmergencyAlerts ?? DEFAULT_SETTINGS.emailEmergencyAlerts!;

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {error && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          ⚠ Impossible de charger les paramètres. {error}
        </div>
      )}

      {/* Settings Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-slate-900 flex items-center">
            <Settings className="w-8 h-8 mr-3 text-slate-400" />
            Configuration de l'Infirmerie
          </h2>
          <p className="text-slate-500 font-medium">Personnalisez les workflows et paramètres du module santé.</p>
        </div>
        <button className="px-6 py-3 bg-blue-600 text-white rounded-2xl font-black text-sm flex items-center hover:bg-blue-700 transition-all shadow-lg shadow-blue-200">
          <Save className="w-5 h-5 mr-2" />
          Enregistrer
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {/* Medical Workflow */}
        <div className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm">
          <h3 className="text-lg font-black text-slate-900 mb-6 flex items-center">
            <HeartPulse className="w-5 h-5 mr-3 text-blue-600" />
            Workflow Médical & Motifs
          </h3>
          <div className="space-y-6">
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
              <div>
                <p className="font-bold text-slate-900">Motifs de visite par défaut</p>
                <p className="text-xs text-slate-500">
                  {(settings?.defaultVisitReasons || DEFAULT_SETTINGS.defaultVisitReasons!).join(', ')}.
                </p>
              </div>
              <button className="text-blue-600 text-xs font-black uppercase tracking-widest hover:underline">Modifier la liste</button>
            </div>
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
              <div>
                <p className="font-bold text-slate-900">Seuils d'alerte stock</p>
                <p className="text-xs text-slate-500">Notification automatique quand le stock est critique.</p>
              </div>
              <div className="flex items-center space-x-2">
                <input type="number" defaultValue={stockThreshold} className="w-16 px-3 py-1 bg-white border border-slate-200 rounded-lg text-sm font-bold text-center" />
                <span className="text-xs font-bold text-slate-400 uppercase">Unités</span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-bold text-slate-900">Exiger validation pour médicaments</p>
                <p className="text-xs text-slate-500">Forcer le personnel à cocher l'autorisation parentale avant l'administration.</p>
              </div>
              <div className={`w-12 h-6 ${requireAuth ? 'bg-blue-600' : 'bg-slate-200'} rounded-full relative cursor-pointer shadow-inner`}>
                <div className={`absolute top-1 ${requireAuth ? 'right-1' : 'left-1'} w-4 h-4 bg-white rounded-full shadow-md`} />
              </div>
            </div>
          </div>
        </div>

        {/* Notifications & Communications */}
        <div className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm">
          <h3 className="text-lg font-black text-slate-900 mb-6 flex items-center">
            <Bell className="w-5 h-5 mr-3 text-amber-500" />
            Notifications & Communications
          </h3>
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="border border-slate-100 rounded-2xl p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3 text-slate-700 font-bold text-sm">
                    <MessageSquare className="w-4 h-4" />
                    SMS aux Parents
                  </div>
                  <div className={`w-10 h-5 ${smsNotif ? 'bg-blue-600' : 'bg-slate-200'} rounded-full relative cursor-pointer`}>
                    <div className={`absolute top-1 ${smsNotif ? 'right-1' : 'left-1'} w-3 h-3 bg-white rounded-full`} />
                  </div>
                </div>
                <p className="text-[10px] text-slate-400 font-medium">Envoyer un SMS automatique pour chaque passage à l'infirmerie.</p>
              </div>
              <div className="border border-slate-100 rounded-2xl p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3 text-slate-700 font-bold text-sm">
                    <AlertCircle className="w-4 h-4" />
                    Alertes Urgence (Email)
                  </div>
                  <div className={`w-10 h-5 ${emailAlerts ? 'bg-blue-600' : 'bg-slate-200'} rounded-full relative cursor-pointer`}>
                    <div className={`absolute top-1 ${emailAlerts ? 'right-1' : 'left-1'} w-3 h-3 bg-white rounded-full`} />
                  </div>
                </div>
                <p className="text-[10px] text-slate-400 font-medium">Notifier immédiatement la direction et les parents par email en cas d'urgence.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Security & Access */}
        <div className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm">
          <h3 className="text-lg font-black text-slate-900 mb-6 flex items-center">
            <Lock className="w-5 h-5 mr-3 text-rose-600" />
            Sécurité & Confidentialité (RGPD)
          </h3>
          <div className="space-y-6">
            <div className="flex items-center justify-between p-4 border border-rose-50 bg-rose-50/20 rounded-2xl">
              <div className="flex items-center space-x-4">
                <div className="p-3 bg-rose-100 rounded-xl text-rose-600">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <p className="font-bold text-slate-900">Accès restreint aux dossiers</p>
                  <p className="text-xs text-slate-500">Seuls l'infirmier(e) et la direction peuvent consulter le détail médical.</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-300" />
            </div>
            <div className="flex items-center justify-between p-4 border border-slate-100 rounded-2xl">
              <div className="flex items-center space-x-4">
                <div className="p-3 bg-slate-100 rounded-xl text-slate-600">
                  <Database className="w-6 h-6" />
                </div>
                <div>
                  <p className="font-bold text-slate-900">Journal d'audit médical</p>
                  <p className="text-xs text-slate-500">Consulter l'historique des accès aux dossiers de santé.</p>
                </div>
              </div>
              <button className="px-4 py-2 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest">
                Voir Logs
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
