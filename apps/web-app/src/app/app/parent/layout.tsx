"use client";

/**
 * ============================================================================
 * PORTAIL PARENT — Layout dédié (séparé du portail école)
 * ============================================================================
 *
 * Layout spécifique pour les parents d'élèves avec sa propre sidebar.
 * Design mobile-first, simple et centré sur le suivi.
 *
 * Modules visibles :
 *   - Dashboard (enfants liés, situation financière, bulletins)
 *   - Mes Enfants (suivi par enfant)
 *   - Paiements (solde, reçus, échéanciers)
 *   - Bulletins (résultats scolaires)
 *   - Présences (absences, retards)
 *   - Messages (communication avec l'école)
 *   - Documents (attestations, certificats)
 * ============================================================================
 */

import { useState } from "react";
import { useAppSession } from "@/contexts/AppSessionContext";
import { useModuleContext } from "@/hooks/useModuleContext";
import { useSchoolIdentity } from "@/hooks/useSchoolIdentity";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Users, CreditCard, FileText,
  CalendarCheck, MessageSquare, Folder, Loader2, Heart,
  Building2, Phone, Mail, MapPin, GraduationCap, LogOut, Menu, X,
  BookOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { LogoutModal } from "@/components/auth/LogoutModal";
// ⛔ OFFLINE-FIRST DÉSACTIVÉ
// import { SyncButton } from "@/components/header/SyncButton";
import AcademicYearSelector from "@/components/pilotage/AcademicYearSelector";

const PARENT_MODULES = [
  { path: "/app/parent", label: "Tableau de bord", icon: LayoutDashboard },
  { path: "/app/parent/children", label: "Mes Enfants", icon: Users },
  { path: "/app/parent/cahier-journal", label: "Cahier journal", icon: BookOpen },
  { path: "/app/parent/attendance", label: "Présences", icon: CalendarCheck },
  { path: "/app/parent/payments", label: "Paiements", icon: CreditCard },
  { path: "/app/parent/results", label: "Notes et Bulletins", icon: FileText },
  { path: "/app/parent/messages", label: "Messages", icon: MessageSquare },
  { path: "/app/parent/documents", label: "Documents", icon: Folder },
];

export default function ParentLayout({ children }: { children: React.ReactNode }) {
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
    // ⭐ FIX : rediriger vers le portail parent (pas le login admin)
    //    On garde le tenant slug pour pré-remplir le formulaire de login.
    //    Le portal=PARENT permet à LoginPage d'afficher directement le bon onglet.
    const tenantSlug = tenant?.slug || (typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('tenant') : null);
    const loginUrl = new URL('/login', window.location.origin);
    if (tenantSlug) loginUrl.searchParams.set('tenant', tenantSlug);
    loginUrl.searchParams.set('portal', 'parent');
    window.location.href = loginUrl.toString();
  };

  if (!academicYear?.id) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  const parentName = user ? `${user.firstName} ${user.lastName}`.trim() : "Parent";
  const currentModuleLabel = PARENT_MODULES.find((m) => pathname === m.path || (m.path !== "/app/parent" && pathname.startsWith(m.path)))?.label || "Portail Parent";

  return (
    <div className="min-h-screen bg-emerald-50/30">
      {/* ⭐ Overlay mobile */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      {/* Sidebar parent — responsive */}
      <aside
        className={cn(
          "w-64 bg-white border-r border-slate-200 flex flex-col fixed inset-y-0 left-0 z-50 transition-transform duration-300",
          mobileSidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        {/* Logo + Nom école + bouton fermer mobile */}
        <div className="h-20 flex items-center gap-3 px-4 border-b border-slate-200">
          {school?.logoUrl ? (
            <img src={school.logoUrl} alt={school.schoolName} className="h-10 w-10 rounded-lg object-cover" />
          ) : (
            <div className="h-10 w-10 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0">
              <Building2 className="h-5 w-5 text-emerald-600" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-slate-900 truncate">{school?.schoolName || tenant?.name || "École"}</p>
            <p className="text-[10px] text-slate-400">{academicYear?.label || ""}</p>
          </div>
          <button
            onClick={() => setMobileSidebarOpen(false)}
            className="lg:hidden p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg"
            aria-label="Fermer le menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Profil parent */}
        <div className="px-4 py-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
              <Heart className="h-4 w-4 text-emerald-600" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-900 truncate">{parentName}</p>
              <p className="text-[10px] text-slate-400">Parent / Tuteur</p>
            </div>
          </div>
        </div>

        {/* Coordonnées école */}
        {school && (school.phone || school.email || school.address) && (
          <div className="px-4 py-3 border-b border-slate-100 space-y-1">
            {school.phone && (
              <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                <Phone className="h-3 w-3" />
                <span>{school.phone}</span>
              </div>
            )}
            {school.email && (
              <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                <Mail className="h-3 w-3" />
                <span className="truncate">{school.email}</span>
              </div>
            )}
            {school.address && (
              <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                <MapPin className="h-3 w-3" />
                <span className="truncate">{school.address}</span>
              </div>
            )}
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-1">
          {PARENT_MODULES.map((mod) => {
            const isActive = pathname === mod.path || (mod.path !== "/app/parent" && pathname.startsWith(mod.path));
            const Icon = mod.icon;
            return (
              <Link
                key={mod.path}
                href={mod.path}
                onClick={() => setMobileSidebarOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                  isActive
                    ? "bg-emerald-50 text-emerald-700 border-l-4 border-emerald-600"
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

      {/* Contenu principal — responsive */}
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
            {/* ⭐ Bouton sync offline (pull/push) — disponible aussi pour les parents */}
            {/* ⛔ OFFLINE-FIRST DÉSACTIVÉ — SyncButton supprimé */}
            {/* <SyncButton /> */}
            <AcademicYearSelector />
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
