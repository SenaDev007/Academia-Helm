'use client';

/**
 * ============================================================================
 * POST-ENROLLMENT FLOW — Chaînage dynamique Inscription → Affectation →
 * Personnalisation → Paiement
 * ============================================================================
 *
 * ⭐ SEPT. 2026 — « C'est trop de gymnastique » : avant, après l'inscription
 * d'un nouvel élève, la secrétaire devait 1) quitter le modal, 2) aller dans
 * l'onglet « Affectations & Mouvements » pour affecter une classe physique,
 * 3) sortir du module Élèves, entrer dans Finance → Encaissements →
 * Nouveau paiement, et 4) RECHERCHER l'élève.
 *
 * Ce composant ouvre AUTOMATIQUEMENT, juste après la finalisation de
 * l'inscription :
 *   Étape 1 — Modal d'affectation vers une classe physique (SKIPPABLE :
 *              « Passer cette étape ») ;
 *   Étape 2 — Modal de PERSONNALISATION des frais (réductions inscription/
 *              scolarité, pattern du module Finance → Personnalisations)
 *              — SKIPPABLE : « Passer cette étape » ;
 *   Étape 3 — Modal de paiement (réutilise NewPaymentModal du module
 *              Finance, préréglé sur l'élève + sa classe officielle + sa
 *              classe physique) — même pattern que « Nouveau paiement ».
 *
 * L'étape d'affectation recalcule le compte financier côté backend
 * (StudentAccountService.recalculate — les frais dépendent de la classe
 * physique), et chaque personnalisation recalcule le compte à nouveau
 * (upsert override) → le modal de paiement ouvre sur les bons montants.
 */

import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  CheckCircle2, Loader2, Layers, GraduationCap, ArrowRight,
  SkipForward, AlertCircle, MapPin, User,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { studentsService } from '@/services/students.service';
import NewPaymentModal from '@/components/finance/NewPaymentModal';
import EnrollmentFeeCustomizationStep from './EnrollmentFeeCustomizationStep';
// ⭐ PERF (sept. 2026) : cache partagé React Query au lieu d'un fetch brut —
//    l'onglet Inscriptions précharge les classes dès son montage (voir
//    EnrollmentsContent), donc ce modal affiche la liste INSTANTANÉMENT
//    (cache chaud) au lieu de re-télécharger /api/all-classes (~30 s perçues
//    en conditions réseau dégradées : cold start fonction Vercel + Neon,
//    timeout 15 s + retry → 30 s). Le refetch d'arrière-plan rafraîchit sans
//    bloquer l'affichage.
import { useAllClasses } from '@/lib/query/use-all-classes';

export interface PostEnrollmentFlowData {
  studentId: string;
  firstName: string;
  lastName: string;
  matricule?: string;
  /** UUID school_levels du niveau de l'élève (filtre des classes physiques) */
  schoolLevelId?: string;
  /** UUID AcademicClass — classe officielle choisie au wizard d'inscription */
  academicClassId?: string;
  academicClassName?: string;
  /** Auto-affectation éventuelle faite par preRegister (section physique unique) */
  preassignedPhysicalClassId?: string | null;
  preassignedPhysicalClassName?: string | null;
}

interface PhysicalClassOption {
  id: string;
  name: string;
  code?: string;
  schoolLevelId?: string;
  officialClassId?: string | null;
}
export default function PostEnrollmentFlow({
  flow,
  academicYearId,
  onClose,
  onRefresh,
}: {
  flow: PostEnrollmentFlowData;
  academicYearId: string;
  onClose: () => void;
  onRefresh?: () => void;
}) {
  const { toast } = useToast();
  // ⭐ Étapes du flux : AFFECTATION (classe physique, skippable) →
  //    CUSTOMIZATION (personnalisation des frais, skippable) → PAYMENT.
  const [step, setStep] = useState<'AFFECTATION' | 'CUSTOMIZATION' | 'PAYMENT'>('AFFECTATION');
  // ⭐ Cache partagé (2 min) + données affichées immédiatement si le cache est
  //    chaud (préchargé par l'onglet Inscriptions pendant que la secrétaire
  //    remplit le wizard — plusieurs minutes d'avance).
  const {
    classes: cachedClasses,
    isLoading: classesLoading,
    isFetching: classesFetching,
    error: classesError,
    refetch: refetchClasses,
  } = useAllClasses({ academicYearId });
  const physicalClasses: PhysicalClassOption[] = useMemo(
    () => cachedClasses.map((c: any) => ({
      id: c.id,
      name: c.name,
      code: c.code,
      schoolLevelId: c.schoolLevelId,
      officialClassId: c.officialClassId ?? null,
    })),
    [cachedClasses],
  );
  const [selectedPhysicalClassId, setSelectedPhysicalClassId] = useState<string>(
    flow.preassignedPhysicalClassId ?? '',
  );
  const [assigning, setAssigning] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);
  /** Classe physique effectivement affectée (nom, pour l'étape paiement) */
  const [assignedPhysicalClassName, setAssignedPhysicalClassName] = useState<string | null>(
    flow.preassignedPhysicalClassName ?? null,
  );

  // Classes physiques du niveau de l'élève — celles rattachées à sa classe
  // officielle en tête (les sections correspondantes), puis les autres du
  // même niveau (flexibilité : la secrétaire peut choisir une autre section).
  const candidateClasses = useMemo(() => {
    if (!flow.schoolLevelId) return physicalClasses;
    const ofLevel = physicalClasses.filter(
      (c) => !c.schoolLevelId || c.schoolLevelId === flow.schoolLevelId,
    );
    return ofLevel.sort((a, b) => {
      const aOfficial = flow.academicClassId && a.officialClassId === flow.academicClassId ? 0 : 1;
      const bOfficial = flow.academicClassId && b.officialClassId === flow.academicClassId ? 0 : 1;
      return aOfficial - bOfficial;
    });
  }, [physicalClasses, flow.schoolLevelId, flow.academicClassId]);

  const selectedClass = candidateClasses.find((c) => c.id === selectedPhysicalClassId);

  const studentFullName = `${flow.firstName} ${flow.lastName}`;

  /** Étape 1 → affecter la classe physique puis passer à la personnalisation */
  const handleAssign = async () => {
    if (!selectedPhysicalClassId) {
      setAssignError('Sélectionnez une classe physique (ou passez cette étape).');
      return;
    }
    setAssigning(true);
    setAssignError(null);
    try {
      await studentsService.assignPhysicalClass({
        studentId: flow.studentId,
        academicYearId,
        physicalClassId: selectedPhysicalClassId,
        reason: 'Affectation immédiate après inscription — flux dynamique',
      });
      setAssignedPhysicalClassName(selectedClass?.name ?? null);
      toast({
        title: '✅ Affectation réussie',
        description: `${studentFullName} est affecté(e) à la classe ${selectedClass?.name ?? ''}.`,
        variant: 'success',
      });
      onRefresh?.();
      // ⭐ La personnalisation des frais se fait APRÈS l'affectation : le compte
      //    vient d'être recalculé avec les frais de la classe physique → les
      //    montants affichés à l'étape personnalisation sont exacts.
      setStep('CUSTOMIZATION');
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || 'Erreur inconnue';
      setAssignError(msg);
    } finally {
      setAssigning(false);
    }
  };

  /** Étape 1 → ignorer l'affectation, passer à la personnalisation des frais */
  const handleSkipAffectation = () => {
    setStep('CUSTOMIZATION');
  };

  // ─── ÉTAPE 3 : modal de paiement (réutilise le pattern Finance) ───
  if (step === 'PAYMENT') {
    return (
      <NewPaymentModal
        academicYearId={academicYearId}
        accounts={[]}
        presetStudent={{
          studentId: flow.studentId,
          firstName: flow.firstName,
          lastName: flow.lastName,
          matricule: flow.matricule,
          academicClassName: flow.academicClassName,
          physicalClassName: assignedPhysicalClassName ?? undefined,
        }}
        onClose={onClose}
        onSuccess={() => onRefresh?.()}
      />
    );
  }

  // ─── ÉTAPE 2 : personnalisation des frais (inscription / scolarité) ───
  //    Réutilise la logique du module Finance → Personnalisations (upsert
  //    override + recalcul synchrone du compte). Skippable.
  if (step === 'CUSTOMIZATION') {
    return (
      <EnrollmentFeeCustomizationStep
        flow={flow}
        academicYearId={academicYearId}
        physicalClassName={assignedPhysicalClassName}
        onClose={onClose}
        onSkip={() => setStep('PAYMENT')}
        onDone={() => setStep('PAYMENT')}
        onRefresh={onRefresh}
      />
    );
  }

  // ─── ÉTAPE 1 : modal d'affectation vers une classe physique ───
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-[2px] flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.99 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.22, ease: 'easeOut' }}
        className="bg-white rounded-xl w-full max-w-lg max-h-[calc(100dvh-2rem)] overflow-hidden flex flex-col border border-emerald-100 shadow-2xl"
      >
        {/* Bandeau succès inscription — toujours visible */}
        <div className="px-5 pt-5 pb-4 bg-gradient-to-br from-emerald-50 to-teal-50 border-b border-emerald-100 shrink-0">
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
                    Classe officielle : <span className="font-medium">{flow.academicClassName}</span>
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Corps : affectation — zone scrollable (le pied reste visible) */}
        <div className="px-5 py-5 overflow-y-auto overscroll-contain">
          <div className="flex items-center gap-2 mb-1">
            <Layers className="w-4 h-4 text-blue-600" />
            <h4 className="text-sm font-bold text-slate-800">Affecter à une classe physique</h4>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed mb-4">
            Souhaitez-vous affecter {flow.firstName} à une classe physique maintenant&nbsp;?
            Cette étape est <span className="font-semibold">facultative</span> — vous pourrez la faire
            plus tard dans l&apos;onglet « Affectations &amp; Mouvements ». Après cette étape, vous
            pourrez personnaliser ses frais (réduction, bourse — facultatif), puis l&apos;encaissement
            s&apos;ouvrira automatiquement.
          </p>

          {classesLoading && physicalClasses.length === 0 ? (
            <div className="flex items-center justify-center gap-2 py-8 text-slate-400">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-sm">Chargement des classes…</span>
            </div>
          ) : (
            <div>
              <Label className="text-xs mb-1.5 block">Classe physique</Label>
              {classesFetching && (
                <p className="text-[11px] text-slate-400 mb-1.5 flex items-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin" /> Actualisation de la liste…
                </p>
              )}
              <Select
                value={selectedPhysicalClassId || '_none'}
                onValueChange={(v) => {
                  setSelectedPhysicalClassId(v === '_none' ? '' : v);
                  setAssignError(null);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder={candidateClasses.length === 0 ? 'Aucune classe disponible' : 'Sélectionner une classe physique'} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">— Aucune (passer l&apos;affectation) —</SelectItem>
                  {candidateClasses.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      <span className="flex items-center gap-2">
                        {flow.academicClassId && c.officialClassId === flow.academicClassId && (
                          <MapPin className="w-3 h-3 text-blue-500" />
                        )}
                        {c.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {flow.academicClassId && (
                <p className="text-[11px] text-slate-400 mt-1.5">
                  Les sections rattachées à la classe officielle {flow.academicClassName ?? ''} sont proposées en priorité.
                </p>
              )}
              {candidateClasses.length === 0 && !classesLoading && !classesFetching && (
                <p className="text-xs text-amber-600 mt-2 flex items-start gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  {classesError ? (
                    <>
                      Impossible de charger les classes ({classesError?.message ?? 'erreur réseau'}).
                      <button
                        type="button"
                        className="font-semibold underline ml-1"
                        onClick={() => refetchClasses()}
                      >
                        Réessayer
                      </button>
                    </>
                  ) : (
                    <>Aucune classe physique trouvée pour ce niveau. Créez les classes dans
                    Paramètres → Classes, ou passez cette étape.</>
                  )}
                </p>
              )}
              {assignError && (
                <p className="text-xs text-rose-600 mt-2 flex items-start gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  {assignError}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Actions — pied FIXE toujours visible */}
        <div className="px-5 py-4 bg-slate-50 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={assigning}>
            Terminer pour l&apos;instant
          </Button>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" onClick={handleSkipAffectation} disabled={assigning}>
              <SkipForward className="w-4 h-4 mr-1.5" />
              Passer cette étape
            </Button>
            <Button
              type="button"
              onClick={handleAssign}
              disabled={assigning || classesLoading || !selectedPhysicalClassId}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {assigning ? (
                <>
                  <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Affectation…
                </>
              ) : (
                <>
                  Affecter et continuer <ArrowRight className="w-4 h-4 ml-1.5" />
                </>
              )}
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
