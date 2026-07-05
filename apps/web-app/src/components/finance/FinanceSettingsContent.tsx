/**
 * SOUS-MODULE 8 — Paramétrage financier (FinancialSettings)
 *
 * Ce composant est utilisé directement par FinanceModulePage.
 * Il NE contient PAS de SubModuleNavigation (géré par ModuleContainer).
 *
 * Sections :
 * 1. 🧠 ORION — Surveillance des changements critiques (statut global + alertes)
 * 2. 🔒 Blocage & Recouvrement
 * 3. 💳 Paiement
 * 4. 🔄 Annulation
 * 5. 🏦 Clôture
 * 6. 📊 Budget
 * 7. 🌐 Paiement en ligne (Fedapay)
 * 8. 📜 Historique des modifications (audit logs)
 */
'use client';

import { useState, useEffect } from 'react';
import { ShieldCheck, AlertTriangle, AlertCircle, Info, History, CreditCard } from 'lucide-react';
import { ModuleContentArea } from '@/components/modules/blueprint';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { financeService } from '@/services/finance.service';
import { useToast } from '@/components/ui/use-toast';
import { formatCurrency } from '@/lib/utils';
import PaymentConfigSection from './PaymentConfigSection';

const SEVERITY_CONFIG = {
  CRITICAL: { icon: AlertCircle, color: 'text-rose-600', bg: 'bg-rose-50', border: 'border-rose-200', label: 'Critique' },
  WARNING: { icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200', label: 'Avertissement' },
  INFO: { icon: Info, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200', label: 'Info' },
};

const STATUS_CONFIG = {
  GREEN: { label: 'Aucun changement critique récent', color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200', icon: ShieldCheck },
  ORANGE: { label: 'Changements modérés détectés', color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200', icon: AlertTriangle },
  RED: { label: 'Changements critiques détectés', color: 'text-rose-600', bg: 'bg-rose-50', border: 'border-rose-200', icon: AlertCircle },
};

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
  const [history, setHistory] = useState<any[]>([]);
  const [orionAlerts, setOrionAlerts] = useState<any>(null);

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
    // Charger l'historique et les alertes ORION
    refreshHistoryAndAlerts();
  }, []);

  const refreshHistoryAndAlerts = async () => {
    try {
      const [hist, orion] = await Promise.all([
        financeService.getSettingsHistory(),
        financeService.getSettingsOrionAlerts(),
      ]);
      setHistory(Array.isArray(hist) ? hist : []);
      setOrionAlerts(orion ?? null);
    } catch (e) {
      console.error('Failed to load history/alerts', e);
    }
  };

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
      // Rafraîchir l'historique et les alertes ORION après modification
      await refreshHistoryAndAlerts();
    } catch (e: any) {
      toast({
        title: 'Erreur',
        description: e?.message || 'Erreur réseau',
        variant: 'destructive',
      });
    }
    setSaving(false);
  };

  const orionStatus = orionAlerts?.status ? STATUS_CONFIG[orionAlerts.status] : STATUS_CONFIG.GREEN;
  const OrionIcon = orionStatus.icon;

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
          {/* 🧠 ORION — Surveillance des changements critiques */}
          {orionAlerts && (
            <div className={`rounded-lg border p-5 ${orionStatus.bg} ${orionStatus.border}`}>
              <div className="flex items-center justify-between mb-3">
                <h3 className={`font-semibold flex items-center gap-2 ${orionStatus.color}`}>
                  <OrionIcon className="w-5 h-5" />
                  ORION — Surveillance Paramétrage
                </h3>
                <Badge className={`${orionStatus.bg} ${orionStatus.color} ${orionStatus.border} border`}>
                  {orionStatus.label}
                </Badge>
              </div>
              {orionAlerts.stats.total === 0 ? (
                <p className="text-sm text-slate-600">
                  🟢 Aucun changement critique récent. Les paramètres financiers sont stables.
                </p>
              ) : (
                <>
                  <div className="grid grid-cols-3 gap-2 mb-3 text-center">
                    <div className="bg-white rounded p-2 border">
                      <p className="text-lg font-bold text-rose-600">{orionAlerts.stats.critical}</p>
                      <p className="text-xs text-slate-500">Critiques</p>
                    </div>
                    <div className="bg-white rounded p-2 border">
                      <p className="text-lg font-bold text-amber-600">{orionAlerts.stats.warning}</p>
                      <p className="text-xs text-slate-500">Avertissements</p>
                    </div>
                    <div className="bg-white rounded p-2 border">
                      <p className="text-lg font-bold text-blue-600">{orionAlerts.stats.info}</p>
                      <p className="text-xs text-slate-500">Infos</p>
                    </div>
                  </div>
                  <ul className="space-y-1.5">
                    {orionAlerts.alerts.slice(0, 5).map((alert: any, idx: number) => {
                      const cfg = SEVERITY_CONFIG[alert.severity as keyof typeof SEVERITY_CONFIG];
                      const AlertIcon = cfg.icon;
                      return (
                        <li key={idx} className={`flex items-start gap-2 text-sm ${cfg.color}`}>
                          <AlertIcon className="w-4 h-4 mt-0.5 flex-shrink-0" />
                          <div className="min-w-0">
                            <p>{alert.message}</p>
                            <p className="text-xs text-slate-400">
                              {new Date(alert.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                              {alert.performedBy ? ` · par ${alert.performedBy}` : ''}
                            </p>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </>
              )}
            </div>
          )}

          {/* 🔒 Blocage & Recouvrement */}
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

          {/* 📜 Historique des modifications */}
          <div className="bg-white rounded-lg border p-5">
            <h3 className="font-semibold mb-3 text-slate-900 flex items-center gap-2">
              <History className="w-5 h-5 text-slate-600" />
              Historique des modifications
            </h3>
            {history.length === 0 ? (
              <p className="text-sm text-slate-500 italic">Aucune modification enregistrée.</p>
            ) : (
              <ul className="space-y-3">
                {history.slice(0, 10).map((h) => (
                  <li key={h.id} className="border-l-2 border-slate-200 pl-3 py-1">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">{h.action}</Badge>
                        {h.performedBy && (
                          <span className="text-xs text-slate-500">
                            par <strong>{h.performedBy.name}</strong>
                            {h.performedBy.role ? ` (${h.performedBy.role})` : ''}
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-slate-400">
                        {new Date(h.performedAt).toLocaleDateString('fr-FR', {
                          day: '2-digit', month: 'short', year: 'numeric',
                          hour: '2-digit', minute: '2-digit',
                        })}
                      </span>
                    </div>
                    {/* Changements détectés */}
                    {h.criticalChanges && h.criticalChanges.length > 0 && (
                      <ul className="space-y-0.5 mt-1">
                        {h.criticalChanges.map((c: any, idx: number) => {
                          const cfg = SEVERITY_CONFIG[c.severity as keyof typeof SEVERITY_CONFIG];
                          return (
                            <li key={idx} className={`text-xs ${cfg.color}`}>{c.message}</li>
                          );
                        })}
                      </ul>
                    )}
                    {/* Détail des valeurs */}
                    {h.oldValue && h.newValue && (
                      <div className="text-xs text-slate-400 mt-1">
                        {Object.keys(h.newValue).filter((k) => k !== 'fedapaySecretKeyUpdated').length > 0 && (
                          <span>
                            Champs modifiés : {Object.keys(h.newValue).filter((k) => k !== 'fedapaySecretKeyUpdated').join(', ')}
                          </span>
                        )}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* === SECTION PAIEMENTS EN LIGNE === */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <PaymentConfigSection tenantId="" />
        </div>
      </ModuleContentArea>
    </div>
  );
}
