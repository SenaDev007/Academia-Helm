/**
 * ============================================================================
 * MODULE BIBLIOTHÈQUE - ACADEMIA HELM
 * ============================================================================
 */

'use client';

import { useState } from 'react';
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
  Plus
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAcademicYear } from '@/hooks/useAcademicYear';
import { useSchoolLevel } from '@/hooks/useSchoolLevel';
import ModulePageLayout from './ModulePageLayout';

// Sub-components (to be created)
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

const TABS = [
  { id: 'dashboard', label: 'Tableau de Bord', icon: LayoutDashboard },
  { id: 'catalog', label: 'Catalogue', icon: Library },
  { id: 'resources', label: 'Livres & Ressources', icon: Book },
  { id: 'borrowings', label: 'Emprunts', icon: ArrowUpCircle },
  { id: 'returns', label: 'Retours', icon: ArrowDownCircle },
  { id: 'reservations', label: 'Réservations', icon: Calendar },
  { id: 'readers', label: 'Lecteurs', icon: Users },
  { id: 'inventory', label: 'Inventaire', icon: ClipboardCheck },
  { id: 'penalties', label: 'Pénalités & Pertes', icon: AlertCircle },
  { id: 'digital', label: 'Ressources Numériques', icon: Globe },
  { id: 'recommendations', label: 'Recommandations', icon: Sparkles },
  { id: 'reports', label: 'Rapports & Stats', icon: BarChart3 },
  { id: 'settings', label: 'Configuration', icon: Settings },
];

export default function LibraryModulePage() {
  const { currentYear } = useAcademicYear();
  const { currentLevel } = useSchoolLevel();
  const [activeTab, setActiveTab] = useState('dashboard');

  const renderActiveTab = () => {
    switch (activeTab) {
      case 'dashboard': return <LibraryDashboard />;
      case 'catalog': return <LibraryCatalog />;
      case 'resources': return <LibraryResources />;
      case 'borrowings': return <LibraryBorrowings />;
      case 'returns': return <LibraryReturns />;
      case 'reservations': return <LibraryReservations />;
      case 'readers': return <LibraryReaders />;
      case 'inventory': return <LibraryInventory />;
      case 'penalties': return <LibraryPenalties />;
      case 'digital': return <LibraryDigitalResources />;
      case 'recommendations': return <LibraryRecommendations />;
      case 'reports': return <LibraryReports />;
      case 'settings': return <LibrarySettings />;
      default: return <LibraryDashboard />;
    }
  };

  return (
    <ModulePageLayout
      title="Bibliothèque"
      subtitle={`${currentLevel?.name || 'Toutes Sections'} | ${currentYear?.name || ''}`}
      actions={
        <div className="flex items-center space-x-2">
          <button className="flex items-center space-x-2 px-4 py-2 bg-navy-900 text-white rounded-xl hover:bg-navy-800 transition-all font-bold text-sm shadow-sm">
            <Plus className="w-4 h-4 text-[#C9A84C]" />
            <span>Nouvel Emprunt</span>
          </button>
        </div>
      }
    >
      <div className="space-y-8">
        {/* Tab Navigation */}
        <div className="bg-white p-1 rounded-2xl border border-slate-200 flex flex-wrap gap-1 shadow-sm sticky top-0 z-10 overflow-x-auto no-scrollbar">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-tighter transition-all whitespace-nowrap ${
                  isActive 
                    ? 'bg-navy-900 text-white shadow-md' 
                    : 'text-slate-500 hover:bg-slate-50 hover:text-navy-900'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-[#C9A84C]' : ''}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
          >
            {renderActiveTab()}
          </motion.div>
        </AnimatePresence>
      </div>
    </ModulePageLayout>
  );
}
