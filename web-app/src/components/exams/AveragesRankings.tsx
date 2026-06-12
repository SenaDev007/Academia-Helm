/**
 * AveragesRankings Component
 * 
 * ONGLET 6 — Moyennes & Classements
 * Calcul automatique des moyennes, rangs, mentions et évolution par période.
 */

'use client';

import { useState } from 'react';
import { BarChart3, TrendingUp, TrendingDown, RefreshCw, Share2, Award, Users, ArrowUp, ArrowDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function AveragesRankings() {
  const [students] = useState([
    { rank: 1, name: 'Amadou Koné', avg: 17.42, mention: 'Très Bien', evolution: 'up', subjects: { maths: 18.5, french: 16.0, physics: 17.5 } },
    { rank: 2, name: 'Fatou Diallo', avg: 16.18, mention: 'Bien', evolution: 'up', subjects: { maths: 15.0, french: 17.5, physics: 16.0 } },
    { rank: 3, name: 'Kouakou René', avg: 15.65, mention: 'Bien', evolution: 'stable', subjects: { maths: 16.5, french: 14.5, physics: 15.5 } },
    { rank: 4, name: 'Marie-Ange Traoré', avg: 13.21, mention: 'Assez Bien', evolution: 'down', subjects: { maths: 11.0, french: 14.5, physics: 14.0 } },
    { rank: 5, name: 'Ibrahim Sylla', avg: 9.85, mention: 'Passable', evolution: 'down', subjects: { maths: 8.0, french: 11.0, physics: 10.5 } },
  ]);

  return (
    <div className="space-y-6">
      {/* Actions Banner */}
      <div className="bg-slate-900 rounded-3xl p-8 text-white flex items-center justify-between">
        <div>
          <h3 className="text-xl font-black tracking-tighter">Moteur de Calcul des Moyennes</h3>
          <p className="text-slate-400 text-xs mt-1">Terminale C — Trimestre 2 — {students.length} élèves</p>
          <div className="flex items-center gap-6 mt-4">
            <div>
              <p className="text-2xl font-black">13.46<span className="text-sm text-slate-400">/20</span></p>
              <p className="text-[10px] text-slate-400 uppercase font-bold">Moyenne Classe</p>
            </div>
            <div>
              <p className="text-2xl font-black text-emerald-400">72%</p>
              <p className="text-[10px] text-slate-400 uppercase font-bold">Taux Réussite</p>
            </div>
            <div>
              <p className="text-2xl font-black text-amber-400">4</p>
              <p className="text-[10px] text-slate-400 uppercase font-bold">Éliminés (&lt;08)</p>
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-3">
          <button className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-xl font-bold text-xs hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-900/20">
            <RefreshCw className="w-4 h-4" /> Recalculer Moyennes
          </button>
          <button className="flex items-center gap-2 px-5 py-2.5 bg-white/10 text-white rounded-xl font-bold text-xs hover:bg-white/20 transition-all">
            <Share2 className="w-4 h-4" /> Publier Classements
          </button>
        </div>
      </div>

      {/* Rankings Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest">Classement Général</h3>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
              <BarChart3 className="w-3 h-3" /> Pondération appliquée
            </span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest w-16">Rang</th>
                <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Élève</th>
                <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Maths</th>
                <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Français</th>
                <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Physique</th>
                <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Moy. Gén.</th>
                <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Mention</th>
                <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Évolution</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {students.map((s) => (
                <tr key={s.rank} className={cn("hover:bg-slate-50/50 transition-colors", s.rank === 1 && "bg-amber-50/30")}>
                  <td className="px-6 py-4">
                    <div className={cn(
                      "w-8 h-8 rounded-xl flex items-center justify-center font-black text-sm",
                      s.rank === 1 ? "bg-amber-400 text-white" : s.rank === 2 ? "bg-slate-300 text-slate-700" : s.rank === 3 ? "bg-amber-700/20 text-amber-800" : "bg-slate-100 text-slate-500"
                    )}>
                      {s.rank}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm font-bold text-slate-900">{s.name}</p>
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-slate-700">{s.subjects.maths}</td>
                  <td className="px-6 py-4 text-sm font-medium text-slate-700">{s.subjects.french}</td>
                  <td className="px-6 py-4 text-sm font-medium text-slate-700">{s.subjects.physics}</td>
                  <td className="px-6 py-4">
                    <span className={cn(
                      "text-lg font-black",
                      s.avg >= 14 ? "text-emerald-600" : s.avg >= 10 ? "text-slate-900" : "text-rose-600"
                    )}>
                      {s.avg.toFixed(2)}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={cn(
                      "px-2.5 py-1 rounded-full text-[10px] font-black",
                      s.avg >= 16 ? "bg-blue-50 text-blue-700" :
                      s.avg >= 14 ? "bg-emerald-50 text-emerald-700" :
                      s.avg >= 12 ? "bg-teal-50 text-teal-700" :
                      s.avg >= 10 ? "bg-slate-100 text-slate-600" : "bg-rose-50 text-rose-700"
                    )}>
                      {s.mention}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {s.evolution === 'up' ? <ArrowUp className="w-4 h-4 text-emerald-500" /> :
                     s.evolution === 'down' ? <ArrowDown className="w-4 h-4 text-rose-500" /> :
                     <Minus className="w-4 h-4 text-slate-300" />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
