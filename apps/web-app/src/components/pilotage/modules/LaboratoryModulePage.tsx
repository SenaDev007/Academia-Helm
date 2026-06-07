/**
 * ============================================================================
 * MODULE LABORATOIRE - ACADEMIA HELM
 * ============================================================================
 */

'use client';

import { useState } from 'react';
import { 
  LayoutDashboard, 
  Beaker, 
  Microscope, 
  Droplets, 
  Calendar, 
  GraduationCap, 
  Wrench, 
  ShieldAlert, 
  Package, 
  BarChart3, 
  Settings,
  Plus
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAcademicYear } from '@/hooks/useAcademicYear';
import { useSchoolLevel } from '@/hooks/useSchoolLevel';
import ModulePageLayout from './ModulePageLayout';

// Sub-components (to be created)
import LaboratoryDashboard from './laboratory/LaboratoryDashboard';
import LabsList from './laboratory/LabsList';
import EquipmentsInventory from './laboratory/EquipmentsInventory';
import ConsumablesStock from './laboratory/ConsumablesStock';
import LabReservations from './laboratory/LabReservations';
import PracticalSessions from './laboratory/PracticalSessions';
import LabMaintenance from './laboratory/LabMaintenance';
import SafetyIncidents from './laboratory/SafetyIncidents';
import StocksApprovisionnement from './laboratory/StocksApprovisionnement';
import LabReportsStats from './laboratory/LabReportsStats';
import LaboratorySettings from './laboratory/LaboratorySettings';

const TABS = [
  { id: 'dashboard', label: 'Tableau de Bord', icon: LayoutDashboard },
  { id: 'labs', label: 'Laboratoires', icon: Beaker },
  { id: 'equipments', label: 'Équipements', icon: Microscope },
  { id: 'consumables', label: 'Consommables', icon: Droplets },
  { id: 'reservations', label: 'Réservations', icon: Calendar },
  { id: 'sessions', label: 'Séances Pratiques', icon: GraduationCap },
  { id: 'maintenance', label: 'Maintenance', icon: Wrench },
  { id: 'safety', label: 'Sécurité & Incidents', icon: ShieldAlert },
  { id: 'stocks', label: 'Stocks & Appro', icon: Package },
  { id: 'reports', label: 'Rapports & Stats', icon: BarChart3 },
  { id: 'settings', label: 'Configuration', icon: Settings },
];

export default function LaboratoryModulePage() {
  const { currentYear } = useAcademicYear();
  const { currentLevel } = useSchoolLevel();
  const [activeTab, setActiveTab] = useState('dashboard');

  const renderActiveTab = () => {
    switch (activeTab) {
      case 'dashboard': return <LaboratoryDashboard />;
      case 'labs': return <LabsList />;
      case 'equipments': return <EquipmentsInventory />;
      case 'consumables': return <ConsumablesStock />;
      case 'reservations': return <LabReservations />;
      case 'sessions': return <PracticalSessions />;
      case 'maintenance': return <LabMaintenance />;
      case 'safety': return <SafetyIncidents />;
      case 'stocks': return <StocksApprovisionnement />;
      case 'reports': return <LabReportsStats />;
      case 'settings': return <LaboratorySettings />;
      default: return <LaboratoryDashboard />;
    }
  };

  return (
    <ModulePageLayout
      title="Laboratoire"
      subtitle={`${currentLevel?.label || 'Tous Niveaux'} | ${currentYear?.name || ''}`}
      actions={
        <div className="flex items-center space-x-2">
          <button className="flex items-center space-x-2 px-4 py-2 bg-[#C9A84C] text-white rounded-xl hover:bg-[#B8973B] transition-all font-bold text-sm shadow-sm">
            <Plus className="w-4 h-4" />
            <span>Nouvelle Séance</span>
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

        {/* Tab Content with Animation */}
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
