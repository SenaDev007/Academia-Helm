/**
 * SOUS-MODULE 8 — Paramétrage financier (FinancialSettings)
 * ============================================================================
 * Refactor 2026-07-05 — Layout pleine largeur, grille 2 colonnes,
 * design moderne avec cartes à header gradient, badges colorés, toggles
 * animés. Tous les appels backend (financeService.*) préservés.
 *
 * Sections :
 *  1. 🧠 ORION — Surveillance des changements critiques (bandeau compact full-width)
 *  2. Grille 2 colonnes :
 *     - 🔒 Blocage & Recouvrement
 *     - 💳 Paiement
 *     - 🏦 Clôture journalière
 *     - 📊 Budget & Alertes
 *     - ⏱️ Annulation
 *  3. 🌐 Paiements en ligne (FeexPay/Fedapay) — PaymentConfigSection
 *  4. 📜 Historique des modifications (audit logs)
 *  5. Barre de sauvegarde sticky
 * ============================================================================
 */
'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  ShieldCheck,
  AlertTriangle,
  AlertCircle,
  Info,
  History,
  CreditCard,
  Lock,
  Clock,
  TrendingUp,
  Save,
  RotateCw,
} from 'lucide-react';
import { ModuleContentArea } from '@/components/modules/blueprint';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { financeService } from '@/services/finance.service';
import { useToast } from '@/components/ui/use-toast';
import { useAppSession } from '@/contexts/AppSessionContext';
import { cn } from '@/lib/utils';
import PaymentConfigSection from './PaymentConfigSection';

/* ------------------------------------------------------------------ */
/*  Constantes de configuration visuelle                               */
/* ------------------------------------------------------------------ */

const SEVERITY_CONFIG = {
  CRITICAL: {
    icon: AlertCircle,
    color: 'text-rose-600',
    bg: 'bg-rose-50',
    border: 'border-rose-200',
    label: 'Critique',
  },
  WARNING: {
    icon: AlertTriangle,
    color: 'text-amber-600',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    label: 'Avertissement',
  },
  INFO: {
    icon: Info,
    color: 'text-blue-600',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    label: 'Info',
  },
} as const;

const STATUS_CONFIG = {
  GREEN: {
    label: 'Aucun changement critique récent',
    color: 'text-emerald-700',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    icon: ShieldCheck,
    accent: 'from-emerald-500 to-emerald-600',
  },
  ORANGE: {
    label: 'Changements modérés détectés',
    color: 'text-amber-700',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    icon: AlertTriangle,
    accent: 'from-amber-500 to-amber-600',
  },
  RED: {
    label: 'Changements critiques détectés',
    color: 'text-rose-700',
    bg: 'bg-rose-50',
    border: 'border-rose-200',
    icon: AlertCircle,
    accent: 'from-rose-500 to-rose-600',
  },
} as const;

/* ------------------------------------------------------------------ */
/*  Sous-composants UI                                                 */
/* ------------------------------------------------------------------ */

/**
 * Carte de section paramètres — header coloré + corps.
 * Remplace l'ancien pattern `<div className="bg-white rounded-xl border p-5">`.
 */
function SettingsCard({
  icon: Icon,
  iconColor,
  iconBg,
  title,
  description,
  children,
  className,
}: {
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
  iconBg: string;
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        'bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col',
        className,
      )}
    >
      <header className="px-5 py-4 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white flex items-start gap-3">
        <div
          className={cn(
            'flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center shadow-sm',
            iconBg,
          )}
        >
          <Icon className={cn('w-5 h-5', iconColor)} />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-slate-900 leading-tight">{title}</h3>
          {description && (
            <p className="text-xs text-slate-500 mt-0.5 leading-snug">{description}</p>
          )}
        </div>
      </header>
      <div className="p-5 flex-1">{children}</div>
    </section>
  );
}

/**
 * Switch animé — remplace les checkboxes basiques.
 */
function ToggleSwitch({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <label className="flex items-start gap-3 cursor-pointer group">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2',
          checked ? 'bg-indigo-600' : 'bg-slate-300',
        )}
      >
        <span
          className={cn(
            'inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform duration-200',
            checked ? 'translate-x-5' : 'translate-x-0.5',
          )}
        />
      </button>
      <div className="min-w-0">
        <p className="text-sm font-medium text-slate-800 group-hover:text-slate-900">{label}</p>
        {description && <p className="text-xs text-slate-500 mt-0.5">{description}</p>}
      </div>
    </label>
  );
}

/**
 * Champ de formulaire standardisé — label + input + hint optionnel.
 */
function FormField({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-slate-700 uppercase tracking-wide">
        {label}
      </Label>
      {children}
      {hint && <p className="text-xs text-slate-500 leading-snug">{hint}</p>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Composant principal                                                */
/* ------------------------------------------------------------------ */

export default function FinanceSettingsContent() {
  const { toast } = useToast();
  const { tenant } = useAppSession();
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
    // Fedapay legacy — conservé pour compat BDD mais l'UI active est PaymentConfigSection
    fedapayEnabled: false,
    fedapayPublicKey: '',
    fedapaySecretKey: '',
  });
  const [existingMaskedKey, setExistingMaskedKey] = useState<string>('');
  const [history, setHistory] = useState<any[]>([]);
  const [orionAlerts, setOrionAlerts] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  /* --------------------------- Data loading --------------------------- */

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [s, hist, orion] = await Promise.all([
          financeService.getSettings(),
          financeService.getSettingsHistory(),
          financeService.getSettingsOrionAlerts(),
        ]);
        if (cancelled) return;
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
        setHistory(Array.isArray(hist) ? hist : []);
        setOrionAlerts(orion ?? null);
      } catch (e) {
        console.error('Failed to load finance settings', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
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

  /* ------------------------------ Actions ----------------------------- */

  const handleSave = async () => {
    setSaving(true);
    try {
      await financeService.updateSettings({
        blockingThreshold: form.blockingThreshold ? Number(form.blockingThreshold) : undefined,
        reminderWarningDays: form.reminderWarningDays
          ? Number(form.reminderWarningDays)
          : undefined,
        reminderUrgentDays: form.reminderUrgentDays ? Number(form.reminderUrgentDays) : undefined,
        reminderFinalDays: form.reminderFinalDays ? Number(form.reminderFinalDays) : undefined,
        autoClosureEnabled: form.autoClosureEnabled,
        autoClosureTime: form.autoClosureTime,
        budgetAlertThreshold: form.budgetAlertThreshold
          ? Number(form.budgetAlertThreshold)
          : undefined,
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

  /* --------------------------- Derived state -------------------------- */

  const orionStatus = useMemo(
    () =>
      orionAlerts?.status
        ? STATUS_CONFIG[orionAlerts.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.GREEN
        : STATUS_CONFIG.GREEN,
    [orionAlerts],
  );
  const OrionIcon = orionStatus.icon;

  /* ------------------------------ Render ------------------------------ */

  return (
    <div className="space-y-6">
      <ModuleContentArea
        layout="custom"
        toolbar={
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Paramètres financiers
              </h2>
              <p className="text-sm text-slate-500">
                Configuration générale du module Finance — blocage, relances, clôture, budget,
                paiements en ligne.
              </p>
            </div>
            <Button
              onClick={handleSave}
              disabled={saving || loading}
              className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm"
            >
              {saving ? (
                <>
                  <RotateCw className="w-4 h-4 mr-2 animate-spin" />
                  Enregistrement…
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Enregistrer
                </>
              )}
            </Button>
          </div>
        }
      >
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <RotateCw className="w-8 h-8 animate-spin text-indigo-500" />
            <span className="ml-3 text-slate-600">Chargement des paramètres…</span>
          </div>
        ) : (
          <div className="space-y-6">
            {/* ========================================================== */}
            {/* 1. BANDEAU ORION — Surveillance pleine largeur             */}
            {/* ========================================================== */}
            {orionAlerts && (
              <div
                className={cn(
                  'rounded-2xl border p-5 shadow-sm',
                  orionStatus.bg,
                  orionStatus.border,
                )}
              >
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                  {/* Titre + statut */}
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        'flex-shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br flex items-center justify-center shadow-md',
                        orionStatus.accent,
                      )}
                    >
                      <OrionIcon className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className={cn('font-bold flex items-center gap-2', orionStatus.color)}>
                        ORION — Surveillance Paramétrage
                      </h3>
                      <p className="text-sm text-slate-700">{orionStatus.label}</p>
                    </div>
                  </div>

                  {/* Stats inline (4 cartes) */}
                  {orionAlerts.stats?.total > 0 && (
                    <div className="grid grid-cols-4 gap-2 lg:gap-3">
                      <div className="bg-white rounded-lg p-2.5 border border-rose-200 text-center min-w-[64px]">
                        <p className="text-xl font-bold text-rose-600">
                          {orionAlerts.stats.critical}
                        </p>
                        <p className="text-[10px] uppercase tracking-wide text-slate-500 font-medium">
                          Critiques
                        </p>
                      </div>
                      <div className="bg-white rounded-lg p-2.5 border border-amber-200 text-center min-w-[64px]">
                        <p className="text-xl font-bold text-amber-600">
                          {orionAlerts.stats.warning}
                        </p>
                        <p className="text-[10px] uppercase tracking-wide text-slate-500 font-medium">
                          Avertissements
                        </p>
                      </div>
                      <div className="bg-white rounded-lg p-2.5 border border-blue-200 text-center min-w-[64px]">
                        <p className="text-xl font-bold text-blue-600">
                          {orionAlerts.stats.info}
                        </p>
                        <p className="text-[10px] uppercase tracking-wide text-slate-500 font-medium">
                          Infos
                        </p>
                      </div>
                      <div className="bg-white rounded-lg p-2.5 border border-slate-200 text-center min-w-[64px]">
                        <p className="text-xl font-bold text-slate-700">
                          {orionAlerts.stats.total}
                        </p>
                        <p className="text-[10px] uppercase tracking-wide text-slate-500 font-medium">
                          Total
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Alertes détaillées */}
                {orionAlerts.stats?.total > 0 && (
                  <ul className="mt-4 space-y-2">
                    {orionAlerts.alerts.slice(0, 5).map((alert: any, idx: number) => {
                      const cfg =
                        SEVERITY_CONFIG[
                          alert.severity as keyof typeof SEVERITY_CONFIG
                        ] ?? SEVERITY_CONFIG.INFO;
                      const AlertIcon = cfg.icon;
                      return (
                        <li
                          key={idx}
                          className={cn(
                            'flex items-start gap-2.5 text-sm bg-white/70 rounded-lg p-2.5 border',
                            cfg.border,
                          )}
                        >
                          <AlertIcon className={cn('w-4 h-4 mt-0.5 flex-shrink-0', cfg.color)} />
                          <div className="min-w-0 flex-1">
                            <p className={cn('font-medium', cfg.color)}>{alert.message}</p>
                            <p className="text-xs text-slate-500 mt-0.5">
                              {new Date(alert.date).toLocaleDateString('fr-FR', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                              {alert.performedBy ? ` · par ${alert.performedBy}` : ''}
                            </p>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}

                {orionAlerts.stats?.total === 0 && (
                  <p className="mt-3 text-sm text-slate-700">
                    🟢 Aucun changement critique récent. Les paramètres financiers sont stables.
                  </p>
                )}
              </div>
            )}

            {/* ========================================================== */}
            {/* 2. GRILLE 2 COLONNES — Cartes de configuration              */}
            {/* ========================================================== */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* ---- Blocage & Recouvrement ---- */}
              <SettingsCard
                icon={Lock}
                iconColor="text-rose-600"
                iconBg="bg-rose-100"
                title="Blocage & Recouvrement"
                description="Seuil de blocage automatique et cycles de relance"
              >
                <div className="space-y-4">
                  <FormField
                    label="Seuil de blocage (XOF)"
                    hint="Solde à partir duquel l'élève est automatiquement bloqué. Laisser vide pour désactiver."
                  >
                    <Input
                      type="number"
                      value={form.blockingThreshold}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, blockingThreshold: e.target.value }))
                      }
                      placeholder="0"
                      className="w-full"
                    />
                  </FormField>

                  <div>
                    <Label className="text-xs font-medium text-slate-700 uppercase tracking-wide mb-2 block">
                      Jours de relance
                    </Label>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <Label className="text-[11px] text-amber-600 font-semibold mb-1 block">
                          Warning
                        </Label>
                        <Input
                          type="number"
                          value={form.reminderWarningDays}
                          onChange={(e) =>
                            setForm((f) => ({ ...f, reminderWarningDays: e.target.value }))
                          }
                          className="w-full"
                        />
                        <p className="text-[10px] text-slate-400 mt-0.5">J+3</p>
                      </div>
                      <div>
                        <Label className="text-[11px] text-orange-600 font-semibold mb-1 block">
                          Urgent
                        </Label>
                        <Input
                          type="number"
                          value={form.reminderUrgentDays}
                          onChange={(e) =>
                            setForm((f) => ({ ...f, reminderUrgentDays: e.target.value }))
                          }
                          className="w-full"
                        />
                        <p className="text-[10px] text-slate-400 mt-0.5">J+7</p>
                      </div>
                      <div>
                        <Label className="text-[11px] text-rose-600 font-semibold mb-1 block">
                          Final
                        </Label>
                        <Input
                          type="number"
                          value={form.reminderFinalDays}
                          onChange={(e) =>
                            setForm((f) => ({ ...f, reminderFinalDays: e.target.value }))
                          }
                          className="w-full"
                        />
                        <p className="text-[10px] text-slate-400 mt-0.5">J+15</p>
                      </div>
                    </div>
                  </div>
                </div>
              </SettingsCard>

              {/* ---- Paiement ---- */}
              <SettingsCard
                icon={CreditCard}
                iconColor="text-indigo-600"
                iconBg="bg-indigo-100"
                title="Paiement"
                description="Paiements partiels et montant minimum"
              >
                <div className="space-y-4">
                  <ToggleSwitch
                    checked={form.allowPartialPayment}
                    onChange={(v) => setForm((f) => ({ ...f, allowPartialPayment: v }))}
                    label="Paiement partiel autorisé"
                    description="Autorise les parents à payer en plusieurs fois, sans respecter l'ordre des tranches."
                  />
                  <FormField
                    label="Montant minimum par paiement (XOF)"
                    hint="Laisser vide pour aucun minimum. S'applique à chaque transaction."
                  >
                    <Input
                      type="number"
                      value={form.minimumInstallmentAmount}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, minimumInstallmentAmount: e.target.value }))
                      }
                      placeholder="Optionnel"
                      className="w-full"
                    />
                  </FormField>
                </div>
              </SettingsCard>

              {/* ---- Clôture journalière ---- */}
              <SettingsCard
                icon={Clock}
                iconColor="text-amber-600"
                iconBg="bg-amber-100"
                title="Clôture journalière"
                description="Clôture automatique des caisses à heure fixe"
              >
                <div className="space-y-4">
                  <ToggleSwitch
                    checked={form.autoClosureEnabled}
                    onChange={(v) => setForm((f) => ({ ...f, autoClosureEnabled: v }))}
                    label="Clôture automatique activée"
                    description="Le cron ferme chaque soir les caisses ouvertes à l'heure configurée."
                  />
                  <FormField label="Heure de clôture auto" hint="Format 24h — ex : 23:59">
                    <Input
                      type="time"
                      value={form.autoClosureTime}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, autoClosureTime: e.target.value }))
                      }
                      className="w-full"
                    />
                  </FormField>
                </div>
              </SettingsCard>

              {/* ---- Budget ---- */}
              <SettingsCard
                icon={TrendingUp}
                iconColor="text-blue-600"
                iconBg="bg-blue-100"
                title="Budget & Alertes"
                description="Seuil de déclenchement des alertes ORION"
              >
                <FormField
                  label="Seuil d'alerte budget (%)"
                  hint="ORION déclenche une alerte quand une catégorie de dépense atteint ce pourcentage du budget alloué."
                >
                  <div className="relative">
                    <Input
                      type="number"
                      min={1}
                      max={100}
                      value={form.budgetAlertThreshold}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, budgetAlertThreshold: e.target.value }))
                      }
                      placeholder="85"
                      className="w-full pr-10"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
                      %
                    </span>
                  </div>
                </FormField>

                {/* Barre de visualisation du seuil */}
                <div className="mt-4">
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-300"
                      style={{
                        width: `${Math.min(
                          100,
                          Math.max(0, Number(form.budgetAlertThreshold) || 0),
                        )}%`,
                      }}
                    />
                  </div>
                  <p className="text-xs text-slate-500 mt-1.5 text-right">
                    Alerte à {form.budgetAlertThreshold || 0}% du budget
                  </p>
                </div>
              </SettingsCard>

              {/* ---- Annulation ---- */}
              <SettingsCard
                icon={AlertCircle}
                iconColor="text-orange-600"
                iconBg="bg-orange-100"
                title="Annulation des transactions"
                description="Délai avant escalation des droits d'annulation"
                className="lg:col-span-2"
              >
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FormField label="Délai d'annulation (heures)">
                    <Input
                      type="number"
                      value={form.cancellationDelayHours}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, cancellationDelayHours: e.target.value }))
                      }
                      className="w-full"
                    />
                  </FormField>
                  <div className="md:col-span-2 bg-slate-50 rounded-xl border border-slate-200 p-4">
                    <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-2">
                      Échelle des droits d'annulation
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                      <div className="flex items-start gap-2 bg-white rounded-lg p-2.5 border border-emerald-200">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 mt-1 flex-shrink-0" />
                        <div>
                          <p className="font-semibold text-emerald-700">Comptable</p>
                          <p className="text-slate-600">Avant le délai</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2 bg-white rounded-lg p-2.5 border border-amber-200">
                        <span className="w-2 h-2 rounded-full bg-amber-500 mt-1 flex-shrink-0" />
                        <div>
                          <p className="font-semibold text-amber-700">Directeur</p>
                          <p className="text-slate-600">Après le délai</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2 bg-white rounded-lg p-2.5 border border-rose-200">
                        <span className="w-2 h-2 rounded-full bg-rose-500 mt-1 flex-shrink-0" />
                        <div>
                          <p className="font-semibold text-rose-700">Promoteur</p>
                          <p className="text-slate-600">Après clôture</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </SettingsCard>
            </div>

            {/* ========================================================== */}
            {/* 3. PAIEMENTS EN LIGNE — FeexPay / Fedapay (pleine largeur)  */}
            {/* ========================================================== */}
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <header className="px-5 py-4 border-b border-slate-100 bg-gradient-to-r from-violet-50 to-white flex items-start gap-3">
                <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center shadow-sm">
                  <CreditCard className="w-5 h-5 text-violet-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900">
                    Paiements en ligne — Configuration par établissement
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Chaque école configure son propre compte FeexPay ou Fedapay. Les fonds sont
                    versés directement sur le compte de l'établissement.
                  </p>
                </div>
              </header>
              <div className="p-5">
                <PaymentConfigSection tenantId={tenant?.id || ''} />
              </div>
            </div>

            {/* ========================================================== */}
            {/* 4. HISTORIQUE — Pleine largeur                              */}
            {/* ========================================================== */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <header className="px-5 py-4 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white flex items-start gap-3">
                <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-slate-200 flex items-center justify-center shadow-sm">
                  <History className="w-5 h-5 text-slate-700" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-slate-900">Historique des modifications</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Audit complet des changements appliqués aux paramètres financiers.
                  </p>
                </div>
                <Badge variant="outline" className="text-xs">
                  {history.length} entrée{history.length > 1 ? 's' : ''}
                </Badge>
              </header>
              <div className="p-5">
                {history.length === 0 ? (
                  <div className="text-center py-8">
                    <History className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                    <p className="text-sm text-slate-500 italic">
                      Aucune modification enregistrée pour le moment.
                    </p>
                  </div>
                ) : (
                  <ul className="space-y-3">
                    {history.slice(0, 15).map((h) => (
                      <li
                        key={h.id}
                        className="border-l-2 border-slate-200 hover:border-indigo-400 transition-colors pl-4 py-2 group"
                      >
                        <div className="flex items-center justify-between gap-2 mb-1 flex-wrap">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="outline" className="text-xs font-mono">
                              {h.action}
                            </Badge>
                            {h.performedBy && (
                              <span className="text-xs text-slate-600">
                                par{' '}
                                <strong className="text-slate-800">
                                  {h.performedBy.name}
                                </strong>
                                {h.performedBy.role ? ` (${h.performedBy.role})` : ''}
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-slate-400 font-mono">
                            {new Date(h.performedAt).toLocaleDateString('fr-FR', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>

                        {h.criticalChanges && h.criticalChanges.length > 0 && (
                          <ul className="space-y-1 mt-2">
                            {h.criticalChanges.map((c: any, idx: number) => {
                              const cfg =
                                SEVERITY_CONFIG[
                                  c.severity as keyof typeof SEVERITY_CONFIG
                                ] ?? SEVERITY_CONFIG.INFO;
                              const AlertIcon = cfg.icon;
                              return (
                                <li
                                  key={idx}
                                  className={cn(
                                    'flex items-start gap-2 text-xs p-1.5 rounded',
                                    cfg.bg,
                                    cfg.color,
                                  )}
                                >
                                  <AlertIcon className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                                  <span>{c.message}</span>
                                </li>
                              );
                            })}
                          </ul>
                        )}

                        {h.oldValue && h.newValue && (
                          <div className="text-xs text-slate-500 mt-2">
                            {Object.keys(h.newValue).filter(
                              (k) => k !== 'fedapaySecretKeyUpdated',
                            ).length > 0 && (
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="text-slate-600">Champs modifiés :</span>
                                {Object.keys(h.newValue)
                                  .filter((k) => k !== 'fedapaySecretKeyUpdated')
                                  .map((k) => (
                                    <span
                                      key={k}
                                      className="inline-flex items-center px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-700 font-mono text-[10px]"
                                    >
                                      {k}
                                    </span>
                                  ))}
                              </div>
                            )}
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        )}
      </ModuleContentArea>
    </div>
  );
}
