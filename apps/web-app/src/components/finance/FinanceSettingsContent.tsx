/**
 * SOUS-MODULE 8 — Paramétrage financier (FinancialSettings)
 *
 * Ce composant est utilisé directement par FinanceModulePage.
 * Il NE contient PAS de SubModuleNavigation (géré par ModuleContainer).
 */
'use client';

import { useState, useEffect } from 'react';
import { ModuleContentArea } from '@/components/modules/blueprint';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { financeService } from '@/services/finance.service';
import { useToast } from '@/components/ui/use-toast';

export default function FinanceSettingsContent() {
  const { toast } = useToast();
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
  const [existingMaskedKey, setExistingMaskedKey] = useState<string>('');

  useEffect(() => {
    financeService.getSettings().then((s) => {
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
          minimumInstallmentAmount:
            s.minimumInstallmentAmount != null ? String(s.minimumInstallmentAmount) : '',
          cancellationDelayHours: String(s.cancellationDelayHours ?? '24'),
          fedapayEnabled: s.fedapayEnabled ?? false,
          fedapayPublicKey: s.fedapayPublicKey ?? '',
          fedapaySecretKey: '',
        }));
        setExistingMaskedKey(s.fedapaySecretKey ?? '');
      }
    });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await financeService.updateSettings({
        blockingThreshold: form.blockingThreshold ? Number(form.blockingThreshold) : undefined,
        reminderWarningDays: form.reminderWarningDays ? Number(form.reminderWarningDays) : undefined,
        reminderUrgentDays: form.reminderUrgentDays ? Number(form.reminderUrgentDays) : undefined,
        reminderFinalDays: form.reminderFinalDays ? Number(form.reminderFinalDays) : undefined,
        autoClosureEnabled: form.autoClosureEnabled,
        autoClosureTime: form.autoClosureTime,
        budgetAlertThreshold: form.budgetAlertThreshold ? Number(form.budgetAlertThreshold) : undefined,
        allowPartialPayment: form.allowPartialPayment,
        minimumInstallmentAmount: form.minimumInstallmentAmount
          ? Number(form.minimumInstallmentAmount)
          : null,
        cancellationDelayHours: form.cancellationDelayHours
          ? Number(form.cancellationDelayHours)
          : undefined,
        fedapayEnabled: form.fedapayEnabled,
        ...(form.fedapayPublicKey ? { fedapayPublicKey: form.fedapayPublicKey } : {}),
        ...(form.fedapaySecretKey ? { fedapaySecretKey: form.fedapaySecretKey } : {}),
      });
      toast({ title: '✅ Paramètres enregistrés' });
    } catch (e: any) {
      toast({
        title: 'Erreur',
        description: e?.message || 'Erreur réseau',
        variant: 'destructive',
      });
    }
    setSaving(false);
  };

  return (
    <div className="space-y-4">
      <ModuleContentArea
        layout="custom"
        toolbar={
          <p className="text-sm text-slate-600">
            Seuil blocage, relances, clôture auto, budget, Fedapay.
          </p>
        }
      >
        <div className="max-w-2xl space-y-6">
          {/* Blocage & Recouvrement */}
          <div className="bg-white rounded-lg border p-5">
            <h3 className="font-semibold mb-3 text-slate-900">Blocage & Recouvrement</h3>
            <div className="space-y-3">
              <div>
                <Label>Seuil blocage (XOF)</Label>
                <Input
                  type="number"
                  value={form.blockingThreshold}
                  onChange={(e) => setForm((f) => ({ ...f, blockingThreshold: e.target.value }))}
                  placeholder="0"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Solde à partir duquel l'élève est automatiquement bloqué.
                </p>
              </div>
              <div>
                <Label className="mb-2 block">Jours de relance</Label>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <Label className="text-xs text-amber-600">Warning (J+3)</Label>
                    <Input
                      type="number"
                      value={form.reminderWarningDays}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, reminderWarningDays: e.target.value }))
                      }
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-orange-600">Urgent (J+7)</Label>
                    <Input
                      type="number"
                      value={form.reminderUrgentDays}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, reminderUrgentDays: e.target.value }))
                      }
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-rose-600">Final (J+15)</Label>
                    <Input
                      type="number"
                      value={form.reminderFinalDays}
                      onChange={(e) => setForm((f) => ({ ...f, reminderFinalDays: e.target.value }))}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Clôture */}
          <div className="bg-white rounded-lg border p-5">
            <h3 className="font-semibold mb-3 text-slate-900">Clôture journalière</h3>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="autoClosure"
                  checked={form.autoClosureEnabled}
                  onChange={(e) => setForm((f) => ({ ...f, autoClosureEnabled: e.target.checked }))}
                  className="w-4 h-4"
                />
                <Label htmlFor="autoClosure">Clôture automatique activée (cron 23h59)</Label>
              </div>
              <div>
                <Label>Heure clôture auto</Label>
                <Input
                  value={form.autoClosureTime}
                  onChange={(e) => setForm((f) => ({ ...f, autoClosureTime: e.target.value }))}
                  placeholder="23:59"
                />
              </div>
            </div>
          </div>

          {/* Budget */}
          <div className="bg-white rounded-lg border p-5">
            <h3 className="font-semibold mb-3 text-slate-900">Budget</h3>
            <div>
              <Label>Seuil alerte budget (%)</Label>
              <Input
                type="number"
                value={form.budgetAlertThreshold}
                onChange={(e) =>
                  setForm((f) => ({ ...f, budgetAlertThreshold: e.target.value }))
                }
                placeholder="85"
              />
              <p className="text-xs text-slate-500 mt-1">
                ORION déclenche une alerte quand une catégorie atteint ce %.
              </p>
            </div>
          </div>

          {/* Paiement */}
          <div className="bg-white rounded-lg border p-5">
            <h3 className="font-semibold mb-3 text-slate-900">Paiement</h3>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="partialPayment"
                  checked={form.allowPartialPayment}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, allowPartialPayment: e.target.checked }))
                  }
                  className="w-4 h-4"
                />
                <Label htmlFor="partialPayment">Paiement partiel autorisé</Label>
              </div>
              <div>
                <Label>Montant minimum par paiement (XOF)</Label>
                <Input
                  type="number"
                  value={form.minimumInstallmentAmount}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, minimumInstallmentAmount: e.target.value }))
                  }
                  placeholder="Optionnel"
                />
              </div>
            </div>
          </div>

          {/* Annulation */}
          <div className="bg-white rounded-lg border p-5">
            <h3 className="font-semibold mb-3 text-slate-900">Annulation</h3>
            <div>
              <Label>Délai d'annulation (heures)</Label>
              <Input
                type="number"
                value={form.cancellationDelayHours}
                onChange={(e) =>
                  setForm((f) => ({ ...f, cancellationDelayHours: e.target.value }))
                }
              />
              <p className="text-xs text-slate-500 mt-1">
                &lt; délai = comptable · &gt; délai = directeur · après clôture = promoteur
              </p>
            </div>
          </div>

          {/* Fedapay */}
          <div className="bg-white rounded-lg border p-5">
            <h3 className="font-semibold mb-3 text-slate-900">Paiement en ligne (Fedapay)</h3>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="fedapayEnabled"
                  checked={form.fedapayEnabled}
                  onChange={(e) => setForm((f) => ({ ...f, fedapayEnabled: e.target.checked }))}
                  className="w-4 h-4"
                />
                <Label htmlFor="fedapayEnabled">Activer Fedapay</Label>
              </div>
              <div>
                <Label>Clé publique</Label>
                <Input
                  value={form.fedapayPublicKey}
                  onChange={(e) => setForm((f) => ({ ...f, fedapayPublicKey: e.target.value }))}
                  placeholder="pk_..."
                />
              </div>
              <div>
                <Label>Clé secrète</Label>
                {existingMaskedKey && (
                  <p className="text-xs text-slate-500 mb-1">
                    Clé actuelle : <code className="bg-slate-100 px-1 rounded">{existingMaskedKey}</code>
                  </p>
                )}
                <Input
                  type="password"
                  value={form.fedapaySecretKey}
                  onChange={(e) => setForm((f) => ({ ...f, fedapaySecretKey: e.target.value }))}
                  placeholder="Laisser vide pour ne pas modifier"
                />
                <p className="text-xs text-slate-500 mt-1">
                  🔒 La clé est chiffrée en base (AES-256-GCM).
                </p>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={saving} size="lg">
              {saving ? 'Enregistrement…' : 'Enregistrer les paramètres'}
            </Button>
          </div>
        </div>
      </ModuleContentArea>
    </div>
  );
}
