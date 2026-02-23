/**
 * ============================================================================
 * MOBILE LAYOUT - PARENTS
 * ============================================================================
 * 
 * Wireframe :
 * [ Accueil ]
 * [ Paiements / Résultats ]
 * [ Messages ]
 * [ Profil ]
 * 
 * Mobile = consultation & interaction légère
 * ============================================================================
 */

'use client';

import { useState } from 'react';
import { Home, DollarSign, FileText, MessageSquare, User } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface ParentMobileLayoutProps {
  children: React.ReactNode;
}

export default function ParentMobileLayout({ children }: ParentMobileLayoutProps) {
  const pathname = usePathname();

  const navItems = [
    { path: '/mobile/parent', label: 'Accueil', icon: Home },
    { path: '/mobile/parent/payments', label: 'Paiements', icon: DollarSign },
    { path: '/mobile/parent/results', label: 'Résultats', icon: FileText },
    { path: '/mobile/parent/messages', label: 'Messages', icon: MessageSquare },
    { path: '/mobile/parent/profile', label: 'Profil', icon: User },
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

