/**
 * SOUS-MODULE 8 — Paramétrage financier (FinancialSettings)
 */
'use client';

import { useState, useEffect } from 'react';
import { ModuleHeader, SubModuleNavigation, ModuleContentArea } from '@/components/modules/blueprint';
import { FINANCE_SUBMODULE_TABS } from '@/components/finance/finance-tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function FinanceSettingsPage() {
  const [settings, setSettings] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    blockingThreshold: '',
    reminderWarningDays: '',
    reminderUrgentDays: '',
    reminderFinalDays: '',
    autoClosureEnabled: true,
    autoClosureTime: '23:59',
    budgetAlertThreshold: '85',
    allowPartialPayment: true,
    minimumInstallmentAmount: '',
    cancellationDelayHours: '24',
    fedapayEnabled: false,
    fedapayPublicKey: '',
    fedapaySecretKey: '',
  });

  useEffect(() => {
    fetch('/api/finance/settings', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((s) => {
        setSettings(s);
        if (s) {
          setForm((f) => ({
            ...f,
            blockingThreshold: String(s.blockingThreshold ?? ''),
            reminderWarningDays: String(s.reminderWarningDays ?? '3'),
            reminderUrgentDays: String(s.reminderUrgentDays ?? '7'),
            reminderFinalDays: String(s.reminderFinalDays ?? '15'),
            autoClosureEnabled: s.autoClosureEnabled ?? true,
            autoClosureTime: s.autoClosureTime ?? '23:59',
            budgetAlertThreshold: String(s.budgetAlertThreshold ?? '85'),
            allowPartialPayment: s.allowPartialPayment ?? true,
            minimumInstallmentAmount: s.minimumInstallmentAmount != null ? String(s.minimumInstallmentAmount) : '',
            cancellationDelayHours: String(s.cancellationDelayHours ?? '24'),
            fedapayEnabled: s.fedapayEnabled ?? false,
            fedapayPublicKey: s.fedapayPublicKey ?? '',
            fedapaySecretKey: '',
          }));
        }
      });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    await fetch('/api/finance/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        blockingThreshold: form.blockingThreshold ? Number(form.blockingThreshold) : undefined,
        reminderWarningDays: form.reminderWarningDays ? Number(form.reminderWarningDays) : undefined,
        reminderUrgentDays: form.reminderUrgentDays ? Number(form.reminderUrgentDays) : undefined,
        reminderFinalDays: form.reminderFinalDays ? Number(form.reminderFinalDays) : undefined,
        autoClosureEnabled: form.autoClosureEnabled,
        autoClosureTime: form.autoClosureTime,
        budgetAlertThreshold: form.budgetAlertThreshold ? Number(form.budgetAlertThreshold) : undefined,
        allowPartialPayment: form.allowPartialPayment,
        minimumInstallmentAmount: form.minimumInstallmentAmount ? Number(form.minimumInstallmentAmount) : null,
        cancellationDelayHours: form.cancellationDelayHours ? Number(form.cancellationDelayHours) : undefined,
        fedapayEnabled: form.fedapayEnabled,
        ...(form.fedapayPublicKey ? { fedapayPublicKey: form.fedapayPublicKey } : {}),
        ...(form.fedapaySecretKey ? { fedapaySecretKey: form.fedapaySecretKey } : {}),
      }),
    });
    setSaving(false);
  };

  const subModuleTabs = FINANCE_SUBMODULE_TABS.map((t) => ({
    id: t.id,
    label: t.label,
    path: t.path,
    icon: <t.icon className="w-4 h-4" />,
  }));

  return (
    <div className="space-y-6">
      <ModuleHeader
        title="Paramétrage & Audit"
        description="Seuil blocage, relances, clôture auto, budget, Fedapay."
        icon="finance"
      />
      <SubModuleNavigation tabs={subModuleTabs} currentPath="/app/finance/settings" />
      <ModuleContentArea layout="custom">
        <div className="max-w-xl space-y-6">
          <div>
            <h3 className="font-medium mb-2">Blocage & Recouvrement</h3>
            <div className="space-y-2">
              <Label>Seuil blocage (XOF)</Label>
              <Input type="number" value={form.blockingThreshold} onChange={(e) => setForm((f) => ({ ...f, blockingThreshold: e.target.value }))} placeholder="0" />
            </div>
          </div>
          <div>
            <h3 className="font-medium mb-2">Jours relance</h3>
            <div className="grid grid-cols-3 gap-2">
              <div><Label className="text-xs">Warning</Label><Input type="number" value={form.reminderWarningDays} onChange={(e) => setForm((f) => ({ ...f, reminderWarningDays: e.target.value }))} /></div>
              <div><Label className="text-xs">Urgent</Label><Input type="number" value={form.reminderUrgentDays} onChange={(e) => setForm((f) => ({ ...f, reminderUrgentDays: e.target.value }))} /></div>
              <div><Label className="text-xs">Final</Label><Input type="number" value={form.reminderFinalDays} onChange={(e) => setForm((f) => ({ ...f, reminderFinalDays: e.target.value }))} /></div>
            </div>
          </div>
          <div>
            <h3 className="font-medium mb-2">Clôture</h3>
            <div className="flex items-center gap-2">
              <input type="checkbox" checked={form.autoClosureEnabled} onChange={(e) => setForm((f) => ({ ...f, autoClosureEnabled: e.target.checked }))} />
              <Label>Clôture automatique activée</Label>
            </div>
            <div className="mt-2"><Label className="text-xs">Heure clôture auto</Label><Input value={form.autoClosureTime} onChange={(e) => setForm((f) => ({ ...f, autoClosureTime: e.target.value }))} /></div>
          </div>
          <div>
            <Label>Seuil alerte budget (%)</Label>
            <Input type="number" value={form.budgetAlertThreshold} onChange={(e) => setForm((f) => ({ ...f, budgetAlertThreshold: e.target.value }))} placeholder="85" />
          </div>
          <div>
            <h3 className="font-medium mb-2">Paiement</h3>
            <div className="flex items-center gap-2 mb-2">
              <input type="checkbox" checked={form.allowPartialPayment} onChange={(e) => setForm((f) => ({ ...f, allowPartialPayment: e.target.checked }))} />
              <Label>Paiement partiel autorisé</Label>
            </div>
            <Label className="text-xs">Montant minimum par paiement (XOF)</Label>
            <Input type="number" value={form.minimumInstallmentAmount} onChange={(e) => setForm((f) => ({ ...f, minimumInstallmentAmount: e.target.value }))} placeholder="Optionnel" />
          </div>
          <div>
            <h3 className="font-medium mb-2">Annulation</h3>
            <Label className="text-xs">Délai (heures) : &lt; délai = comptable, &gt; délai = directeur</Label>
            <Input type="number" value={form.cancellationDelayHours} onChange={(e) => setForm((f) => ({ ...f, cancellationDelayHours: e.target.value }))} />
          </div>
          <div>
            <h3 className="font-medium mb-2">Paiement en ligne (Fedapay)</h3>
            <div className="flex items-center gap-2 mb-2">
              <input type="checkbox" checked={form.fedapayEnabled} onChange={(e) => setForm((f) => ({ ...f, fedapayEnabled: e.target.checked }))} />
              <Label>Activer Fedapay</Label>
            </div>
            <Label className="text-xs">Clé publique</Label>
            <Input value={form.fedapayPublicKey} onChange={(e) => setForm((f) => ({ ...f, fedapayPublicKey: e.target.value }))} placeholder="Optionnel" className="mb-2" />
            <Label className="text-xs">Clé secrète (laisser vide pour ne pas modifier)</Label>
            <Input type="password" value={form.fedapaySecretKey} onChange={(e) => setForm((f) => ({ ...f, fedapaySecretKey: e.target.value }))} placeholder="••••••••" />
          </div>
          <Button onClick={handleSave} disabled={saving}>{saving ? 'Enregistrement…' : 'Enregistrer'}</Button>
        </div>
        <p className="text-sm text-gray-500 mt-4">Aucune suppression destructive ; toute modification peut être journalisée (audit log).</p>
      </ModuleContentArea>
    </div>
  );
}
