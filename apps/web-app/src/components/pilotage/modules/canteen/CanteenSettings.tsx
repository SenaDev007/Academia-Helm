/**
 * ============================================================================
 * CANTEEN SETTINGS — Branché sur backend réel
 * ============================================================================
 *
 * Endpoint (lecture)  : GET /modules-complementaires/canteen/settings
 * Endpoint (écriture) : PUT /modules-complementaires/canteen/settings
 *
 * Refonte juillet 2026 (Task 7-d) :
 *  - <input>/<button> HTML → <Input>/<Button> shadcn
 *  - Toggles CSS-only (button + span) → <Switch> shadcn
 *  - rounded-3xl → rounded-xl, font-black uppercase tracking-widest → font-semibold
 *  - bouton "Enregistrer" bg-navy-900 → <Button> shadcn (default = indigo-600)
 *  - bandeau "Maintenance des Données" bg-navy-50 → bg-slate-50
 *  - alert()/setError → toast() pour le feedback utilisateur (erreur conservée
 *    dans l'état pour le bandeau d'avertissement, mais le toast notifie
 *    explicitement succès/erreur).
 * ============================================================================
 */

'use client';

import React, { useState, useEffect } from 'react';
import {
  Bell, CreditCard,
  Clock, Database,
  Save,
  AlertTriangle, Loader2,
} from 'lucide-react';
import { useModuleContext } from '@/hooks/useModuleContext';
import { modulesApi, buildModulesApiOptions } from '@/lib/modules-complementaires/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ui/use-toast';

interface CanteenSettingsData {
  breakfastTime?: string;
  lunchTime?: string;
  snackTime?: string;
  dinnerTime?: string;
  requirePrepayment?: boolean;
  allowOccasualMeals?: boolean;
  notifyMenuPublished?: boolean;
  notifyAllergyAlert?: boolean;
  notifyLowStock?: boolean;
  [key: string]: any;
}

export default function CanteenSettings() {
  const { academicYear } = useModuleContext();
  const { toast } = useToast();
  const [settings, setSettings] = useState<CanteenSettingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!academicYear?.id) return;
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const data = await modulesApi.get<CanteenSettingsData>(
          'canteen/settings',
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
        'canteen/settings',
        settings ?? {},
        buildModulesApiOptions(academicYear.id),
      );
      setError(null);
      toast({ title: 'Paramètres enregistrés', description: 'La configuration a été sauvegardée.' });
    } catch (e: any) {
      setError(e?.message || 'Erreur lors de l’enregistrement');
      toast({
        title: 'Erreur enregistrement',
        description: e?.message || 'Erreur lors de l’enregistrement',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const update = <K extends keyof CanteenSettingsData>(key: K, value: CanteenSettingsData[K]) => {
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
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 max-w-5xl mx-auto pb-12">
      {error && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          ⚠ {error}
        </div>
      )}

      <Card className="p-0 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-navy-900 text-xl">Configuration Cantine</h3>
            <p className="text-gray-500 text-sm mt-1">Personnalisez les règles et le fonctionnement du module</p>
          </div>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </Button>
        </div>

        <div className="p-6 space-y-10">
          {/* Section: Service Times */}
          <section className="space-y-4">
            <div className="flex items-center space-x-3 text-navy-900">
              <Clock className="w-5 h-5 text-gray-500" />
              <h4 className="font-semibold text-base">Horaires de Service</h4>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <TimeInput label="Petit Déjeuner" value={settings?.breakfastTime ?? '07:30'} onChange={(v) => update('breakfastTime', v)} />
              <TimeInput label="Déjeuner" value={settings?.lunchTime ?? '12:00'} onChange={(v) => update('lunchTime', v)} />
              <TimeInput label="Goûter" value={settings?.snackTime ?? '15:30'} onChange={(v) => update('snackTime', v)} />
              <TimeInput label="Dîner (Internat)" value={settings?.dinnerTime ?? '19:00'} onChange={(v) => update('dinnerTime', v)} />
            </div>
          </section>

          {/* Section: Subscription Plans */}
          <section className="space-y-4">
            <div className="flex items-center space-x-3 text-navy-900">
              <CreditCard className="w-5 h-5 text-gray-500" />
              <h4 className="font-semibold text-base">Abonnements & Tarifs</h4>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <ToggleOption
                title="Paiement à l’avance obligatoire"
                desc="L’élève ne peut badger que si son solde ou abonnement est à jour."
                checked={!!settings?.requirePrepayment}
                onToggle={() => update('requirePrepayment', !settings?.requirePrepayment)}
              />
              <ToggleOption
                title="Autoriser les repas occasionnels"
                desc="Permet aux élèves non-inscrits de déjeuner via paiement unique."
                checked={!!settings?.allowOccasualMeals}
                onToggle={() => update('allowOccasualMeals', !settings?.allowOccasualMeals)}
              />
            </div>
          </section>

          {/* Section: Notifications */}
          <section className="space-y-4">
            <div className="flex items-center space-x-3 text-navy-900">
              <Bell className="w-5 h-5 text-gray-500" />
              <h4 className="font-semibold text-base">Notifications & Alertes</h4>
            </div>
            <div className="space-y-3 max-w-2xl">
              <NotificationToggle
                label="Menu publié"
                desc="Envoyer une notification in-app et email aux parents lors de la publication du menu hebdomadaire."
                channels={['App', 'Email']}
                checked={!!settings?.notifyMenuPublished}
                onToggle={() => update('notifyMenuPublished', !settings?.notifyMenuPublished)}
              />
              <NotificationToggle
                label="Alerte Allergie"
                desc="Notifier immédiatement le responsable cuisine et QHSE si un menu contient un allergène critique pour un élève inscrit."
                channels={['App', 'SMS']}
                isCritical={true}
                checked={!!settings?.notifyAllergyAlert}
                onToggle={() => update('notifyAllergyAlert', !settings?.notifyAllergyAlert)}
              />
              <NotificationToggle
                label="Stock faible"
                desc="Alerter l’économe lorsque le stock d’un produit descend sous le seuil critique."
                channels={['App']}
                checked={!!settings?.notifyLowStock}
                onToggle={() => update('notifyLowStock', !settings?.notifyLowStock)}
              />
            </div>
          </section>

          {/* Section: Advanced */}
          <section className="p-6 bg-slate-50 rounded-xl border border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start space-x-4">
              <div className="p-3 bg-white rounded-xl shadow-sm text-blue-600">
                <Database className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-semibold text-navy-900 text-sm">Maintenance des Données</h4>
                <p className="text-xs text-gray-500 mt-1">Archivage des historiques de présence et de paiements des années précédentes.</p>
              </div>
            </div>
            <Button variant="outline">
              Gérer l’archivage
            </Button>
          </section>
        </div>
      </Card>
    </div>
  );
}

function TimeInput({ label, value, onChange }: any) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input
        type="time"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function ToggleOption({ title, desc, checked, onToggle }: any) {
  return (
    <Card className="p-4 shadow-sm flex items-start justify-between">
      <div className="pr-4">
        <h5 className="font-semibold text-navy-900 text-sm mb-1">{title}</h5>
        <p className="text-xs text-gray-500 leading-relaxed">{desc}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onToggle} />
    </Card>
  );
}

function NotificationToggle({ label, desc, channels, isCritical, checked, onToggle }: any) {
  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 hover:bg-slate-50 rounded-xl transition-all">
      <div className="flex-1">
        <div className="flex items-center space-x-2">
          <p className="text-sm font-semibold text-navy-900">{label}</p>
          {isCritical && (
            <span className="p-1 bg-red-100 text-red-600 rounded-lg">
              <AlertTriangle className="w-3 h-3" />
            </span>
          )}
        </div>
        <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
      </div>
      <div className="flex items-center space-x-2">
        {channels.map((c: string) => (
          <Badge key={c} variant="outline" className="text-gray-500">{c}</Badge>
        ))}
        <div className="ml-4">
          <Switch checked={checked} onCheckedChange={onToggle} />
        </div>
      </div>
    </div>
  );
}
