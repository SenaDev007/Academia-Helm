/**
 * ============================================================================
 * MOBILE LAYOUT - ÉLÈVES
 * ============================================================================
 * 
 * Wireframe :
 * [ Accueil ]
 * [ Emploi du temps ]
 * [ Devoirs ]
 * [ Résultats ]
 * [ Notifications ]
 * 
 * Mobile = consultation & interaction légère
 * ============================================================================
 */

'use client';

import { useState } from 'react';
import { Home, Calendar, BookOpen, FileText, Bell } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface StudentMobileLayoutProps {
  children: React.ReactNode;
}

export default function StudentMobileLayout({ children }: StudentMobileLayoutProps) {
  const pathname = usePathname();

  const navItems = [
    { path: '/mobile/student', label: 'Accueil', icon: Home },
    { path: '/mobile/student/schedule', label: 'Emploi du temps', icon: Calendar },
    { path: '/mobile/student/homework', label: 'Devoirs', icon: BookOpen },
    { path: '/mobile/student/results', label: 'Résultats', icon: FileText },
    { path: '/mobile/student/notifications', label: 'Notifications', icon: Bell },
  ];

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="px-4 py-3">
          <h1 className="text-lg font-bold text-navy-900">Academia Helm</h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="p-4">
        {children}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-20">
        <div className="flex items-center justify-around px-2 py-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.path || pathname.startsWith(item.path + '/');
            return (
              <Link
                key={item.path}
                href={item.path}
                className={`flex flex-col items-center space-y-1 px-3 py-2 rounded-md transition-colors ${
                  isActive ? 'text-navy-900' : 'text-gray-500'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-xs font-medium">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

