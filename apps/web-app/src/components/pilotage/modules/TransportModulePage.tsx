/**
 * ============================================================================
 * TRANSPORT MODULE PAGE (MODULE 9.2)
 * ============================================================================
 * Gère le parc automobile, les chauffeurs, les itinéraires et le suivi.
 */

'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Bus, Users, MapPin, Route, Calendar, Clock, 
  AlertTriangle, PenTool, CreditCard, FileBarChart, 
  Settings, Activity, Navigation, ShieldAlert, Plus, 
  LayoutDashboard, Search, Filter, Download, Info
} from 'lucide-react';

// Sub-components
import TransportDashboard from './transport/TransportDashboard';
import TransportVehicles from './transport/TransportVehicles';
import TransportDrivers from './transport/TransportDrivers';
import TransportRoutes from './transport/TransportRoutes';
import TransportStops from './transport/TransportStops';
import TransportStudents from './transport/TransportStudents';
import TransportSchedules from './transport/TransportSchedules';
import TransportTrips from './transport/TransportTrips';
import TransportAttendance from './transport/TransportAttendance';
import TransportIncidents from './transport/TransportIncidents';
import TransportMaintenance from './transport/TransportMaintenance';
import TransportPayments from './transport/TransportPayments';
import TransportReports from './transport/TransportReports';
import TransportSettings from './transport/TransportSettings';

const TABS = [
  { id: 'dashboard', label: 'Tableau de bord', icon: LayoutDashboard },
  { id: 'vehicles', label: 'Véhicules', icon: Bus },
  { id: 'drivers', label: 'Personnel', icon: Users },
  { id: 'routes', label: 'Itinéraires', icon: Route },
  { id: 'stops', label: 'Arrêts & Zones', icon: MapPin },
  { id: 'students', label: 'Élèves', icon: Users },
  { id: 'schedules', label: 'Planning', icon: Calendar },
  { id: 'trips', label: 'Suivi Trajets', icon: Navigation },
  { id: 'attendance', label: 'Présences', icon: Clock },
  { id: 'incidents', label: 'Incidents', icon: ShieldAlert },
  { id: 'maintenance', label: 'Maintenance', icon: PenTool },
  { id: 'payments', label: 'Paiements', icon: CreditCard },
  { id: 'reports', label: 'Rapports', icon: FileBarChart },
  { id: 'settings', label: 'Paramètres', icon: Settings },
];

export default function TransportModulePage() {
  const [activeTab, setActiveTab] = useState('dashboard');

  const renderActiveTab = () => {
    switch (activeTab) {
      case 'dashboard': return <TransportDashboard />;
      case 'vehicles': return <TransportVehicles />;
      case 'drivers': return <TransportDrivers />;
      case 'routes': return <TransportRoutes />;
      case 'stops': return <TransportStops />;
      case 'students': return <TransportStudents />;
      case 'schedules': return <TransportSchedules />;
      case 'trips': return <TransportTrips />;
      case 'attendance': return <TransportAttendance />;
      case 'incidents': return <TransportIncidents />;
      case 'maintenance': return <TransportMaintenance />;
      case 'payments': return <TransportPayments />;
      case 'reports': return <TransportReports />;
      case 'settings': return <TransportSettings />;
      default: return <TransportDashboard />;
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] p-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-navy-900 rounded-xl">
              <Bus className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tighter uppercase">
              Transport <span className="text-navy-600 font-medium">| Academia Helm</span>
            </h1>
          </div>
          <p className="text-slate-500 font-medium max-w-2xl">
            Gestion intelligente du transport scolaire, suivi en temps réel et sécurité des élèves.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="bg-white px-6 py-3 rounded-2xl border border-slate-100 shadow-sm">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Ponctualité</p>
            <p className="text-xl font-black text-emerald-600 tracking-tighter">94.2%</p>
          </div>
          <div className="bg-white px-6 py-3 rounded-2xl border border-slate-100 shadow-sm">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Activité</p>
            <p className="text-xl font-black text-navy-900 tracking-tighter">12/15 <span className="text-slate-300 font-medium text-xs">Bus</span></p>
          </div>
          <button className="p-4 bg-white text-slate-400 rounded-2xl border border-slate-100 hover:text-navy-900 hover:border-navy-900 transition-all">
            <Info className="w-5 h-5" />
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
                ? 'bg-navy-900 text-white shadow-lg shadow-navy-900/20 translate-y-[-2px]' 
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
