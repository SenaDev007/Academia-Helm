"use client";

/**
 * ============================================================================
 * ESPACE PÉDAGOGIQUE ENSEIGNANT — Workspace principal
 * ============================================================================
 *
 * Espace de travail professionnel de chaque enseignant.
 * Sous-onglets :
 *   1. Mes Classes — vue d'ensemble + effectifs + accès classe
 *   2. Appel — appel journalier par classe
 *   3. Cahier Journal — saisie des séances quotidiennes
 *   4. Cahier Journal Hebdo — grille hebdomadaire 5 jours × 8 matières
 *   5. Cahier de Semaine — monitoring institutionnel (semainier)
 *   6. Fiches Pédagogiques — 6 types (MATH/FRANCAIS/EST/ES/EA/EPS) pour le primaire
 *   7. Registre d'Appel — registre mensuel + évaluation certificative + relevés
 *   8. Devoirs — création de devoirs + suivi par élève
 *   9. Cahier de Texte — évaluations (visible pour tous les niveaux)
 *  10. Bibliothèque virtuelle — ressources pédagogiques
 *  11. Matériel pédagogique — inventaire et ressources
 *
 *   ⭐ SUPPRIMÉ : Cahier de Test (sous-onglet supprimé définitivement)
 *
 * Design identique aux autres modules (cards, tables, boutons cohérents).
 * Isolation : chaque enseignant ne voit QUE ses classes.
 * ============================================================================
 */

import { useState, useEffect, useCallback } from "react";
import { useModuleContext } from "@/hooks/useModuleContext";
import { useAppSession } from "@/contexts/AppSessionContext";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  BookOpen, CalendarCheck, CalendarDays, FileText,
  Users, Loader2, ChevronRight, RefreshCw, ClipboardList, FileSpreadsheet,
  ClipboardCheck, Package, Send, Bell, CalendarClock,
} from "lucide-react";

import { MyClassesTab } from "./MyClassesTab";
import { AttendanceTab } from "./AttendanceTab";
import { CahierJournalTab } from "./CahierJournalTab";
import { CahierJournalFichesContainer } from "./CahierJournalFichesContainer";
import { CahierSemaineTab } from "./CahierSemaineTab";
import { PedagogicalSheetsTab } from "./PedagogicalSheetsTab";
import { AttendanceRegisterTab } from "./AttendanceRegisterTab";
import { MonthlyPlanningTab } from "./MonthlyPlanningTab";
import { CahierDeTexteTab } from "./CahierDeTexteTab";
import { TeacherMaterialsWorkspace } from "@/components/pedagogy/materials/TeacherMaterialsWorkspace";
import TeacherTasksWorkspace from "@/components/pedagogy/tasks/TeacherTasksWorkspace";
import { useConfirmDialog } from "@/components/ui/confirm-dialog";

// ⭐ Ordre des onglets — Fiches Pédagogiques fusionnées avec Cahier Journal :
//   1. Mes Classes
//   2. Appel (présences journalières)
//   3. Registre d'Appel (registre mensuel + évaluations) — ⭐ MATERNELLE/PRIMAIRE uniquement
//   4. Cahier Journal & Fiches Pédagogiques (grille hebdo 5j × 8 matières + fiches liées) — ⭐ MATERNELLE/PRIMAIRE uniquement
//   5. Cahier de Semaine (monitoring institutionnel)
//   6. Travaux & Suivi (devoirs, exercices & suivi des élèves)
//   7. Cahier de Texte (visible pour tous les niveaux — anciennement secondaire uniquement)
//   8. Matériel pédagogique
//
//   ⭐ Supprimé : Devoirs (fusionné dans Travaux & Suivi)
//   ⭐ Supprimé : Bibliothèque (supprimé du module pédagogie)
//   ⭐ Travaux & Suivi déplacé depuis le module orga pédagogique vers ici
//   ⭐ Cahier de Texte déplacé depuis le module orga pédagogique vers ici
//   ⭐ SUPPRIMÉ : Cahier de Test (sous-onglet supprimé définitivement — ce n'était pas pertinent)
//   ⭐ RESTRICTION NIVEAU : Cahier Journal, Fiches Pédagogiques, Registre d'Appel
//     sont réservés aux niveaux MATERNELLE + PRIMAIRE. Les enseignants du SECONDAIRE
//     (classes de 6e à Terminale) ne voient PAS ces onglets dans leur espace pédagogique.
//     Exception : le PROMOTEUR et les rôles plateforme ont accès à TOUT (tous les niveaux).
const ALL_TABS = [
  { id: 'classes', label: 'My Classes', icon: Users, description: 'Headcount & students', secondaryOnly: false, maternellePrimaireOnly: false },
  { id: 'attendance', label: 'Attendance', icon: CalendarCheck, description: 'Daily attendance', secondaryOnly: false, maternellePrimaireOnly: false },
  { id: 'registre', label: 'Attendance Register', icon: ClipboardList, description: 'Monthly register + evaluations', secondaryOnly: false, maternellePrimaireOnly: true },
  // ⭐ Planification mensuelle — auto-proposition depuis la planification annuelle
  //    L'enseignant édite la planification de son mois pour sa classe.
  //    Terminologie : SA (Situation d'Apprentissage), Séquence, U (Unité), D (Dossier)
  { id: 'monthly-planning', label: 'Monthly Planning', icon: CalendarClock, description: 'Auto-plan + editing', secondaryOnly: false, maternellePrimaireOnly: true },
  { id: 'cahier-journal', label: 'Daily Log & Pedagogical Sheets', icon: FileSpreadsheet, description: 'Weekly grid + daily sheets', secondaryOnly: false, maternellePrimaireOnly: true },
  { id: 'weekly', label: 'Weekly Log', icon: CalendarDays, description: 'Institutional monitoring', secondaryOnly: false, maternellePrimaireOnly: false },
  // ⭐ Travaux & Suivi — accessible depuis l'Espace Pédagogique (directeurs/promoteurs)
  //    ET depuis la sidebar enseignant (/app/teacher/tasks)
  { id: 'tasks', label: 'Assignments & Tracking', icon: ClipboardList, description: 'Homework & student tracking', secondaryOnly: false, maternellePrimaireOnly: false },
  { id: 'cahier-texte', label: 'Text Log', icon: ClipboardCheck, description: 'Evaluations', secondaryOnly: false, maternellePrimaireOnly: false },
  { id: 'materiel', label: 'Materials', icon: Package, description: 'Inventory & resources', secondaryOnly: false, maternellePrimaireOnly: false },
] as const;

type TabId = typeof ALL_TABS[number]['id'];

export function PedagogicalSpaceWorkspaceEN({
  tenantId: propTenantId,
  academicYearId: propAcademicYearId,
  teacherId: propTeacherId,
}: {
  tenantId?: string;
  academicYearId?: string;
  teacherId?: string;
} = {}) {
  const { tenant, academicYear, schoolLevel } = useModuleContext();
  const { user } = useAppSession();
  const [tab, setTab] = useState<TabId>('classes');

  // ⭐ Classes assignées à l'enseignant (pour la planification mensuelle)
  //    - Pour un enseignant : SEULEMENT SES classes (1 ou plusieurs, via teacher-class-assignments)
  //    - Pour la direction/promoteur : TOUTES les classes primaires (CI à CM2)
  const [teacherClasses, setTeacherClasses] = useState<{ value: string; label: string }[]>([]);

  // Résoudre le teacherId depuis le user ou les props
  // Pour les enseignants, on utilise user.id (qui correspond au userId lié au teacher)
  // Pour les rôles non-enseignant (PROMOTER, DIRECTOR, ADMIN), on utilise aussi user.id
  // ⭐ Si pas de user.id ET pas de prop teacherId → message d'erreur.
  // Le backend resolveTeacherFilter() gère ensuite le mode "vue direction" pour
  // les rôles PROMOTER/SCHOOL_OWNER/DIRECTEUR_*/ADMIN qui n'ont pas de profil Teacher.
  const teacherId = propTeacherId || user?.teacherId || user?.id || '';
  const resolvedTenantId = propTenantId || tenant?.id || user?.tenantId || '';
  const resolvedAcademicYearId = propAcademicYearId || academicYear?.id || '';

  // ⭐ Déterminer si le niveau scolaire actif est "Secondaire"
  // pour afficher/masquer l'onglet "Cahier de Texte" (secondaire uniquement)
  // et MASQUER les onglets Cahier Journal / Fiches / Registre (maternelle/primaire uniquement).
  // schoolLevel.code peut être 'MATERNELLE', 'PRIMAIRE', 'SECONDAIRE', 'COLLEGE', 'LYCEE'
  const schoolLevelCode = (schoolLevel?.code || '').toUpperCase();
  const isSecondaryLevel =
    schoolLevelCode.includes('SECOND') ||
    schoolLevelCode.includes('COLLEGE') ||
    schoolLevelCode.includes('LYCEE');

  // ⭐ Rôles "accès global" qui voient TOUS les onglets quel que soit le niveau sélectionné
  //    (PROMOTEUR, plateforme admins, super admin). Ces rôles peuvent basculer entre
  //    les niveaux Maternelle/Primaire/Secondaire dans le dropdown sans perdre l'accès
  //    aux fonctionnalités réservées Maternelle+Primaire (cahier journal, fiches, registre).
  const GLOBAL_ACCESS_ROLES = new Set([
    'PROMOTER', 'PLATFORM_OWNER', 'PLATFORM_SUPER_ADMIN', 'PLATFORM_ADMIN', 'SUPER_ADMIN',
  ]);
  const userRole = (user?.role || '').toUpperCase();
  const hasGlobalAccess = GLOBAL_ACCESS_ROLES.has(userRole);

  // ⭐ Filtrer les onglets visibles selon le niveau scolaire :
  //    - secondaryOnly=true → visible seulement si isSecondaryLevel (ou accès global)
  //    - maternellePrimaireOnly=true → masqué si isSecondaryLevel (sauf accès global)
  //    Le PROMOTEUR voit tous les onglets quel que soit le niveau sélectionné.
  const TABS = ALL_TABS.filter(t => {
    // Onglets secondaire-only (Cahier de Texte) : visibles si niveau secondaire OU accès global
    if (t.secondaryOnly && !isSecondaryLevel && !hasGlobalAccess) return false;
    // ⭐ Onglets maternelle/primaire-only (Cahier Journal, Fiches, Registre) :
    //    masqués si niveau secondaire ET pas d'accès global
    if (t.maternellePrimaireOnly && isSecondaryLevel && !hasGlobalAccess) return false;
    return true;
  });

  // ⭐ Si l'onglet actif n'est plus visible (ex: utilisateur passe du Primaire au Secondaire
  //    alors que l'onglet 'cahier-journal' est actif), on revient à l'onglet 'classes'.
  useEffect(() => {
    if (tab !== 'classes' && !TABS.some(t => t.id === tab)) {
      setTab('classes');
    }
  }, [tab, TABS]);

  // ⭐ Fetch des classes assignées à l'enseignant — pour le sélecteur de la planification mensuelle.
  //    Un enseignant ne doit voir QUE ses classes (pas toutes les classes de l'école).
  //    On fetch via /api/pedagogy/teacher-profiles (pour résoudre user.id → teacher.id)
  //    puis /api/pedagogy/teacher-class-assignments (pour avoir les AcademicClass).
  //    Pour les rôles direction/promoteur, on prend TOUTES les classes CI-CM2.
  useEffect(() => {
    if (tab !== 'monthly-planning') return;
    if (!resolvedAcademicYearId || !teacherId) return;
    // ⭐ Si l'utilisateur a un accès global (direction/promoteur), on prend toutes les classes
    //    INCLANT la Maternelle (qui affichera "pas encore disponible" quand sélectionnée)
    if (hasGlobalAccess) {
      setTeacherClasses([
        { value: 'MATERNELLE_GRANDS', label: 'Maternelle' },
        { value: 'CI', label: 'CI' }, { value: 'CP', label: 'CP' },
        { value: 'CE1', label: 'CE1' }, { value: 'CE2', label: 'CE2' },
        { value: 'CM1', label: 'CM1' }, { value: 'CM2', label: 'CM2' },
      ]);
      return;
    }
    // ⭐ Enseignant : fetch de ses classes assignées
    (async () => {
      try {
        // 1. Récupérer le profil enseignant (user.id → teacher.id)
        const profRes = await fetch(
          `/api/pedagogy/teacher-profiles?academicYearId=${encodeURIComponent(resolvedAcademicYearId)}`,
          { credentials: 'include' }
        );
        const profList = await profRes.json();
        const profiles = Array.isArray(profList) ? profList : (profList?.data || []);
        const myProfile = profiles.find((p: any) =>
          p.userId === user?.id ||
          p.user?.id === user?.id ||
          (p.teacher?.email && user?.email && p.teacher.email.toLowerCase() === user.email.toLowerCase()) ||
          (p.teacher?.matricule && user?.matricule && p.teacher.matricule === user.matricule)
        );
        const myTeacherId = myProfile?.teacherId || myProfile?.id;
        if (!myTeacherId) return;

        // 2. Récupérer les assignments du teacher
        const assignRes = await fetch(
          `/api/pedagogy/teacher-class-assignments?teacherId=${encodeURIComponent(myTeacherId)}&academicYearId=${encodeURIComponent(resolvedAcademicYearId)}`,
          { credentials: 'include' }
        );
        const assignList = await assignRes.json();
        const assignments = Array.isArray(assignList) ? assignList : (assignList?.data || []);

        // 3. Extraire les officialClassId uniques (ex: "CI", "CP", "CE1", ...)
        const classSet = new Map<string, string>(); // value → label
        for (const a of assignments) {
          const officialClassId = a.classSubject?.academicClass?.officialClassId
            || a.classSubject?.academicClass?.name
            || a.academicClass?.officialClassId
            || a.academicClass?.name;
          if (officialClassId) {
            // ⭐ On ne retient que les classes primaires (CI à CM2) — pas maternelle pour la planif mensuelle
            const validClasses = ['CI', 'CP', 'CE1', 'CE2', 'CM1', 'CM2'];
            const upperId = String(officialClassId).toUpperCase();
            if (validClasses.includes(upperId) && !classSet.has(upperId)) {
              classSet.set(upperId, upperId);
            }
          }
        }
        setTeacherClasses(Array.from(classSet.entries()).map(([value, label]) => ({ value, label })));
      } catch (e) {
        console.error('Failed to fetch teacher classes for monthly planning:', e);
      }
    })();
  }, [tab, resolvedAcademicYearId, teacherId, hasGlobalAccess, user?.id, user?.email, user?.matricule]);

  if (!resolvedAcademicYearId) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />
        Chargement de l'année académique…
      </div>
    );
  }

  if (!teacherId) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Users className="h-12 w-12 text-muted-foreground/40 mb-3" />
        <p className="font-medium text-foreground">Aucun profil enseignant trouvé</p>
        <p className="text-sm text-muted-foreground mt-1">
          Votre compte n'est pas lié à un profil enseignant. Contactez l'administration.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Sous-onglets */}
      <div className="space-y-4">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="flex overflow-x-auto border-b border-slate-100">
            {TABS.map((t) => {
              const Icon = t.icon;
              const isActive = tab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={cn(
                    "flex items-center gap-2 px-5 py-3.5 text-sm font-bold transition-all whitespace-nowrap",
                    isActive
                      ? "text-blue-600 border-b-2 border-blue-600 bg-blue-50/50"
                      : "text-slate-500 hover:text-slate-700 hover:bg-slate-50 border-b-2 border-transparent"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span>{t.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Contenu du sous-onglet actif */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-6">
          {tab === 'classes' && (
            <MyClassesTab
              tenantId={resolvedTenantId}
              academicYearId={resolvedAcademicYearId}
              teacherId={teacherId}
            />
          )}
          {tab === 'attendance' && (
            <AttendanceTab
              tenantId={resolvedTenantId}
              academicYearId={resolvedAcademicYearId}
              schoolLevelId={schoolLevel?.schoolLevelId || schoolLevel?.id || ''}
              teacherId={teacherId}
            />
          )}
          {tab === 'cahier-journal' && (
            <CahierJournalFichesContainer
              tenantId={resolvedTenantId}
              academicYearId={resolvedAcademicYearId}
              teacherId={teacherId}
            />
          )}
          {tab === 'weekly' && (
            <CahierSemaineTab
              tenantId={resolvedTenantId}
              academicYearId={resolvedAcademicYearId}
              teacherId={teacherId}
            />
          )}
          {tab === 'registre' && (
            <AttendanceRegisterTab
              tenantId={resolvedTenantId}
              academicYearId={resolvedAcademicYearId}
              teacherId={teacherId}
            />
          )}
          {/* ⭐ Planification mensuelle — auto-proposition depuis la planification annuelle */}
          {tab === 'monthly-planning' && (
            teacherClasses.length === 0 ? (
              <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
                <CalendarClock className="h-12 w-12 text-slate-300 mx-auto mb-2" />
                <p className="text-sm font-medium text-slate-700">Aucune classe assignée</p>
                <p className="text-xs text-slate-500 mt-1">
                  Vous n'avez pas encore de classes assignées. La planification mensuelle
                  n'est accessible qu'aux enseignants titulaires d'au moins une classe.
                  Contactez la direction si vous pensez qu'il s'agit d'une erreur.
                </p>
              </div>
            ) : (
              <MonthlyPlanningTab
                tenantId={resolvedTenantId}
                academicYearId={resolvedAcademicYearId}
                teacherId={teacherId}
                availableClasses={teacherClasses}
                isDirector={hasGlobalAccess}
              />
            )
          )}
          {tab === 'cahier-texte' && (
            <CahierDeTexteTab
              tenantId={resolvedTenantId}
              academicYearId={resolvedAcademicYearId}
              teacherId={teacherId}
            />
          )}
          {/* ⭐ Travaux & Suivi — accessible aux directeurs/promoteurs ET enseignants */}
          {tab === 'tasks' && (
            <TeacherTasksWorkspace />
          )}
          {tab === 'materiel' && (
            <TeacherMaterialsWorkspace teacherId={teacherId} academicYearId={resolvedAcademicYearId} />
          )}
        </div>
      </div>
    </div>
  );
}
