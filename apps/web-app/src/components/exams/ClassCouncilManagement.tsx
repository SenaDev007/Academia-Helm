/**
 * ClassCouncilManagement Component
 * 
 * ONGLET 7 — Conseils de Classe
 * Gestion des sessions de conseil, décisions pédagogiques et PV automatiques.
 */

'use client';

import { useState } from 'react';
import { Users, Plus, CheckCircle2, Clock, XCircle, FileText, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

const decisions: Record<string, { label: string; color: string }> = {
  PROMOTED:             { label: 'Admis(e)',          color: 'bg-emerald-50 text-emerald-700' },
  REPEATED:             { label: 'Redouble',           color: 'bg-rose-50 text-rose-700' },
  WARNING:              { label: 'Avertissement',      color: 'bg-amber-50 text-amber-700' },
  ENCOURAGEMENT:        { label: 'Encouragements',     color: 'bg-blue-50 text-blue-700' },
  HONOR_ROLL:           { label: 'Félicitations',      color: 'bg-violet-50 text-violet-700' },
  CONDITIONAL_PROMOTION:{ label: 'Passable Conditionnel', color: 'bg-orange-50 text-orange-700' },
};

export default function ClassCouncilManagement() {
  const [councils] = useState([
    { id: 'CC-001', class: 'Terminale C', period: 'Trimestre 2', date: '22 Mai 2026', status: 'PLANNED', chair: 'Dir. Konaté', students: 34 },
    { id: 'CC-002', class: '3ème A', period: 'Trimestre 2', date: '23 Mai 2026', status: 'COMPLETED', chair: 'M. Censeur', students: 42 },
  ]);

  const [activeCouncil, setActiveCouncil] = useState<string | null>('CC-001');

  const studentDecisions = [
    { name: 'Amadou Koné', avg: 17.42, decision: 'HONOR_ROLL', appreciation: 'Élève brillant, sérieux et travailleur.' },
    { name: 'Fatou Diallo', avg: 16.18, decision: 'ENCOURAGEMENT', appreciation: 'Progression constante et régulière.' },
    { name: 'Ibrahim Sylla', avg: 9.85, decision: 'WARNING', appreciation: 'Doit fournir plus d\'efforts en mathématiques.' },
  ];

  return (
    <div className="space-y-6">
      {/* Council List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {councils.map((c) => (
          <button
            key={c.id}
            onClick={() => setActiveCouncil(c.id)}
            className={cn(
              "p-6 rounded-3xl border text-left transition-all",
              activeCouncil === c.id ? "border-slate-900 bg-slate-900 text-white shadow-xl" : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-md"
            )}
          >
            <div className="flex items-center justify-between mb-4">
              <span className={cn(
                "px-2.5 py-1 rounded-full text-[10px] font-black",
                c.status === 'PLANNED' ? (activeCouncil === c.id ? "bg-white/10 text-white" : "bg-blue-50 text-blue-600") : (activeCouncil === c.id ? "bg-white/10 text-white" : "bg-emerald-50 text-emerald-600")
              )}>
                {c.status === 'PLANNED' ? '⏳ Planifié' : '✅ Terminé'}
              </span>
              <ChevronRight className={cn("w-4 h-4", activeCouncil === c.id ? "text-slate-400" : "text-slate-300")} />
            </div>
            <h4 className={cn("font-black text-lg tracking-tighter", activeCouncil === c.id ? "text-white" : "text-slate-900")}>{c.class}</h4>
            <p className={cn("text-xs mt-1", activeCouncil === c.id ? "text-slate-400" : "text-slate-400")}>{c.period} · {c.date}</p>
            <div className={cn("flex items-center gap-4 mt-4 text-xs font-medium", activeCouncil === c.id ? "text-slate-300" : "text-slate-400")}>
              <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {c.students} élèves</span>
              <span>Présidé par {c.chair}</span>
            </div>
          </button>
        ))}

        <button className="p-6 rounded-3xl border border-dashed border-slate-300 flex flex-col items-center justify-center gap-2 hover:border-slate-400 hover:bg-slate-50 transition-all text-slate-400">
          <Plus className="w-8 h-8" />
          <span className="text-xs font-bold uppercase tracking-widest">Planifier un Conseil</span>
        </button>
      </div>

      {/* Decisions Panel */}
      {activeCouncil && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <h3 className="font-black text-slate-900">Décisions Pédagogiques — Terminale C</h3>
            <div className="flex items-center gap-2">
              <button className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-200 transition-all">
                <FileText className="w-3 h-3" /> Générer PV
              </button>
              <button className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-all">
                <CheckCircle2 className="w-3 h-3" /> Clôturer Conseil
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Élève</th>
                  <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Moy. Gén.</th>
                  <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Décision</th>
                  <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Appréciation du Conseil</th>
                  <th className="px-6 py-4 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {studentDecisions.map((sd, i) => (
                  <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <p className="text-sm font-bold text-slate-900">{sd.name}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span className={cn("text-lg font-black", sd.avg >= 14 ? "text-emerald-600" : sd.avg >= 10 ? "text-slate-900" : "text-rose-600")}>
                        {sd.avg.toFixed(2)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <select className={cn("px-3 py-1.5 rounded-xl text-[10px] font-black border-none focus:ring-2 focus:ring-slate-200 outline-none", decisions[sd.decision]?.color)}>
                        {Object.entries(decisions).map(([key, val]) => (
                          <option key={key} value={key} selected={key === sd.decision}>{val.label}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-6 py-4">
                      <input defaultValue={sd.appreciation} className="w-full text-xs text-slate-600 bg-transparent focus:outline-none italic" />
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button className="px-3 py-1.5 bg-slate-900 text-white rounded-lg text-[10px] font-black hover:bg-slate-800 transition-all">
                        Valider
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
