/**
 * MODULE 2 — GESTION DE SALLE (refonte 2026-11-27)
 * Onglet dédié à la gestion professionnelle des salles de l'établissement
 * (ex « Structure académique ») : inventaire, capacités, équipements,
 * affectation des classes, emploi du temps des salles et maintenance.
 */

'use client';

import { Suspense } from 'react';
import { ModuleContainer } from '@/components/modules/blueprint';
import { useVisiblePedagogyTabs } from '@/hooks/usePedagogyTabs';
import { AcademicStructureWorkspace } from '@/components/pedagogy/academic-structure/AcademicStructureWorkspace';
import { useModuleContext } from '@/hooks/useModuleContext';

export default function AcademicStructurePage() {
  const pedagogyVisibleTabs = useVisiblePedagogyTabs();

  const { academicYear } = useModuleContext();

  return (
    <ModuleContainer
      header={{
        title: 'Gestion de salle',
        description: academicYear
          ? `Salles de l'établissement — année ${academicYear.label}`
          : 'Salles de classe, laboratoires, bibliothèque et espaces de l\'établissement',
        icon: 'bookOpen',
      }}
      subModules={{
        modules: pedagogyVisibleTabs.map((tab) => {
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
          <Suspense fallback={<p className="text-gray-500">Chargement des salles…</p>}>
            <AcademicStructureWorkspace />
          </Suspense>
        ),
      }}
    />
  );
}
