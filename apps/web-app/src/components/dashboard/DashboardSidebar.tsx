/**
 * Dashboard Sidebar
 * 
 * Sidebar modulaire pour le dashboard
 */

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useMemo } from 'react';
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
import { useEnabledFeatureCodes } from '@/hooks/useEnabledFeatureCodes';

interface DashboardSidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  user?: User; // Pour afficher conditionnellement les liens SUPER_DIRECTOR
}

type MenuItem = { path: string; label: string; icon: typeof LayoutDashboard; featureCode?: string };

export default function DashboardSidebar({ isOpen, onToggle, user }: DashboardSidebarProps) {
  const pathname = usePathname();
  const { enabledSet, loading } = useEnabledFeatureCodes();
  const isSuperDirector = user?.role === 'SUPER_DIRECTOR';

  const baseMenuItems: MenuItem[] = [
    { path: '/app', label: 'Tableau de bord', icon: LayoutDashboard },
    { path: '/app/students', label: 'Élèves', icon: Users, featureCode: 'STUDENTS' },
    { path: '/app/exams', label: 'Examens', icon: BookOpen, featureCode: 'EXAMS' },
    { path: '/app/finance', label: 'Finances', icon: Calculator, featureCode: 'FINANCE' },
    { path: '/app/hr', label: 'RH & Paie', icon: UserCheck, featureCode: 'HR_PAYROLL' },
    { path: '/app/planning', label: 'Planning', icon: Building, featureCode: 'PEDAGOGY' },
    { path: '/app/communication', label: 'Communication', icon: MessageSquare, featureCode: 'COMMUNICATION' },
    { path: '/app/reports', label: 'Bilans & KPI', icon: BarChart3 },
    { path: '/app/settings/billing', label: 'Facturation', icon: FileText },
    { path: '/app/settings', label: 'Paramètres', icon: Settings },
  ];

  const menuItems = useMemo(() => {
    const showItem = (item: MenuItem) =>
      !item.featureCode || loading || enabledSet.has(item.featureCode);
    let items = baseMenuItems.filter(showItem);
    if (isSuperDirector) {
      const idx = items.findIndex((i) => i.path === '/app/communication');
      const consolidated = { path: '/app/consolidated', label: 'Bilans consolidés', icon: Network };
      items = idx >= 0
        ? [...items.slice(0, idx + 1), consolidated, ...items.slice(idx + 1)]
        : [...items, consolidated];
    }
    return items;
  }, [enabledSet, loading, isSuperDirector]);

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

