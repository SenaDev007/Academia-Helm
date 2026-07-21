"use client";

/**
 * ============================================================================
 * PORTAIL ENSEIGNANT — Layout dédié
 * ============================================================================
 *
 * Sidebar spécifique pour les enseignants avec accès à :
 *   1. Dashboard
 *   2. Espace Pédagogique (cahier journal, fiches, registre, cahier de texte, devoirs)
 *   3. Emploi du Temps (le sien)
 *   4. Mes Classes (élèves, suivi)
 *   5. Bibliothèque
 *   6. EduCast (vidéos pédagogiques)
 *   7. Travaux & Suivi
 *   8. Communication (chat)
 *   9. ORION (alertes pédagogiques)
 *
 * Pas d'accès aux : Finances, RH, Paramètres, Administration générale
 * ============================================================================
 */

import { useAppSession } from "@/contexts/AppSessionContext";
import { useModuleContext } from "@/hooks/useModuleContext";
import { useSchoolIdentity } from "@/hooks/useSchoolIdentity";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, BookOpen, CalendarDays, Users, Library,
  Video, ClipboardList, MessageSquare, Loader2, GraduationCap,
  BarChart3, Settings, Building2,
} from "lucide-react";
import { cn } from "@/lib/utils";

const TEACHER_MODULES = [
  { path: "/app/teacher", label: "Dashboard", icon: LayoutDashboard, desc: "Cours du jour, classes assignées" },
  { path: "/app/teacher/pedagogy", label: "Espace Pédagogique", icon: BookOpen, desc: "Cahier journal, fiches, registre d'appel, cahier de texte, devoirs" },
  { path: "/app/teacher/timetable", label: "Emploi du Temps", icon: CalendarDays, desc: "Mon emploi du temps" },
  { path: "/app/teacher/classes", label: "Mes Classes", icon: Users, desc: "Liste des élèves par classe" },
  { path: "/app/teacher/tasks", label: "Travaux & Suivi", icon: ClipboardList, desc: "Tâches assignées et suivi" },
  { path: "/app/teacher/library", label: "Bibliothèque", icon: Library, desc: "Ressources et documents" },
  { path: "/app/teacher/educast", label: "EduCast", icon: Video, desc: "Vidéos et contenus pédagogiques" },
  { path: "/app/teacher/orion", label: "ORION", icon: BarChart3, desc: "Alertes et analyses pédagogiques" },
  { path: "/app/teacher/communication", label: "Communication", icon: MessageSquare, desc: "Messages et chats" },
];

export default function TeacherLayout({ children }: { children: React.ReactNode }) {
  const { user, tenant } = useAppSession();
  const { academicYear } = useModuleContext();
  const { identity: school } = useSchoolIdentity();
  const pathname = usePathname();

  if (!academicYear?.id) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  const teacherName = user ? `${user.firstName} ${user.lastName}`.trim() : "Enseignant";

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar enseignant */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col fixed inset-y-0 left-0 z-30">
        {/* Logo + Nom école + Profil */}
        <div className="h-20 flex items-center gap-3 px-4 border-b border-slate-200">
          {school?.logoUrl ? (
            <img src={school.logoUrl} alt={school.schoolName} className="h-10 w-10 rounded-lg object-cover" />
          ) : (
            <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
              <Building2 className="h-5 w-5 text-blue-600" />
            </div>
          )}
          <div className="min-w-0">
            <p className="text-xs font-bold text-slate-900 truncate">{school?.schoolName || tenant?.name || "École"}</p>
            <p className="text-[10px] text-slate-400">{academicYear?.label || ""}</p>
          </div>
        </div>

        {/* Profil enseignant */}
        <div className="px-4 py-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
              <GraduationCap className="h-4 w-4 text-blue-600" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-900 truncate">{teacherName}</p>
              <p className="text-[10px] text-slate-400">Enseignant</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-1">
          {TEACHER_MODULES.map((mod) => {
            const isActive = pathname === mod.path || (mod.path !== "/app/teacher" && pathname.startsWith(mod.path));
            const Icon = mod.icon;
            return (
              <Link
                key={mod.path}
                href={mod.path}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                  isActive
                    ? "bg-blue-50 text-blue-700 border-l-4 border-blue-600"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900 border-l-4 border-transparent"
                )}
                title={mod.desc}
              >
                <Icon className="h-5 w-5 flex-shrink-0" />
                <span className="truncate">{mod.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="p-3 border-t border-slate-200">
          <Link
            href="/app"
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-slate-500 hover:bg-slate-50 hover:text-slate-700"
          >
            <Settings className="h-4 w-4" />
            <span>Portail École</span>
          </Link>
        </div>
      </aside>

      {/* Contenu principal */}
      <div className="flex-1 ml-64">
        {/* Top bar */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 sticky top-0 z-20">
          <h1 className="text-lg font-bold text-slate-900">
            {TEACHER_MODULES.find((m) => pathname === m.path || (m.path !== "/app/teacher" && pathname.startsWith(m.path)))?.label || "Portail Enseignant"}
          </h1>
          <div className="text-sm text-slate-500">
            {academicYear?.label || ""}
          </div>
        </header>

        {/* Contenu de la page */}
        <main className="p-4 sm:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
