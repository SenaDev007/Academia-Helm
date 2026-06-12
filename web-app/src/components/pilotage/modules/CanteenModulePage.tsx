/**
 * ============================================================================
 * MODULE CANTINE - ACADEMIA HELM
 * ============================================================================
 */

'use client';

import { useState } from 'react';
import { 
  Plus, UtensilsCrossed, Users, DollarSign, ChefHat, 
  ClipboardCheck, AlertTriangle, Package, Truck, Activity, 
  Settings, BarChart3, Search, AlertCircle, 
} from 'lucide-react';
import { useAcademicYear } from '@/hooks/useAcademicYear';
import { useSchoolLevel } from '@/hooks/useSchoolLevel';
import ModulePageLayout from './ModulePageLayout';

// Sub-components
import CanteenDashboard from './canteen/CanteenDashboard';
import CanteenMenus from './canteen/CanteenMenus';
import CanteenEnrollments from './canteen/CanteenEnrollments';
import CanteenStudents from './canteen/CanteenStudents';
import CanteenAttendance from './canteen/CanteenAttendance';
import CanteenDiets from './canteen/CanteenDiets';
import CanteenPayments from './canteen/CanteenPayments';
import CanteenStocks from './canteen/CanteenStocks';
import CanteenSuppliers from './canteen/CanteenSuppliers';
import CanteenIncidents from './canteen/CanteenIncidents';
import CanteenReports from './canteen/CanteenReports';
import CanteenSettings from './canteen/CanteenSettings';

type TabId = 'dashboard' | 'menus' | 'enrollments' | 'students' | 'attendance' | 'diets' | 'payments' | 'stocks' | 'suppliers' | 'incidents' | 'reports' | 'settings';

export default function CanteenModulePage() {
  const { currentYear } = useAcademicYear();
  const { currentLevel } = useSchoolLevel();
  const [activeTab, setActiveTab] = useState<TabId>('dashboard');
  const [searchTerm, setSearchTerm] = useState('');

  const tabs = [
    { id: 'dashboard', label: 'Tableau de bord', icon: Activity },
    { id: 'menus', label: 'Menus', icon: ChefHat },
    { id: 'enrollments', label: 'Inscriptions', icon: ClipboardCheck },
    { id: 'students', label: 'Élèves inscrits', icon: Users },
    { id: 'attendance', label: 'Présences', icon: UtensilsCrossed },
    { id: 'diets', label: 'Régimes & Allergies', icon: AlertTriangle },
    { id: 'payments', label: 'Paiements', icon: DollarSign },
    { id: 'stocks', label: 'Stocks', icon: Package },
    { id: 'suppliers', label: 'Fournisseurs', icon: Truck },
    { id: 'incidents', label: 'Incidents & Hygiène', icon: AlertCircle },
    { id: 'reports', label: 'Rapports', icon: BarChart3 },
    { id: 'settings', label: 'Paramètres', icon: Settings },
  ];

  return (
    <ModulePageLayout
      title="Cantine & Restauration"
      subtitle={`${currentLevel?.label || 'Niveau scolaire'} | ${currentYear?.name || ''}`}
      actions={
        <div className="flex items-center space-x-3">
          <div className="relative group">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-navy-500 transition-colors" />
            <input 
              type="text" 
              placeholder="Recherche globale..." 
              className="pl-9 pr-4 py-2 bg-gray-50 border border-gray-100 rounded-xl text-sm outline-none focus:ring-2 focus:ring-navy-500/20 w-64 transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button className="flex items-center space-x-2 px-6 py-2 bg-navy-900 text-white rounded-xl hover:bg-navy-800 shadow-xl shadow-navy-900/20 transition-all active:scale-95 font-black text-[10px] uppercase tracking-widest">
            <Plus className="w-4 h-4" />
            <span>Nouveau</span>
          </button>
        </div>
      }
    >
      <div className="space-y-8">
        {/* Navigation Premium */}
        <div className="flex items-center space-x-1 bg-gray-100/50 p-1.5 rounded-2xl border border-gray-100 overflow-x-auto no-scrollbar">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as TabId)}
                className={`flex items-center space-x-2 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-300 whitespace-nowrap ${
                  isActive 
                    ? 'bg-white text-navy-900 shadow-sm border border-gray-200' 
                    : 'text-gray-400 hover:text-navy-600 hover:bg-white/50'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-navy-600' : 'text-gray-400'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Content Area */}
        <div className="min-h-[600px]">
          {activeTab === 'dashboard' && <CanteenDashboard />}
          {activeTab === 'menus' && <CanteenMenus />}
          {activeTab === 'enrollments' && <CanteenEnrollments />}
          {activeTab === 'students' && <CanteenStudents />}
          {activeTab === 'attendance' && <CanteenAttendance />}
          {activeTab === 'diets' && <CanteenDiets />}
          {activeTab === 'payments' && <CanteenPayments />}
          {activeTab === 'stocks' && <CanteenStocks />}
          {activeTab === 'suppliers' && <CanteenSuppliers />}
          {activeTab === 'incidents' && <CanteenIncidents />}
          {activeTab === 'reports' && <CanteenReports />}
          {activeTab === 'settings' && <CanteenSettings />}
        </div>
      </div>
    </ModulePageLayout>
  );
}

