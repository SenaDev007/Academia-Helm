/**
 * ============================================================================
 * MODULE BIBLIOTHÈQUE - ACADEMIA HELM (Standardisé sur pattern Finance)
 * ============================================================================
 *
 * Sous-modules : Dashboard, Catalogue, Ressources, Emprunts, Retours,
 * Réservations, Lecteurs, Inventaire, Pénalités, Ressources Numériques,
 * Recommandations, Rapports, Configuration.
 *
 * La navigation par sous-modules est gérée par ModuleContainer.subModules.
 * Les sous-composants NE doivent PAS inclure leur propre SubModuleNavigation.
 * ============================================================================
 */

'use client';

import { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Library,
  Book,
  ArrowUpCircle,
  ArrowDownCircle,
  Calendar,
  Users,
  ClipboardCheck,
  AlertCircle,
  Globe,
  Sparkles,
  BarChart3,
  Settings,
  Plus,
  Download,
} from 'lucide-react';
import { ModuleContainer } from '@/components/modules/blueprint';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useModulesDashboard } from '@/lib/modules-complementaires/hooks';

// Sub-components
import LibraryDashboard from './library/LibraryDashboard';
import LibraryCatalog from './library/LibraryCatalog';
import LibraryResources from './library/LibraryResources';
import LibraryBorrowings from './library/LibraryBorrowings';
import LibraryReturns from './library/LibraryReturns';
import LibraryReservations from './library/LibraryReservations';
import LibraryReaders from './library/LibraryReaders';
import LibraryInventory from './library/LibraryInventory';
import LibraryPenalties from './library/LibraryPenalties';
import LibraryDigitalResources from './library/LibraryDigitalResources';
import LibraryRecommendations from './library/LibraryRecommendations';
import LibraryReports from './library/LibraryReports';
import LibrarySettings from './library/LibrarySettings';

interface LibraryStats {
  totalBooks?: number;
  activeLoans?: number;
  activeReservations?: number;
  overdueLoans?: number;
  [key: string]: any;
}

export default function LibraryModulePage() {
  const { academicYear, isLoading: contextLoading } = useModuleContext();
  const [activeSubModuleId, setActiveSubModuleId] = useState<string>('dashboard');
  const { data: stats } = useModulesDashboard<LibraryStats>('library', academicYear?.id);

  if (contextLoading) return <div className="p-8 text-center">Chargement...</div>;

  return (
    <ModuleContainer
      header={{
        title: 'Bibliothèque',
        description:
          'Pilotage documentaire : catalogue, emprunts, retours, réservations, lecteurs, inventaire, ressources numériques et rapports',
        icon: 'library',
        kpis: stats
          ? [
              {
                label: 'Total Livres',
                value: (stats.totalBooks ?? 0).toLocaleString('fr-FR'),
                icon: 'library',
                trend: 'neutral',
              },
              {
                label: 'Emprunts en cours',
                value: (stats.activeLoans ?? 0).toLocaleString('fr-FR'),
                icon: 'trends',
                trend: 'up',
              },
              {
                label: 'Réservations',
                value: (stats.activeReservations ?? 0).toLocaleString('fr-FR'),
                icon: 'calendar',
                trend: 'neutral',
              },
              {
                label: 'Retards',
                value: (stats.overdueLoans ?? 0).toLocaleString('fr-FR'),
                icon: 'warning',
                trend: 'up',
              },
            ]
          : [],
        actions: (
          <div className="flex items-center gap-2">
            <button className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl font-semibold shadow-lg shadow-indigo-900/20 hover:bg-indigo-700 transition-all">
              <Plus className="w-4 h-4" /> Nouvel Emprunt
            </button>
            <button className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl font-semibold hover:bg-slate-50 transition-all">
              <Download className="w-4 h-4" /> Exporter
            </button>
          </div>
        ),
      }}
      subModules={{
        activeModuleId: activeSubModuleId,
        onModuleChange: setActiveSubModuleId,
        modules: [
          { id: 'dashboard', label: 'Tableau de Bord', icon: <LayoutDashboard className="w-4 h-4" /> },
          { id: 'catalog', label: 'Catalogue', icon: <Library className="w-4 h-4" /> },
          { id: 'resources', label: 'Livres & Ressources', icon: <Book className="w-4 h-4" /> },
          { id: 'borrowings', label: 'Emprunts', icon: <ArrowUpCircle className="w-4 h-4" /> },
          { id: 'returns', label: 'Retours', icon: <ArrowDownCircle className="w-4 h-4" /> },
          { id: 'reservations', label: 'Réservations', icon: <Calendar className="w-4 h-4" /> },
          { id: 'readers', label: 'Lecteurs', icon: <Users className="w-4 h-4" /> },
          { id: 'inventory', label: 'Inventaire', icon: <ClipboardCheck className="w-4 h-4" /> },
          { id: 'penalties', label: 'Pénalités & Pertes', icon: <AlertCircle className="w-4 h-4" /> },
          { id: 'digital', label: 'Ressources Numériques', icon: <Globe className="w-4 h-4" /> },
          { id: 'recommendations', label: 'Recommandations', icon: <Sparkles className="w-4 h-4" /> },
          { id: 'reports', label: 'Rapports & Stats', icon: <BarChart3 className="w-4 h-4" /> },
          { id: 'settings', label: 'Configuration', icon: <Settings className="w-4 h-4" /> },
        ],
      }}
      content={
        activeSubModuleId === 'dashboard' ? { layout: 'default', children: <LibraryDashboard /> } :
        activeSubModuleId === 'catalog' ? { layout: 'default', children: <LibraryCatalog /> } :
        activeSubModuleId === 'resources' ? { layout: 'default', children: <LibraryResources /> } :
        activeSubModuleId === 'borrowings' ? { layout: 'default', children: <LibraryBorrowings /> } :
        activeSubModuleId === 'returns' ? { layout: 'default', children: <LibraryReturns /> } :
        activeSubModuleId === 'reservations' ? { layout: 'default', children: <LibraryReservations /> } :
        activeSubModuleId === 'readers' ? { layout: 'default', children: <LibraryReaders /> } :
        activeSubModuleId === 'inventory' ? { layout: 'default', children: <LibraryInventory /> } :
        activeSubModuleId === 'penalties' ? { layout: 'default', children: <LibraryPenalties /> } :
        activeSubModuleId === 'digital' ? { layout: 'default', children: <LibraryDigitalResources /> } :
        activeSubModuleId === 'recommendations' ? { layout: 'default', children: <LibraryRecommendations /> } :
        activeSubModuleId === 'reports' ? { layout: 'default', children: <LibraryReports /> } :
        activeSubModuleId === 'settings' ? { layout: 'default', children: <LibrarySettings /> } :
        { layout: 'default', children: <LibraryDashboard /> }
      }
    />
  );
}
