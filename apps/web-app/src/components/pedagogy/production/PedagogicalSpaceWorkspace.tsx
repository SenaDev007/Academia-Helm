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
 *   6. Fiches Pédagogiques — 5 types (MATH/FRANCAIS/EST/ES/EA) pour le primaire
 *   7. Registre d'Appel — registre mensuel + évaluation certificative + relevés
 *   8. Devoirs — création de devoirs + suivi par élève
 *
 * Design identique aux autres modules (cards, tables, boutons cohérents).
 * Isolation : chaque enseignant ne voit QUE ses classes.
 * ============================================================================
 */

import { useState, useEffect, useCallback } from "react";
import { useModuleContext } from "@/hooks/useModuleContext";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  BookOpen, CalendarCheck, NotebookPen, CalendarDays, FileText,
  Users, Loader2, ChevronRight, RefreshCw, ClipboardList, FileSpreadsheet,
  ClipboardCheck,
} from "lucide-react";

import { MyClassesTab } from "./MyClassesTab";
import { AttendanceTab } from "./AttendanceTab";
import { ClassLogTab } from "./ClassLogTab";
import { CahierJournalTab } from "./CahierJournalTab";
import { CahierSemaineTab } from "./CahierSemaineTab";
import { PedagogicalSheetsTab } from "./PedagogicalSheetsTab";
import { AttendanceRegisterTab } from "./AttendanceRegisterTab";
import { CahierDeTexteTab } from "./CahierDeTexteTab";
import { HomeworkTab } from "./HomeworkTab";

const TABS = [
  { id: 'classes', label: 'Mes Classes', icon: Users, description: 'Effectifs & élèves' },
  { id: 'attendance', label: 'Appel', icon: CalendarCheck, description: 'Présences journalières' },
  { id: 'classlog', label: 'Cahier Journal', icon: NotebookPen, description: 'Séances quotidiennes' },
  { id: 'cahier-journal', label: 'Cahier Journal Hebdo', icon: FileSpreadsheet, description: 'Grille hebdomadaire 5j × 8 matières' },
  { id: 'weekly', label: 'Cahier de Semaine', icon: CalendarDays, description: 'Monitoring institutionnel' },
  { id: 'fiches', label: 'Fiches Pédagogiques', icon: FileText, description: '5 types (MATH/FR/EST/ES/EA)' },
  { id: 'registre', label: 'Registre d\'Appel', icon: ClipboardList, description: 'Registre mensuel + évaluations' },
  { id: 'cahier-texte', label: 'Cahier de Texte', icon: ClipboardCheck, description: 'Évaluations (secondaire)' },
  { id: 'homework', label: 'Devoirs', icon: BookOpen, description: 'Exercices & suivi' },
] as const;

type TabId = typeof TABS[number]['id'];

export function PedagogicalSpaceWorkspace() {
  const { tenant, user, academicYear, schoolLevel } = useModuleContext();
  const [tab, setTab] = useState<TabId>('classes');

  // Résoudre le teacherId depuis le user (role TEACHER)
  const teacherId = user?.teacherId || user?.id || '';

  if (!academicYear?.id) {
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
              tenantId={tenant?.id || ''}
              academicYearId={academicYear.id}
              teacherId={teacherId}
            />
          )}
          {tab === 'attendance' && (
            <AttendanceTab
              tenantId={tenant?.id || ''}
              academicYearId={academicYear.id}
              schoolLevelId={schoolLevel?.schoolLevelId || schoolLevel?.id || ''}
              teacherId={teacherId}
            />
          )}
          {tab === 'classlog' && (
            <ClassLogTab
              tenantId={tenant?.id || ''}
              academicYearId={academicYear.id}
              teacherId={teacherId}
            />
          )}
          {tab === 'cahier-journal' && (
            <CahierJournalTab
              tenantId={tenant?.id || ''}
              academicYearId={academicYear.id}
              teacherId={teacherId}
            />
          )}
          {tab === 'weekly' && (
            <CahierSemaineTab
              tenantId={tenant?.id || ''}
              academicYearId={academicYear.id}
              teacherId={teacherId}
            />
          )}
          {tab === 'fiches' && (
            <PedagogicalSheetsTab
              tenantId={tenant?.id || ''}
              academicYearId={academicYear.id}
              teacherId={teacherId}
            />
          )}
          {tab === 'registre' && (
            <AttendanceRegisterTab
              tenantId={tenant?.id || ''}
              academicYearId={academicYear.id}
              teacherId={teacherId}
            />
          )}
          {tab === 'cahier-texte' && (
            <CahierDeTexteTab
              tenantId={tenant?.id || ''}
              academicYearId={academicYear.id}
              teacherId={teacherId}
            />
          )}
          {tab === 'homework' && (
            <HomeworkTab
              tenantId={tenant?.id || ''}
              academicYearId={academicYear.id}
              schoolLevelId={schoolLevel?.schoolLevelId || schoolLevel?.id || ''}
              teacherId={teacherId}
            />
          )}
        </div>
      </div>
    </div>
  );
}
