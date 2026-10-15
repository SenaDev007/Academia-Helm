'use client';

/**
 * ============================================================================
 * HELM ENSEIGNANT — SHELL DE L'ESPACE CONNECTÉ
 * ============================================================================
 *
 * Monte la pile de providers dont les workspaces pédagogiques existants ont
 * besoin (même pile que /app, en version allégée — pas d'offline bootstrap
 * massif ni de modaux d'administration) :
 *
 *   QueryProvider → I18nProvider → AppSessionProvider → AcademicYearProvider
 *   → SchoolLevelProvider → BilingualProvider
 *
 * puis le chrome ProfLayout (header + sidebar propres au mini-SaaS).
 */

import { ReactNode, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  GraduationCap,
  LayoutDashboard,
  BookOpen,
  ClipboardList,
  CalendarDays,
  Calculator,
  Users,
  Settings,
  LogOut,
  Menu,
  X,
} from 'lucide-react';
import { QueryProvider } from '@/providers/QueryProvider';
import { AppSessionProvider } from '@/contexts/AppSessionContext';
import { AcademicYearProvider } from '@/contexts/AcademicYearContext';
import { SchoolLevelProvider } from '@/contexts/SchoolLevelContext';
import { BilingualProvider } from '@/contexts/BilingualContext';
import { I18nProvider } from '@/contexts/I18nContext';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useAppSession } from '@/contexts/AppSessionContext';
import type { User, Tenant } from '@/types';

const NAV_ITEMS = [
  { href: '/prof/dashboard', label: 'Tableau de bord', icon: LayoutDashboard },
  { href: '/prof/pedagogie', label: 'Espace pédagogique', icon: BookOpen },
  { href: '/prof/travaux', label: 'Travaux & suivi', icon: ClipboardList },
  { href: '/prof/planification', label: 'Planification annuelle', icon: CalendarDays },
  { href: '/prof/examens', label: 'Évaluations & bulletins', icon: Calculator },
  { href: '/prof/eleves', label: 'Mes élèves', icon: Users },
  { href: '/prof/parametres', label: 'Paramètres', icon: Settings },
];

export interface ProfShellProps {
  children: ReactNode;
  user: User;
  tenant: Tenant;
}

export function ProfShell({ children, user, tenant }: ProfShellProps) {
  return (
    <I18nProvider>
      <QueryProvider>
        <AppSessionProvider user={user} tenant={tenant}>
          <AcademicYearProvider>
            <SchoolLevelProvider>
              <BilingualProvider>
                <ProfLayout>{children}</ProfLayout>
              </BilingualProvider>
            </SchoolLevelProvider>
          </AcademicYearProvider>
        </AppSessionProvider>
      </QueryProvider>
    </I18nProvider>
  );
}

function ProfLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { user, tenant } = useAppSession();
  const { academicYear, schoolLevel } = useModuleContext();
  const [mobileOpen, setMobileOpen] = useState(false);

  const displayName =
    [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.email || 'Enseignant';

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // best-effort — la purge cookie côté serveur a déjà été tentée
    }
    window.location.href = '/prof/login';
  };

  const nav = (
    <nav className="space-y-1 px-3 py-4">
      {NAV_ITEMS.map((item) => {
        const active = pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            prefetch={false}
            onClick={() => setMobileOpen(false)}
            className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
              active
                ? 'bg-teal-50 text-teal-700'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <item.icon className={`h-4.5 w-4.5 ${active ? 'text-teal-600' : 'text-slate-400'}`} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ── Sidebar desktop ── */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-slate-200 bg-white lg:flex">
        <div className="flex h-16 items-center gap-3 border-b border-slate-200 px-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-600 text-white">
            <GraduationCap className="h-5 w-5" />
          </div>
          <div className="min-w-0 leading-tight">
            <p className="truncate text-sm font-bold text-slate-900">Helm Enseignant</p>
            <p className="truncate text-xs text-slate-500">
              {tenant?.name || 'Espace personnel'}
            </p>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">{nav}</div>
        <div className="border-t border-slate-200 p-3">
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-red-50 hover:text-red-600"
          >
            <LogOut className="h-4.5 w-4.5 text-slate-400" />
            Se déconnecter
          </button>
        </div>
      </aside>

      {/* ── Sidebar mobile ── */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-slate-900/50"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 flex w-72 flex-col bg-white shadow-xl">
            <div className="flex h-16 items-center justify-between border-b border-slate-200 px-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-600 text-white">
                  <GraduationCap className="h-5 w-5" />
                </div>
                <span className="text-sm font-bold text-slate-900">Helm Enseignant</span>
              </div>
              <button onClick={() => setMobileOpen(false)} className="p-1 text-slate-500">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">{nav}</div>
            <div className="border-t border-slate-200 p-3">
              <button
                onClick={handleLogout}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-red-50 hover:text-red-600"
              >
                <LogOut className="h-4.5 w-4.5 text-slate-400" />
                Se déconnecter
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* ── Contenu ── */}
      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur sm:px-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileOpen(true)}
              className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="leading-tight">
              <p className="text-sm font-semibold text-slate-900">{displayName}</p>
              <p className="text-xs text-slate-500">
                {academicYear?.label || 'Année scolaire'}
                {schoolLevel?.label ? ` · ${schoolLevel.label}` : ''}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-teal-100 text-sm font-bold text-teal-700">
              {(user?.firstName || user?.email || 'P').charAt(0).toUpperCase()}
            </div>
          </div>
        </header>

        <main className="p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
