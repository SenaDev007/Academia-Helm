/**
 * ============================================================================
 * EXAMENS NATIONAUX — CEP / BEPC / BACCALAURÉAT / CAP (page établissement)
 * ============================================================================
 *
 * Onglet du module Examen (Academia Helm) dédié aux examens organisés par le
 * patronat (Academia Federis) entre écoles privées du département :
 *
 *   • CEP  — Certificat d'Études Primaires     → élèves de CM2
 *   • BEPC — Brevet d'Études du Premier Cycle  → élèves de 3ème
 *   • BAC  — Baccalauréat (séries A1, C, D…)   → élèves de Terminale
 *   • CAP  — Certificat d'Aptitude Professionnelle → élèves de Terminale CAP
 *          (filières techniques et professionnelles — ajouté le 2026-09-29)
 *
 * AFFICHAGE DYNAMIQUE : seuls les sous-onglets correspondant aux classes
 * réellement existantes dans l'école s'affichent (CM2 → CEP, 3ème → BEPC,
 * Terminale → Bac, Terminale CAP → CAP) — API GET /federis/school/national-exams.
 *
 * FLUX :
 *   1. L'école consulte la liste de ses élèves éligibles (année courante).
 *      Pour le Baccalauréat, les élèves sont catégorisés PAR SÉRIE.
 *   2. L'école coche les élèves qu'elle s'engage officiellement à présenter
 *      (elle peut écarter les élèves en carence).
 *   3. Le bouton « Envoyer au patronat » transmet la liste EN TEMPS RÉEL au(x)
 *      patronat(s) rattaché(s) — le patronat est notifié immédiatement.
 *
 * Pattern : ModuleContainer + sous-modules du module Examen (comme
 * unlock-requests/page.tsx). Palette Helm (Royal Blue + Living Gold).
 * ============================================================================
 */

'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import {
  Landmark, Loader2, RefreshCw, CheckSquare, Square, Send, Users,
  GraduationCap, AlertCircle, CheckCircle2, Info, ChevronDown, ChevronRight,
  School, ShieldCheck, FileText, XCircle,
} from 'lucide-react';
import { ModuleContainer } from '@/components/modules/blueprint';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EXAMS_SUB_MODULES } from '../sub-modules';
import { useExamSubModules } from '../layout';
import apiClient from '@/lib/api/client';
import { toastSuccess, toastError } from '@/lib/toast/toast-helpers';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

// ─── Types (réponses API) ────────────────────────────────────────────────────

interface EligibilityExam {
  type: 'CEP' | 'BEPC' | 'BAC' | 'CAP';
  label: string;
  fullLabel: string;
  eligibleClass: string;
  hasSeries: boolean;
  available: boolean;
  classes: string[];
  studentCount: number;
  submission: { status: string; count: number; submittedAt: string | null } | null;
}

interface Eligibility {
  academicYear: { id: string; name: string; label: string } | null;
  message?: string;
  patronats: { id: string; name: string; territoryName: string | null }[];
  exams: EligibilityExam[];
}

interface CandidateStudent {
  id: string;
  fullName: string;
  firstName: string;
  lastName: string;
  matricule: string | null;
  dateOfBirth: string | null;
  gender: string | null;
  className: string | null;
  series: string | null;
  selected: boolean;
  patronatStatus: 'TRANSMITTED' | 'WITHDRAWN' | null;
}

interface CandidatesResponse {
  examType: 'CEP' | 'BEPC' | 'BAC' | 'CAP';
  label: string;
  fullLabel: string;
  hasSeries: boolean;
  students: CandidateStudent[];
  groups: { key: string; label: string; count: number }[];
  submission: { status: string; count: number; submittedAt: string | null } | null;
  patronatTargets: { name: string; exam: { code: string; name: string } | null; ready: boolean; reason: string | null }[];
}

// ─── Composant principal ─────────────────────────────────────────────────────

export default function NationalExamsPage() {
  const scopedSubModules = useExamSubModules(EXAMS_SUB_MODULES);

  const [eligibility, setEligibility] = useState<Eligibility | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeType, setActiveType] = useState<'CEP' | 'BEPC' | 'BAC' | 'CAP' | null>(null);

  // État du sous-onglet actif
  const [candidates, setCandidates] = useState<CandidatesResponse | null>(null);
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // ── Chargement de l'éligibilité ───────────────────────────────────────────
  const loadEligibility = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/federis/school/national-exams', { timeout: 20000 });
      setEligibility(res.data);
      // Auto-sélection du premier sous-onglet disponible
      const first = (res.data?.exams ?? []).find((e: EligibilityExam) => e.available);
      setActiveType((prev) => prev ?? first?.type ?? null);
    } catch (err: any) {
      toastError(err?.response?.data?.message || 'Impossible de charger les examens nationaux.');
      setEligibility(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadEligibility();
  }, [loadEligibility]);

  // ── Chargement des candidats du sous-onglet actif ────────────────────────
  const loadCandidates = useCallback(async (type: 'CEP' | 'BEPC' | 'BAC' | 'CAP') => {
    setLoadingCandidates(true);
    try {
      const res = await apiClient.get(`/federis/school/national-exams/${type}/candidates`, {
        timeout: 25000,
      });
      setCandidates(res.data);
      const preselected = new Set<string>(
        (res.data?.students ?? [])
          .filter((s: CandidateStudent) => s.selected)
          .map((s: CandidateStudent) => s.id),
      );
      setSelected(preselected);
      // Groupes de séries ouverts par défaut (Bac)
      setExpandedGroups(
        new Set((res.data?.groups ?? []).map((g: { key: string }) => g.key)),
      );
    } catch (err: any) {
      toastError(err?.response?.data?.message || 'Impossible de charger la liste des élèves.');
      setCandidates(null);
    } finally {
      setLoadingCandidates(false);
    }
  }, []);

  useEffect(() => {
    if (activeType) loadCandidates(activeType);
  }, [activeType, loadCandidates]);

  // ── Sélection ─────────────────────────────────────────────────────────────
  const toggleStudent = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleGroup = (studentIds: string[]) => {
    const allSelected = studentIds.every((id) => selected.has(id));
    setSelected((prev) => {
      const next = new Set(prev);
      for (const id of studentIds) {
        if (allSelected) next.delete(id);
        else next.add(id);
      }
      return next;
    });
  };

  const toggleGroupExpanded = (key: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // Étudiants groupés (par série pour le Bac, par classe sinon)
  const groupedStudents = useMemo(() => {
    if (!candidates) return [];
    return candidates.groups.map((g) => ({
      ...g,
      students: candidates.students.filter((s) =>
        candidates.hasSeries
          ? (s.series ?? 'NON PRECISEE') === g.key
          : (s.className ?? 'NON ASSIGNEE') === g.key,
      ),
    }));
  }, [candidates]);

  // ── Envoi officiel au(x) patronat(s) ─────────────────────────────────────
  const handleSubmit = async () => {
    if (!activeType || selected.size === 0) return;
    if (
      !window.confirm(
        `Confirmer l'envoi officiel de ${selected.size} candidat(s) ${candidates?.label ?? ''} au(x) patronat(s) rattaché(s) ?`,
      )
    ) {
      return;
    }
    setSending(true);
    try {
      const res = await apiClient.post(
        `/federis/school/national-exams/${activeType}/submit`,
        { studentIds: [...selected] },
        { timeout: 45000 },
      );
      const reports = res.data?.reports ?? [];
      const patronatsNames = reports.map((r: any) => r.patronat).join(', ');
      toastSuccess(
        `${selected.size} candidat(s) envoyé(s) à ${patronatsNames || 'votre patronat'}.`,
      );
      // Rechargement de l'état complet
      await loadEligibility();
      if (activeType) await loadCandidates(activeType);
    } catch (err: any) {
      toastError(err?.response?.data?.message || "Échec de l'envoi au patronat.");
    } finally {
      setSending(false);
    }
  };

  // ─── Rendu ────────────────────────────────────────────────────────────────

  const availableExams = (eligibility?.exams ?? []).filter((e) => e.available);
  const joinedPatronats = eligibility?.patronats ?? [];
  const activeExamDef = availableExams.find((e) => e.type === activeType);

  return (
    <ModuleContainer
      header={{
        title: 'Examens nationaux',
        description:
          'CEP, BEPC, Baccalauréat et CAP — sélectionnez les élèves que votre établissement présente aux examens organisés par le patronat, puis envoyez la liste officielle.',
        icon: 'fileText',
      }}
      subModules={{ modules: scopedSubModules, activeModuleId: 'national-exams' }}
      content={{
        layout: 'full',
        children: (
          <div className="space-y-6">
            {/* ── État général : année scolaire + patronats rattachés ── */}
            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-7 h-7 animate-spin text-blue-900" />
              </div>
            ) : !eligibility ? (
              <Card>
                <CardContent className="py-10 text-center space-y-3">
                  <AlertCircle className="w-10 h-10 text-red-500 mx-auto" />
                  <p className="font-bold text-slate-800">Module indisponible</p>
                  <p className="text-sm text-slate-500 max-w-md mx-auto">
                    Les examens nationaux nécessitent une connexion au service Academia Federis.
                    Vérifiez votre connexion puis réessayez.
                  </p>
                  <Button variant="outline" onClick={loadEligibility} className="mx-auto">
                    <RefreshCw className="w-4 h-4 mr-2" /> Réessayer
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <>
                {/* Bandeau contexte */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card className="border-blue-100">
                    <CardContent className="pt-5 flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-blue-900/5 border border-blue-900/10 flex items-center justify-center shrink-0">
                        <GraduationCap className="w-5 h-5 text-blue-900" />
                      </div>
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                          Année scolaire
                        </p>
                        <p className="font-bold text-slate-800 text-sm mt-0.5">
                          {eligibility.academicYear?.label ?? eligibility.academicYear?.name ?? '—'}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="border-blue-100">
                    <CardContent className="pt-5 flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-blue-900/5 border border-blue-900/10 flex items-center justify-center shrink-0">
                        <School className="w-5 h-5 text-blue-900" />
                      </div>
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                          Patronats rattachés
                        </p>
                        {joinedPatronats.length === 0 ? (
                          <p className="text-sm font-semibold text-amber-600 mt-0.5">
                            Aucun — validez un rattachement
                          </p>
                        ) : (
                          <p className="font-bold text-slate-800 text-sm mt-0.5">
                            {joinedPatronats.map((p) => p.name).join(', ')}
                          </p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="border-blue-100">
                    <CardContent className="pt-5 flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-amber-400/10 border border-amber-400/20 flex items-center justify-center shrink-0">
                        <ShieldCheck className="w-5 h-5 text-amber-600" />
                      </div>
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                          Engagement officiel
                        </p>
                        <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                          La liste envoyée engage l&apos;établissement auprès du patronat.
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {joinedPatronats.length === 0 && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 flex items-start gap-3">
                    <Info className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                    <div className="text-sm text-amber-800">
                      <p className="font-bold">Aucun patronat rattaché</p>
                      <p>
                        Validez d&apos;abord les demandes de rattachement dans le module
                        « Patronats &amp; Examens fédérés » pour pouvoir envoyer vos candidats.
                      </p>
                    </div>
                  </div>
                )}

                {/* ── Sous-onglets dynamiques CEP / BEPC / Baccalauréat ── */}
                {eligibility.message ? (
                  <Card>
                    <CardContent className="py-8 text-center">
                      <p className="text-sm text-slate-600">{eligibility.message}</p>
                    </CardContent>
                  </Card>
                ) : availableExams.length === 0 ? (
                  <Card>
                    <CardContent className="py-10 text-center space-y-3">
                      <Landmark className="w-10 h-10 text-slate-300 mx-auto" />
                      <p className="font-bold text-slate-700">Aucun examen national disponible</p>
                      <p className="text-sm text-slate-500 max-w-lg mx-auto">
                        Votre établissement n&apos;a aucune classe de CM2, 3ème, Terminale ou
                        Terminale CAP pour
                        l&apos;année scolaire courante. Les sous-onglets CEP, BEPC, Baccalauréat et CAP
                        apparaîtront automatiquement dès qu&apos;une classe éligible existera dans
                        votre structure.
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  <>
                    <div className="flex flex-wrap items-center gap-2">
                      {availableExams.map((exam) => {
                        const isActive = exam.type === activeType;
                        return (
                          <button
                            key={exam.type}
                            onClick={() => setActiveType(exam.type)}
                            className={cn(
                              'inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-bold transition-all',
                              isActive
                                ? 'bg-blue-900 text-white border-blue-900 shadow-md shadow-blue-900/20'
                                : 'bg-white text-slate-600 border-slate-200 hover:border-blue-900/30 hover:text-blue-900',
                            )}
                          >
                            <Landmark className="w-4 h-4" />
                            {exam.type === 'BAC' ? 'Baccalauréat' : exam.type === 'CAP' ? 'CAP (filières techniques)' : exam.label}
                            <span
                              className={cn(
                                'px-2 py-0.5 rounded-full text-[10px] font-black',
                                isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500',
                              )}
                            >
                              {exam.studentCount}
                            </span>
                            {exam.submission?.status === 'SUBMITTED' && (
                              <CheckCircle2
                                className={cn('w-3.5 h-3.5', isActive ? 'text-emerald-300' : 'text-emerald-500')}
                              />
                            )}
                          </button>
                        );
                      })}
                    </div>

                    {/* ── Contenu du sous-onglet actif ── */}
                    {loadingCandidates ? (
                      <div className="flex justify-center py-12">
                        <Loader2 className="w-7 h-7 animate-spin text-blue-900" />
                      </div>
                    ) : !candidates || candidates.students.length === 0 ? (
                      <Card>
                        <CardContent className="py-10 text-center space-y-3">
                          <Users className="w-10 h-10 text-slate-300 mx-auto" />
                          <p className="font-bold text-slate-700">Aucun élève éligible</p>
                          <p className="text-sm text-slate-500">
                            Aucun élève actif n&apos;est inscrit dans les classes{' '}
                            {activeExamDef?.classes.join(', ') ?? 'éligibles'} pour cette année scolaire.
                          </p>
                        </CardContent>
                      </Card>
                    ) : (
                      <Card>
                        <CardHeader className="pb-3">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <CardTitle className="flex items-center gap-2 text-lg">
                                {candidates.examType === 'BAC'
                                  ? 'Baccalauréat'
                                  : candidates.examType === 'CAP'
                                    ? 'CAP (filières techniques)'
                                    : candidates.label}
                                <Badge className="bg-blue-900 text-white hover:bg-blue-900">
                                  {candidates.students.length} élèves
                                </Badge>
                              </CardTitle>
                              <CardDescription>
                                {candidates.fullLabel} —{' '}
                                {candidates.hasSeries
                                  ? 'élèves de Terminale par série'
                                  : 'liste des élèves éligibles'}
                              </CardDescription>
                            </div>

                            {/* Bandeau état d'envoi */}
                            {candidates.submission?.status === 'SUBMITTED' && (
                              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700 flex items-center gap-2">
                                <CheckCircle2 className="w-4 h-4 shrink-0" />
                                <span>
                                  Liste envoyée
                                  {candidates.submission.submittedAt
                                    ? ` le ${format(new Date(candidates.submission.submittedAt), 'd MMMM yyyy à HH:mm', { locale: fr })}`
                                    : ''}{' '}
                                  ({candidates.submission.count} candidats)
                                </span>
                              </div>
                            )}
                          </div>

                          {/* Barre d'actions */}
                          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t mt-3">
                            <div className="flex items-center gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  setSelected(new Set(candidates.students.map((s) => s.id)))
                                }
                              >
                                <CheckSquare className="w-4 h-4 mr-1.5" /> Tout sélectionner
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
                                <Square className="w-4 h-4 mr-1.5" /> Tout désélectionner
                              </Button>
                              <span className="text-sm font-bold text-blue-900">
                                {selected.size} sélectionné(s)
                              </span>
                            </div>
                            <Button
                              onClick={handleSubmit}
                              disabled={selected.size === 0 || sending || joinedPatronats.length === 0}
                              className="bg-amber-500 hover:bg-amber-600 text-white font-bold"
                            >
                              {sending ? (
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              ) : (
                                <Send className="w-4 h-4 mr-2" />
                              )}
                              Envoyer au patronat
                            </Button>
                          </div>
                        </CardHeader>

                        <CardContent>
                          {/* Cibles patronats (état de préparation) */}
                          {candidates.patronatTargets.length > 0 && (
                            <div className="mb-4 rounded-xl border border-blue-100 bg-blue-50/50 p-3 space-y-1.5">
                              {candidates.patronatTargets.map((t, i) => (
                                <div key={i} className="flex items-center gap-2 text-xs">
                                  {t.ready ? (
                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                                  ) : (
                                    <XCircle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                                  )}
                                  <span className="font-bold text-slate-700">{t.name}</span>
                                  <span className="text-slate-500">
                                    {t.exam ? `Campagne ${t.exam.code} — ${t.exam.name}` : t.reason}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Listes : par série (Bac) ou par classe (CEP/BEPC) */}
                          <div className="space-y-4">
                            {groupedStudents.map((group) => {
                              const groupIds = group.students.map((s) => s.id);
                              const allSelected =
                                groupIds.length > 0 && groupIds.every((id) => selected.has(id));
                              const groupSelectedCount = groupIds.filter((id) => selected.has(id)).length;
                              const isExpanded = expandedGroups.has(group.key) || !candidates.hasSeries;

                              return (
                                <div
                                  key={group.key}
                                  className="rounded-xl border border-slate-200 overflow-hidden"
                                >
                                  {/* En-tête de groupe */}
                                  <div
                                    className={cn(
                                      'flex items-center justify-between gap-3 px-4 py-3 cursor-pointer select-none',
                                      candidates.hasSeries
                                        ? 'bg-blue-900/[0.04] hover:bg-blue-900/[0.07]'
                                        : 'bg-slate-50',
                                    )}
                                    onClick={() =>
                                      candidates.hasSeries && toggleGroupExpanded(group.key)
                                    }
                                  >
                                    <div className="flex items-center gap-2.5">
                                      {candidates.hasSeries &&
                                        (isExpanded ? (
                                          <ChevronDown className="w-4 h-4 text-slate-400" />
                                        ) : (
                                          <ChevronRight className="w-4 h-4 text-slate-400" />
                                        ))}
                                      <span className="font-bold text-slate-800 text-sm">
                                        {group.label}
                                      </span>
                                      <Badge variant="outline" className="text-[10px]">
                                        {groupSelectedCount}/{group.count}
                                      </Badge>
                                    </div>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        toggleGroup(groupIds);
                                      }}
                                      className={cn(
                                        'text-xs font-bold px-3 py-1.5 rounded-lg border transition-colors',
                                        allSelected
                                          ? 'bg-blue-900 text-white border-blue-900'
                                          : 'bg-white text-slate-600 border-slate-200 hover:border-blue-900/40',
                                      )}
                                    >
                                      {allSelected ? 'Tout décocher' : 'Tout cocher'}
                                    </button>
                                  </div>

                                  {/* Élèves du groupe */}
                                  {isExpanded && (
                                    <div className="divide-y divide-slate-100">
                                      {group.students.map((student) => {
                                        const isSelected = selected.has(student.id);
                                        return (
                                          <label
                                            key={student.id}
                                            className={cn(
                                              'flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors',
                                              isSelected ? 'bg-amber-50/60' : 'hover:bg-slate-50',
                                            )}
                                          >
                                            <input
                                              type="checkbox"
                                              checked={isSelected}
                                              onChange={() => toggleStudent(student.id)}
                                              className="w-4 h-4 accent-blue-900"
                                            />
                                            <div className="flex-1 min-w-0">
                                              <div className="flex items-center gap-2 flex-wrap">
                                                <span className="font-semibold text-slate-800 text-sm truncate">
                                                  {student.fullName}
                                                </span>
                                                {student.className && (
                                                  <Badge variant="outline" className="text-[10px] font-medium">
                                                    {student.className}
                                                  </Badge>
                                                )}
                                                {student.patronatStatus === 'TRANSMITTED' && (
                                                  <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 text-[10px]">
                                                    <CheckCircle2 className="w-3 h-3 mr-1" />
                                                    Transmis
                                                  </Badge>
                                                )}
                                                {student.patronatStatus === 'WITHDRAWN' && (
                                                  <Badge className="bg-slate-100 text-slate-500 hover:bg-slate-100 text-[10px]">
                                                    Retiré
                                                  </Badge>
                                                )}
                                              </div>
                                              <p className="text-xs text-slate-500 mt-0.5">
                                                {student.matricule ? `Mat. ${student.matricule} · ` : ''}
                                                {student.gender === 'M'
                                                  ? 'Garçon'
                                                  : student.gender === 'F'
                                                    ? 'Fille'
                                                    : ''}
                                                {student.dateOfBirth
                                                  ? ` · Né(e) le ${format(new Date(student.dateOfBirth), 'dd/MM/yyyy')}`
                                                  : ''}
                                              </p>
                                            </div>
                                          </label>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>

                          {/* Note de bas de page */}
                          <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50/40 p-3 flex items-start gap-2.5">
                            <FileText className="w-4 h-4 text-blue-900 shrink-0 mt-0.5" />
                            <p className="text-xs text-slate-600 leading-relaxed">
                              Décochez les élèves que vous ne souhaitez pas présenter (carences,
                              déficits). Seuls les élèves cochés seront transmis officiellement au
                              patronat, qui les enregistrera comme candidats à l&apos;examen{' '}
                              {candidates.examType === 'BAC' ? 'du baccalauréat' : candidates.label}.
                              Vous pouvez modifier et renvoyer la liste à tout moment — les candidats
                              retirés seront signalés au patronat.
                            </p>
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </>
                )}
              </>
            )}
          </div>
        ),
      }}
    />
  );
}
