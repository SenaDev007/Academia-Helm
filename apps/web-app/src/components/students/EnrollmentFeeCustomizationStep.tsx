'use client';

/**
 * ============================================================================
 * ÉTAPE « PERSONNALISATION DES FRAIS » — flux post-inscription (sept. 2026)
 * ============================================================================
 *
 * ⭐ Intègre la personnalisation du module Finance (onglet
 *    « Personnalisations ») DANS l'onboarding d'inscription du module
 *    Élèves & Scolarité : juste après le choix de la classe physique et la
 *    création de l'inscription, la secrétaire peut appliquer des réductions
 *    (bourse, cas social, remise…) sur les frais d'INSCRIPTION ou de
 *    SCOLARITÉ de l'élève — sans quitter le flux.
 *
 *    - Les lignes de frais proviennent du COMPTE FINANCIER de l'élève
 *      (getOrCreate) → exactement ce qui lui sera facturé (classe physique,
 *      classe officielle, régime tarifaire… déjà pris en compte côté backend).
 *    - Réductions en % OU en montant (FCFA) — même logique de calcul auto
 *      que FeeOverrideModal (module Finance).
 *    - Motif obligatoire (partagé par toutes les réductions de l'étape).
 *    - Étape 100 % SKIPPABLE : « Passer cette étape » → paiement direct.
 *    - Chaque réduction est envoyée via POST /finance/fee-structures/override
 *      (upsert + recalcul synchrone du compte) → le modal de paiement qui
 *      suit affiche immédiatement les montants personnalisés.
 *
 *    Séquentiel volontaire : les overrides sont envoyés UN PAR UN car chacun
 *    déclenche un recalcul du compte côté backend (écritures concurrentes
 *    sur les mêmes breakdowns à éviter).
 */

import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  CheckCircle2, Loader2, Calculator, ArrowRight, SkipForward,
  AlertCircle, User, GraduationCap, Layers, RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { financeService } from '@/services/finance.service';
import { formatCurrency } from '@/lib/utils';
import type { PostEnrollmentFlowData } from './PostEnrollmentFlow';

const FEE_TYPE_LABELS: Record<string, string> = {
  INSCRIPTION: 'Inscription',
  REINSCRIPTION: 'Réinscription',
  TUITION: 'Scolarité',
  CANTEEN: 'Cantine',
  EXAMEN: "Frais d'examen",
  GENERAL: 'Frais généraux',
  OTHER: 'Autre',
};

const FEE_TYPE_BADGE: Record<string, string> = {
  INSCRIPTION: 'bg-blue-100 text-blue-700 border-blue-200',
  REINSCRIPTION: 'bg-blue-100 text-blue-700 border-blue-200',
  TUITION: 'bg-violet-100 text-violet-700 border-violet-200',
  CANTEEN: 'bg-orange-100 text-orange-700 border-orange-200',
  EXAMEN: 'bg-amber-100 text-amber-700 border-amber-200',
  GENERAL: 'bg-teal-100 text-teal-700 border-teal-200',
  OTHER: 'bg-slate-100 text-slate-700 border-slate-200',
};

// Ordre d'affichage des lignes (identique au modal de paiement)
const PRIORITY_ORDER = ['INSCRIPTION', 'REINSCRIPTION', 'TUITION', 'CANTEEN', 'EXAMEN', 'GENERAL', 'OTHER'];

interface FeeLine {
  feeStructureId: string;
  name: string;
  feeType: string;
  /** Montant actuellement facturé (régime tarifaire inclus) */
  initial: number;
  remaining: number;
}

export default function EnrollmentFeeCustomizationStep({
  flow,
  academicYearId,
  physicalClassName,
  onClose,
  onSkip,
  onDone,
  onRefresh,
}: {
  flow: PostEnrollmentFlowData;
  academicYearId: string;
  /** Classe physique affectée à l'étape précédente (affichage uniquement) */
  physicalClassName?: string | null;
  onClose: () => void;
  /** Skip : passer la personnalisation → paiement direct */
  onSkip: () => void;
  /** Réductions appliquées avec succès → paiement */
  onDone: () => void;
  onRefresh?: () => void;
}) {
  const { toast } = useToast();
  const [account, setAccount] = useState<any | null>(null);
  // ⭐ Initial "true" : le premier chargement démarre dès le montage — pas
  //    besoin de setState synchrone dans l'effet (règle react-hooks v6).
  const [loadingAccount, setLoadingAccount] = useState(true);
  const [accountError, setAccountError] = useState<string | null>(null);
  /** Incrémenté par le bouton « Réessayer » pour re-déclencher l'effet */
  const [reloadTick, setReloadTick] = useState(0);
  /** Réduction par ligne, indexée par feeStructureId — saisie en FCFA */
  const [reductionAmounts, setReductionAmounts] = useState<Record<string, string>>({});
  /** Réduction par ligne, saisie en % (synchronisée avec le FCFA) */
  const [reductionPercents, setReductionPercents] = useState<Record<string, string>>({});
  /** Motif partagé par toutes les réductions de l'étape */
  const [reason, setReason] = useState('');
  const [applying, setApplying] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);

  const studentFullName = `${flow.firstName} ${flow.lastName}`;

  // ─── Chargement du compte financier de l'élève (getOrCreate) ───
  //     Les breakdowns donnent EXACTEMENT les frais qui seront facturés à
  //     l'élève (périmètre classe/niveau + filtres enrollmentType faits
  //     côté backend au moment de l'admission / affectation).
  //     ⚗️ Les setState vivent uniquement dans les callbacks de promesse
  //     (asynchrones) — jamais en synchrone dans le corps de l'effet.
  useEffect(() => {
    if (!flow.studentId || !academicYearId) return;
    let cancelled = false;
    financeService.getStudentAccountByStudentId(flow.studentId, academicYearId)
      .then((res: any) => {
        if (cancelled) return;
        const acc = res?.account ?? res;
        if (!acc?.id) throw new Error('Compte financier introuvable pour cet élève.');
        setAccount(acc);
      })
      .catch((e: any) => {
        if (cancelled) return;
        setAccountError(e?.message || 'Impossible de charger le compte de l\'élève.');
      })
      .finally(() => {
        if (!cancelled) setLoadingAccount(false);
      });
    return () => { cancelled = true; };
  }, [flow.studentId, academicYearId, reloadTick]);

  /** Bouton « Réessayer » — handler d'évènement, setState direct autorisé */
  const reloadAccount = () => {
    setAccount(null);
    setAccountError(null);
    setLoadingAccount(true);
    setReloadTick((t) => t + 1);
  };

  // ─── Lignes de frais non soldées (tri identique au modal de paiement) ───
  const feeLines: FeeLine[] = useMemo(() => {
    const breakdowns: any[] = account?.breakdowns ?? [];
    return breakdowns
      .filter((b: any) => Number(b.remainingAmount ?? 0) > 0)
      .map((b: any) => ({
        feeStructureId: b.feeStructureId ?? b.feeStructure?.id,
        name: b.feeStructure?.name ?? 'Frais',
        feeType: b.feeStructure?.feeType ?? 'OTHER',
        initial: Number(b.initialAmount ?? 0),
        remaining: Number(b.remainingAmount ?? 0),
      }))
      .filter((l: FeeLine) => Boolean(l.feeStructureId))
      .sort((a: FeeLine, b: FeeLine) => {
        const ia = PRIORITY_ORDER.indexOf(a.feeType);
        const ib = PRIORITY_ORDER.indexOf(b.feeType);
        return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
      });
  }, [account]);

  // ─── Helpers réductions (même logique de calcul auto que FeeOverrideModal) ───
  const reductionOf = (line: FeeLine): number => {
    const raw = parseFloat(reductionAmounts[line.feeStructureId] ?? '');
    if (isNaN(raw) || raw < 0) return 0;
    return Math.min(raw, line.initial);
  };

  const finalAmountOf = (line: FeeLine): number => Math.max(0, line.initial - reductionOf(line));

  const hasActiveReduction = (line: FeeLine): boolean => reductionOf(line) > 0;

  // ⚗️ Dépendances INLINE dans les useMemo (pas de référence de fonction du
  //    corps du composant — règle react-hooks/preserve-manual-memoization).
  const activeLines = useMemo(
    () => feeLines.filter((l) => {
      const raw = parseFloat(reductionAmounts[l.feeStructureId] ?? '');
      return !isNaN(raw) && raw > 0;
    }),
    [feeLines, reductionAmounts],
  );

  // Saisie de la réduction en MONTANT → % recalculé automatiquement
  const handleAmountChange = (line: FeeLine, v: string) => {
    setReductionAmounts((prev) => ({ ...prev, [line.feeStructureId]: v }));
    const amt = parseFloat(v);
    const pct = (!isNaN(amt) && amt >= 0 && line.initial > 0)
      ? ((Math.min(amt, line.initial) / line.initial) * 100).toFixed(2)
      : '';
    setReductionPercents((prev) => ({ ...prev, [line.feeStructureId]: pct }));
    setApplyError(null);
  };

  // Saisie de la réduction en % → montant recalculé automatiquement
  const handlePercentChange = (line: FeeLine, v: string) => {
    setReductionPercents((prev) => ({ ...prev, [line.feeStructureId]: v }));
    const pct = parseFloat(v);
    if (isNaN(pct) || pct < 0 || pct > 100 || line.initial <= 0) {
      setReductionAmounts((prev) => ({ ...prev, [line.feeStructureId]: '' }));
      return;
    }
    const amt = Math.round((line.initial * pct) / 100);
    setReductionAmounts((prev) => ({ ...prev, [line.feeStructureId]: String(amt) }));
    setApplyError(null);
  };

  // ─── Totaux de l'étape ───
  const totalInitial = useMemo(() => feeLines.reduce((s, l) => s + l.initial, 0), [feeLines]);
  const totalReduction = useMemo(
    () => feeLines.reduce((s, l) => {
      const raw = parseFloat(reductionAmounts[l.feeStructureId] ?? '');
      return s + (isNaN(raw) || raw < 0 ? 0 : Math.min(raw, l.initial));
    }, 0),
    [feeLines, reductionAmounts],
  );
  const totalFinal = totalInitial - totalReduction;

  // ─── Application : un override par ligne réduite (séquentiel) ───
  const handleApply = async () => {
    if (activeLines.length === 0) {
      setApplyError('Saisissez au moins une réduction, ou passez cette étape.');
      return;
    }
    if (!reason.trim()) {
      setApplyError('Le motif est obligatoire pour appliquer une réduction (traçabilité comptable).');
      return;
    }
    setApplying(true);
    setApplyError(null);
    const failures: string[] = [];
    for (const line of activeLines) {
      const customAmount = finalAmountOf(line);
      try {
        // Upsert côté backend + recalcul synchrone du compte élève
        await financeService.overrideFeeStructure({
          studentId: flow.studentId,
          feeStructureId: line.feeStructureId,
          customAmount,
          reason: reason.trim(),
        });
      } catch {
        failures.push(line.name);
      }
    }
    setApplying(false);
    if (failures.length > 0) {
      const msg = `${failures.length} personnalisation(s) ont échoué : ${failures.join(', ')}.`;
      setApplyError(`${msg} Réessayez ou passez cette étape.`);
      toast({
        title: '⚠️ Personnalisation partielle',
        description: msg,
        variant: 'error',
      });
      return;
    }
    toast({
      title: '✅ Frais personnalisés',
      description: `${activeLines.length} frais ajusté(s) pour ${studentFullName}. Le compte a été recalculé.`,
      variant: 'success',
    });
    onRefresh?.();
    onDone();
  };

  // ─── Rendu ───
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-[2px] flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.99 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.22, ease: 'easeOut' }}
        className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-emerald-100 shadow-2xl"
      >
        {/* Bandeau succès inscription (continuité avec l'étape d'affectation) */}
        <div className="px-5 pt-5 pb-4 bg-gradient-to-br from-emerald-50 to-teal-50 border-b border-emerald-100">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-bold text-slate-800">Inscription enregistrée</p>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600 mt-1">
                <span className="font-semibold">{flow.lastName.toUpperCase()} {flow.firstName}</span>
                {flow.matricule && (
                  <span className="flex items-center gap-1"><User className="w-3 h-3" />{flow.matricule}</span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600 mt-0.5">
                {flow.academicClassName && (
                  <span className="flex items-center gap-1">
                    <GraduationCap className="w-3 h-3" />
                    Classe : <span className="font-medium">{flow.academicClassName}</span>
                  </span>
                )}
                {physicalClassName && (
                  <span className="flex items-center gap-1">
                    <Layers className="w-3 h-3" />
                    Section : <span className="font-medium">{physicalClassName}</span>
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Corps : personnalisation des frais */}
        <div className="px-5 py-5">
          <div className="flex items-center gap-2 mb-1">
            <Calculator className="w-4 h-4 text-violet-600" />
            <h4 className="text-sm font-bold text-slate-800">Personnaliser les frais de {flow.firstName}&nbsp;?</h4>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed mb-4">
            Souhaitez-vous appliquer une réduction (bourse, cas social, remise…) sur les frais
            d&apos;inscription ou de scolarité de {flow.firstName}&nbsp;? Cette étape est{' '}
            <span className="font-semibold">facultative</span> — sans personnalisation, les montants
            standards s&apos;appliquent. Vous pourrez aussi l&apos;ajuster plus tard dans{' '}
            Finance → Personnalisations. Après cette étape, l&apos;encaissement s&apos;ouvrira automatiquement.
          </p>

          {loadingAccount ? (
            <div className="flex items-center justify-center gap-2 py-10 text-slate-400">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-sm">Chargement des frais de l&apos;élève…</span>
            </div>
          ) : accountError ? (
            <div className="space-y-3">
              <p className="text-xs text-amber-600 flex items-start gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                <span>
                  {accountError} Vous pouvez réessayer, ou passer cette étape — la personnalisation
                  restera disponible dans Finance → Personnalisations.
                </span>
              </p>
              <Button type="button" variant="outline" size="sm" onClick={reloadAccount}>
                <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                Réessayer
              </Button>
            </div>
          ) : feeLines.length === 0 ? (
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-6 text-center">
              <p className="text-sm text-slate-600">
                Aucun frais n&apos;est configuré pour cette classe / cette année académique.
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Passez cette étape — les frais pourront être créés dans Finance → Configuration des frais.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {feeLines.map((line) => {
                const active = hasActiveReduction(line);
                const badgeCls = FEE_TYPE_BADGE[line.feeType] ?? FEE_TYPE_BADGE.OTHER;
                return (
                  <div
                    key={line.feeStructureId}
                    className={`rounded-lg border p-3 transition-colors ${
                      active ? 'border-violet-300 bg-violet-50/60' : 'border-slate-200 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 shrink-0 ${badgeCls}`}>
                          {FEE_TYPE_LABELS[line.feeType] ?? line.feeType}
                        </Badge>
                        <span className="text-sm font-medium text-slate-800 truncate">{line.name}</span>
                      </div>
                      <span className="text-xs text-slate-500 shrink-0">
                        Initial : <span className="font-semibold text-slate-700">{formatCurrency(line.initial)}</span>
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2 items-end">
                      <div>
                        <Label className="text-[11px] text-slate-500">Réduction (%)</Label>
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          step="0.01"
                          value={reductionPercents[line.feeStructureId] ?? ''}
                          onChange={(e) => handlePercentChange(line, e.target.value)}
                          placeholder="Ex : 10"
                          className="h-9"
                          disabled={applying}
                        />
                      </div>
                      <div>
                        <Label className="text-[11px] text-slate-500">Réduction (F CFA)</Label>
                        <Input
                          type="number"
                          min={0}
                          value={reductionAmounts[line.feeStructureId] ?? ''}
                          onChange={(e) => handleAmountChange(line, e.target.value)}
                          placeholder="Ex : 5000"
                          className="h-9"
                          disabled={applying}
                        />
                      </div>
                      <div className="text-right pb-1">
                        <span className="text-[11px] text-slate-500 block leading-tight">À payer</span>
                        <span className={`text-sm font-bold ${active ? 'text-violet-700' : 'text-slate-700'}`}>
                          {formatCurrency(finalAmountOf(line))}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Récapitulatif global */}
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <span className="text-slate-500 block">Total initial</span>
                    <p className="font-semibold text-slate-700">{formatCurrency(totalInitial)}</p>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Réduction totale</span>
                    <p className="font-semibold text-rose-600">−{formatCurrency(totalReduction)}</p>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Total à payer</span>
                    <p className="font-bold text-emerald-700">{formatCurrency(totalFinal)}</p>
                  </div>
                </div>
              </div>

              {/* Motif partagé */}
              <div>
                <Label className="text-xs">
                  Motif de la personnalisation {activeLines.length > 0 && <span className="text-rose-500">*</span>}
                </Label>
                <Input
                  value={reason}
                  onChange={(e) => { setReason(e.target.value); setApplyError(null); }}
                  placeholder="Ex : bourse, réduction cas social, remise famille…"
                  disabled={applying}
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Le motif est enregistré avec chaque personnalisation (traçabilité comptable —
                  Finance → Personnalisations).
                </p>
              </div>
            </div>
          )}

          {applyError && (
            <p className="text-xs text-rose-600 mt-3 flex items-start gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              {applyError}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="px-5 py-4 bg-slate-50 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={applying}>
            Terminer pour l&apos;instant
          </Button>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" onClick={onSkip} disabled={applying}>
              <SkipForward className="w-4 h-4 mr-1.5" />
              Passer cette étape
            </Button>
            <Button
              type="button"
              onClick={handleApply}
              disabled={applying || feeLines.length === 0 || activeLines.length === 0 || !reason.trim()}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {applying ? (
                <>
                  <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Application…
                </>
              ) : (
                <>
                  Appliquer et encaisser <ArrowRight className="w-4 h-4 ml-1.5" />
                </>
              )}
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
