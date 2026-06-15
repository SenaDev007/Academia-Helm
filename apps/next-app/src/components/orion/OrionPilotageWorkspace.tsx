'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Brain,
  ShieldAlert,
  Target,
  Lightbulb,
  CheckSquare,
  DollarSign,
  GraduationCap,
  Users,
  Bus,
  FileText,
  ChevronRight,
  Zap,
  ArrowRight,
  Bell,
} from 'lucide-react';

const TABS = [
  { id: 'cockpit', label: 'Cockpit Direction', icon: Target },
  { id: 'alerts', label: 'Alertes critiques', icon: ShieldAlert },
  { id: 'scores', label: 'Scores de pilotage', icon: Zap },
  { id: 'recommendations', label: 'Recommandations', icon: Lightbulb },
  { id: 'decisions', label: 'Décisions & Actions', icon: CheckSquare },
  { id: 'finance', label: 'Finances intelligentes', icon: DollarSign },
  { id: 'pedagogy', label: 'Pédagogie intelligente', icon: GraduationCap },
  { id: 'life', label: 'Vie scolaire intelligente', icon: Users },
  { id: 'services', label: 'Services intelligents', icon: Bus },
  { id: 'reports', label: 'Rapports Direction', icon: FileText },
];

export default function OrionPilotageWorkspace() {
  const [activeTab, setActiveTab] = useState('cockpit');

  return (
    <div className="flex flex-col h-full bg-slate-50/50">
      {/* Header */}
      <div className="bg-indigo-900 px-8 py-8 text-white relative overflow-hidden">
        {/* Decorative background element */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-800/30 rounded-full blur-3xl -mr-32 -mt-32" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="p-4 bg-white/10 rounded-2xl backdrop-blur-md border border-white/20">
              <Brain className="w-10 h-10 text-indigo-200" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">ORION — Pilotage Direction</h1>
              <p className="text-indigo-200 mt-1 opacity-80">Intelligence décisionnelle assistée par IA</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-4 py-2 bg-emerald-500/20 text-emerald-300 rounded-xl text-sm font-bold border border-emerald-500/30">
              <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
              SARA AI Connectée
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 mt-10 overflow-x-auto no-scrollbar pb-1">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all whitespace-nowrap ${
                  isActive 
                    ? 'bg-white text-indigo-900 shadow-xl' 
                    : 'text-indigo-100 hover:bg-white/10'
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
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === 'cockpit' && <CockpitView />}
            {activeTab !== 'cockpit' && (
              <div className="p-12 text-center bg-white rounded-3xl border border-slate-100 shadow-sm">
                <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Zap className="w-8 h-8 text-indigo-400" />
                </div>
                <h3 className="text-lg font-bold text-slate-900">Analyse en cours...</h3>
                <p className="text-slate-500 mt-2">Sara AI croise les données agrégées pour générer vos insights {TABS.find(t => t.id === activeTab)?.label.toLowerCase()}.</p>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

function CockpitView() {
  return (
    <div className="space-y-8">
      {/* Top Priorities & Critical Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="p-6 bg-white rounded-3xl border border-slate-100 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-bold text-slate-900 flex items-center gap-2">
                <Bell className="w-5 h-5 text-red-500" />
                Alertes Critiques Immédiates
              </h3>
              <span className="text-xs font-bold text-slate-400">Total: 4 prioritaires</span>
            </div>
            <div className="space-y-3">
              {[
                { id: 1, title: 'Baisse brutale des notes (3ème A)', desc: 'Moyenne de classe passée de 12.5 à 9.8 en Mathématiques.', type: 'PEDAGOGY', priority: 'CRITICAL' },
                { id: 2, title: 'Impayés critiques détectés', desc: '15 parents n\'ont pas honoré la tranche 2. Risque de trésorerie.', type: 'FINANCE', priority: 'HIGH' },
                { id: 3, title: 'Retard de soumission pédagogique', desc: '12 enseignants n\'ont pas validé leur cahier de texte.', type: 'HR', priority: 'MEDIUM' },
              ].map((alert) => (
                <div key={alert.id} className="p-4 rounded-2xl border border-slate-100 bg-slate-50/50 flex items-center justify-between group hover:border-indigo-200 transition-all">
                  <div className="flex items-center gap-4">
                    <div className={`w-2 h-10 rounded-full ${
                      alert.priority === 'CRITICAL' ? 'bg-red-500' : alert.priority === 'HIGH' ? 'bg-amber-500' : 'bg-blue-500'
                    }`} />
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm">{alert.title}</h4>
                      <p className="text-xs text-slate-500 mt-0.5">{alert.desc}</p>
                    </div>
                  </div>
                  <button className="flex items-center gap-1 text-xs font-bold text-indigo-600 opacity-0 group-hover:opacity-100 transition-all">
                    Agir <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="p-6 bg-white rounded-3xl border border-slate-100 shadow-sm">
            <h3 className="font-bold text-slate-900 mb-6">Recommandations Directionnelles</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { title: 'Convoquer Parents (Retard)', icon: Users, color: 'text-amber-600', bg: 'bg-amber-50' },
                { title: 'Réunion Pédagogique (Maths)', icon: GraduationCap, color: 'text-indigo-600', bg: 'bg-indigo-50' },
                { title: 'Relance Facturation (SMS)', icon: DollarSign, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                { title: 'Inspection Cahiers de Texte', icon: FileText, color: 'text-blue-600', bg: 'bg-blue-50' },
              ].map((rec, i) => (
                <button key={i} className="flex items-center gap-4 p-4 rounded-2xl border border-slate-100 hover:border-indigo-100 hover:bg-indigo-50/30 transition-all text-left">
                  <div className={`p-3 rounded-xl ${rec.bg} ${rec.color}`}>
                    <rec.icon className="w-5 h-5" />
                  </div>
                  <span className="font-bold text-slate-700 text-sm">{rec.title}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Global School Score Cockpit */}
        <div className="p-8 bg-white rounded-3xl border border-slate-100 shadow-sm">
          <h3 className="font-bold text-slate-900 mb-2 text-center">Score de Santé Global</h3>
          <p className="text-xs text-slate-500 text-center mb-8">Calculé par ORION sur 120 vecteurs</p>
          
          <div className="flex justify-center mb-10">
            <div className="relative w-48 h-48">
              <svg className="w-full h-full transform -rotate-90">
                <circle cx="96" cy="96" r="80" stroke="currentColor" strokeWidth="16" fill="transparent" className="text-slate-100" />
                <circle cx="96" cy="96" r="80" stroke="currentColor" strokeWidth="16" fill="transparent" strokeDasharray="502" strokeDashoffset="502" className="text-indigo-600 transition-all duration-1000" style={{ strokeDashoffset: 502 - (502 * 0.84) }} />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-5xl font-black text-slate-900">84</span>
                <span className="text-xs font-bold text-emerald-600 uppercase mt-1">Excellent</span>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            {[
              { label: 'Financier', score: 92, color: 'bg-emerald-500' },
              { label: 'Pédagogique', score: 78, color: 'bg-indigo-500' },
              { label: 'Discipline', score: 88, color: 'bg-blue-500' },
              { label: 'Conformité Admin', score: 65, color: 'bg-amber-500' },
            ].map((score) => (
              <div key={score.label}>
                <div className="flex items-center justify-between text-xs font-bold text-slate-600 mb-1.5">
                  <span>{score.label}</span>
                  <span>{score.score}%</span>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className={`h-full ${score.color}`} style={{ width: `${score.score}%` }} />
                </div>
              </div>
            ))}
          </div>
          
          <button className="w-full mt-8 py-3 bg-indigo-900 text-white rounded-2xl text-sm font-bold shadow-xl shadow-indigo-200 flex items-center justify-center gap-2">
            Rapport Exécutif Complet
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
