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
  ClipboardCheck, Package, Send, Bell,
} from "lucide-react";

import { MyClassesTab } from "./MyClassesTab";
import { AttendanceTab } from "./AttendanceTab";
import { CahierJournalTab } from "./CahierJournalTab";
import { CahierJournalFichesContainer } from "./CahierJournalFichesContainer";
import { CahierSemaineTab } from "./CahierSemaineTab";
import { PedagogicalSheetsTab } from "./PedagogicalSheetsTab";
import { AttendanceRegisterTab } from "./AttendanceRegisterTab";
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
  { id: 'classes', label: 'Mes Classes', icon: Users, description: 'Effectifs & élèves', secondaryOnly: false, maternellePrimaireOnly: false },
  { id: 'attendance', label: 'Appel', icon: CalendarCheck, description: 'Présences journalières', secondaryOnly: false, maternellePrimaireOnly: false },
  { id: 'registre', label: 'Registre d\'Appel', icon: ClipboardList, description: 'Registre mensuel + évaluations', secondaryOnly: false, maternellePrimaireOnly: true },
  { id: 'cahier-journal', label: 'Cahier Journal & Fiches Pédagogiques', icon: FileSpreadsheet, description: 'Grille hebdo + fiches par jour', secondaryOnly: false, maternellePrimaireOnly: true },
  { id: 'weekly', label: 'Cahier de Semaine', icon: CalendarDays, description: 'Monitoring institutionnel', secondaryOnly: false, maternellePrimaireOnly: false },
  // ⭐ Travaux & Suivi — accessible depuis l'Espace Pédagogique (directeurs/promoteurs)
  //    ET depuis la sidebar enseignant (/app/teacher/tasks)
  { id: 'tasks', label: 'Travaux & Suivi', icon: ClipboardList, description: 'Devoirs & suivi des élèves', secondaryOnly: false, maternellePrimaireOnly: false },
  { id: 'cahier-texte', label: 'Cahier de Texte', icon: ClipboardCheck, description: 'Évaluations', secondaryOnly: false, maternellePrimaireOnly: false },
  { id: 'materiel', label: 'Matériel', icon: Package, description: 'Inventaire & ressources', secondaryOnly: false, maternellePrimaireOnly: false },
] as const;

type TabId = typeof ALL_TABS[number]['id'];

export function PedagogicalSpaceWorkspace({
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
