/**
 * ============================================================================
 * PILOTAGE SIDEBAR - NAVIGATION PAR DOMAINES MÉTIER
 * ============================================================================
 * 
 * Navigation orientée "domaines métier", pas par écrans techniques.
 * S'adapte au niveau scolaire, aux modules activés, au rôle utilisateur.
 * 
 * Philosophie : Résumer avant de détailler
 * ============================================================================
 */

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  Calculator,
  BookOpen,
  UserCheck,
  Building,
  MessageSquare,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Network,
  Library,
  Bus,
  UtensilsCrossed,
  HeartPulse,
  ShieldCheck,
  Radio,
  ShoppingBag,
  Brain,
  Calendar,
  Settings,
} from 'lucide-react';
import type { User } from '@/types';
import { useSchoolLevel } from '@/hooks/useSchoolLevel';

interface PilotageSidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  user?: User;
}

export default function PilotageSidebar({ isOpen, onToggle, user }: PilotageSidebarProps) {
  const pathname = usePathname();
  const { currentLevel } = useSchoolLevel();
  const isSuperDirector = user?.role === 'SUPER_DIRECTOR';
  const [mainModulesOpen, setMainModulesOpen] = useState(true);
  const [supplementaryModulesOpen, setSupplementaryModulesOpen] = useState(true);

  // Modules principaux (domaines métier)
  const mainModules = [
    { path: '/app', label: 'Tableau de pilotage', icon: LayoutDashboard },
    { path: '/app/orion', label: 'ORION — Pilotage Direction', icon: Brain },
    { path: '/app/meetings', label: 'Réunions', icon: Calendar },
    { path: '/app/students', label: 'Élèves & Scolarité', icon: Users },
    { path: '/app/finance', label: 'Finances & Économat', icon: Calculator },
    { path: '/app/exams-grades', label: 'Examens, Notes & Bulletins', icon: BookOpen },
    { path: '/app/pedagogy', label: 'Organisation Pédagogique', icon: Building },
    { path: '/app/hr', label: 'Personnel, RH & Paie', icon: UserCheck },
    { path: '/app/communication', label: 'Communication', icon: MessageSquare },
  ];

  // Modules supplémentaires
  const supplementaryModules = [
    { path: '/app/library', label: 'Bibliothèque', icon: Library },
    { path: '/app/transport', label: 'Transport', icon: Bus },
    { path: '/app/canteen', label: 'Cantine', icon: UtensilsCrossed },
    { path: '/app/infirmary', label: 'Infirmerie', icon: HeartPulse },
    { path: '/app/qhse', label: 'QHSE', icon: ShieldCheck },
    { path: '/app/educast', label: 'EduCast', icon: Radio },
    { path: '/app/shop', label: 'Boutique', icon: ShoppingBag },
  ];

  // Module Général (Direction uniquement)
  const generalModule = isSuperDirector
    ? { path: '/app/general', label: 'Module Général', icon: Network }
    : null;

  const isActive = (path: string) => {
    if (path === '/app') {
      return pathname === '/app';
    }
    return pathname.startsWith(path);
  };

  return (
    <aside
      className={`fixed left-0 top-[60px] h-[calc(100vh-60px)] bg-gradient-to-b from-blue-900 via-blue-900 to-blue-800 text-white transition-all duration-300 ease-in-out z-40 shadow-xl ${
        isOpen ? 'w-64' : 'w-16'
      }`}
    >
      <div className="flex flex-col h-full">
        {/* Toggle button */}
        <div className="flex items-center justify-end p-3 border-b border-blue-700/50">
          <button
            onClick={onToggle}
            className="p-2 rounded-lg hover:bg-blue-800/80 transition-all duration-200 text-white hover:scale-105 active:scale-95"
            aria-label="Toggle sidebar"
          >
            {isOpen ? (
              <ChevronLeft className="w-5 h-5" />
            ) : (
              <ChevronRight className="w-5 h-5" />
            )}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-1 scrollbar-thin scrollbar-thumb-blue-700 scrollbar-track-transparent">
          {/* Modules Principaux - déroulant */}
          <div className="mb-6">
            {isOpen ? (
              <>
                <button
                  type="button"
                  onClick={() => setMainModulesOpen(!mainModulesOpen)}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-blue-800/60 transition-colors text-left"
                >
                  <span className="text-xs font-semibold text-blue-300/70 uppercase tracking-wider">
                    Modules principaux
                  </span>
                  <ChevronDown
                    className={`w-4 h-4 text-blue-300/70 transition-transform duration-200 ${
                      mainModulesOpen ? 'rotate-0' : '-rotate-90'
                    }`}
                  />
                </button>
                {mainModulesOpen && (
                  <div className="mt-1 space-y-1">
                    {mainModules.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.path);
              
              return (
                <Link
                  key={item.path}
                  href={item.path}
                  className={`group flex items-center space-x-3 px-3 py-2.5 rounded-lg transition-all duration-200 ${
                    active
                      ? 'bg-gradient-to-r from-blue-700 to-blue-600 text-white shadow-md shadow-blue-900/30'
                      : 'text-blue-100 hover:bg-blue-800/60 hover:text-white hover:translate-x-1'
                  }`}
                  title={!isOpen ? item.label : undefined}
                >
                  <Icon className={`w-5 h-5 flex-shrink-0 transition-transform duration-200 ${
                    active ? 'scale-110' : 'group-hover:scale-105'
                  }`} />
                  {isOpen && (
                    <span className={`text-sm font-medium transition-all duration-200 whitespace-nowrap overflow-hidden text-ellipsis flex-1 ${
                      active ? 'font-semibold' : ''
                    }`} title={item.label}>{item.label}</span>
                  )}
                  {active && isOpen && (
                    <div className="ml-auto w-1.5 h-1.5 bg-white rounded-full flex-shrink-0"></div>
                  )}
                </Link>
              );
            })}
                  </div>
                )}
              </>
            ) : (
              mainModules.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.path);
                return (
                  <Link
                    key={item.path}
                    href={item.path}
                    className="flex items-center justify-center p-2.5 rounded-lg transition-all duration-200 text-blue-100 hover:bg-blue-800/60 hover:text-white"
                    title={item.label}
                  >
                    <Icon className="w-5 h-5 flex-shrink-0" />
                  </Link>
                );
              })
            )}
          </div>

          {/* Module Général (Direction) */}
          {generalModule && (
            <div className="mb-6">
              {isOpen && (
                <p className="text-xs font-semibold text-blue-300/70 uppercase tracking-wider mb-3 px-3">
                  Direction
                </p>
              )}
              <Link
                href={generalModule.path}
                className={`group flex items-center space-x-3 px-3 py-2.5 rounded-lg transition-all duration-200 border-l-2 ${
                  isActive(generalModule.path)
                    ? 'bg-gradient-to-r from-blue-700 to-blue-600 text-white border-gold-500 shadow-md shadow-blue-900/30'
                    : 'text-blue-100 hover:bg-blue-800/60 hover:text-white hover:translate-x-1 border-transparent'
                }`}
                title={!isOpen ? generalModule.label : undefined}
              >
                <Network className={`w-5 h-5 flex-shrink-0 transition-transform duration-200 ${
                  isActive(generalModule.path) ? 'scale-110' : 'group-hover:scale-105'
                }`} />
                {isOpen && (
                  <span className={`text-sm font-medium transition-all duration-200 whitespace-nowrap overflow-hidden text-ellipsis flex-1 ${
                    isActive(generalModule.path) ? 'font-semibold' : ''
                  }`} title={generalModule.label}>{generalModule.label}</span>
                )}
                {isActive(generalModule.path) && isOpen && (
                  <div className="ml-auto w-1.5 h-1.5 bg-gold-500 rounded-full flex-shrink-0"></div>
                )}
              </Link>
            </div>
          )}

          {/* Modules Supplémentaires - déroulant */}
          <div className="mb-6">
            {isOpen ? (
              <>
                <button
                  type="button"
                  onClick={() => setSupplementaryModulesOpen(!supplementaryModulesOpen)}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-blue-800/60 transition-colors text-left"
                >
                  <span className="text-xs font-semibold text-blue-300/70 uppercase tracking-wider">
                    Modules supplémentaires
                  </span>
                  <ChevronDown
                    className={`w-4 h-4 text-blue-300/70 transition-transform duration-200 ${
                      supplementaryModulesOpen ? 'rotate-0' : '-rotate-90'
                    }`}
                  />
                </button>
                {supplementaryModulesOpen && (
                  <div className="mt-1 space-y-1">
                    {supplementaryModules.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.path);
              
              return (
                <Link
                  key={item.path}
                  href={item.path}
                  className={`group flex items-center space-x-3 px-3 py-2.5 rounded-lg transition-all duration-200 ${
                    active
                      ? 'bg-gradient-to-r from-blue-700 to-blue-600 text-white shadow-md shadow-blue-900/30'
                      : 'text-blue-100 hover:bg-blue-800/60 hover:text-white hover:translate-x-1'
                  }`}
                  title={!isOpen ? item.label : undefined}
                >
                  <Icon className={`w-5 h-5 flex-shrink-0 transition-transform duration-200 ${
                    active ? 'scale-110' : 'group-hover:scale-105'
                  }`} />
                  {isOpen && (
                    <span className={`text-sm font-medium transition-all duration-200 whitespace-nowrap overflow-hidden text-ellipsis flex-1 ${
                      active ? 'font-semibold' : ''
                    }`} title={item.label}>{item.label}</span>
                  )}
                  {active && isOpen && (
                    <div className="ml-auto w-1.5 h-1.5 bg-white rounded-full flex-shrink-0"></div>
                  )}
                </Link>
              );
            })}
                  </div>
                )}
              </>
            ) : (
              supplementaryModules.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.path);
                return (
                  <Link
                    key={item.path}
                    href={item.path}
                    className="flex items-center justify-center p-2.5 rounded-lg transition-all duration-200 text-blue-100 hover:bg-blue-800/60 hover:text-white"
                    title={item.label}
                  >
                    <Icon className="w-5 h-5 flex-shrink-0" />
                  </Link>
                );
              })
            )}
          </div>

          {/* Paramètres */}
          <div className="mt-auto pt-4 border-t border-blue-700/50">
            <Link
              href="/app/settings"
              className={`group flex items-center space-x-3 px-3 py-2.5 rounded-lg transition-all duration-200 ${
                isActive('/app/settings')
                  ? 'bg-gradient-to-r from-blue-700 to-blue-600 text-white shadow-md shadow-blue-900/30'
                  : 'text-blue-100 hover:bg-blue-800/60 hover:text-white hover:translate-x-1'
              }`}
              title={!isOpen ? 'Paramètres' : undefined}
            >
              <Settings className={`w-5 h-5 flex-shrink-0 transition-transform duration-200 ${
                isActive('/app/settings') ? 'scale-110' : 'group-hover:scale-105'
              }`} />
              {isOpen && (
                <span className={`text-sm font-medium transition-all duration-200 whitespace-nowrap overflow-hidden text-ellipsis flex-1 ${
                  isActive('/app/settings') ? 'font-semibold' : ''
                }`} title="Paramètres">Paramètres</span>
              )}
              {isActive('/app/settings') && isOpen && (
                <div className="ml-auto w-1.5 h-1.5 bg-white rounded-full flex-shrink-0"></div>
              )}
            </Link>
          </div>
        </nav>

        {/* Footer - Niveau actif */}
        <div className="mt-auto border-t border-blue-700/50 bg-blue-900/30 backdrop-blur-sm">
          {isOpen && currentLevel && (
            <div className="p-4">
              <p className="text-xs text-blue-300/70 mb-1.5 font-medium">Niveau actif</p>
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-gold-500 rounded-full animate-pulse"></div>
                <p className="text-sm font-semibold text-white">
                  {currentLevel.code === 'MATERNELLE' ? 'Maternelle' :
                   currentLevel.code === 'PRIMAIRE' ? 'Primaire' :
                   currentLevel.code === 'SECONDAIRE' ? 'Secondaire' : currentLevel.code}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}

