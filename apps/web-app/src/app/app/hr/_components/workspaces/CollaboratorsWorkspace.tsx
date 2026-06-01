'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users,
  FileText,
  Briefcase,
  History,
  Network,
  TrendingUp,
  UserCheck,
  ShieldAlert,
  Plus,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { StaffWorkspace } from './StaffWorkspace';
import { ContractsWorkspace } from './ContractsWorkspace';
import Link from 'next/link';

export function CollaboratorsWorkspace() {
  const [activeTab, setActiveTab] = useState<'staff' | 'contracts' | 'assignments' | 'history' | 'org_chart'>('staff');

  const SUB_TABS = [
    { id: 'staff', label: 'Personnel', icon: Users },
    { id: 'contracts', label: 'Contrats', icon: FileText },
    { id: 'assignments', label: 'Affectations', icon: Briefcase },
    { id: 'history', label: 'Historique', icon: History },
    { id: 'org_chart', label: 'Organigramme', icon: Network },
  ] as const;

  return (
    <div className="space-y-6 pb-12">
      {/* Sub tabs navigation */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
        {SUB_TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={cn(
                'flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200',
                isActive ? 'bg-[#1A2BA6] text-white shadow-md' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              )}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'staff' && (
          <motion.div key="staff" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <StaffWorkspace />
          </motion.div>
        )}

        {activeTab === 'contracts' && (
          <motion.div key="contracts" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <ContractsWorkspace />
          </motion.div>
        )}

        {activeTab === 'assignments' && (
          <motion.div key="assignments" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-base font-bold text-slate-900">Affectations des collaborateurs</h3>
              <span className="text-xs text-slate-500">2 affectations actives</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { name: 'Dr. Jean Diallo', role: 'Doyen des Enseignements', date: 'Depuis le 01/09/2025', dept: 'Sciences et Technologies' },
                { name: 'Mme. Sarah Gnonlonfoun', role: 'Responsable Pédagogique', date: 'Depuis le 15/10/2025', dept: 'Administration' },
              ].map((ass, i) => (
                <div key={i} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                  <h4 className="font-bold text-slate-900 text-sm">{ass.name}</h4>
                  <p className="text-xs text-[#1A2BA6] font-semibold mt-1">{ass.role}</p>
                  <p className="text-xs text-slate-500 mt-2">Département : {ass.dept}</p>
                  <p className="text-[10px] text-slate-400 mt-4">{ass.date}</p>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {activeTab === 'history' && (
          <motion.div key="history" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            <h3 className="text-base font-bold text-slate-900">Historique des modifications de contrat</h3>
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm divide-y divide-slate-100">
              {[
                { name: 'Fatimata Sow', action: 'Promotion - Directeur adjoint des études', date: '01/06/2026', author: 'Directrice RH' },
                { name: 'Dr. Jean Diallo', action: 'Renouvellement Contrat CDD', date: '15/05/2026', author: 'Responsable Admin' },
              ].map((hist, i) => (
                <div key={i} className="py-3 flex justify-between items-center text-xs">
                  <div>
                    <p className="font-bold text-slate-900">{hist.name}</p>
                    <p className="text-slate-500 mt-0.5">{hist.action}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-slate-700">{hist.date}</p>
                    <p className="text-[10px] text-slate-400">Par {hist.author}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {activeTab === 'org_chart' && (
          <motion.div key="org_chart" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            <h3 className="text-base font-bold text-slate-900">Organigramme</h3>
            <div className="bg-white border border-slate-200 rounded-xl p-8 flex flex-col items-center justify-center min-h-[300px]">
              <div className="border border-slate-200 rounded-xl p-4 bg-slate-50 text-center shadow-sm w-48 mb-6">
                <p className="font-bold text-slate-900 text-xs">Directeur Général</p>
                <p className="text-[10px] text-[#1A2BA6] font-bold">M. Charles Lawson</p>
              </div>
              <div className="w-1 h-8 bg-slate-200" />
              <div className="grid grid-cols-2 gap-8 mt-2">
                <div className="border border-slate-200 rounded-xl p-4 bg-slate-50 text-center shadow-sm w-44">
                  <p className="font-bold text-slate-900 text-xs">Directeur des Études</p>
                  <p className="text-[10px] text-slate-500">Dr. Jean Diallo</p>
                </div>
                <div className="border border-slate-200 rounded-xl p-4 bg-slate-50 text-center shadow-sm w-44">
                  <p className="font-bold text-slate-900 text-xs">Responsable RH</p>
                  <p className="text-[10px] text-slate-500">Mme. Sarah G.</p>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Connection to CNSS notification */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 text-xs">
        <div className="flex gap-2.5">
          <ShieldAlert className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-amber-900">Nouvelles embauches en cours de validation</p>
            <p className="text-amber-700 mt-0.5">Assurez-vous de déclarer les nouveaux collaborateurs à la CNSS dès la signature de leur contrat.</p>
          </div>
        </div>
        <Link
          href="/app/hr/cnss"
          className="text-[#1A2BA6] font-bold hover:underline shrink-0 bg-white border border-amber-200 px-3 py-1.5 rounded-lg"
        >
          Déclarer à la CNSS →
        </Link>
      </div>
    </div>
  );
}
