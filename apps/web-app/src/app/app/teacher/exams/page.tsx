"use client";

/**
 * ============================================================================
 * PORTAIL ENSEIGNANT — Examens & Notes
 * ============================================================================
 *
 * Deux vues :
 *   1. "Mes évaluations" — Liste les évaluations assignées à l'enseignant
 *   2. "Bulletins à signer" — Bulletins distribués par le directeur à
 *      l'enseignant (statut TEACHER_DISTRIBUTED). Permet de signer
 *      (SignatureCanvas → POST /teacher-sign) et de renvoyer
 *      (POST /teacher-return) au directeur.
 *
 * Sources de données :
 *   - GET /institutional-exams/evaluations (apiClient axios)
 *   - GET /institutional-exams/grades/evaluation/:id
 *   - POST /institutional-exams/grades/evaluation/:id/bulk
 *   - GET /institutional-exams/bulletins/teacher-bulletins?periodId=X
 *     (renvoie les classes où l'enseignant a des bulletins à signer)
 *   - GET /institutional-exams/bulletins/class/:classId/workflow-status?periodId=X
 *   - POST /institutional-exams/bulletins/class/:classId/teacher-sign
 *   - POST /institutional-exams/bulletins/class/:classId/teacher-return
 *
 * ⭐ Anti-screenshot : activé sur l'onglet "Bulletins à signer"
 *    (clic droit, Ctrl+P, PrintScreen désactivés).
 * ============================================================================
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Loader2, FileEdit, Calendar, BookOpen, Users, Save,
  ChevronRight, AlertCircle, CheckCircle2, Bell, XCircle, CheckCircle,
  FileText, PenTool, Undo, Send, Shield, ShieldAlert, Sparkles,
} from 'lucide-react';
import { useAppSession } from '@/contexts/AppSessionContext';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useBilingual } from '@/contexts/BilingualContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toastSuccess, toastError } from '@/lib/toast/toast-helpers';
import apiClient from '@/lib/api/client';
import { institutionalExamsService } from '@/services/institutional-exams.service';
import { GradingSheet } from '@/components/exams/GradingSheet';
import { HierarchicalEvaluationList } from '@/components/exams/HierarchicalEvaluationList';
import { SignatureCanvas } from '@/components/ui/SignatureCanvas';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Evaluation {
  id: string;
  title: string | null;
  evaluationDate: string;
  startDate?: string | null;
  endDate?: string | null;
  status: 'DRAFT' | 'PLANNED' | 'OPEN_FOR_GRADING' | 'SUBMITTED' | 'VALIDATED' | 'LOCKED' | 'CANCELLED';
  class?: { id: string; name: string; schoolLevel?: { code: string; name: string } };
  subject?: { id: string; name: string; language?: string };
  evaluationType?: { id: string; name: string; code?: string };
  period?: { id: string; name: string };
  _count?: { grades: number };
}

interface GroupedEvaluation {
  classId: string;
  className: string;
  evaluationTypeId: string;
  evaluationTypeName: string;
  evaluationTypeCode?: string;
  periodId: string;
  periodName: string;
  startDate: string | null;
  endDate: string | null;
  subjects: Array<{ id: string; name: string }>;
  evaluationIds: string[];
  statuses: string[];
  firstEvaluation: Evaluation;
}

interface GradeRow {
  studentId: string;
  studentName: string;
  matricule?: string;
  gender?: string;
  // Pour Maternelle : qualitativeCode (TS/S/PS)
  // Pour Primaire : cm (/18) + cp (/2) + total = cm + cp
  scores: Record<string, {
    score: number | null;
    cm: number | null;
    cp: number | null;
    qualitativeCode: string | null;
    isAbsent: boolean;
    comment: string;
  }>;
  status: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(d: string | null): string {
  if (!d) return 'Date non définie';
  try {
    return format(new Date(d), 'd MMM yyyy', { locale: fr });
  } catch {
    return d;
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TeacherExamsPage() {
  const { user } = useAppSession();
  const { academicYear, schoolLevel } = useModuleContext();
  const { isEnabled: isBilingual, currentTrack } = useBilingual();

  // ⭐ Onglet actif : "evaluations" (par défaut) ou "bulletins"
  const [tab, setTab] = useState<'evaluations' | 'bulletins'>('evaluations');

  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedGroup, setSelectedGroup] = useState<GroupedEvaluation | null>(null);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);

  // Détecter le niveau scolaire depuis schoolLevel.code
  // ⭐ Si schoolLevel est null ou 'ALL', déduire depuis les évaluations (BDD)
  const ctxLevelCode = (schoolLevel?.code || '').toUpperCase();
  const evalLevelCode = evaluations.length > 0
    ? (evaluations[0]?.class?.schoolLevel?.code || '').toUpperCase()
    : '';
  const levelCode = (ctxLevelCode && ctxLevelCode !== 'ALL') ? ctxLevelCode : evalLevelCode;
  const isMaternelle = levelCode === 'MATERNELLE' || levelCode.includes('MATERN');
  const isPrimaire = levelCode === 'PRIMAIRE' || levelCode.includes('PRIM');
  const isSecondaire = levelCode === 'SECONDAIRE' || levelCode.includes('SECOND');

  // ─── Charger les évaluations de l'enseignant ──────────────────────────────
  const [resolvedTeacherId, setResolvedTeacherId] = useState<string | null>(null);

  // ⭐ Résoudre user.id → Teacher.id : priorité à user.teacherId (renvoyé par
  // le proxy de connexion portail enseignant — exact pour les doubles
  // casquettes), sinon resolution backend via my-classes (User→Teacher par email)
  useEffect(() => {
    if (!user?.id || !academicYear?.id) return;
    if (user?.teacherId) {
      setResolvedTeacherId(user.teacherId);
      return;
    }
    apiClient
      .get('/pedagogy-space/my-classes', {
        params: { teacherId: user.id, academicYearId: academicYear.id },
      })
      .then(() => {
        // L'API pedagogy-space résout user.id → Teacher.id côté backend.
        setResolvedTeacherId(user.id);
      })
      .catch(() => {
        // Fallback: utiliser user.id directement
        setResolvedTeacherId(user.id);
      });
  }, [user?.id, user?.teacherId, academicYear?.id]);

  const loadEvaluations = useCallback(async () => {
    if (!academicYear?.id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const params: any = {
        academicYearId: academicYear.id,
        teacherId: resolvedTeacherId || user?.id,
      };
      // ⭐ schoolLevelId est optionnel — si 'ALL' ou non défini, ne pas filtrer
      if (schoolLevel?.id && schoolLevel.id !== 'ALL') params.schoolLevelId = schoolLevel.id;
      const res = await institutionalExamsService.getEvaluations(params);
      setEvaluations(Array.isArray(res) ? res : []);
    } catch (err) {
      console.error('Error loading evaluations', err);
      setEvaluations([]);
    } finally {
      setLoading(false);
    }
  }, [academicYear?.id, schoolLevel?.id, user?.id, resolvedTeacherId]);

  useEffect(() => { loadEvaluations(); }, [loadEvaluations]);

  // ─── Charger les notifications in-app ──────────────────────────────────────
  const loadNotifications = useCallback(async () => {
    if (!user?.id) return;
    try {
      const res = await apiClient.get('/notifications', {
        params: { type: 'EVALUATION_SCHEDULED', limit: 10 },
      });
      const data = res.data;
      const notifs = Array.isArray(data) ? data : (data?.items || data?.data || []);
      setNotifications(notifs);
    } catch {
      setNotifications([]);
    }
  }, [user?.id]);

  useEffect(() => { loadNotifications(); }, [loadNotifications]);

  // ─── Grouper les évaluations ─────────────────────────────────────────────────
  const grouped = useMemo<GroupedEvaluation[]>(() => {
    const map = new Map<string, GroupedEvaluation>();
    for (const ev of evaluations) {
      const classId = ev.class?.id || '_no_class';
      const evaluationTypeId = ev.evaluationType?.id || '_no_type';
      const periodId = ev.period?.id || '_no_period';
      const sd = ev.startDate || ev.evaluationDate || '';
      const ed = ev.endDate || ev.startDate || ev.evaluationDate || '';
      const key = `${classId}|${evaluationTypeId}|${periodId}|${sd}|${ed}`;

      if (!map.has(key)) {
        map.set(key, {
          classId,
          className: ev.class?.name || 'Sans classe',
          evaluationTypeId,
          evaluationTypeName: ev.evaluationType?.name || 'Évaluation',
          evaluationTypeCode: ev.evaluationType?.code,
          periodId,
          periodName: ev.period?.name || '',
          startDate: ev.startDate || null,
          endDate: ev.endDate || null,
          subjects: [],
          evaluationIds: [],
          statuses: [],
          firstEvaluation: ev,
          subjectByEvalId: {},
        });
      }
      const g = map.get(key)!;
      if (ev.subject && !g.subjects.find((s) => s.id === ev.subject!.id)) {
        g.subjects.push({ id: ev.subject.id, name: ev.subject.name });
      }
      // ⭐ V10d — mapping explicite evaluationId → subjectId (robuste aux doublons)
      if (ev.subject) (g as any).subjectByEvalId![ev.id] = ev.subject.id;
      g.evaluationIds.push(ev.id);
      g.statuses.push(ev.status);
    }
    return Array.from(map.values());
  }, [evaluations]);

  // ─── Si un groupe est sélectionné, afficher la fiche de saisie ──────────────
  if (selectedGroup) {
    return (
      <GradingSheet
        group={selectedGroup}
        isMaternelle={isMaternelle}
        isPrimaire={isPrimaire}
        isSecondaire={isSecondaire}
        scopedSubModules={null}
        onBack={() => {
          setSelectedGroup(null);
          loadEvaluations();
        }}
        language={currentTrack as 'FR' | 'EN' | undefined}
      />
    );
  }

  // ⭐ Si l'onglet "Bulletins à signer" est actif, afficher cette vue
  //    (avec anti-screenshot activé)
  if (tab === 'bulletins') {
    return (
      <div className="space-y-4">
        {/* Tabs */}
        <TeacherTabsHeader
          tab={tab}
          setTab={setTab}
          bulletinsCount={0}
        />
        <TeacherBulletinsToSign
          academicYearId={academicYear?.id}
          onBackToEvaluations={() => setTab('evaluations')}
        />
      </div>
    );
  }

  // ─── Vue liste ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Tabs */}
      <TeacherTabsHeader
        tab={tab}
        setTab={setTab}
        bulletinsCount={0}
      />

      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <FileEdit className="w-6 h-6 text-blue-600" />
            Mes Évaluations
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Évaluations programmées pour vos classes — {academicYear?.label || 'Année courante'}
            {isBilingual && currentTrack && ` • Piste ${currentTrack === 'FR' ? 'francophone' : 'anglophone'}`}
          </p>
        </div>
        {/* Bouton notifications */}
        <button
          onClick={() => setShowNotifications(!showNotifications)}
          className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors"
          title="Notifications évaluations"
        >
          <Bell className="w-5 h-5 text-gray-600" />
          {notifications.length > 0 && (
            <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
              {notifications.length > 9 ? '9+' : notifications.length}
            </span>
          )}
        </button>
      </div>

      {/* Panneau notifications (dépliable) */}
      {showNotifications && (
        <Card className="border-blue-200 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                <Bell className="w-4 h-4 text-blue-600" />
                Notifications d'évaluations ({notifications.length})
              </h3>
              <Button variant="ghost" size="sm" onClick={() => setShowNotifications(false)}>
                Fermer
              </Button>
            </div>
            {notifications.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">Aucune notification</p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {notifications.map((notif: any) => (
                  <div
                    key={notif.id}
                    className={cn(
                      'flex items-start gap-3 p-3 rounded-lg border',
                      notif.isRead ? 'bg-gray-50 border-gray-200' : 'bg-blue-50 border-blue-200'
                    )}
                  >
                    <div className={cn(
                      'flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center',
                      notif.priority === 'HIGH' ? 'bg-amber-100' : 'bg-blue-100'
                    )}>
                      <Bell className="w-4 h-4 text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900">{notif.title}</p>
                      <p className="text-xs text-gray-600 mt-0.5">{notif.body}</p>
                      <p className="text-[10px] text-gray-400 mt-1">
                        {notif.createdAt ? format(new Date(notif.createdAt), 'dd MMM yyyy HH:mm', { locale: fr }) : ''}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Pas de sélecteur bilingue — l'enseignant a une seule piste linguistique */}

      {/* Loading */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
          <span className="ml-2 text-gray-600">Chargement de vos évaluations...</span>
        </div>
      ) : grouped.length === 0 ? (
        <Card className="border-gray-200 shadow-sm">
          <CardContent className="py-12 text-center">
            <FileEdit className="w-10 h-10 mx-auto mb-2 text-gray-300" />
            <p className="font-medium text-gray-600">Aucune évaluation assignée</p>
            <p className="text-xs mt-1 text-gray-400">
              {isBilingual
                ? `Aucune évaluation sur la piste ${currentTrack === 'FR' ? 'francophone' : 'anglophone'} pour le moment.`
                : 'Aucune évaluation ne vous est assignée pour le moment.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <HierarchicalEvaluationList
          groups={grouped}
          scopeKey="teacher-exams"
          onGroupClick={(group) => {
            // ⭐ L'enseignant peut ouvrir la fiche pour VISUALISATION même si
            //    l'évaluation a déjà été validée (OPEN_FOR_GRADING), soumise
            //    (SUBMITTED) ou validée par l'admin (VALIDATED).
            //    La fiche TeacherGradingSheet passera en lecture seule automatiquement.
            setSelectedGroup(group);
          }}
          isMaternelle={isMaternelle}
          renderStatusBadge={(g) => {
            // ⭐ Flux : PLANNED → OPEN_FOR_GRADING → SUBMITTED → VALIDATED
            //   - PLANNED : évaluation créée par l'admin, prête à être saisie
            //   - OPEN_FOR_GRADING : l'enseignant a validé sa saisie (mais PAS encore
            //     soumise au directeur) → badge ambre "Validée par enseignant"
            //   - SUBMITTED : signée et soumise au directeur depuis l'Espace Pédagogique
            //     → badge violet "Soumise au directeur"
            //   - VALIDATED/LOCKED : validée par l'admin → badge vert "Validée"
            // ⭐ FIX 2026-11-19 — IGNORER les évaluations CANCELLED dans
            //    l'agrégation : une session reprogrammée [VALIDATED×n +
            //    CANCELLED×n] ne remplissait aucune branche et retombait sur
            //    « Planifiée » (cf. CP B Mon Avenir Plus). Un groupe
            //    entièrement annulé affiche « Annulée ».
            const active = g.statuses.filter(s => s !== 'CANCELLED');
            const allCancelled = active.length === 0 && g.statuses.length > 0;
            const isPlanned = active.length > 0 && active.every(s => s === 'PLANNED' || s === 'DRAFT');
            const isValidatedByTeacher = active.some(s => s === 'OPEN_FOR_GRADING') && !isPlanned;
            const isSubmitted = active.some(s => s === 'SUBMITTED');
            const isValidated = active.length > 0 && active.every(s => s === 'VALIDATED' || s === 'LOCKED');
            const status = allCancelled ? 'Annulée' :
                          isValidated ? 'Validée' :
                          isSubmitted ? 'Soumise au directeur' :
                          isValidatedByTeacher ? 'Validée par enseignant' :
                          'Planifiée';
            // ⭐ Couleurs distinctes (cf. admin grades page)
            const color = allCancelled ? 'bg-red-100 text-red-700' :
                        isValidated ? 'bg-emerald-100 text-emerald-700' :
                        isSubmitted ? 'bg-purple-100 text-purple-700' :
                        isValidatedByTeacher ? 'bg-amber-100 text-amber-700' :
                        'bg-blue-100 text-blue-700';
            return <span className={cn('text-[10px] font-semibold uppercase tracking-wide px-2 py-1 rounded-full whitespace-nowrap', color)}>{status}</span>;
          }}
        />
      )}
    </div>
  );
}

// ─── Fiche de saisie (vue détaillée) ─────────────────────────────────────────

function TeacherGradingSheet({
  group,
  isMaternelle,
  academicYearId,
  onBack,
}: {
  group: GroupedEvaluation;
  isMaternelle: boolean;
  academicYearId: string;
  onBack: () => void;
}) {
  const [rows, setRows] = useState<GradeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // ⭐ Lecture seule si l'évaluation n'est plus en PLANNED (déjà validée, soumise,
  //    ou validée par l'admin). L'enseignant ne peut plus modifier les notes.
  //    Il peut juste consulter la fiche.
  // ⭐ FIX 2026-11-19 — IGNORER les CANCELLED : une session reprogrammée
  //    [CANCELLED + PLANNED] doit rester SAISISSABLE (l'ancienne formule
  //    every(PLANNED|DRAFT) la passait en lecture seule à cause des zombies
  //    annulés de la reprogrammation).
  const active = group.statuses.filter(s => s !== 'CANCELLED');
  const isPlanned = active.length > 0 && active.every(s => s === 'PLANNED' || s === 'DRAFT');
  const isReadOnly = !isPlanned || active.length === 0;

  // ── Charger les élèves + notes existantes ─────────────────────────────────
  useEffect(() => {
    const loadSheet = async () => {
      if (!group.evaluationIds.length) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        // Fetch la grading sheet pour chaque évaluation du groupe
        const sheets = await Promise.all(
          group.evaluationIds.map(async (evId) => {
            try {
              const response = await apiClient.get(`/institutional-exams/grades/evaluation/${evId}`);
              return { evaluationId: evId, students: Array.isArray(response.data) ? response.data : [] };
            } catch {
              return { evaluationId: evId, students: [] };
            }
          })
        );

        // Construire la map evaluationId → subjectId
        const evalToSubject = new Map<string, string>();
        try {
          const evalsRes = await institutionalExamsService.getEvaluations({
            academicYearId,
            schoolLevelId: group.classId,
          });
          const evalsWithSubject = (Array.isArray(evalsRes) ? evalsRes : []).filter(
            (ev: Evaluation) => group.evaluationIds.includes(ev.id)
          );
          evalsWithSubject.forEach((ev: Evaluation) => {
            if (ev.subject?.id) {
              evalToSubject.set(ev.id, ev.subject.id);
            }
          });
        } catch (err) {
          console.warn('Failed to fetch evaluations for subject mapping', err);
        }

        // Fallback : associer par ordre
        if (evalToSubject.size === 0 && group.subjects.length === group.evaluationIds.length) {
          group.evaluationIds.forEach((evId, i) => {
            evalToSubject.set(evId, group.subjects[i].id);
          });
        }

        // Construire la map studentId → GradeRow
        const studentMap = new Map<string, GradeRow>();
        sheets.forEach(({ evaluationId, students }) => {
          const subjectId = evalToSubject.get(evaluationId);
          if (!subjectId) return;
          students.forEach((student: any) => {
            if (!studentMap.has(student.studentId)) {
              studentMap.set(student.studentId, {
                studentId: student.studentId,
                studentName: student.studentName || 'Inconnu',
                matricule: student.matricule,
                gender: student.gender,
                scores: {},
                status: student.status || 'NEW',
              });
            }
            const row = studentMap.get(student.studentId)!;
            row.scores[subjectId] = {
              score: student.score ?? null,
              cm: student.cm ?? null,
              cp: student.cp ?? null,
              qualitativeCode: student.qualitativeCode ?? null,
              isAbsent: student.isAbsent ?? false,
              comment: student.comment ?? '',
            };
          });
        });

        // Initialiser tous les sujets pour chaque élève
        const rowsArray = Array.from(studentMap.values());
        rowsArray.forEach((row) => {
          group.subjects.forEach((subject) => {
            if (!row.scores[subject.id]) {
              row.scores[subject.id] = { score: null, cm: null, cp: null, qualitativeCode: null, isAbsent: false, comment: '' };
            }
          });
        });

        rowsArray.sort((a, b) => a.studentName.localeCompare(b.studentName, 'fr'));
        setRows(rowsArray);
      } catch (err) {
        console.error('Error loading grading sheet', err);
        toastError('Erreur lors du chargement de la fiche de saisie');
        setRows([]);
      } finally {
        setLoading(false);
      }
    };

    loadSheet();
  }, [group, academicYearId]);

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleScoreChange = (studentId: string, subjectId: string, value: string) => {
    setRows(prev => prev.map(row => {
      if (row.studentId !== studentId) return row;
      const existing = row.scores[subjectId] || { score: null, cm: null, cp: null, qualitativeCode: null, isAbsent: false, comment: '' };
      let updated: any;
      if (isMaternelle) {
        updated = { ...existing, qualitativeCode: value === '' ? null : value };
      } else {
        updated = { ...existing, score: value === '' ? null : parseFloat(value) };
      }
      return { ...row, scores: { ...row.scores, [subjectId]: updated } };
    }));
  };

  // ⭐ Primaire : gestion CM (/18) et CP (/2)
  // CP possible uniquement si CM ≥ 10. Sinon CP = 0.
  // Total = CM + CP (max /20)
  const handleCmChange = (studentId: string, subjectId: string, value: string) => {
    setRows(prev => prev.map(row => {
      if (row.studentId !== studentId) return row;
      const existing = row.scores[subjectId] || { score: null, cm: null, cp: null, qualitativeCode: null, isAbsent: false, comment: '' };
      const cm = value === '' ? null : Math.min(18, Math.max(0, parseFloat(value) || 0));
      const cp = (cm !== null && cm >= 10) ? existing.cp : 0;
      const total = (cm !== null ? cm : 0) + (cp !== null ? cp : 0);
      return {
        ...row,
        scores: {
          ...row.scores,
          [subjectId]: { ...existing, cm, cp, score: total, isAbsent: false },
        },
      };
    }));
  };

  const handleCpChange = (studentId: string, subjectId: string, value: string) => {
    setRows(prev => prev.map(row => {
      if (row.studentId !== studentId) return row;
      const existing = row.scores[subjectId] || { score: null, cm: null, cp: null, qualitativeCode: null, isAbsent: false, comment: '' };
      if (existing.cm === null || existing.cm < 10) return row;
      const cp = value === '' ? null : Math.min(2, Math.max(0, parseFloat(value) || 0));
      const total = (existing.cm || 0) + (cp !== null ? cp : 0);
      return {
        ...row,
        scores: {
          ...row.scores,
          [subjectId]: { ...existing, cp, score: total },
        },
      };
    }));
  };

  const handleSave = async (submit = false) => {
    // ⭐ Si on valide, demander confirmation à l'enseignant
    if (submit) {
      const ok = window.confirm(
        `Valider la saisie des notes de ${group.className} ?\n\n` +
        `Les notes seront transmises à l'Espace Pédagogique pour signature\n` +
        `et soumission au directeur. Vous ne pourrez plus les modifier.\n\n` +
        `Continuer ?`
      );
      if (!ok) return;
    }
    setSaving(true);
    try {
      // Refetch evaluations pour résoudre evaluationId → subjectId
      let evalsWithSubject: Evaluation[] = [];
      try {
        const evalsRes = await institutionalExamsService.getEvaluations({
          academicYearId,
          schoolLevelId: group.classId,
        });
        evalsWithSubject = (Array.isArray(evalsRes) ? evalsRes : []).filter(
          (e: Evaluation) => group.evaluationIds.includes(e.id)
        );
      } catch (err) {
        console.warn('Failed to fetch evaluations for save', err);
      }

      // 1. Sauvegarder les notes (grades)
      await Promise.all(
        group.evaluationIds.map(async (evId) => {
          const ev = evalsWithSubject.find(e => e.id === evId);
          const subjectId = ev?.subject?.id;
          if (!subjectId) return;

          const gradesForEval = rows
            .filter(row => row.scores[subjectId])
            .map(row => ({
              studentId: row.studentId,
              subjectId,
              score: row.scores[subjectId].score,
              cm: row.scores[subjectId].cm,
              cp: row.scores[subjectId].cp,
              qualitativeCode: row.scores[subjectId].qualitativeCode,
              isAbsent: row.scores[subjectId].isAbsent,
              comment: row.scores[subjectId].comment,
              // ⭐ On reste en DRAFT côté grade ; c'est l'évaluation qui passe à OPEN_FOR_GRADING
              status: 'DRAFT',
            }));
          if (gradesForEval.length === 0) return;
          try {
            await apiClient.post(
              `/institutional-exams/grades/evaluation/${evId}/bulk`,
              gradesForEval,
            );
          } catch (err: any) {
            console.error(`Failed to save evaluation ${evId}:`, err.response?.data || err.message);
            throw err;
          }
        })
      );

      // 2. Si validation : ouvrir l'évaluation (PLANNED → OPEN_FOR_GRADING)
      //    Cela signifie que l'enseignant a validé sa saisie. Les notes sont
      //    ensuite disponibles dans l'Espace Pédagogique (Registre d'appel →
      //    Évaluation mensuelle) pour signature et soumission au directeur.
      if (submit) {
        const submitErrors: string[] = [];
        await Promise.all(
          group.evaluationIds.map(async (evId) => {
            try {
              // ⭐ /open accepte PLANNED ou DRAFT → OPEN_FOR_GRADING
              // ⭐ /open est idempotent : si déjà OPEN_FOR_GRADING, ne fait rien
              //    (le backend lèverait une erreur si on l'appelait 2x, donc on catch)
              await apiClient.post(`/institutional-exams/evaluations/${evId}/open`);
            } catch (err: any) {
              // Si l'erreur est « doit être PLANNED ou DRAFT », c'est que l'évaluation
              // est déjà ouverte → on ignore l'erreur (idempotence)
              const msg = err.response?.data?.message || err.message || '';
              if (msg.includes('doit être') || msg.includes('already') || err.response?.status === 400) {
                console.warn(`Evaluation ${evId} déjà ouverte, ignoré`);
                return;
              }
              console.error(`Failed to validate evaluation ${evId}:`, err.response?.data || err.message);
              submitErrors.push(evId);
            }
          })
        );
        if (submitErrors.length > 0) {
          throw new Error(`Échec de la validation pour ${submitErrors.length} évaluation(s). Vérifiez la console.`);
        }
      }

      toastSuccess(submit ? 'Notes validées' : 'Notes enregistrées', {
        description: submit
          ? 'Les notes sont disponibles dans l\'Espace Pédagogique pour signature et soumission au directeur.'
          : `${rows.length} élève(s) · ${group.subjects.length} matière(s)`,
      });
      if (submit) onBack();
    } catch (err: any) {
      toastError('Erreur lors de la sauvegarde', { description: err.message });
    } finally {
      setSaving(false);
    }
  };

  const filteredRows = useMemo(() => {
    if (!searchQuery.trim()) return rows;
    const q = searchQuery.toLowerCase().trim();
    return rows.filter(r =>
      r.studentName.toLowerCase().includes(q) ||
      (r.matricule || '').toLowerCase().includes(q)
    );
  }, [rows, searchQuery]);

  const startDate = group.startDate ? new Date(group.startDate) : null;
  const endDate = group.endDate ? new Date(group.endDate) : null;
  const sameDay = startDate && endDate &&
    startDate.getFullYear() === endDate.getFullYear() &&
    startDate.getMonth() === endDate.getMonth() &&
    startDate.getDate() === endDate.getDate();
  const dateRange = startDate
    ? sameDay || !endDate
      ? `Le ${format(startDate, 'd MMM yyyy', { locale: fr })}`
      : `Du ${format(startDate, 'd MMM yyyy', { locale: fr })} au ${format(endDate, 'd MMM yyyy', { locale: fr })}`
    : 'Date non définie';

  return (
    <div className="space-y-4">
      {/* Action Bar */}
      <div className="flex flex-wrap justify-between items-center bg-white p-4 rounded-2xl shadow-sm border border-gray-100 gap-3">
        <Button variant="ghost" onClick={onBack}>
          <ChevronRight className="w-4 h-4 mr-1 rotate-180" />
          Retour à la liste
        </Button>

        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className="border-blue-200 text-blue-600 text-xs gap-1">
            <Users className="w-3 h-3" />
            {rows.length} élèves
          </Badge>
          <Badge variant="outline" className="border-emerald-200 text-emerald-600 text-xs gap-1">
            <BookOpen className="w-3 h-3" />
            {group.subjects.length} matières
          </Badge>
          <Badge variant="outline" className="border-amber-200 text-amber-600 text-xs">
            {isMaternelle ? 'TS/S/PS' : `/20`}
          </Badge>

          <Button
            variant="outline"
            size="sm"
            onClick={() => handleSave(false)}
            disabled={saving || loading || isReadOnly}
            className="border-blue-200 text-blue-700 hover:bg-blue-50"
          >
            {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
            Sauvegarder
          </Button>
          <Button
            size="sm"
            onClick={() => handleSave(true)}
            disabled={saving || loading || isReadOnly}
            className="bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-700"
          >
            {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-1" />}
            Valider
          </Button>
        </div>
      </div>

      {/* Header fiche */}
      <div className="bg-white border-2 border-slate-800 rounded-xl p-4 text-center">
        <h2 className="text-lg font-bold text-slate-900">
          FICHE DE SAISIE — {group.evaluationTypeName}
        </h2>
        <div className="text-sm text-slate-600 mt-1">
          Classe : <strong>{group.className}</strong> • {group.periodName} • {dateRange}
        </div>
      </div>

      {/* ⭐ Bannière lecture seule si l'évaluation a déjà été validée/soumise */}
      {isReadOnly && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center gap-2 text-sm text-amber-800">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span className="font-semibold">
            {active.every(s => s === 'VALIDATED' || s === 'LOCKED')
              ? "Cette évaluation a été validée par l'administration. Les notes sont verrouillées."
              : active.some(s => s === 'SUBMITTED')
              ? "Cette évaluation a été soumise au directeur. Elle est en attente de validation."
              : "Vous avez déjà validé cette saisie. Pour modifier les notes, l'administration doit la réinitialiser."}
          </span>
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          <p className="ml-3 text-sm text-gray-500">Chargement des élèves et notes…</p>
        </div>
      ) : rows.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-10 text-center">
          <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-600 font-medium">Aucun élève dans cette classe</p>
          <p className="text-sm text-gray-400 mt-1">
            Vérifiez que des élèves sont inscrits dans la classe {group.className}.
          </p>
        </div>
      ) : (
        <>
          {/* Recherche */}
          <div className="relative max-w-xs">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher un élève…"
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
            <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          </div>

          {/* Tableau registre */}
          <div className="bg-white border-2 border-slate-800 rounded-xl overflow-x-auto">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100">
                  <th rowSpan={2} className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase w-12">N°</th>
                  <th rowSpan={2} className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase" style={{ minWidth: '180px' }}>Nom et prénom</th>
                  <th rowSpan={2} className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase w-12">Sexe</th>
                  <th rowSpan={2} className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase w-20">Présence</th>
                  {group.subjects.map((subject, idx) => (
                    isMaternelle ? (
                      <th key={idx} className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase text-center min-w-[100px]">
                        {subject.name}
                        <div className="text-[9px] text-slate-400 font-normal">TS / S / PS</div>
                      </th>
                    ) : (
                      <th key={idx} colSpan={3} className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase text-center min-w-[180px]">
                        {subject.name}
                      </th>
                    )
                  ))}
                  {!isMaternelle && (
                    <th rowSpan={2} className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase w-16">Total gén.</th>
                  )}
                  <th rowSpan={2} className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase w-16">Seuil</th>
                </tr>
                {!isMaternelle && (
                  <tr className="bg-slate-50">
                    {group.subjects.map((_, idx) => (
                      <>
                        <th key={`cm-h-${idx}`} className="border border-slate-300 px-2 py-1 font-bold text-slate-600 text-[10px]">CM /18</th>
                        <th key={`cp-h-${idx}`} className="border border-slate-300 px-2 py-1 font-bold text-slate-600 text-[10px]">CP /2</th>
                        <th key={`tot-h-${idx}`} className="border border-slate-300 px-2 py-1 font-bold text-slate-600 text-[10px]">Total</th>
                      </>
                    ))}
                  </tr>
                )}
              </thead>
              <tbody>
                {filteredRows.map((row, idx) => {
                  const totalGeneral = isMaternelle ? null : group.subjects.reduce((sum, subj) => {
                    const s = row.scores[subj.id];
                    return sum + (s && typeof s.score === 'number' && !s.isAbsent ? s.score : 0);
                  }, 0);
                  const seuilAtteint = isMaternelle ? null : (
                    totalGeneral !== null && totalGeneral >= (10 * group.subjects.length * 0.5)
                  );

                  return (
                    <tr
                      key={row.studentId}
                      className={cn(
                        'hover:bg-slate-50 transition-colors',
                        idx % 2 === 1 && 'bg-slate-50/50',
                        Object.values(row.scores).some(s => s?.isAbsent) && 'bg-red-50/30'
                      )}
                    >
                      <td className="border border-slate-300 px-2 py-1 text-center font-semibold text-slate-600">{idx + 1}</td>
                      <td className="border border-slate-300 px-2 py-1 font-medium text-slate-900">{row.studentName}</td>
                      <td className="border border-slate-300 px-2 py-1 text-center">
                        {row.gender === 'M' ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-cyan-100 text-cyan-700">M</span>
                        ) : row.gender === 'F' ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-pink-100 text-pink-700">F</span>
                        ) : '—'}
                      </td>
                      {/* Colonne Présence P/A */}
                      <td className="border border-slate-300 px-1 py-1 text-center">
                        <div className="flex gap-1 justify-center">
                          <button
                            type="button"
                            onClick={() => {
                              if (isReadOnly) return;
                              setRows(prev => prev.map(r => {
                                if (r.studentId !== row.studentId) return r;
                                const newScores = { ...r.scores };
                                group.subjects.forEach(subj => {
                                  newScores[subj.id] = { ...newScores[subj.id], isAbsent: false };
                                });
                                return { ...r, scores: newScores };
                              }));
                            }}
                            disabled={isReadOnly}
                            title="Présent"
                            className={cn(
                              'px-2 py-1 rounded text-xs font-bold transition',
                              !Object.values(row.scores).some(s => s?.isAbsent)
                                ? 'bg-emerald-600 text-white'
                                : 'bg-gray-100 text-gray-600 hover:bg-emerald-100',
                              isReadOnly && 'opacity-30 cursor-not-allowed'
                            )}
                          >
                            P
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (isReadOnly) return;
                              setRows(prev => prev.map(r => {
                                if (r.studentId !== row.studentId) return r;
                                const newScores = { ...r.scores };
                                group.subjects.forEach(subj => {
                                  newScores[subj.id] = {
                                    ...newScores[subj.id],
                                    isAbsent: true,
                                    score: null,
                                    qualitativeCode: null,
                                  };
                                });
                                return { ...r, scores: newScores };
                              }));
                            }}
                            disabled={isReadOnly}
                            title="Absent"
                            className={cn(
                              'px-2 py-1 rounded text-xs font-bold transition',
                              Object.values(row.scores).some(s => s?.isAbsent)
                                ? 'bg-red-600 text-white'
                                : 'bg-gray-100 text-gray-600 hover:bg-red-100',
                              isReadOnly && 'opacity-30 cursor-not-allowed'
                            )}
                          >
                            A
                          </button>
                        </div>
                      </td>

                      {/* Matières */}
                      {group.subjects.map((subject) => {
                        const score = row.scores[subject.id] || { score: null, qualitativeCode: null, isAbsent: false, comment: '' };
                        if (isMaternelle) {
                          return (
                            <td key={subject.id} className="border border-slate-300 px-1 py-1 text-center">
                              <div className="flex gap-1 justify-center">
                                {['TS', 'S', 'PS'].map((opt) => (
                                  <button
                                    key={opt}
                                    type="button"
                                    onClick={() => !score.isAbsent && !isReadOnly && handleScoreChange(row.studentId, subject.id, opt)}
                                    disabled={score.isAbsent || isReadOnly}
                                    title={opt === 'TS' ? 'Très Satisfaisant' : opt === 'S' ? 'Satisfaisant' : 'Peu Satisfaisant'}
                                    className={cn(
                                      'px-2 py-1 rounded text-xs font-bold transition',
                                      score.qualitativeCode === opt
                                        ? opt === 'TS'
                                          ? 'bg-emerald-600 text-white'
                                          : opt === 'S'
                                            ? 'bg-blue-600 text-white'
                                            : 'bg-amber-600 text-white'
                                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
                                      (score.isAbsent || isReadOnly) && 'opacity-30 cursor-not-allowed'
                                    )}
                                  >
                                    {opt}
                                  </button>
                                ))}
                              </div>
                            </td>
                          );
                        }
                        return (
                          <>
                            {/* ⭐ Primaire : 3 cellules CM /18 + CP /2 + Total */}
                            <td key={`cm-${subject.id}`} className="border border-slate-300 p-0">
                              <input
                                type="number"
                                step="0.5"
                                min="0"
                                max="18"
                                value={score.isAbsent ? '' : (score.cm ?? '')}
                                onChange={(e) => handleCmChange(row.studentId, subject.id, e.target.value)}
                                disabled={score.isAbsent || isReadOnly}
                                placeholder="—"
                                className={cn(
                                  'w-full px-1 py-1 text-center text-xs font-bold border-0 bg-transparent',
                                  'focus:outline-none focus:ring-1 focus:ring-blue-400',
                                  score.isAbsent && 'opacity-30 cursor-not-allowed bg-red-50',
                                  !score.isAbsent && score.cm !== null && typeof score.cm === 'number' &&
                                    (Number(score.cm) < 10 ? 'text-rose-600' : Number(score.cm) >= 14 ? 'text-emerald-600' : 'text-slate-900')
                                )}
                              />
                            </td>
                            <td key={`cp-${subject.id}`} className="border border-slate-300 p-0">
                              <input
                                type="number"
                                step="0.25"
                                min="0"
                                max="2"
                                value={score.isAbsent ? '' : (score.cp ?? '')}
                                onChange={(e) => handleCpChange(row.studentId, subject.id, e.target.value)}
                                disabled={score.isAbsent || isReadOnly || (score.cm === null || score.cm < 10)}
                                placeholder="—"
                                title={score.cm !== null && score.cm >= 10 ? 'Critère de Perfectionnement (0, 1 ou 2)' : 'CP disponible uniquement si CM ≥ 10'}
                                className={cn(
                                  'w-full px-1 py-1 text-center text-xs font-bold border-0 bg-transparent',
                                  'focus:outline-none focus:ring-1 focus:ring-blue-400',
                                  (score.isAbsent || isReadOnly || score.cm === null || score.cm < 10) && 'opacity-30 cursor-not-allowed bg-slate-50'
                                )}
                              />
                            </td>
                            <td key={`tot-${subject.id}`} className="border border-slate-300 px-2 py-1 text-center font-bold bg-slate-50">
                              {score.isAbsent ? '—' : ((score.cm != null || score.cp != null) ? Number((score.cm || 0) + (score.cp || 0)).toFixed(2) : '—')}
                            </td>
                          </>
                        );
                      })}

                      {/* Total général */}
                      {!isMaternelle && (
                        <td className="border border-slate-300 px-2 py-1 text-center font-bold text-blue-700 bg-blue-50">
                          {totalGeneral !== null ? totalGeneral.toFixed(2) : '—'}
                        </td>
                      )}
                      {/* Seuil */}
                      <td className="border border-slate-300 px-2 py-1 text-center">
                        {isMaternelle ? (
                          group.subjects.every(subj => {
                            const s = row.scores[subj.id];
                            return s && s.qualitativeCode;
                          }) ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-600 mx-auto" />
                          ) : (
                            <span className="text-slate-300 text-xs">—</span>
                          )
                        ) : seuilAtteint ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-600 mx-auto" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-500 mx-auto" />
                        )}
                      </td>
                    </tr>
                  );
                })}

                {filteredRows.length === 0 && (
                  <tr>
                    <td
                      colSpan={isMaternelle ? 5 + group.subjects.length + 1 : 5 + group.subjects.length * 3 + 2}
                      className="border border-slate-300 px-4 py-8 text-center text-slate-400 text-sm"
                    >
                      Aucun élève trouvé.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Légende */}
          <div className="bg-gray-50 rounded-xl p-3 text-xs text-gray-600">
            <p className="font-semibold mb-1">
              {isMaternelle
                ? 'Légende — Évaluation qualitative (Maternelle)'
                : 'Légende — Évaluation quantitative (Primaire)'}
            </p>
            {isMaternelle ? (
              <ul className="space-y-0.5 ml-4">
                <li><strong className="text-emerald-700">TS</strong> = Très Satisfaisant</li>
                <li><strong className="text-blue-700">S</strong> = Satisfaisant</li>
                <li><strong className="text-amber-700">PS</strong> = Peu Satisfaisant</li>
                <li><strong className="text-emerald-600">P</strong> = Présent · <strong className="text-red-600">A</strong> = Absent</li>
              </ul>
            ) : (
              <ul className="space-y-0.5 ml-4">
                <li><strong>CM</strong> = Critère Maximal, noté sur /18</li>
                <li><strong>CP</strong> = Critère de Perfectionnement, noté sur /2</li>
                <li className="text-amber-700">⭐ CP disponible uniquement si CM ≥ 10/18</li>
                <li><strong>Total</strong> = CM + CP (max /20)</li>
                <li><strong className="text-emerald-600">P</strong> = Présent · <strong className="text-red-600">A</strong> = Absent</li>
                <li className="text-emerald-700">CM ≥ 10 : admis (en vert).</li>
                <li className="text-rose-700">CM &lt; 10 : échec (en rouge).</li>
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ============================================================================
// ⭐ TABS HEADER — Switch entre "Mes évaluations" et "Bulletins à signer"
// ============================================================================

function TeacherTabsHeader({
  tab, setTab, bulletinsCount,
}: {
  tab: 'evaluations' | 'bulletins';
  setTab: (t: 'evaluations' | 'bulletins') => void;
  bulletinsCount: number;
}) {
  return (
    <div className="flex items-center gap-1 border-b border-gray-200 mb-2">
      <button
        onClick={() => setTab('evaluations')}
        className={cn(
          'flex items-center gap-2 px-4 py-2 text-sm font-semibold border-b-2 transition-colors -mb-px',
          tab === 'evaluations'
            ? 'border-blue-600 text-blue-700'
            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
        )}
      >
        <FileEdit className="w-4 h-4" />
        Mes évaluations
      </button>
      <button
        onClick={() => setTab('bulletins')}
        className={cn(
          'flex items-center gap-2 px-4 py-2 text-sm font-semibold border-b-2 transition-colors -mb-px relative',
          tab === 'bulletins'
            ? 'border-amber-600 text-amber-700'
            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
        )}
      >
        <FileText className="w-4 h-4" />
        Bulletins à signer
        {bulletinsCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
            {bulletinsCount > 9 ? '9+' : bulletinsCount}
          </span>
        )}
      </button>
    </div>
  );
}

// ============================================================================
// ⭐ BULLETINS À SIGNER — Vue dédiée pour les enseignants
// Liste les classes où le directeur a distribué des bulletins (TEACHER_DISTRIBUTED)
// Permet de signer (SignatureCanvas) et de renvoyer au directeur.
// ⭐ Anti-screenshot activé sur tout le contenu de cette vue.
// ============================================================================

function useAntiScreenshot(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;

    const handleContextMenu = (e: MouseEvent) => { e.preventDefault(); };
    const handleSelectStart = (e: Event) => { e.preventDefault(); };
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'p') { e.preventDefault(); }
      if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'S') { e.preventDefault(); }
      if (e.key === 'PrintScreen') {
        e.preventDefault();
        if (navigator.clipboard) navigator.clipboard.writeText('').catch(() => {});
      }
    };
    const handleCopy = (e: ClipboardEvent) => {
      if (e.clipboardData && e.clipboardData.types.includes('Files')) {
        e.preventDefault();
      }
    };

    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('selectstart', handleSelectStart);
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('copy', handleCopy);
    document.body.style.userSelect = 'none';
    document.body.style.webkitUserSelect = 'none';

    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('selectstart', handleSelectStart);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('copy', handleCopy);
      document.body.style.userSelect = '';
      document.body.style.webkitUserSelect = '';
    };
  }, [enabled]);
}

interface ClassBulletinSummary {
  classId: string;
  className: string;
  periodId: string;
  periodName: string;
  // ⭐ Infos du type d'évaluation (EM1, EM2, EC, EP, etc.) — peuvent être null
  //    pour les anciens bulletins sans evaluationTypeId
  evaluationTypeId: string | null;
  evaluationTypeName: string;
  evaluationTypeCode: string;
  total: number;
  counts: {
    DRAFT: number;
    DIRECTOR_SIGNED: number;
    TEACHER_DISTRIBUTED: number;
    TEACHER_SIGNED: number;
    TEACHER_RETURNED: number;
    PARENT_SENT: number;
    BLOCKED: number;
  };
  currentStatus: string;
}

function TeacherBulletinsToSign({
  academicYearId,
  onBackToEvaluations,
}: {
  academicYearId?: string;
  onBackToEvaluations: () => void;
}) {
  const { user } = useAppSession();
  // ⭐ Anti-screenshot activé en permanence sur cette vue
  useAntiScreenshot(true);

  const [loading, setLoading] = useState(true);
  const [classesSummaries, setClassesSummaries] = useState<ClassBulletinSummary[]>([]);
  const [periods, setPeriods] = useState<{ id: string; name: string }[]>([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState<string | null>(null);
  const [signingClass, setSigningClass] = useState<ClassBulletinSummary | null>(null);
  const [signature, setSignature] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // ── Charger la liste des périodes ──────────────────────────────────────────
  useEffect(() => {
    if (!academicYearId) return;
    fetch(`/api/settings/academic-years/${academicYearId}/periods`, { credentials: 'include' })
      .then((res) => res.json())
      .then((data) => {
        const list = Array.isArray(data) ? data : (data?.items || data?.data || []);
        setPeriods(list.map((p: any) => ({ id: p.id, name: p.name || p.label || 'Période' })));
        if (list.length > 0 && !selectedPeriodId) {
          setSelectedPeriodId(list[0].id);
        }
      })
      .catch(() => setPeriods([]));
  }, [academicYearId]);

  // ── Charger les bulletins de l'enseignant (par période) ────────────────────
  const loadTeacherBulletins = useCallback(async () => {
    if (!academicYearId || !selectedPeriodId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      // ⭐ Utiliser l'API teacher-bulletins qui renvoie :
      //   - bulletins : liste complète des bulletins de l'enseignant
      //   - classes   : résumé par classe (classId, className, total, counts, currentStatus)
      // Plus besoin d'appeler workflow-status pour chaque classe — le backend
      // fait déjà le travail.
      const res = await apiClient.get('/institutional-exams/bulletins/teacher-bulletins', {
        params: { periodId: selectedPeriodId },
      });
      const data = res.data || {};
      const classesArray = Array.isArray(data.classes) ? data.classes : [];

      const summaries: ClassBulletinSummary[] = classesArray.map((cls: any) => ({
        classId: cls.classId,
        className: cls.className || `Classe ${cls.classId.slice(-4)}`,
        periodId: selectedPeriodId,
        periodName: periods.find(p => p.id === selectedPeriodId)?.name || '',
        // ⭐ Infos du type d'évaluation (peuvent être null pour les anciens)
        evaluationTypeId: cls.evaluationTypeId || null,
        evaluationTypeName: cls.evaluationTypeName || 'Bulletin',
        evaluationTypeCode: cls.evaluationTypeCode || '',
        total: cls.total || 0,
        counts: {
          DRAFT: cls.counts?.DRAFT || 0,
          DIRECTOR_SIGNED: cls.counts?.DIRECTOR_SIGNED || 0,
          TEACHER_DISTRIBUTED: cls.counts?.TEACHER_DISTRIBUTED || 0,
          TEACHER_SIGNED: cls.counts?.TEACHER_SIGNED || 0,
          TEACHER_RETURNED: cls.counts?.TEACHER_RETURNED || 0,
          PARENT_SENT: cls.counts?.PARENT_SENT || 0,
          BLOCKED: cls.counts?.BLOCKED || 0,
        },
        currentStatus: cls.currentStatus || 'DRAFT',
      }));
      setClassesSummaries(summaries);
    } catch (err) {
      console.error('Error loading teacher bulletins', err);
      setClassesSummaries([]);
    } finally {
      setLoading(false);
    }
  }, [academicYearId, selectedPeriodId, periods]);

  useEffect(() => {
    loadTeacherBulletins();
  }, [loadTeacherBulletins]);

  // ── Signer ──────────────────────────────────────────────────────────────────
  const handleSign = async () => {
    if (!signingClass || !signature || !selectedPeriodId) return;
    setActionLoading(true);
    try {
      // ⭐ Passer evaluationTypeId pour ne signer QUE ce type d'éval
      const body: any = { periodId: selectedPeriodId, signature };
      if (signingClass.evaluationTypeId) {
        body.evaluationTypeId = signingClass.evaluationTypeId;
      }
      await apiClient.post(
        `/institutional-exams/bulletins/class/${signingClass.classId}/teacher-sign`,
        body
      );
      toastSuccess('Signature appliquée', {
        description: `Tous les bulletins${signingClass.evaluationTypeName && signingClass.evaluationTypeName !== 'Bulletin' ? ` de ${signingClass.evaluationTypeName}` : ''} ont été signés par l'enseignant.`,
      });
      setSigningClass(null);
      setSignature(null);
      loadTeacherBulletins();
    } catch (err: any) {
      toastError('Erreur', { description: err.response?.data?.message || err.message });
    } finally {
      setActionLoading(false);
    }
  };

  // ── Renvoyer au directeur ────────────────────────────────────────────────────
  // ⭐ Utilise un modal personnalisé au lieu du confirm() natif
  const [returnClass, setReturnClass] = useState<ClassBulletinSummary | null>(null);

  const handleReturnClick = (cls: ClassBulletinSummary) => {
    setReturnClass(cls);
  };

  const handleReturnConfirm = async () => {
    if (!returnClass || !selectedPeriodId) return;
    setActionLoading(true);
    try {
      // ⭐ Passer evaluationTypeId pour ne renvoyer QUE ce type d'éval
      const body: any = { periodId: selectedPeriodId };
      if (returnClass.evaluationTypeId) {
        body.evaluationTypeId = returnClass.evaluationTypeId;
      }
      const res = await apiClient.post(
        `/institutional-exams/bulletins/class/${returnClass.classId}/teacher-return`,
        body
      );
      const data = res.data || {};
      const signaturesReapplied = data.signaturesReapplied || 0;
      const returnedCount = data.returnedCount || 0;
      const evalTypeSuffix = returnClass.evaluationTypeName && returnClass.evaluationTypeName !== 'Bulletin'
        ? ` de ${returnClass.evaluationTypeName}` : '';
      toastSuccess('Bulletins renvoyés au directeur', {
        description: signaturesReapplied > 0
          ? `${returnedCount} bulletin(s)${evalTypeSuffix} renvoyé(s) avec votre signature (${signaturesReapplied} signature(s) ré-appliquée(s) sur des bulletins récents).`
          : `${returnedCount} bulletin(s)${evalTypeSuffix} renvoyé(s) avec votre signature appliquée sur chacun.`,
      });
      setReturnClass(null);
      loadTeacherBulletins();
    } catch (err: any) {
      toastError('Erreur', { description: err.response?.data?.message || err.message });
    } finally {
      setActionLoading(false);
    }
  };

  // ── UI ─────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* En-tête */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <FileText className="w-6 h-6 text-amber-600" />
          Bulletins à signer
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Bulletins distribués par le directeur — à signer puis à renvoyer.
        </p>
      </div>

      {/* Sélecteur de période */}
      {periods.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-600 font-semibold">Période :</span>
          {periods.map((p) => (
            <button
              key={p.id}
              onClick={() => setSelectedPeriodId(p.id)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors',
                selectedPeriodId === p.id
                  ? 'bg-amber-600 text-white'
                  : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
              )}
            >
              {p.name}
            </button>
          ))}
        </div>
      )}

      {/* Alerte anti-screenshot */}
      <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 flex items-start gap-2">
        <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
        <div>
          <strong>Protection active :</strong> Les captures d'écran, le clic droit et
          l'impression (Ctrl+P) sont désactivés sur cet onglet. Toute tentative est
          journalisée. Les bulletins ne peuvent être ni téléchargés ni imprimés par
          l'enseignant — seule la signature et le renvoi au directeur sont autorisés.
        </div>
      </div>

      {/* Loading */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-amber-600" />
          <span className="ml-2 text-gray-600">Chargement des bulletins...</span>
        </div>
      ) : classesSummaries.length === 0 ? (
        <Card className="border-gray-200 shadow-sm">
          <CardContent className="py-12 text-center">
            <FileText className="w-10 h-10 mx-auto mb-2 text-gray-300" />
            <p className="font-medium text-gray-600">Aucun bulletin à signer</p>
            <p className="text-xs mt-1 text-gray-400">
              Le directeur n'a pas encore distribué de bulletins pour cette période,
              ou vous n'êtes assigné(e) à aucune classe avec bulletins distribués.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={onBackToEvaluations}
              className="mt-4"
            >
              ← Retour à Mes évaluations
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {classesSummaries.map((cls) => (
            <ClassBulletinCard
              key={cls.classId}
              cls={cls}
              onSign={() => { setSigningClass(cls); setSignature(null); }}
              onReturn={() => handleReturnClick(cls)}
              actionLoading={actionLoading}
            />
          ))}
        </div>
      )}

      {/* Signature Modal */}
      {signingClass && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-md w-full mx-4">
            <h3 className="text-sm font-bold text-slate-900 mb-2 flex items-center gap-2">
              <PenTool className="w-4 h-4 text-blue-600" />
              Signature enseignant
            </h3>
            {/* ⭐ Récap clair : type d'éval + période + classe */}
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-2 mb-3">
              <p className="text-sm font-bold text-slate-900">
                {signingClass.evaluationTypeName && signingClass.evaluationTypeName !== 'Bulletin'
                  ? `${signingClass.evaluationTypeName}${signingClass.evaluationTypeCode ? ` [${signingClass.evaluationTypeCode}]` : ''}`
                  : 'Bulletin'}
              </p>
              <p className="text-xs text-slate-600">
                {signingClass.periodName} · {signingClass.className} · {signingClass.total} bulletin(s)
              </p>
            </div>
            <p className="text-xs text-slate-500 mb-4">
              Cette signature sera appliquée à <strong>tous les bulletins</strong> de
              ce groupe sans exception.
            </p>
            <div className="border border-slate-300 rounded-lg p-2 bg-slate-50/50 mb-4">
              <SignatureCanvas
                width={340}
                height={120}
                onSignatureChange={setSignature}
                placeholder="Signez ici"
              />
            </div>
            <div className="flex items-center justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => { setSigningClass(null); setSignature(null); }}
                className="text-sm"
              >
                Annuler
              </Button>
              <Button
                onClick={handleSign}
                disabled={!signature || actionLoading}
                className="bg-blue-600 hover:bg-blue-700 text-white text-sm"
              >
                {actionLoading
                  ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  : <CheckCircle className="w-4 h-4 mr-2" />}
                Valider la signature
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ⭐ Modal personnalisé de confirmation "Renvoyer au directeur" */}
      {returnClass && (
        <ReturnConfirmModal
          cls={returnClass}
          onConfirm={handleReturnConfirm}
          onClose={() => setReturnClass(null)}
          loading={actionLoading}
        />
      )}
    </div>
  );
}

// ─── Modal personnalisé de confirmation pour "Renvoyer au directeur" ──────────
// ⭐ Affiche clairement : "Bulletin de l'évaluation [Type] — [Période]"
//    au lieu du générique "bulletins de la classe X pour la période Y".
function ReturnConfirmModal({
  cls, onConfirm, onClose, loading,
}: {
  cls: ClassBulletinSummary;
  onConfirm: () => void;
  onClose: () => void;
  loading: boolean;
}) {
  // ⭐ Construction du libellé lisible du bulletin
  //    Ex: "Bulletin de l'Évaluation mensuelle 1 — Trimestre 1"
  //    Ex: "Bulletin — Trimestre 1" (si pas de type d'éval)
  const evalTypeLabel = cls.evaluationTypeName && cls.evaluationTypeName !== 'Bulletin'
    ? `Bulletin de l'${cls.evaluationTypeName}`
    : 'Bulletin';
  const periodLabel = cls.periodName || 'période en cours';
  const fullBulletinLabel = `${evalTypeLabel} — ${periodLabel}`;
  // ⭐ Suffixe avec code (ex: "[EM1]") si dispo
  const codeSuffix = cls.evaluationTypeCode ? ` [${cls.evaluationTypeCode}]` : '';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
        {/* Header coloré */}
        <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0">
              <Undo className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-bold text-white">Renvoyer au directeur</h3>
              <p className="text-xs text-white/90 truncate">
                {fullBulletinLabel}{codeSuffix} · {cls.className}
              </p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="p-5 space-y-3">
          {/* ⭐ Libellé clair : "Bulletin de l'évaluation X — Trimestre Y" */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
            <p className="text-[10px] font-bold text-slate-600 uppercase mb-1">
              Bulletin concerné
            </p>
            <p className="text-sm font-bold text-slate-900">
              {evalTypeLabel}{codeSuffix}
            </p>
            <p className="text-xs text-slate-600 mt-0.5">
              Période : <strong>{periodLabel}</strong>
            </p>
            <p className="text-xs text-slate-600">
              Classe : <strong>{cls.className}</strong>
            </p>
            <p className="text-xs text-slate-600">
              Nombre de bulletins : <strong>{cls.total}</strong>
            </p>
          </div>

          <p className="text-sm text-slate-700">
            Vous êtes sur le point de <strong>renvoyer au directeur</strong> les
            <strong> {cls.total} bulletin(s)</strong> ci-dessus. Votre signature
            sera appliquée sur chacun.
          </p>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-900 flex items-start gap-2">
            <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold mb-1">Signature appliquée</p>
              <p>
                Votre signature électronique sera présente sur chaque bulletin
                renvoyé au directeur — exactement comme pour la signature
                directeurs. Le directeur verra votre signature sur chaque bulletin
                dans son interface.
              </p>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-900 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold mb-1">À noter</p>
              <p>
                Après cette action, ces bulletins ne seront plus accessibles dans
                votre interface. Le directeur prendra le relais pour la suite du
                workflow (envoi aux parents).
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={loading}
            className="text-sm"
          >
            Annuler
          </Button>
          <Button
            onClick={onConfirm}
            disabled={loading}
            className="bg-amber-600 hover:bg-amber-700 text-white text-sm"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Renvoi en cours...
              </>
            ) : (
              <>
                <Undo className="w-4 h-4 mr-2" />
                Confirmer le renvoi
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

function ClassBulletinCard({
  cls, onSign, onReturn, actionLoading,
}: {
  cls: ClassBulletinSummary;
  onSign: () => void;
  onReturn: () => void;
  actionLoading: boolean;
}) {
  const c = cls.counts;
  const isDistributed = cls.currentStatus === 'TEACHER_DISTRIBUTED';
  const isSigned = cls.currentStatus === 'TEACHER_SIGNED';
  const isReturned = cls.currentStatus === 'TEACHER_RETURNED';
  const isParentSent = cls.currentStatus === 'PARENT_SENT';

  // ⭐ Libellé du bulletin — affiche le type d'évaluation en priorité
  //    Ex: "Évaluation mensuelle 1 [EM1]" ou "Bulletin" si pas de type
  const hasEvalType = cls.evaluationTypeName && cls.evaluationTypeName !== 'Bulletin';
  const evalTypeDisplay = hasEvalType
    ? `${cls.evaluationTypeName}${cls.evaluationTypeCode ? ` [${cls.evaluationTypeCode}]` : ''}`
    : 'Bulletin';

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
        <div className="flex items-center gap-3">
          <div className={cn(
            'w-10 h-10 rounded-lg flex items-center justify-center text-white',
            isDistributed ? 'bg-amber-500' :
            isSigned ? 'bg-blue-600' :
            isReturned ? 'bg-purple-600' :
            isParentSent ? 'bg-emerald-600' :
            'bg-gray-400'
          )}>
            <FileText className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            {/* ⭐ Titre : type d'évaluation (EM1, EM2, EC, etc.) */}
            <p className="font-bold text-gray-900 truncate">
              {evalTypeDisplay}
            </p>
            <p className="text-xs text-gray-500">
              {cls.className} · {cls.periodName} · {cls.total} bulletin(s)
            </p>
          </div>
        </div>
        <span className={cn(
          'text-xs font-semibold px-3 py-1 rounded-full whitespace-nowrap',
          isDistributed ? 'bg-amber-100 text-amber-700' :
          isSigned ? 'bg-blue-100 text-blue-700' :
          isReturned ? 'bg-purple-100 text-purple-700' :
          isParentSent ? 'bg-emerald-100 text-emerald-700' :
          'bg-gray-100 text-gray-600'
        )}>
          {isDistributed ? 'À signer' :
           isSigned ? 'Signé par vous' :
           isReturned ? 'Renvoyé au directeur' :
           isParentSent ? 'Envoyé aux parents' :
           'En attente'}
        </span>
      </div>

      {/* Workflow status */}
      <div className="flex items-center gap-1 flex-wrap text-[10px] mb-3">
        <WorkflowChip label="Brouillon" done={c.DRAFT > 0} active={cls.currentStatus === 'DRAFT'} muted />
        <Arrow />
        <WorkflowChip label="Signé Directeur" done={c.DIRECTOR_SIGNED > 0 || c.TEACHER_DISTRIBUTED > 0 || c.TEACHER_SIGNED > 0} />
        <Arrow />
        <WorkflowChip label="Distribué" done={c.TEACHER_DISTRIBUTED > 0 || c.TEACHER_SIGNED > 0} active={isDistributed} />
        <Arrow />
        <WorkflowChip label="Signé Enseignant" done={c.TEACHER_SIGNED > 0 || c.TEACHER_RETURNED > 0} active={isSigned} />
        <Arrow />
        <WorkflowChip label="Renvoyé" done={c.TEACHER_RETURNED > 0} active={isReturned} />
        <Arrow />
        <WorkflowChip label="Envoyé Parents" done={c.PARENT_SENT > 0} active={isParentSent} />
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2">
        {isDistributed && (
          <Button
            onClick={onSign}
            disabled={actionLoading}
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm"
          >
            <PenTool className="w-4 h-4 mr-2" />
            Signer les bulletins{hasEvalType ? ` — ${cls.evaluationTypeName}` : ''}
          </Button>
        )}
        {isSigned && (
          <Button
            onClick={onReturn}
            disabled={actionLoading}
            className="bg-amber-600 hover:bg-amber-700 text-white text-sm"
          >
            {actionLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Undo className="w-4 h-4 mr-2" />}
            Renvoyer au directeur{hasEvalType ? ` — ${cls.evaluationTypeName}` : ''}
          </Button>
        )}
        {isReturned && (
          <div className="text-xs text-purple-700 font-semibold flex items-center gap-1">
            <CheckCircle className="w-4 h-4" /> Bulletins renvoyés au directeur
          </div>
        )}
        {isParentSent && (
          <div className="text-xs text-emerald-700 font-semibold flex items-center gap-1">
            <CheckCircle className="w-4 h-4" /> Bulletins envoyés aux parents
          </div>
        )}
      </div>
    </div>
  );
}

function WorkflowChip({
  label, done, active, muted,
}: {
  label: string;
  done?: boolean;
  active?: boolean;
  muted?: boolean;
}) {
  return (
    <span className={cn(
      'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border',
      active ? 'bg-blue-600 text-white border-blue-600' :
      done ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
      muted ? 'bg-gray-50 text-gray-400 border-gray-200' :
      'bg-slate-50 text-slate-500 border-slate-200'
    )}>
      {done && <CheckCircle className="w-2.5 h-2.5 mr-0.5" />}
      {label}
    </span>
  );
}

function Arrow() {
  return <span className="text-gray-300 text-[10px]">→</span>;
}
