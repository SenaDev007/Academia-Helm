/**
 * MODULE 2 — STRUCTURE ACADÉMIQUE (refonte 2026-11-27)
 * L'onglet est désormais dédié à la GESTION DES SALLES (ex-sous-onglet Salle) :
 * tout le reste (Niveaux, Cycles, Classes, Sections, Séries, duplication) a
 * été supprimé à la demande du promoteur — les niveaux restent dans Paramètres.
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
        title: 'Structure académique',
        description: academicYear
          ? `Gestion des salles — année ${academicYear.label}`
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
          <Suspense fallback={<p className="text-gray-500">Chargement de la structure…</p>}>
            <AcademicStructureWorkspace />
          </Suspense>
        ),
      }}
    />
  );
}
