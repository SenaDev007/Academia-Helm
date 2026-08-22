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

import { useState } from "react";
import { useAppSession } from "@/contexts/AppSessionContext";
import { useModuleContext } from "@/hooks/useModuleContext";
import { useSchoolIdentity } from "@/hooks/useSchoolIdentity";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, BookOpen, CalendarDays, Users, Library,
  Video, ClipboardList, MessageSquare, Loader2, GraduationCap,
  FileEdit,
  BarChart3, Building2, LogOut, Menu, X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { LogoutModal } from "@/components/auth/LogoutModal";
// ⛔ OFFLINE-FIRST DÉSACTIVÉ
// import { SyncButton } from "@/components/header/SyncButton";

const TEACHER_MODULES = [
  { path: "/app/teacher", label: "Dashboard", icon: LayoutDashboard, desc: "Cours du jour, classes assignées" },
  { path: "/app/teacher/timetable", label: "Emploi du Temps", icon: CalendarDays, desc: "Mon emploi du temps" },
  { path: "/app/teacher/annual-planning", label: "Planification annuelle", icon: ClipboardList, desc: "Planification pédagogique officielle (CI à CM2 + Maternelle)" },
  { path: "/app/teacher/pedagogy", label: "Espace Pédagogique", icon: BookOpen, desc: "Cahier journal, fiches, registre d'appel, cahier de texte, devoirs" },
  { path: "/app/teacher/tasks", label: "Travaux & Suivi", icon: ClipboardList, desc: "Tâches assignées et suivi" },
  { path: "/app/teacher/exams", label: "Examens & Notes", icon: FileEdit, desc: "Mes évaluations et saisie de notes" },
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
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    } catch {
      // silent — on redirige de toute façon
    }
    // ⭐ FIX : rediriger vers le portail enseignant (pas le login admin)
    //    On garde le tenant slug pour pré-remplir le formulaire de login.
    //    Le portal=TEACHER permet à LoginPage d'afficher directement le bon onglet.
    const tenantSlug = tenant?.slug || (typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('tenant') : null);
    const loginUrl = new URL('/login', window.location.origin);
    if (tenantSlug) loginUrl.searchParams.set('tenant', tenantSlug);
    loginUrl.searchParams.set('portal', 'teacher');
    window.location.href = loginUrl.toString();
  };

  if (!academicYear?.id) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  const teacherName = user ? `${user.firstName} ${user.lastName}`.trim() : "Enseignant";
  const currentModuleLabel = TEACHER_MODULES.find((m) => pathname === m.path || (m.path !== "/app/teacher" && pathname.startsWith(m.path)))?.label || "Portail Enseignant";

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ⭐ Overlay mobile — sombre la page quand la sidebar est ouverte */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      {/* Sidebar enseignant — responsive :
          - Desktop (lg+) : fixed left, width 64, toujours visible
          - Mobile (<lg) : fixed left, width 64, translate-x quand fermée */}
      <aside
        className={cn(
          "w-64 bg-white border-r border-slate-200 flex flex-col fixed inset-y-0 left-0 z-50 transition-transform duration-300",
          // Mobile : drawer qui se ferme
          mobileSidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        {/* Logo + Nom école + Profil + bouton fermer mobile */}
        <div className="h-20 flex items-center gap-3 px-4 border-b border-slate-200">
          {school?.logoUrl ? (
            <img src={school.logoUrl} alt={school.schoolName} className="h-10 w-10 rounded-lg object-cover" />
          ) : (
            <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
              <Building2 className="h-5 w-5 text-blue-600" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-slate-900 truncate">{school?.schoolName || tenant?.name || "École"}</p>
            <p className="text-[10px] text-slate-400">{academicYear?.label || ""}</p>
          </div>
          {/* Bouton fermer (mobile only) */}
          <button
            onClick={() => setMobileSidebarOpen(false)}
            className="lg:hidden p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg"
            aria-label="Fermer le menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Profil enseignant — photo ou initiales (comme module RH) */}
        <div className="px-4 py-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            {/* ⭐ Avatar : photo de l'enseignant ou initiales */}
            {user?.photoUrl ? (
              <img
                src={user.photoUrl}
                alt={teacherName}
                className="h-8 w-8 rounded-full object-cover flex-shrink-0 border border-slate-200"
              />
            ) : (
              <div className="h-8 w-8 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0 text-white text-xs font-bold">
                {(user?.firstName?.[0] || '')}{(user?.lastName?.[0] || '')}
              </div>
            )}
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
                onClick={() => setMobileSidebarOpen(false)}
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
        <div className="p-3 border-t border-slate-200 space-y-1">
          <button
            onClick={() => setLogoutOpen(true)}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-red-600 hover:bg-red-50 hover:text-red-700"
          >
            <LogOut className="h-4 w-4" />
            <span>Se déconnecter</span>
          </button>
        </div>
      </aside>

      {/* Modal de confirmation de déconnexion */}
      <LogoutModal
        open={logoutOpen}
        onClose={() => setLogoutOpen(false)}
        onConfirm={handleLogout}
        loading={loggingOut}
        userName={user ? `${user.firstName} ${user.lastName}`.trim() : undefined}
      />

      {/* Contenu principal — responsive :
          - Desktop (lg+) : ml-64 pour laisser place à la sidebar fixed
          - Mobile (<lg) : ml-0, pas de marge (la sidebar est en drawer) */}
      <div className="lg:ml-64 min-w-0">
        {/* Top bar — responsive avec bouton hamburger mobile */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 sm:px-6 sticky top-0 z-30">
          <div className="flex items-center gap-3 min-w-0">
            {/* Bouton hamburger (mobile only) */}
            <button
              onClick={() => setMobileSidebarOpen(true)}
              className="lg:hidden p-2 text-slate-600 hover:bg-slate-100 rounded-lg"
              aria-label="Ouvrir le menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <h1 className="text-base sm:text-lg font-bold text-slate-900 truncate">
              {currentModuleLabel}
            </h1>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* ⛔ OFFLINE-FIRST DÉSACTIVÉ — SyncButton supprimé */}
            {/* <SyncButton /> */}
            <span className="text-xs sm:text-sm text-slate-500">
              {academicYear?.label || ""}
            </span>
          </div>
        </header>

        {/* Contenu de la page */}
        <main className="p-3 sm:p-4 lg:p-6">
          <div className="min-w-0">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
