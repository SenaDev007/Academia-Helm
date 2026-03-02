/**
 * ============================================================================
 * MODULE 2 : ORGANISATION PÉDAGOGIQUE & ÉTUDES - PAGE PRINCIPALE
 * ============================================================================
 */

'use client';

import { useState } from 'react';
import { BookOpen, Users, Calendar, FileText, Book, Building2, Package, Layers, ClipboardList, BarChart3, ShieldCheck } from 'lucide-react';
import {
  ModuleContainer,
} from '@/components/modules/blueprint';
import { useModuleContext } from '@/hooks/useModuleContext';
import Link from 'next/link';

export default function PedagogyPage() {
  const { academicYear, schoolLevel } = useModuleContext();

  // Wireframe Module 2 — 8 sous-modules officiels
  const subModules = [
    {
      id: 'academic-structure',
      label: 'Structure académique',
      href: '/app/pedagogy/academic-structure',
      icon: 'layers',
      description: 'Niveaux, cycles et classes par année scolaire',
    },
    {
      id: 'subjects',
      label: 'Matières & programmes',
      href: '/app/pedagogy/subjects',
      icon: 'bookOpen',
      description: 'Catalogue matières, coefficients, séries, programmes officiels',
    },
    {
      id: 'teachers-academic',
      label: 'Enseignants académiques',
      href: '/app/pedagogy/teachers',
      icon: 'users',
      description: 'Profils pédagogiques, qualifications, niveaux autorisés, charge max',
    },
    {
      id: 'assignments',
      label: 'Affectations & charges',
      href: '/app/pedagogy/assignments',
      icon: 'clipboardList',
      description: 'Affecter enseignant à classe/matière, volume horaire, période',
    },
    {
      id: 'timetables',
      label: 'Emploi du temps',
      href: '/app/pedagogy/timetables',
      icon: 'calendar',
      description: 'Grille hebdomadaire, conflits, versionnement, export',
    },
    {
      id: 'pedagogical-workspace',
      label: 'Espace pédagogique',
      href: '/app/pedagogy/workspace',
      icon: 'fileText',
      description: 'Fiches, cahier journal, cahier de texte, semainier, validation',
    },
    {
      id: 'control',
      label: 'Contrôle direction',
      href: '/app/pedagogy/control',
      icon: 'shieldCheck',
      description: 'Vue consolidée, fiches en attente, KPI, rapports exportables',
    },
    {
      id: 'orion-pedagogy',
      label: 'Analytique ORION',
      href: '/app/pedagogy/orion',
      icon: 'barChart3',
      description: 'KPI pédagogiques, alertes, prévisions, recommandations',
    },
  ];

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

  return (
    <ModuleContainer
      header={{
        title: 'Organisation Pédagogique & Études',
        description: 'Gestion complète de la pédagogie : matières, enseignants, emplois du temps, fiches pédagogiques',
        icon: 'bookOpen',
      }}
      subModules={{
        modules: subModules.map((m) => ({
          id: m.id,
          label: m.label,
          href: m.href,
        })),
      }}
      content={{
        layout: 'grid',
        children: subModules.map((module) => {
          const Icon = getIcon(module.icon);
          return (
            <Link
              key={module.id}
              href={module.href}
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
                  <p className="text-sm text-gray-600">{module.description}</p>
                </div>
              </div>
            </Link>
          );
        }),
      }}
    />
  );
}

