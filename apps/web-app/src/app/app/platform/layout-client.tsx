/**
 * PlatformLayoutClient — Client Component pour le layout du back-office
 *
 * Affiche un layout minimaliste (sans sidebar école, sans PilotageLayout)
 * avec juste le header admin + le contenu de la page.
 */

'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Building2,
  Users,
  CreditCard,
  ShieldAlert,
  History,
  HelpCircle,
  BarChart3,
  Settings,
  LogOut,
  Menu,
  X,
} from 'lucide-react';

interface PlatformLayoutClientProps {
  admin: {
    id: string;
    email: string;
    name: string;
    role: string;
  };
  children: React.ReactNode;
}

const NAV_ITEMS = [
  { href: '/app/platform', label: 'Tableau de bord', icon: LayoutDashboard },
  { href: '/app/platform/aggregation', label: 'Agrégation globale', icon: BarChart3 },
  { href: '/app/platform/tenants', label: 'Tenants', icon: Building2 },
  { href: '/app/platform/users', label: 'Utilisateurs', icon: Users },
  { href: '/app/platform/payments', label: 'Paiements', icon: CreditCard },
  { href: '/app/platform/support', label: 'Support', icon: HelpCircle },
  { href: '/app/platform/orion', label: 'ORION Pilotage', icon: ShieldAlert },
  { href: '/app/platform/audit', label: 'Audit', icon: History },
  { href: '/app/platform/monitoring', label: 'Monitoring', icon: Settings },
];

export default function PlatformLayoutClient({ admin, children }: PlatformLayoutClientProps) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = async () => {
    await fetch('/api/admin-auth/logout', { method: 'POST' });
    window.location.href = '/admin-login';
  };

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-[#0a1d3f] text-white transform transition-transform duration-300 lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Logo */}
        <div className="p-6 border-b border-white/10">
          <Link href="/app/platform" className="flex items-center gap-3">
            <Image
              src="/images/logo-Academia Hub.png"
              alt="Academia Helm"
              width={40}
              height={40}
              className="w-10 h-10 object-contain"
            />
            <div>
              <div className="font-bold text-sm">Academia Helm</div>
              <div className="text-[10px] text-amber-400 font-bold uppercase tracking-wider">
                Back-office
              </div>
            </div>
          </Link>
        </div>

        {/* Nav */}
        <nav className="p-4 space-y-1 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 200px)' }}>
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-white/15 text-white'
                    : 'text-slate-300 hover:bg-white/5 hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* User + Logout */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-white/10">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-full bg-amber-500 flex items-center justify-center font-bold text-sm">
              {admin.name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-bold truncate">{admin.name}</div>
              <div className="text-[10px] text-slate-400 truncate">{admin.email}</div>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold text-slate-300 hover:bg-rose-500/20 hover:text-rose-300 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Déconnexion
          </button>
        </div>
      </aside>

      {/* Overlay mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main content */}
      <div className="flex-1 lg:ml-64">
        {/* Mobile header */}
        <header className="lg:hidden bg-[#0a1d3f] text-white p-4 flex items-center justify-between sticky top-0 z-30">
          <button onClick={() => setSidebarOpen(true)} className="p-2">
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <Image
              src="/images/logo-Academia Hub.png"
              alt="Academia Helm"
              width={28}
              height={28}
              className="w-7 h-7 object-contain"
            />
            <span className="font-bold text-sm">Back-office</span>
          </div>
          <div className="w-9" />
        </header>

        {/* Content */}
        <main className="p-4 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
