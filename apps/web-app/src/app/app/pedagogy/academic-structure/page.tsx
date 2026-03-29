/**
 * MODULE 2 — Structure académique (Niveaux → Cycles → Classes → Sections → Séries → Salles)
 */

'use client';

import { Suspense } from 'react';
import { ModuleContainer } from '@/components/modules/blueprint';
import { PEDAGOGY_SUBMODULE_TABS } from '@/components/pedagogy/pedagogy-tabs';
import { AcademicStructureWorkspace } from '@/components/pedagogy/academic-structure/AcademicStructureWorkspace';
import { useModuleContext } from '@/hooks/useModuleContext';

export default function AcademicStructurePage() {
  const { academicYear } = useModuleContext();

  return (
    <ModuleContainer
      header={{
        title: 'Structure académique',
        description: academicYear
          ? `Organisation pédagogique — année ${academicYear.label}`
          : 'Niveaux, cycles, classes, sections, séries et salles',
        icon: 'bookOpen',
      }}
      subModules={{
        modules: PEDAGOGY_SUBMODULE_TABS.map((tab) => {
          const Icon = tab.icon;
          return {
            id: tab.id,
            label: tab.label,
            href: tab.path,
            icon: <Icon className="w-4 h-4" />,
          };
        }),
      }}
      content={{
        layout: 'custom',
        children: !academicYear ? (
          <p className="text-gray-500">Veuillez sélectionner une année scolaire.</p>
        ) : (
          <Suspense fallback={<p className="text-gray-500">Chargement de la structure…</p>}>
            <AcademicStructureWorkspace />
          </Suspense>
        ),
      }}
    />
  );
}
