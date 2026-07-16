/**
 * ============================================================================
 * INFIRMARY SETTINGS TAB
 * ============================================================================
 *
 * Refonte juillet 2026 : alignement sur le pattern Finance — <Input>/<Button>
 * shadcn, <Switch> shadcn pour toggles, Cards rounded-xl, alert() → toast(),
 * plus de font-black uppercase tracking-widest, plus de rounded-3xl,
 * plus de text-[10px]. Logique modulesApi + useModuleContext conservée.
 * ============================================================================
 */

'use client';

import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import {
  Settings,
  Bell,
  Lock,
  Database,
  HeartPulse,
  ChevronRight,
  ShieldCheck,
  Save,
  MessageSquare,
  AlertCircle,
} from 'lucide-react';
import { useModuleContext } from '@/hooks/useModuleContext';
import { modulesApi, buildModulesApiOptions } from '@/lib/modules-complementaires/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ui/use-toast';

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
  const { toast } = useToast();
  const [settings, setSettings] = useState<InfirmarySettingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

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

  const handleSave = async () => {
    try {
      setSubmitting(true);
      await modulesApi.post('infirmary/settings', settings ?? DEFAULT_SETTINGS, buildModulesApiOptions(academicYear?.id));
      toast({
        title: 'Paramètres enregistrés',
        description: 'La configuration de l\'infirmerie a été mise à jour avec succès.',
      });
    } catch (e: any) {
      toast({
        title: 'Erreur d\'enregistrement',
        description: e?.response?.data?.message || e?.message || 'Erreur lors de l\'enregistrement',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const updateSetting = (key: keyof InfirmarySettingsData, value: any) => {
    setSettings((prev) => ({ ...(prev ?? DEFAULT_SETTINGS), [key]: value }));
  };

  const stockThreshold = settings?.stockAlertThreshold ?? DEFAULT_SETTINGS.stockAlertThreshold!;
  const requireAuth = settings?.requireParentalAuthorization ?? DEFAULT_SETTINGS.requireParentalAuthorization!;
  const smsNotif = settings?.smsNotifications ?? DEFAULT_SETTINGS.smsNotifications!;
  const emailAlerts = settings?.emailEmergencyAlerts ?? DEFAULT_SETTINGS.emailEmergencyAlerts!;
  const restrictedAccess = settings?.restrictedAccess ?? DEFAULT_SETTINGS.restrictedAccess!;
  const auditLog = settings?.auditLogEnabled ?? DEFAULT_SETTINGS.auditLogEnabled!;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {error && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          ⚠ Impossible de charger les paramètres. {error}
        </div>
      )}

      {/* Settings Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-semibold text-navy-900 flex items-center">
            <Settings className="w-6 h-6 mr-3 text-slate-400" />
            Configuration de l'Infirmerie
          </h2>
          <p className="text-slate-500 font-medium text-sm">Personnalisez les workflows et paramètres du module santé.</p>
        </div>
        <Button onClick={handleSave} disabled={submitting}>
          {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          <Save className="w-4 h-4 mr-2" />
          {submitting ? 'Enregistrement...' : 'Enregistrer'}
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {/* Medical Workflow */}
        <Card className="p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-navy-900 mb-6 flex items-center">
            <HeartPulse className="w-5 h-5 mr-3 text-blue-600" />
            Workflow Médical & Motifs
          </h3>
          <div className="space-y-6">
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl gap-4">
              <div>
                <p className="font-semibold text-navy-900">Motifs de visite par défaut</p>
                <p className="text-xs text-slate-500">
                  {(settings?.defaultVisitReasons || DEFAULT_SETTINGS.defaultVisitReasons!).join(', ')}.
                </p>
              </div>
              <Button variant="link" size="sm" className="text-blue-600">Modifier la liste</Button>
            </div>
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl gap-4">
              <div>
                <p className="font-semibold text-navy-900">Seuils d'alerte stock</p>
                <p className="text-xs text-slate-500">Notification automatique quand le stock est critique.</p>
              </div>
              <div className="flex items-center space-x-2">
                <Input
                  type="number"
                  value={stockThreshold}
                  onChange={(e) => updateSetting('stockAlertThreshold', Number(e.target.value))}
                  className="w-16 text-center"
                />
                <span className="text-xs font-semibold text-slate-400">Unités</span>
              </div>
            </div>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="font-semibold text-navy-900">Exiger validation pour médicaments</p>
                <p className="text-xs text-slate-500">Forcer le personnel à cocher l'autorisation parentale avant l'administration.</p>
              </div>
              <Switch
                checked={requireAuth}
                onCheckedChange={(v) => updateSetting('requireParentalAuthorization', v)}
              />
            </div>
          </div>
        </Card>

        {/* Notifications & Communications */}
        <Card className="p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-navy-900 mb-6 flex items-center">
            <Bell className="w-5 h-5 mr-3 text-amber-500" />
            Notifications & Communications
          </h3>
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="border border-slate-100 rounded-xl p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3 text-slate-700 font-semibold text-sm">
                    <MessageSquare className="w-4 h-4" />
                    SMS aux Parents
                  </div>
                  <Switch
                    checked={smsNotif}
                    onCheckedChange={(v) => updateSetting('smsNotifications', v)}
                  />
                </div>
                <p className="text-xs text-slate-400 font-medium">Envoyer un SMS automatique pour chaque passage à l'infirmerie.</p>
              </div>
              <div className="border border-slate-100 rounded-xl p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3 text-slate-700 font-semibold text-sm">
                    <AlertCircle className="w-4 h-4" />
                    Alertes Urgence (Email)
                  </div>
                  <Switch
                    checked={emailAlerts}
                    onCheckedChange={(v) => updateSetting('emailEmergencyAlerts', v)}
                  />
                </div>
                <p className="text-xs text-slate-400 font-medium">Notifier immédiatement la direction et les parents par email en cas d'urgence.</p>
              </div>
            </div>
          </div>
        </Card>

        {/* Security & Access */}
        <Card className="p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-navy-900 mb-6 flex items-center">
            <Lock className="w-5 h-5 mr-3 text-rose-600" />
            Sécurité & Confidentialité (RGPD)
          </h3>
          <div className="space-y-6">
            <div className="flex items-center justify-between p-4 border border-rose-50 bg-rose-50/20 rounded-xl gap-4">
              <div className="flex items-center space-x-4">
                <div className="p-3 bg-rose-100 rounded-xl text-rose-600">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <p className="font-semibold text-navy-900">Accès restreint aux dossiers</p>
                  <p className="text-xs text-slate-500">Seuls l'infirmier(e) et la direction peuvent consulter le détail médical.</p>
                </div>
              </div>
              <Switch
                checked={restrictedAccess}
                onCheckedChange={(v) => updateSetting('restrictedAccess', v)}
              />
            </div>
            <div className="flex items-center justify-between p-4 border border-slate-100 rounded-xl gap-4">
              <div className="flex items-center space-x-4">
                <div className="p-3 bg-slate-100 rounded-xl text-slate-600">
                  <Database className="w-6 h-6" />
                </div>
                <div>
                  <p className="font-semibold text-navy-900">Journal d'audit médical</p>
                  <p className="text-xs text-slate-500">Consulter l'historique des accès aux dossiers de santé.</p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <Switch
                  checked={auditLog}
                  onCheckedChange={(v) => updateSetting('auditLogEnabled', v)}
                />
                <Button variant="default" size="sm" className="bg-slate-900 hover:bg-slate-800">
                  Voir Logs
                </Button>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
