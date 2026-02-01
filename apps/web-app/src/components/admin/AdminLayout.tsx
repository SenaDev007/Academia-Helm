/**
 * Admin Layout Client Component
 * 
 * Layout sécurisé pour le panel Super Admin
 * Vérifie que l'utilisateur a le rôle SUPER_ADMIN
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { User } from '@/types';
import { Shield, LogOut, Menu, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import AppIcon from '@/components/ui/AppIcon';
import type { IconName } from '@/lib/icons';

interface AdminLayoutProps {
  children: React.ReactNode;
  user: User;
}

export default function AdminLayout({ children, user }: AdminLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Vérification du rôle SUPER_ADMIN
  useEffect(() => {
    if (user.role !== 'SUPER_ADMIN') {
      router.push('/app'); // Rediriger vers le dashboard normal
    }
  }, [user.role, router]);

  if (user.role !== 'SUPER_ADMIN') {
    return null; // Ne rien afficher si pas Super Admin
  }

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/login');
    } catch (error) {
      console.error('Error logging out:', error);
      router.push('/login');
    }
  };

  const menuItems: Array<{ path: string; label: string; icon: IconName }> = [
    { path: '/admin', label: 'Dashboard', icon: 'dashboard' },
    { path: '/admin/tenants', label: 'Établissements', icon: 'classes' },
    { path: '/admin/pricing', label: 'Pricing & Billing', icon: 'reports' },
    { path: '/admin/devices', label: 'Appareils', icon: 'dashboard' },
    { path: '/admin/testimonials', label: 'Témoignages', icon: 'communication' },
    { path: '/admin/audit', label: 'Journal d\'audit', icon: 'reports' },
    { path: '/admin/stats', label: 'Statistiques', icon: 'analysis' },
  ];

  return (
    <div className="min-h-screen bg-cloud">
      {/* Sidebar */}
      <aside
        className={`fixed left-0 top-0 h-full bg-blue-900 text-white transition-all duration-300 z-40 ${
          sidebarOpen ? 'w-64' : 'w-16'
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-blue-800">
            {sidebarOpen && (
              <div className="flex items-center space-x-2">
                <Shield className="w-6 h-6 text-gold-500" />
                <h2 className="text-lg font-bold">Super Admin</h2>
              </div>
            )}
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 rounded-md hover:bg-blue-800 transition-colors"
              aria-label="Toggle sidebar"
            >
              {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>

          {/* User Info */}
          <div className="p-4 border-b border-blue-800">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gold-500 rounded-full flex items-center justify-center">
                <span className="text-blue-900 font-bold text-sm">
                  {user.firstName.charAt(0)}{user.lastName.charAt(0)}
                </span>
              </div>
              {sidebarOpen && (
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">
                    {user.firstName} {user.lastName}
                  </p>
                  <p className="text-xs text-gray-400 truncate">{user.email}</p>
                </div>
              )}
            </div>
          </div>

          {/* Menu */}
          <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
            {menuItems.map((item) => {
              const isActive = pathname === item.path || pathname.startsWith(item.path + '/');
              return (
                <Link
                  key={item.path}
                  href={item.path}
                  className={`flex items-center space-x-3 px-4 py-3 rounded-md transition-colors ${
                    isActive
                      ? 'bg-blue-800 text-white'
                      : 'text-graphite-500 hover:bg-blue-800 hover:text-white'
                  }`}
                  title={!sidebarOpen ? item.label : undefined}
                >
                  <AppIcon 
                    name={item.icon} 
                    size="menu" 
                    className="text-current"
                    aria-hidden="true"
                  />
                  {sidebarOpen && (
                    <span className="text-sm font-medium">{item.label}</span>
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Logout */}
          <div className="p-4 border-t border-blue-800">
            <button
              onClick={handleLogout}
              className="flex items-center space-x-3 w-full px-4 py-3 rounded-md text-graphite-500 hover:bg-blue-800 hover:text-white transition-colors"
            >
              <LogOut className="w-5 h-5" />
              {sidebarOpen && <span className="text-sm font-medium">Déconnexion</span>}
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className={`transition-all duration-300 bg-cloud ${sidebarOpen ? 'ml-64' : 'ml-16'}`}>
        <main className="p-6">
          {children}
        </main>
      </div>
    </div>
  );
}

