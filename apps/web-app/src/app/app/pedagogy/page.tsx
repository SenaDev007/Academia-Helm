/**
 * ============================================================================
 * MODULE 2 : ORGANISATION PÉDAGOGIQUE & ÉTUDES - PAGE PRINCIPALE
 * ============================================================================
 */

'use client';

import { useState } from 'react';
import {
  BookOpen,
  Users,
  Calendar,
  FileText,
  Book,
  Building2,
  Package,
  Layers,
  ClipboardList,
  BarChart3,
  ShieldCheck,
} from 'lucide-react';
import {
  ModuleContainer,
} from '@/components/modules/blueprint';
import { useModuleContext } from '@/hooks/useModuleContext';
import Link from 'next/link';
import { PEDAGOGY_SUBMODULE_TABS } from '@/components/pedagogy/pedagogy-tabs';

export default function PedagogyPage() {
  const { academicYear, schoolLevel } = useModuleContext();

  const getIcon = (iconName: string) => {
    const icons: Record<string, React.ComponentType<{ className?: string }>> = {
      bookOpen: BookOpen,
      users: Users,
      calendar: Calendar,
      fileText: FileText,
      book: Book,
      building: Building2,
      package: Package,
      layers: Layers,
      clipboardList: ClipboardList,
      barChart3: BarChart3,
      shieldCheck: ShieldCheck,
    };
    return icons[iconName] || BookOpen;
  };

  const navModules = [
    ...PEDAGOGY_SUBMODULE_TABS.map((tab) => {
      const Icon = tab.icon;
      return {
        id: tab.id,
        label: tab.label,
        href: tab.path,
        icon: <Icon className="w-4 h-4" />,
      };
    }),
  ];

  return (
    <ModuleContainer
      header={{
        title: 'Organisation Pédagogique & Études',
        description:
          'Gestion complète de la pédagogie : matières, enseignants, emplois du temps, fiches pédagogiques',
        icon: 'bookOpen',
      }}
      subModules={{
        modules: navModules,
      }}
      content={{
        layout: 'custom',
        children: (
          <div className="space-y-6">
            {/* KPI pédagogiques principaux (placeholder en attendant le branchage API) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-blue-100 p-2">
                    <Layers className="h-6 w-6 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">Structure académique</p>
                    <p className="text-xs text-gray-500">
                      {academicYear?.label ?? '—'} · {schoolLevel?.label ?? 'Tous niveaux'}
                    </p>
                  </div>
                </div>
              </div>
              <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-violet-100 p-2">
                    <BookOpen className="h-6 w-6 text-violet-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">Matières & programmes</p>
                    <p className="text-xs text-gray-500">Catalogue par niveau et filière</p>
                  </div>
                </div>
              </div>
              <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-emerald-100 p-2">
                    <Users className="h-6 w-6 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">Enseignants & charges</p>
                    <p className="text-xs text-gray-500">Profils, affectations, volume horaire</p>
                  </div>
                </div>
              </div>
              <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-amber-100 p-2">
                    <Calendar className="h-6 w-6 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">Rythme pédagogique</p>
                    <p className="text-xs text-gray-500">Emplois du temps & suivi de séances</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Lien vers contrôle & analytique ORION */}
            <div className="rounded-lg border border-indigo-100 bg-indigo-50/60 p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-indigo-900">Suivi de complétion pédagogique</p>
                <p className="text-xs text-indigo-800 mt-1">
                  Consultez le module « Contrôle direction » pour voir les KPI de complétion des fiches, cahiers et semainiers,
                  et le module « Analytique ORION » pour l&apos;analyse avancée.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link
                  href="/app/pedagogy/control"
                  className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
                >
                  <ShieldCheck className="h-4 w-4" />
                  Contrôle direction
                </Link>
                <Link
                  href="/app/pedagogy/orion"
                  className="inline-flex items-center gap-2 rounded-md border border-indigo-200 bg-white px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-50"
                >
                  <BarChart3 className="h-4 w-4" />
                  Analytique ORION
                </Link>
              </div>
            </div>

            {/* Accès rapide aux sous-modules pédagogiques */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {PEDAGOGY_SUBMODULE_TABS.filter((m) => m.id !== 'dashboard').map((module) => {
                const Icon = module.icon;
                return (
                  <Link
                    key={module.id}
                    href={module.path}
                    className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start space-x-4">
                      <div className="flex-shrink-0">
                        <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center">
                          <Icon className="w-6 h-6 text-blue-600" />
                        </div>
                      </div>
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-gray-900 mb-1">
                          {module.label}
                        </h3>
                        <p className="text-sm text-gray-600">
                          {module.id === 'academic-structure' && 'Niveaux, cycles et classes par année scolaire'}
                          {module.id === 'subjects' && 'Catalogue matières, coefficients, séries, programmes officiels'}
                          {module.id === 'teachers-academic' && 'Profils pédagogiques, qualifications, niveaux autorisés, charge max'}
                          {module.id === 'assignments' && 'Affecter enseignant à classe/matière, volume horaire, période'}
                          {module.id === 'timetables' && 'Grille hebdomadaire, conflits, versionnement, export'}
                          {module.id === 'pedagogical-workspace' && 'Fiches, cahier journal, cahier de texte, semainier, validation'}
                          {module.id === 'control' && 'Vue consolidée, fiches en attente, KPI, rapports exportables'}
                          {module.id === 'orion-pedagogy' && 'KPI pédagogiques, alertes, prévisions, recommandations'}
                        </p>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        ),
      }}
    />
  );
}

