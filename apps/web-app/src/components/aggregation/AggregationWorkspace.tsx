'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  Users,
  Calculator,
  GraduationCap,
  AlertCircle,
  BookOpen,
  MessageSquare,
  Bus,
  Scale,
  FileDown,
  Filter,
  ChevronRight,
  TrendingUp,
  BarChart3,
} from 'lucide-react';

const TABS = [
  { id: 'summary', label: 'Vue consolidée', icon: LayoutDashboard },
  { id: 'students', label: 'Effectifs', icon: Users },
  { id: 'finance', label: 'Finances', icon: Calculator },
  { id: 'results', label: 'Résultats scolaires', icon: GraduationCap },
  { id: 'discipline', label: 'Présences & Discipline', icon: AlertCircle },
  { id: 'pedagogy', label: 'Pédagogie Enseignant', icon: BookOpen },
  { id: 'communication', label: 'Communication', icon: MessageSquare },
  { id: 'services', label: 'Services', icon: Bus },
  { id: 'comparisons', label: 'Comparaisons', icon: Scale },
  { id: 'reports', label: 'Exports & Rapports', icon: FileDown },
];

export default function AggregationWorkspace() {
  const [activeTab, setActiveTab] = useState('summary');

  return (
    <div className="flex flex-col h-full bg-slate-50/50">
      {/* Header with Title & Global Filters */}
      <div className="bg-white border-b border-slate-200 px-8 py-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
              <BarChart3 className="w-8 h-8 text-indigo-600" />
              Module Agrégation
            </h1>
            <p className="text-slate-500 mt-1">Vision consolidée et intelligente de l'établissement</p>
          </div>
          <div className="flex items-center gap-3">
            <button className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-sm font-semibold text-slate-700 transition-all">
              <Filter className="w-4 h-4" />
              Filtres Globaux
            </button>
            <button className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-xl text-sm font-semibold text-white transition-all shadow-lg shadow-indigo-100">
              <TrendingUp className="w-4 h-4" />
              Actualiser les données
            </button>
          </div>
        </div>

        {/* Horizontal Navigation */}
        <div className="flex items-center gap-1 mt-8 overflow-x-auto no-scrollbar pb-1">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all whitespace-nowrap ${
                  isActive 
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-100' 
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === 'summary' && <ConsolidatedView />}
            {activeTab !== 'summary' && (
              <div className="p-12 text-center bg-white rounded-3xl border border-dashed border-slate-200">
                <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <BarChart3 className="w-8 h-8 text-slate-300" />
                </div>
                <h3 className="text-lg font-bold text-slate-900">Module en cours de consolidation</h3>
                <p className="text-slate-500 mt-2">L'agrégation des données pour {TABS.find(t => t.id === activeTab)?.label} est en cours de calcul.</p>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

function ConsolidatedView() {
  return (
    <div className="space-y-8">
      {/* Top Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Effectifs Globaux', value: '1,248', trend: '+12%', icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Chiffre d\'Affaires', value: '42.5M', trend: '+8%', icon: Calculator, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Moyenne Générale', value: '14.2/20', trend: '+0.5', icon: GraduationCap, color: 'text-indigo-600', bg: 'bg-indigo-50' },
          { label: 'Taux de Présence', value: '96.4%', trend: '-1.2%', icon: AlertCircle, color: 'text-amber-600', bg: 'bg-amber-50' },
        ].map((stat, i) => (
          <div key={i} className="p-6 bg-white rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-all">
            <div className="flex items-center justify-between mb-4">
              <div className={`p-3 rounded-2xl ${stat.bg} ${stat.color}`}>
                <stat.icon className="w-6 h-6" />
              </div>
              <span className={`text-xs font-bold px-2 py-1 rounded-lg ${
                stat.trend.startsWith('+') ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'
              }`}>
                {stat.trend}
              </span>
            </div>
            <p className="text-sm font-medium text-slate-500">{stat.label}</p>
            <h3 className="text-2xl font-bold text-slate-900 mt-1">{stat.value}</h3>
          </div>
        ))}
      </div>

      {/* Main Analysis Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Academic Performance Snapshot */}
        <div className="lg:col-span-2 p-8 bg-white rounded-3xl border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-lg font-bold text-slate-900">Performance Pédagogique par Niveau</h3>
            <button className="text-indigo-600 text-sm font-bold flex items-center gap-1">
              Détails <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-6">
            {[
              { level: 'Secondaire', score: 14.8, count: 450, color: 'bg-indigo-600' },
              { level: 'Primaire', score: 15.2, count: 620, color: 'bg-blue-600' },
              { level: 'Maternelle', score: 12.5, count: 178, color: 'bg-emerald-600' },
            ].map((item) => (
              <div key={item.level}>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-slate-800">{item.level}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-slate-500">{item.count} élèves</span>
                    <span className="text-sm font-bold text-slate-900">{item.score}/20</span>
                  </div>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div 
                    className={`h-full ${item.color} transition-all duration-1000`} 
                    style={{ width: `${(item.score / 20) * 100}%` }} 
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Financial Recouvrement */}
        <div className="p-8 bg-white rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">Taux de Recouvrement</h3>
            <p className="text-xs text-slate-500 mb-8">Consolidation des paiements scolarité</p>
            
            <div className="relative w-40 h-40 mx-auto mb-8">
              <svg className="w-full h-full transform -rotate-90">
                <circle cx="80" cy="80" r="70" stroke="currentColor" strokeWidth="12" fill="transparent" className="text-slate-100" />
                <circle cx="80" cy="80" r="70" stroke="currentColor" strokeWidth="12" fill="transparent" strokeDasharray="440" strokeDashoffset="440" className="text-emerald-500 transition-all duration-1000" style={{ strokeDashoffset: 440 - (440 * 0.78) }} />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-extrabold text-slate-900">78%</span>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Payé</span>
              </div>
            </div>
          </div>
          
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl">
              <span className="text-xs font-bold text-slate-600">Total Encaissé</span>
              <span className="text-sm font-bold text-slate-900">33.1M FCFA</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-red-50 rounded-2xl">
              <span className="text-xs font-bold text-red-600">Impayés</span>
              <span className="text-sm font-bold text-red-900">9.4M FCFA</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
