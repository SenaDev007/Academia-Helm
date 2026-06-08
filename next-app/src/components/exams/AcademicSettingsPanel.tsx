/**
 * AcademicSettingsPanel Component
 * 
 * ONGLET 2 — Paramétrage académique
 * Configuration des périodes, barèmes, types d'évaluations et règles de calcul.
 */

'use client';

import { useState } from 'react';
import { Settings, Plus, ChevronRight, Clock, Scale, FileText, Calculator, Award, BookTemplate } from 'lucide-react';
import { cn } from '@/lib/utils';

const sections = [
  { id: 'periods', label: 'Périodes d\'Évaluation', icon: Clock, color: 'text-blue-600', bg: 'bg-blue-50', desc: 'Trimestres, semestres, séquences' },
  { id: 'scales', label: 'Barèmes de Notation', icon: Scale, color: 'text-emerald-600', bg: 'bg-emerald-50', desc: '/20, /10, /100' },
  { id: 'types', label: 'Types d\'Évaluation', icon: FileText, color: 'text-indigo-600', bg: 'bg-indigo-50', desc: 'Devoirs, compositions, oraux' },
  { id: 'rules', label: 'Règles de Calcul', icon: Calculator, color: 'text-amber-600', bg: 'bg-amber-50', desc: 'Formules de moyenne pondérée' },
  { id: 'mentions', label: 'Mentions & Décisions', icon: Award, color: 'text-rose-600', bg: 'bg-rose-50', desc: 'Admis, ajourné, félicitations' },
  { id: 'templates', label: 'Modèles de Bulletins', icon: BookTemplate, color: 'text-violet-600', bg: 'bg-violet-50', desc: 'Templates PDF par niveau' },
];

export default function AcademicSettingsPanel() {
  const [activeSection, setActiveSection] = useState('periods');

  const periods = [
    { id: '1', name: 'Trimestre 1', type: 'TRIMESTER', start: '05 Sept 2025', end: '05 Dec 2025', status: 'LOCKED' },
    { id: '2', name: 'Trimestre 2', type: 'TRIMESTER', start: '06 Jan 2026', end: '28 Mars 2026', status: 'ACTIVE' },
    { id: '3', name: 'Trimestre 3', type: 'TRIMESTER', start: '06 Avr 2026', end: '30 Juin 2026', status: 'PLANNED' },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
      {/* Left Navigation */}
      <div className="space-y-2">
        {sections.map((s) => (
          <button
            key={s.id}
            onClick={() => setActiveSection(s.id)}
            className={cn(
              "w-full p-4 rounded-2xl text-left flex items-center gap-4 transition-all group",
              activeSection === s.id ? "bg-slate-900 text-white shadow-lg" : "bg-white border border-slate-200 hover:border-slate-300 hover:shadow-sm"
            )}
          >
            <div className={cn("p-2.5 rounded-xl", activeSection === s.id ? "bg-white/10" : cn(s.bg))}>
              <s.icon className={cn("w-4 h-4", activeSection === s.id ? "text-white" : s.color)} />
            </div>
            <div className="flex-1 min-w-0">
              <p className={cn("text-xs font-black uppercase tracking-tighter truncate", activeSection === s.id ? "text-white" : "text-slate-700")}>{s.label}</p>
              <p className={cn("text-[10px] mt-0.5 truncate", activeSection === s.id ? "text-slate-400" : "text-slate-400")}>{s.desc}</p>
            </div>
            <ChevronRight className={cn("w-3 h-3 flex-shrink-0", activeSection === s.id ? "text-slate-400" : "text-slate-300")} />
          </button>
        ))}
      </div>

      {/* Right Content Panel */}
      <div className="lg:col-span-3 bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        {activeSection === 'periods' && (
          <div>
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="font-black text-slate-900">Périodes d'Évaluation</h3>
                <p className="text-xs text-slate-400 mt-1">Configuration du calendrier académique de l'année en cours</p>
              </div>
              <button className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-all">
                <Plus className="w-3 h-3" /> Nouvelle Période
              </button>
            </div>
            <div className="p-6 space-y-4">
              {periods.map((p) => (
                <div key={p.id} className="p-5 rounded-2xl border border-slate-100 bg-slate-50/50 flex items-center justify-between hover:bg-slate-50 transition-all group">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-slate-200 flex items-center justify-center font-black text-slate-600 text-sm">{p.id}</div>
                    <div>
                      <p className="font-bold text-slate-900 text-sm">{p.name}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">{p.start} → {p.end}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={cn(
                      "px-3 py-1 rounded-full text-[10px] font-black uppercase",
                      p.status === 'LOCKED' ? "bg-rose-50 text-rose-600" :
                      p.status === 'ACTIVE' ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-500"
                    )}>
                      {p.status === 'LOCKED' ? '🔒 Verrouillé' : p.status === 'ACTIVE' ? '✅ En cours' : '⏳ Planifié'}
                    </span>
                    <button className="p-2 hover:bg-white rounded-lg text-slate-400 hover:text-slate-700 transition-all opacity-0 group-hover:opacity-100">
                      <Settings className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeSection === 'scales' && (
          <div className="p-8">
            <h3 className="font-black text-slate-900 mb-6">Barèmes de Notation</h3>
            <div className="grid grid-cols-3 gap-4">
              {[
                { name: 'Barème /20', max: 20, pass: 10, default: true },
                { name: 'Barème /10', max: 10, pass: 5, default: false },
                { name: 'Barème /100', max: 100, pass: 50, default: false },
              ].map((scale, i) => (
                <div key={i} className={cn("p-6 rounded-2xl border text-center", scale.default ? "border-emerald-300 bg-emerald-50" : "border-slate-200 bg-white")}>
                  <p className="text-2xl font-black text-slate-900">/{scale.max}</p>
                  <p className="text-xs font-bold text-slate-400 mt-1">{scale.name}</p>
                  <p className="text-[10px] text-slate-400 mt-1">Seuil : {scale.pass}</p>
                  {scale.default && <span className="mt-3 inline-block px-2 py-0.5 bg-emerald-600 text-white text-[10px] font-black rounded-full">Défaut</span>}
                </div>
              ))}
            </div>
            <button className="mt-6 flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-slate-700 transition-colors">
              <Plus className="w-3 h-3" /> Ajouter un barème personnalisé
            </button>
          </div>
        )}

        {['types', 'rules', 'mentions', 'templates'].includes(activeSection) && (
          <div className="p-12 text-center">
            <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Settings className="w-8 h-8 text-slate-300" />
            </div>
            <h3 className="font-bold text-slate-900">{sections.find(s => s.id === activeSection)?.label}</h3>
            <p className="text-sm text-slate-400 mt-2">{sections.find(s => s.id === activeSection)?.desc}</p>
            <button className="mt-6 flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-all mx-auto">
              <Plus className="w-3 h-3" /> Configurer
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
