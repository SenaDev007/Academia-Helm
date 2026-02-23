/**
 * Dashboard Sidebar
 * 
 * Sidebar modulaire pour le dashboard
 */

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  BookOpen,
  Calculator,
  UserCheck,
  Building,
  MessageSquare,
  Settings,
  ChevronLeft,
  ChevronRight,
  FileText,
  BarChart3,
  Network,
} from 'lucide-react';
import type { User } from '@/types';

interface DashboardSidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  user?: User; // Pour afficher conditionnellement les liens SUPER_DIRECTOR
}

export default function DashboardSidebar({ isOpen, onToggle, user }: DashboardSidebarProps) {
  const pathname = usePathname();
  const isSuperDirector = user?.role === 'SUPER_DIRECTOR';
  
  // Menu items de base
  const baseMenuItems = [
    { path: '/app', label: 'Tableau de bord', icon: LayoutDashboard },
    { path: '/app/students', label: 'Élèves', icon: Users },
    { path: '/app/exams', label: 'Examens', icon: BookOpen },
    { path: '/app/finance', label: 'Finances', icon: Calculator },
    { path: '/app/hr', label: 'RH & Paie', icon: UserCheck },
    { path: '/app/planning', label: 'Planning', icon: Building },
    { path: '/app/communication', label: 'Communication', icon: MessageSquare },
    { path: '/app/reports', label: 'Bilans & KPI', icon: BarChart3 },
    { path: '/app/settings/billing', label: 'Facturation', icon: FileText },
    { path: '/app/settings', label: 'Paramètres', icon: Settings },
  ];
  
  // Ajouter le lien consolidé pour les SUPER_DIRECTOR
  const menuItems = isSuperDirector
    ? [
        ...baseMenuItems.slice(0, 7), // Jusqu'à Communication
        { path: '/app/consolidated', label: 'Bilans consolidés', icon: Network },
        ...baseMenuItems.slice(7), // Le reste
      ]
    : baseMenuItems;

  return (
    <aside
      className={`fixed left-0 top-0 h-full bg-navy-900 text-white transition-all duration-300 z-40 ${
        isOpen ? 'w-64' : 'w-16'
      }`}
    >
      <div className="flex flex-col h-full">
        {/* Toggle Button */}
        <div className="flex items-center justify-between p-4 border-b border-navy-700">
          {isOpen && (
            <h2 className="text-lg font-bold">Academia Helm</h2>
          )}
          <button
            onClick={onToggle}
            className="p-2 rounded-md hover:bg-navy-700 transition-colors"
            aria-label="Toggle sidebar"
          >
            {isOpen ? (
              <ChevronLeft className="w-5 h-5" />
            ) : (
              <ChevronRight className="w-5 h-5" />
            )}
          </button>
        </div>

        {/* Menu Items */}
        <nav className="flex-1 p-4 space-y-2">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.path || pathname.startsWith(item.path + '/');
            
            return (
              <Link
                key={item.path}
                href={item.path}
                className={`flex items-center space-x-3 px-4 py-3 rounded-md transition-colors ${
                  isActive
                    ? 'bg-navy-700 text-white'
                    : 'text-gray-300 hover:bg-navy-800 hover:text-white'
                }`}
                title={!isOpen ? item.label : undefined}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                {isOpen && (
                  <span className="text-sm font-medium">{item.label}</span>
                )}
              </Link>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}

