/**
 * OfficialAnnouncements Component
 * 
 * ONGLET 3 — Annonces Officielles
 * Publication d'annonces institutionnelles avec ciblage avancé.
 */

'use client';

import { useState } from 'react';
import { 
  Megaphone, 
  Plus, 
  Search, 
  Filter, 
  CheckCircle2, 
  Clock, 
  AlertTriangle,
  MoreHorizontal,
  Target,
  Eye
} from 'lucide-react';
import { cn } from '@/lib/utils';

export default function OfficialAnnouncements() {
  const [announcements] = useState([
    { id: 'ANN-001', title: 'Réunion Parents-Professeurs T2', target: 'Tous les Parents', status: 'PUBLISHED', date: '15 Mai 2026', views: 342, author: 'Direction' },
    { id: 'ANN-002', title: 'Fermeture exceptionnelle (Férié)', target: 'Toute l\'école', status: 'SCHEDULED', date: '20 Mai 2026', views: 0, author: 'Administration' },
    { id: 'ANN-003', title: 'Rappel : Paiement Tranche 3', target: 'Parents (Débiteurs)', status: 'DRAFT', date: '—', views: 0, author: 'Comptabilité' },
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex-wrap gap-3">
        <div className="flex items-center gap-3 flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input placeholder="Rechercher une annonce..." className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-violet-500/20 transition-all" />
          </div>
          <button className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl hover:bg-slate-100 transition-all">
            <Filter className="w-4 h-4 text-slate-600" />
          </button>
        </div>
        <button className="flex items-center gap-2 px-4 py-2.5 bg-violet-600 text-white rounded-xl font-bold text-sm hover:bg-violet-700 transition-all shadow-lg shadow-violet-900/20">
          <Plus className="w-4 h-4" /> Créer une Annonce
        </button>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 bg-slate-50/50">
          <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
            <Megaphone className="w-4 h-4 text-violet-500" /> Registre des Annonces Officielles
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Annonce</th>
                <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Cible</th>
                <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Statut</th>
                <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Audience</th>
                <th className="px-6 py-4 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {announcements.map((ann) => (
                <tr key={ann.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-6 py-4">
                    <p className="text-sm font-bold text-slate-900">{ann.title}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">Par {ann.author} · {ann.date}</p>
                  </td>
                  <td className="px-6 py-4">
                    <span className="flex items-center gap-1.5 text-xs font-medium text-slate-600 bg-slate-100 px-2 py-1 rounded-md w-fit">
                      <Target className="w-3 h-3" /> {ann.target}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={cn(
                      "px-2.5 py-1 rounded-full text-[10px] font-black flex items-center gap-1 w-fit",
                      ann.status === 'PUBLISHED' ? "bg-emerald-50 text-emerald-600" :
                      ann.status === 'SCHEDULED' ? "bg-blue-50 text-blue-600" : "bg-slate-100 text-slate-500"
                    )}>
                      {ann.status === 'PUBLISHED' ? <CheckCircle2 className="w-3 h-3" /> :
                       ann.status === 'SCHEDULED' ? <Clock className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                      {ann.status === 'PUBLISHED' ? 'Publiée' : ann.status === 'SCHEDULED' ? 'Planifiée' : 'Brouillon'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                      <Eye className="w-4 h-4 text-slate-400" /> {ann.views} vues
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button className="p-2 hover:bg-slate-100 rounded-lg transition-all opacity-0 group-hover:opacity-100">
                      <MoreHorizontal className="w-4 h-4 text-slate-400" />
                    </button>
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
