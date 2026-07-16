/**
 * ============================================================================
 * LIBRARY SETTINGS — Branché sur backend réel (Standardisé)
 * ============================================================================
 *
 * Endpoint (lecture)  : GET /modules-complementaires/library/settings
 * Endpoint (écriture) : PUT /modules-complementaires/library/settings
 * ============================================================================
 */

'use client';

import { useState, useEffect } from 'react';
import { Settings, Bell, ShieldCheck, Clock, CreditCard, Save, Loader2 } from 'lucide-react';
import { useModuleContext } from '@/hooks/useModuleContext';
import { modulesApi, buildModulesApiOptions } from '@/lib/modules-complementaires/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ui/use-toast';

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
  const { toast } = useToast();
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
      toast({ title: 'Paramètres enregistrés', description: 'Les paramètres de la bibliothèque ont été sauvegardés.' });
    } catch (e: any) {
      toast({ title: 'Erreur', description: e?.message || "Erreur lors de l'enregistrement", variant: 'destructive' });
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
    <div className="max-w-4xl space-y-6">
      {error && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          ⚠ {error}
        </div>
      )}

      <div className="flex justify-between items-center">
        <div className="space-y-1">
          <h3 className="text-lg font-semibold text-slate-900 flex items-center">
            <Settings className="w-5 h-5 mr-2 text-slate-400" />
            Paramètres de la Bibliothèque
          </h3>
          <p className="text-slate-500 text-sm">Configurez les règles de circulation et de gestion.</p>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
          {saving ? 'Enregistrement…' : 'Enregistrer'}
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {/* Loan Rules */}
        <Card className="p-6 shadow-sm space-y-6">
          <div className="flex items-center gap-4 border-b border-slate-100 pb-4">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-lg font-semibold text-slate-900">Règles d'Emprunt</h4>
              <p className="text-xs text-slate-400">Définissez les limites standards</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="max-loan-days">Durée maximale d'emprunt (Jours)</Label>
              <Input
                id="max-loan-days"
                type="number"
                value={settings?.maxLoanDurationDays ?? 14}
                onChange={(e) => update('maxLoanDurationDays', Number(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="max-books">Nombre maximal de livres / lecteur</Label>
              <Input
                id="max-books"
                type="number"
                value={settings?.maxBooksPerReader ?? 3}
                onChange={(e) => update('maxBooksPerReader', Number(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="res-hours">Durée de réservation (Heures)</Label>
              <Input
                id="res-hours"
                type="number"
                value={settings?.reservationDurationHours ?? 48}
                onChange={(e) => update('reservationDurationHours', Number(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="max-renewals">Nombre d'extensions autorisées</Label>
              <Input
                id="max-renewals"
                type="number"
                value={settings?.maxRenewals ?? 1}
                onChange={(e) => update('maxRenewals', Number(e.target.value))}
              />
            </div>
          </div>
        </Card>

        {/* Finance Rules */}
        <Card className="p-6 shadow-sm space-y-6">
          <div className="flex items-center gap-4 border-b border-slate-100 pb-4">
            <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
              <CreditCard className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-lg font-semibold text-slate-900">Pénalités & Amendes</h4>
              <p className="text-xs text-slate-400">Configuration financière</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="late-fee">Amende par jour de retard (F CFA)</Label>
              <Input
                id="late-fee"
                type="number"
                value={settings?.lateFeePerDay ?? 500}
                onChange={(e) => update('lateFeePerDay', Number(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="auto-block">Seuil blocage automatique (F CFA)</Label>
              <Input
                id="auto-block"
                type="number"
                value={settings?.autoBlockThreshold ?? 5000}
                onChange={(e) => update('autoBlockThreshold', Number(e.target.value))}
              />
            </div>
          </div>
        </Card>

        {/* Automation & Security */}
        <Card className="p-6 shadow-sm">
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
              <div className="flex items-center gap-4">
                <Bell className="w-5 h-5 text-blue-600" />
                <div>
                  <p className="text-sm font-semibold text-slate-900">Notifications de Rappel</p>
                  <p className="text-xs text-slate-400">Envoyer SMS/Email 2 jours avant l'échéance</p>
                </div>
              </div>
              <Switch
                checked={!!settings?.sendReminders}
                onCheckedChange={(v) => update('sendReminders', v)}
              />
            </div>

            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
              <div className="flex items-center gap-4">
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
                <div>
                  <p className="text-sm font-semibold text-slate-900">Validation Parentale</p>
                  <p className="text-xs text-slate-400">Requis pour les ressources payantes</p>
                </div>
              </div>
              <Switch
                checked={!!settings?.requireParentalValidation}
                onCheckedChange={(v) => update('requireParentalValidation', v)}
              />
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
