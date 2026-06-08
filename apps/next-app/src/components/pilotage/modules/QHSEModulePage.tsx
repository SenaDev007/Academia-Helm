/**
 * ============================================================================
 * QHSE MODULE PAGE (MODULE 9.9)
 * ============================================================================
 * Gère la Qualité, Hygiène, Sécurité et Environnement.
 */

'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ShieldCheck, AlertTriangle, Trash2, CheckCircle2, 
  FileText, ClipboardList, Activity, Stethoscope, 
  Search, Plus, Filter, Download, Settings, Bell, 
  LayoutDashboard, Scale, HardHat, Droplets, BookOpen
} from 'lucide-react';

// Sub-components
import QHSEDashboard from './qhse/QHSEDashboard';
import QHSEIncidents from './qhse/QHSEIncidents';
import QHSERisks from './qhse/QHSERisks';
import QHSEHygiene from './qhse/QHSEHygiene';
import QHSESecurity from './qhse/QHSESecurity';
import QHSEHealth from './qhse/QHSEHealth';
import QHSEAudits from './qhse/QHSEAudits';
import QHSEActionPlans from './qhse/QHSEActionPlans';
import QHSEDocuments from './qhse/QHSEDocuments';
import QHSEPeriodicControls from './qhse/QHSEPeriodicControls';
import QHSEAlerts from './qhse/QHSEAlerts';
import QHSEReports from './qhse/QHSEReports';
import QHSECompliance from './qhse/QHSECompliance';
import QHSESettings from './qhse/QHSESettings';

const TABS = [
  { id: 'dashboard', label: 'Tableau de bord', icon: LayoutDashboard },
  { id: 'incidents', label: 'Incidents', icon: AlertTriangle },
  { id: 'risks', label: 'Risques', icon: Activity },
  { id: 'hygiene', label: 'Hygiène', icon: Droplets },
  { id: 'security', label: 'Sécurité', icon: HardHat },
  { id: 'health', label: 'Santé', icon: Stethoscope },
  { id: 'audits', label: 'Audits', icon: ClipboardList },
  { id: 'plans', label: 'Plans d\'action', icon: CheckCircle2 },
  { id: 'docs', label: 'Procédures', icon: FileText },
  { id: 'controls', label: 'Contrôles', icon: BookOpen },
  { id: 'alerts', label: 'Alertes', icon: Bell },
  { id: 'reports', label: 'Rapports', icon: Download },
  { id: 'compliance', label: 'Conformité', icon: Scale },
  { id: 'settings', label: 'Paramètres', icon: Settings },
];

export default function QHSEModulePage() {
  const [activeTab, setActiveTab] = useState('dashboard');

  const renderActiveTab = () => {
    switch (activeTab) {
      case 'dashboard': return <QHSEDashboard />;
      case 'incidents': return <QHSEIncidents />;
      case 'risks': return <QHSERisks />;
      case 'hygiene': return <QHSEHygiene />;
      case 'security': return <QHSESecurity />;
      case 'health': return <QHSEHealth />;
      case 'audits': return <QHSEAudits />;
      case 'plans': return <QHSEActionPlans />;
      case 'docs': return <QHSEDocuments />;
      case 'controls': return <QHSEPeriodicControls />;
      case 'alerts': return <QHSEAlerts />;
      case 'reports': return <QHSEReports />;
      case 'compliance': return <QHSECompliance />;
      case 'settings': return <QHSESettings />;
      default: return <QHSEDashboard />;
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] p-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-emerald-600 rounded-xl">
              <ShieldCheck className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tighter uppercase">
              QHSE <span className="text-emerald-600 font-medium">| Qualité & Sécurité</span>
            </h1>
          </div>
          <p className="text-slate-500 font-medium max-w-2xl">
            Gestion de la qualité, de l'hygiène, de la sécurité et de l'environnement scolaire.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="bg-white px-6 py-3 rounded-2xl border border-slate-100 shadow-sm">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Niveau de Conformité</p>
            <p className="text-xl font-black text-emerald-600 tracking-tighter">95.4%</p>
          </div>
          <button className="px-6 py-4 bg-navy-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-navy-900/20 hover:bg-navy-800 transition-all flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Signaler un Incident
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-4 mb-8 no-scrollbar scroll-smooth">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`
              flex items-center gap-2 px-6 py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shrink-0
              ${activeTab === tab.id 
                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20 translate-y-[-2px]' 
                : 'bg-white text-slate-400 hover:bg-slate-50 hover:text-slate-600 border border-slate-100'}
            `}
          >
            <tab.icon className={`w-4 h-4 ${activeTab === tab.id ? 'text-white' : 'text-slate-400'}`} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Main Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
        >
          {renderActiveTab()}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
