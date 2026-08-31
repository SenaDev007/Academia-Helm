'use client';

import { useState, useEffect } from 'react';
import { Save, Loader2, Bell, CreditCard, Receipt, Lock, Truck, Wallet, Settings as SettingsIcon, Zap } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ui/use-toast';
import { useModuleContext } from '@/hooks/useModuleContext';
import { modulesApi, buildModulesApiOptions } from '@/lib/modules-complementaires/api';

interface ShopSettings {
  id?: string;
  tenantId?: string;
  lowStockAlert?: boolean;
  allowPreOrders?: boolean;
  loyaltyProgramActive?: boolean;
  pointsPer1000?: number;
  receiptHeader?: string;
  receiptFooter?: string;
  // Extended fields (may not be in DB yet — we send them anyway, backend ignores unknowns)
  lowStockAlertEnabled?: boolean;
  weeklyInventoryReport?: boolean;
  defaultLowStockThreshold?: number;
  allowClientCredit?: boolean;
  autoPrintReceipt?: boolean;
  barcodeScannerEnabled?: boolean;
  orionPredictiveInventory?: boolean;
}

export default function ShopSettings() {
  const { academicYear } = useModuleContext();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState('general');
  const [form, setForm] = useState<ShopSettings>({
    lowStockAlert: true,
    allowPreOrders: true,
    loyaltyProgramActive: false,
    pointsPer1000: 10,
    receiptHeader: 'Merci de votre confiance ! Bonne rentrée scolaire.',
    receiptFooter: '',
    lowStockAlertEnabled: true,
    weeklyInventoryReport: false,
    defaultLowStockThreshold: 10,
    allowClientCredit: false,
    autoPrintReceipt: true,
    barcodeScannerEnabled: true,
    orionPredictiveInventory: true,
  });

  // Load settings
  useEffect(() => {
    if (!academicYear?.id) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const data = await modulesApi.get<ShopSettings>(
          'shop/settings',
          buildModulesApiOptions(academicYear.id),
        );
        if (!cancelled) {
          const loaded = (data as any)?.data ?? data ?? {};
          setForm(prev => ({ ...prev, ...loaded }));
        }
      } catch (e: any) {
        // Settings may not exist yet for this tenant — that's OK, defaults are used
        console.warn('Shop settings load failed (using defaults):', e?.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [academicYear?.id]);

  // Save settings
  const handleSave = async () => {
    try {
      setSubmitting(true);
      await modulesApi.put('shop/settings', form, buildModulesApiOptions(academicYear?.id));
      toast({ title: 'Paramètres enregistrés', description: 'La configuration a été sauvegardée avec succès.' });
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? e?.message ?? 'Erreur lors de l\'enregistrement';
      toast({ title: 'Erreur', description: msg, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        <span className="ml-2 text-gray-600">Chargement des paramètres...</span>
      </div>
    );
  }

  const tabs = [
    { id: 'general', label: 'Général', icon: SettingsIcon },
    { id: 'pos', label: 'Point de Vente', icon: CreditCard },
    { id: 'receipts', label: 'Reçus', icon: Receipt },
    { id: 'alerts', label: 'Alertes & Stocks', icon: Bell },
  ];

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="text-lg font-semibold text-navy-900">Configuration Academia Shop</h3>
          <p className="text-sm text-gray-500">Personnalisez le fonctionnement de l'économat et du point de vente</p>
        </div>
        <Button onClick={handleSave} disabled={submitting}>
          {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          <Save className="w-4 h-4 mr-2" />
          {submitting ? 'Enregistrement...' : 'Enregistrer les modifications'}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Navigation Sidebar */}
        <div className="space-y-2">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition ${
                activeTab === tab.id
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-white text-gray-500 border border-slate-100 hover:bg-slate-50 hover:text-navy-900'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Settings Content */}
        <div className="md:col-span-3 space-y-6">
          {activeTab === 'general' && (
            <Card className="p-6 shadow-sm space-y-6">
              <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
                <SettingsIcon className="w-4 h-4 text-indigo-600" />
                <h4 className="text-sm font-semibold text-navy-900">Paramètres Généraux</h4>
              </div>
              <ToggleRow
                label="Autoriser les pré-commandes"
                description="Permettre aux parents de commander à l'avance les articles"
                checked={form.allowPreOrders ?? true}
                onChange={(v) => setForm({ ...form, allowPreOrders: v })}
              />
              <ToggleRow
                label="Programme de fidélité"
                description="Activer le système de points pour les achats"
                checked={form.loyaltyProgramActive ?? false}
                onChange={(v) => setForm({ ...form, loyaltyProgramActive: v })}
              />
              {form.loyaltyProgramActive && (
                <div className="pl-4 border-l-2 border-indigo-100">
                  <Label className="text-xs mb-2 block">Points par tranche de 1000 FCFA</Label>
                  <Input
                    type="number"
                    value={form.pointsPer1000 ?? 10}
                    onChange={(e) => setForm({ ...form, pointsPer1000: Number(e.target.value) })}
                    className="w-32"
                  />
                </div>
              )}
            </Card>
          )}

          {activeTab === 'pos' && (
            <Card className="p-6 shadow-sm space-y-6">
              <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
                <CreditCard className="w-4 h-4 text-indigo-600" />
                <h4 className="text-sm font-semibold text-navy-900">Options Point de Vente (POS)</h4>
              </div>
              <ToggleRow
                label="Autoriser le crédit client"
                description="Permettre aux élèves d'acheter à crédit (selon limite)"
                checked={form.allowClientCredit ?? false}
                onChange={(v) => setForm({ ...form, allowClientCredit: v })}
              />
              <ToggleRow
                label="Impression automatique du reçu"
                description="Lancer l'impression dès la validation de l'encaissement"
                checked={form.autoPrintReceipt ?? true}
                onChange={(v) => setForm({ ...form, autoPrintReceipt: v })}
              />
              <ToggleRow
                label="Scanner code-barres activé"
                description="Support natif pour les douchettes de lecture"
                checked={form.barcodeScannerEnabled ?? true}
                onChange={(v) => setForm({ ...form, barcodeScannerEnabled: v })}
              />
            </Card>
          )}

          {activeTab === 'receipts' && (
            <Card className="p-6 shadow-sm space-y-6">
              <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
                <Receipt className="w-4 h-4 text-indigo-600" />
                <h4 className="text-sm font-semibold text-navy-900">Entête & Pied de Reçu</h4>
              </div>
              <div>
                <Label className="text-xs mb-2 block">Message d'accueil (entête du reçu)</Label>
                <textarea
                  className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 min-h-[80px]"
                  value={form.receiptHeader ?? ''}
                  onChange={(e) => setForm({ ...form, receiptHeader: e.target.value })}
                  placeholder="Merci de votre confiance ! Bonne rentrée scolaire."
                />
              </div>
              <div>
                <Label className="text-xs mb-2 block">Message de pied (pied du reçu)</Label>
                <textarea
                  className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 min-h-[60px]"
                  value={form.receiptFooter ?? ''}
                  onChange={(e) => setForm({ ...form, receiptFooter: e.target.value })}
                  placeholder="Visitez notre boutique en ligne sur academiashelm.com"
                />
              </div>
            </Card>
          )}

          {activeTab === 'alerts' && (
            <Card className="p-6 shadow-sm space-y-6">
              <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
                <Bell className="w-4 h-4 text-indigo-600" />
                <h4 className="text-sm font-semibold text-navy-900">Alertes de Stock</h4>
              </div>
              <ToggleRow
                label="Notifications de stock bas"
                description="Envoyer une alerte quand un produit atteint son seuil critique"
                checked={form.lowStockAlert ?? form.lowStockAlertEnabled ?? true}
                onChange={(v) => setForm({ ...form, lowStockAlert: v, lowStockAlertEnabled: v })}
              />
              <ToggleRow
                label="Rapport hebdomadaire d'inventaire"
                description="Recevoir un résumé des mouvements de stock par email"
                checked={form.weeklyInventoryReport ?? false}
                onChange={(v) => setForm({ ...form, weeklyInventoryReport: v })}
              />
              <div className="pt-2">
                <Label className="text-xs mb-2 block">Seuil d'alerte par défaut</Label>
                <div className="flex items-center gap-3">
                  <Input
                    type="number"
                    value={form.defaultLowStockThreshold ?? 10}
                    onChange={(e) => setForm({ ...form, defaultLowStockThreshold: Number(e.target.value) })}
                    className="w-28"
                  />
                  <span className="text-xs text-gray-500">Unités</span>
                </div>
              </div>
            </Card>
          )}

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
              <Switch
                checked={form.orionPredictiveInventory ?? true}
                onCheckedChange={(v) => setForm({ ...form, orionPredictiveInventory: v })}
              />
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function ToggleRow({ label, description, checked, onChange }: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="space-y-1">
        <p className="text-sm font-medium text-navy-900">{label}</p>
        <p className="text-xs text-gray-500">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
