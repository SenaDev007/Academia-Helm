/**
 * ============================================================================
 * MODULE INFIRMERIE - ACADEMIA HELM
 * ============================================================================
 */

'use client';

import { useState } from 'react';
import { 
  LayoutDashboard, 
  FileText, 
  HeartPulse, 
  AlertCircle, 
  Pills, 
  ShieldAlert, 
  Calendar, 
  ClipboardCheck, 
  BarChart3, 
  Settings,
  Plus
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAcademicYear } from '@/hooks/useAcademicYear';
import { useSchoolLevel } from '@/hooks/useSchoolLevel';
import ModulePageLayout from './ModulePageLayout';

// Sub-components
import InfirmaryDashboard from './infirmary/InfirmaryDashboard';
import MedicalRecords from './infirmary/MedicalRecords';
import InfirmaryVisits from './infirmary/InfirmaryVisits';
import Emergencies from './infirmary/Emergencies';
import PharmacyStock from './infirmary/PharmacyStock';
import AllergiesVigilance from './infirmary/AllergiesVigilance';
import MedicalCheckups from './infirmary/MedicalCheckups';
import Authorizations from './infirmary/Authorizations';
import ReportsStats from './infirmary/ReportsStats';
import InfirmarySettings from './infirmary/InfirmarySettings';

const TABS = [
  { id: 'dashboard', label: 'Tableau de Bord', icon: LayoutDashboard },
  { id: 'records', label: 'Dossiers Médicaux', icon: FileText },
  { id: 'visits', label: 'Passages Infirmerie', icon: HeartPulse },
  { id: 'emergencies', label: 'Urgences & Incidents', icon: AlertCircle },
  { id: 'pharmacy', label: 'Pharmacie & Stocks', icon: Pills },
  { id: 'allergies', label: 'Allergies & Vigilance', icon: ShieldAlert },
  { id: 'checkups', label: 'Visites Médicales', icon: Calendar },
  { id: 'authorizations', label: 'Autorisations', icon: ClipboardCheck },
  { id: 'reports', label: 'Rapports & Stats', icon: BarChart3 },
  { id: 'settings', label: 'Configuration', icon: Settings },
];

export default function InfirmaryModulePage() {
  const { currentYear } = useAcademicYear();
  const { currentLevel } = useSchoolLevel();
  const [activeTab, setActiveTab] = useState('dashboard');

  const renderActiveTab = () => {
    switch (activeTab) {
      case 'dashboard': return <InfirmaryDashboard />;
      case 'records': return <MedicalRecords />;
      case 'visits': return <InfirmaryVisits />;
      case 'emergencies': return <Emergencies />;
      case 'pharmacy': return <PharmacyStock />;
      case 'allergies': return <AllergiesVigilance />;
      case 'checkups': return <MedicalCheckups />;
      case 'authorizations': return <Authorizations />;
      case 'reports': return <ReportsStats />;
      case 'settings': return <InfirmarySettings />;
      default: return <InfirmaryDashboard />;
    }
  };

  return (
    <ModulePageLayout
      title="Infirmerie"
      subtitle={`${currentLevel?.name || ''} | ${currentYear?.name || ''}`}
      actions={
        <div className="flex items-center space-x-2">
          <button className="flex items-center space-x-2 px-4 py-2 bg-[#C9A84C] text-white rounded-xl hover:bg-[#B8973B] transition-all font-bold text-sm shadow-sm">
            <Plus className="w-4 h-4" />
            <span>Action Rapide</span>
          </button>
        </div>
      }
    >
      <div className="space-y-8">
        {/* Tab Navigation */}
        <div className="bg-white p-1 rounded-2xl border border-slate-200 flex flex-wrap gap-1 shadow-sm sticky top-0 z-10">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-tighter transition-all ${
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

