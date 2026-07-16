/**
 * ============================================================================
 * EDUCAST SETTINGS
 * ============================================================================
 */

'use client';

import { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Bell, ShieldCheck, Database, Save, RefreshCw, MonitorPlay, Loader2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ui/use-toast';
import { useModuleContext } from '@/hooks/useModuleContext';
import { modulesApi, buildModulesApiOptions } from '@/lib/modules-complementaires/client';

export default function EduCastSettings() {
  const { academicYear } = useModuleContext();
  const { toast } = useToast();
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
      toast({ title: 'Paramètres enregistrés', description: 'La configuration a été mise à jour.' });
    } catch (e: any) {
      toast({ title: 'Erreur', description: e?.message || 'Erreur lors de l\'enregistrement', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const toggleSetting = (key: string) => {
    setSettings((prev: any) => ({ ...(prev ?? {}), [key]: !prev?.[key] }));
  };

  const updateField = (key: string, value: any) => {
    setSettings((prev: any) => ({ ...(prev ?? {}), [key]: value }));
  };

  return (
    <div className="max-w-4xl space-y-6">
      {error && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          ⚠ Impossible de charger les paramètres. {error}
        </div>
      )}

      <div className="flex justify-between items-center">
        <div className="space-y-1">
          <h3 className="text-lg font-semibold text-navy-900 flex items-center">
            <SettingsIcon className="w-5 h-5 mr-2 text-slate-400" />
            Configuration EduCast
          </h3>
          <p className="text-slate-500 text-sm">Paramétrez les règles de diffusion et de stockage média.</p>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
          Enregistrer
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {/* Publication Rules */}
        <Card className="p-6 shadow-sm space-y-6">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
              <MonitorPlay className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-base font-semibold text-slate-900">Règles de Publication</h4>
              <p className="text-xs text-slate-500">Contrôle des flux média</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label>Qualité Vidéo Maximale</Label>
              <select
                value={settings?.maxVideoQuality || 'Full HD (1080p)'}
                onChange={(e) => updateField('maxVideoQuality', e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
              >
                <option>4K (2160p)</option>
                <option>Full HD (1080p)</option>
                <option>HD (720p)</option>
                <option>SD (480p)</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>Durée Max Capsules (Minutes)</Label>
              <Input
                type="number"
                value={settings?.maxCapsuleDuration ?? 5}
                onChange={(e) => updateField('maxCapsuleDuration', Number(e.target.value))}
              />
            </div>
          </div>

          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
            <div className="flex items-center gap-3">
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
              <div>
                <p className="text-sm font-semibold text-slate-900">Modération Obligatoire</p>
                <p className="text-xs text-slate-500">Tout contenu élève doit être validé</p>
              </div>
            </div>
            <Switch
              checked={!!settings?.mandatoryModeration}
              onCheckedChange={() => toggleSetting('mandatoryModeration')}
            />
          </div>
        </Card>

        {/* Storage & Limits */}
        <Card className="p-6 shadow-sm space-y-6">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
            <div className="p-3 bg-rose-50 text-rose-600 rounded-xl">
              <Database className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-base font-semibold text-slate-900">Stockage & Quotas</h4>
              <p className="text-xs text-slate-500">Gestion de l&apos;espace disque</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label>Quota par Enseignant (GB)</Label>
              <Input
                type="number"
                value={settings?.teacherQuotaGB ?? 50}
                onChange={(e) => updateField('teacherQuotaGB', Number(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label>Auto-archivage après (Mois)</Label>
              <Input
                type="number"
                value={settings?.autoArchiveMonths ?? 24}
                onChange={(e) => updateField('autoArchiveMonths', Number(e.target.value))}
              />
            </div>
          </div>
        </Card>

        {/* Monetization Rules */}
        <Card className="p-6 shadow-sm space-y-6">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
            <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
              <RefreshCw className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-base font-semibold text-slate-900">Règles de Monétisation</h4>
              <p className="text-xs text-slate-500">Configuration financière</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label>Commission École (%)</Label>
              <Input
                type="number"
                value={settings?.schoolCommissionPct ?? 20}
                onChange={(e) => updateField('schoolCommissionPct', Number(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label>Plafond Prix Vidéo (F CFA)</Label>
              <Input
                type="number"
                value={settings?.maxVideoPrice ?? 5000}
                onChange={(e) => updateField('maxVideoPrice', Number(e.target.value))}
              />
            </div>
          </div>

          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
            <div className="flex items-center gap-3">
              <ShieldCheck className="w-5 h-5 text-amber-600" />
              <div>
                <p className="text-sm font-semibold text-slate-900">Validation Vidéos Payantes</p>
                <p className="text-xs text-slate-500">L&apos;école doit valider tout contenu payant</p>
              </div>
            </div>
            <Switch
              checked={!!settings?.paidVideoValidation}
              onCheckedChange={() => toggleSetting('paidVideoValidation')}
            />
          </div>
        </Card>

        {/* Notifications */}
        <Card className="p-6 shadow-sm">
          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
            <div className="flex items-center gap-3">
              <Bell className="w-5 h-5 text-blue-600" />
              <div>
                <p className="text-sm font-semibold text-slate-900">Notifications de Publication</p>
                <p className="text-xs text-slate-500">Alerter les élèves lors d&apos;un nouveau cours</p>
              </div>
            </div>
            <Switch
              checked={!!settings?.publishNotifications}
              onCheckedChange={() => toggleSetting('publishNotifications')}
            />
          </div>
        </Card>
      </div>
    </div>
  );
}
