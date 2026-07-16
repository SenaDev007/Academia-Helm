/**
 * ============================================================================
 * SHOP SETTINGS - ACADEMIA HELM
 * ============================================================================
 *
 * Refonte juillet 2026 : alignement sur le pattern Finance/Students.
 *  - Boutons : <Button> shadcn
 *  - Inputs/Labels : <Input>/<Label> shadcn
 *  - Notifications : useToast() (au lieu de alert())
 *  - Cards : rounded-xl (au lieu de rounded-[2.5rem])
 *  - Typo : font-semibold (au lieu de font-black uppercase tracking-widest)
 * ============================================================================
 */

'use client';

import React, { useState, useEffect } from 'react';
import {
  Loader2, Settings, Save, Bell, CreditCard,
  Wallet, Truck, Receipt, Lock, Zap
} from 'lucide-react';
import { useModuleContext } from '@/hooks/useModuleContext';
import { modulesApi, buildModulesApiOptions } from '@/lib/modules-complementaires/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ui/use-toast';

interface ShopSettings {
  lowStockAlertEnabled?: boolean;
  weeklyInventoryReport?: boolean;
  defaultLowStockThreshold?: number;
  allowClientCredit?: boolean;
  autoPrintReceipt?: boolean;
  barcodeScannerEnabled?: boolean;
  receiptHeader?: string;
  orionPredictiveInventory?: boolean;
}

export default function ShopSettings() {
  const { academicYear } = useModuleContext();
  const { toast } = useToast();
  const [settings, setSettings] = useState<ShopSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSave = async () => {
    try {
      setSubmitting(true);
      await modulesApi.put('shop/settings', settings ?? {}, buildModulesApiOptions(academicYear?.id));
      toast({ title: 'Paramètres enregistrés', description: 'La configuration a été sauvegardée avec succès.' });
    } catch (e: any) {
      toast({
        title: 'Erreur',
        description: e?.response?.data?.message ?? e?.message ?? 'Erreur lors de l\'enregistrement',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    if (!academicYear?.id) {
      setSettings(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await modulesApi.get<ShopSettings>(
          'shop/settings',
          buildModulesApiOptions(academicYear.id),
        );
        if (!cancelled) setSettings(data?.data ?? data);
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.response?.data?.message ?? e?.message ?? 'Erreur de chargement');
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
        <span className="ml-2 text-gray-600">Chargement des paramètres...</span>
      </div>
    );
  }

  const s: ShopSettings = settings ?? {};
  const [orionChecked, setOrionChecked] = useState(s.orionPredictiveInventory ?? true);

  return (
    <div className="space-y-6 animate-in fade-in duration-700 max-w-5xl">
      {error && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          ⚠ Impossible de charger les paramètres. Affichage des valeurs par défaut. {error}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="text-lg font-semibold text-navy-900">Configuration Boutique</h3>
          <p className="text-sm text-gray-500">Personnalisez le fonctionnement de l'économat et du point de vente</p>
        </div>
        <Button onClick={handleSave} disabled={submitting}>
          {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          <Save className="w-4 h-4 mr-2" />
          {submitting ? 'Enregistrement...' : 'Enregistrer les modifications'}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Navigation Sidebar */}
        <div className="space-y-2">
          <SettingsTab active icon={Settings} label="Général" />
          <SettingsTab icon={Wallet} label="Paiements & Wallet" />
          <SettingsTab icon={Truck} label="Logistique & Livraison" />
          <SettingsTab icon={Receipt} label="Facturation & Recus" />
          <SettingsTab icon={Bell} label="Alertes & Stocks" />
          <SettingsTab icon={Lock} label="Sécurité & Accès" />
        </div>

        {/* Settings Content */}
        <div className="md:col-span-2 space-y-6">
          <Card className="p-6 shadow-sm space-y-8">
            {/* Stock Alerts */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
                <Bell className="w-4 h-4 text-indigo-600" />
                <h4 className="text-sm font-semibold text-navy-900">Alertes de Stock</h4>
              </div>
              <div className="space-y-4">
                <ToggleField
                  label="Notifications de stock bas"
                  description="Envoyer une alerte quand un produit atteint son seuil critique"
                  defaultChecked={s.lowStockAlertEnabled ?? true}
                />
                <ToggleField
                  label="Rapport hebdomadaire d'inventaire"
                  description="Recevoir un résumé des mouvements de stock par email"
                  defaultChecked={s.weeklyInventoryReport ?? false}
                />
                <div className="pt-2">
                  <Label className="text-xs mb-2 block">Seuil d'alerte par défaut</Label>
                  <div className="flex items-center gap-3">
                    <Input type="number" defaultValue={s.defaultLowStockThreshold ?? 10} className="w-28" />
                    <span className="text-xs text-gray-500">Unités</span>
                  </div>
                </div>
              </div>
            </div>

            {/* POS Settings */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
                <CreditCard className="w-4 h-4 text-indigo-600" />
                <h4 className="text-sm font-semibold text-navy-900">Options Point de Vente (POS)</h4>
              </div>
              <div className="space-y-4">
                <ToggleField
                  label="Autoriser le crédit client"
                  description="Permettre aux élèves d'acheter sans solde suffisant (selon limite)"
                  defaultChecked={s.allowClientCredit ?? false}
                />
                <ToggleField
                  label="Impression automatique du reçu"
                  description="Lancer l'impression dès la validation de l'encaissement"
                  defaultChecked={s.autoPrintReceipt ?? true}
                />
                <ToggleField
                  label="Scanner code-barres activé"
                  description="Support natif pour les douchettes de lecture"
                  defaultChecked={s.barcodeScannerEnabled ?? true}
                />
              </div>
            </div>

            {/* Receipt Customization */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
                <Receipt className="w-4 h-4 text-indigo-600" />
                <h4 className="text-sm font-semibold text-navy-900">Entête & Pied de Reçu</h4>
              </div>
              <div className="space-y-3">
                <div>
                  <Label className="text-xs mb-2 block">Message d'accueil</Label>
                  <textarea
                    className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 min-h-[80px]"
                    defaultValue={s.receiptHeader ?? "Merci de votre confiance ! Bonne rentrée scolaire."}
                  />
                </div>
              </div>
            </div>
          </Card>

          {/* ORION Intelligence Toggle */}
          <Card className="p-6 bg-slate-900 text-white shadow-md border-0 relative overflow-hidden">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Zap className="w-5 h-5 text-amber-400 fill-amber-400" />
                  <h4 className="text-sm font-semibold">ORION Predictive Inventory</h4>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed pr-8">
                  Activez l'IA pour prédire les besoins de stock en fonction de l'année scolaire et des tendances d'achat.
                </p>
              </div>
              <Switch checked={orionChecked} onCheckedChange={setOrionChecked} />
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function SettingsTab({ icon: Icon, label, active }: any) {
  return (
    <Button
      variant="outline"
      className={`w-full justify-start gap-3 ${
        active
          ? 'bg-indigo-600 text-white border-indigo-600 hover:bg-indigo-600 hover:text-white shadow-sm'
          : 'bg-white text-gray-500 border-slate-100 hover:bg-slate-50 hover:text-navy-900 hover:border-slate-200'
      }`}
    >
      <Icon className={`w-4 h-4 ${active ? 'text-white' : 'text-gray-400'}`} />
      <span className="text-sm font-medium">{label}</span>
    </Button>
  );
}

function ToggleField({ label, description, defaultChecked }: any) {
  const [checked, setChecked] = useState(defaultChecked);
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="space-y-1">
        <p className="text-sm font-medium text-navy-900">{label}</p>
        <p className="text-xs text-gray-500">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={setChecked} />
    </div>
  );
}
