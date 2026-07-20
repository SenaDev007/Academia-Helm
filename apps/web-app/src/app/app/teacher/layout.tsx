"use client";

/**
 * ============================================================================
 * PORTAIL ENSEIGNANT — Layout dédié (séparé du portail école)
 * ============================================================================
 *
 * Layout spécifique pour les enseignants avec sa propre sidebar.
 * N'affiche PAS la PilotageSidebar (réservée au portail école).
 *
 * Modules visibles :
 *   - Dashboard (cours du jour, classes assignées)
 *   - Espace Pédagogique (cahier journal, fiches, registre, cahier de texte, devoirs)
 *   - Mes Classes (liste des élèves par classe)
 *   - Bibliothèque
 *   - EduCast (vidéos pédagogiques)
 *   - Communication (chat)
 * ============================================================================
 */

import { useAppSession } from "@/contexts/AppSessionContext";
import { useModuleContext } from "@/hooks/useModuleContext";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, BookOpen, Users, Library, Video,
  MessageSquare, Loader2, GraduationCap, Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";

const TEACHER_MODULES = [
  { path: "/app/teacher", label: "Tableau de bord", icon: LayoutDashboard },
  { path: "/app/teacher/pedagogy", label: "Espace Pédagogique", icon: BookOpen },
  { path: "/app/teacher/classes", label: "Mes Classes", icon: Users },
  { path: "/app/teacher/library", label: "Bibliothèque", icon: Library },
  { path: "/app/teacher/educast", label: "EduCast", icon: Video },
  { path: "/app/teacher/communication", label: "Communication", icon: MessageSquare },
];

export default function TeacherLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAppSession();
  const { academicYear } = useModuleContext();
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
        {/* Logo + Profil */}
        <div className="h-16 flex items-center gap-3 px-4 border-b border-slate-200">
          <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
            <GraduationCap className="h-5 w-5 text-blue-600" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-slate-900 truncate">{teacherName}</p>
            <p className="text-xs text-slate-500">Enseignant</p>
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
            <span>Retour au portail école</span>
          </Link>
        </div>
      </aside>

      {/* Contenu principal */}
      <div className="flex-1 ml-64">
        {/* Top bar */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 sticky top-0 z-20">
          <h1 className="text-lg font-bold text-slate-900">
            {TEACHER_MODULES.find((m) => pathname.startsWith(m.path))?.label || "Portail Enseignant"}
          </h1>
          <div className="text-sm text-slate-500">
            {academicYear?.label || ""}
          </div>
        </header>

        {/* Contenu de la page */}
        <main className="p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
