'use client';

import React from 'react';
import { 
  ShieldCheck, 
  Search, 
  FileText, 
  History as HistoryIcon, 
  CheckSquare, 
  Lock,
  Printer,
  Download,
  Filter,
  MoreVertical,
  Plus
} from 'lucide-react';
import { ModuleContentArea } from '@/components/modules/blueprint';

export default function AdministrativeCommunicationPage() {
  const documents = [
    { id: 1, title: 'Note de service N°2026-004', date: '12/05/2026', type: 'CIRCULAIRE', status: 'SIGNED', author: 'Direction Générale' },
    { id: 2, title: 'Compte rendu du conseil de direction', date: '08/05/2026', type: 'PV', status: 'ARCHIVED', author: 'Secrétariat' },
    { id: 3, title: 'Protocole sanitaire 2026', date: '01/05/2026', type: 'RÈGLEMENT', status: 'SIGNED', author: 'Administration' },
  ];

  return (
    <ModuleContentArea>
      <div className="p-6 space-y-8">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h3 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
              <ShieldCheck className="text-blue-600" size={32} /> Communication Administrative
            </h3>
            <p className="text-slate-500 font-medium mt-1">Registre officiel des notes de service, circulaires et documents institutionnels.</p>
          </div>
          <div className="flex gap-3">
            <button className="bg-white border border-slate-200 text-slate-600 px-6 py-3 rounded-2xl font-bold flex items-center gap-2 hover:bg-slate-50 transition-all">
              <HistoryIcon size={18} /> Historique
            </button>
            <button className="bg-blue-600 text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 hover:bg-blue-700 transition-all shadow-lg shadow-blue-200">
              <Plus size={18} /> Nouveau Document
            </button>
          </div>
        </div>

        {/* Content Table Style */}
        <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-50 flex items-center justify-between bg-slate-50/30">
            <div className="flex items-center gap-6">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input type="text" placeholder="Rechercher un document..." className="pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 w-64 shadow-sm" />
              </div>
              <div className="flex items-center gap-2">
                <button className="p-2.5 rounded-xl bg-white border border-slate-200 text-slate-400 hover:text-blue-600 transition-all">
                  <Filter size={18} />
                </button>
              </div>
            </div>
          </div>

          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 text-left border-b border-slate-100">
                <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Document / Titre</th>
                <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Auteur</th>
                <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Date</th>
                <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Statut</th>
                <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {documents.map((doc) => (
                <tr key={doc.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                        <FileText size={20} />
                      </div>
                      <div>
                        <p className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors">{doc.title}</p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">{doc.type}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <p className="text-sm font-bold text-slate-600">{doc.author}</p>
                  </td>
                  <td className="px-8 py-5">
                    <p className="text-sm font-medium text-slate-500">{doc.date}</p>
                  </td>
                  <td className="px-8 py-5">
                    <div className="flex justify-center">
                      <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 ${
                        doc.status === 'SIGNED' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'
                      }`}>
                        {doc.status === 'SIGNED' ? <CheckSquare size={12} /> : <Lock size={12} />}
                        {doc.status}
                      </span>
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button className="p-2 rounded-lg bg-white border border-slate-200 text-slate-400 hover:text-blue-600 hover:border-blue-200 transition-all shadow-sm">
                        <Printer size={16} />
                      </button>
                      <button className="p-2 rounded-lg bg-white border border-slate-200 text-slate-400 hover:text-blue-600 hover:border-blue-200 transition-all shadow-sm">
                        <Download size={16} />
                      </button>
                      <button className="p-2 rounded-lg bg-white border border-slate-200 text-slate-400 hover:text-blue-600 transition-all">
                        <MoreVertical size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </ModuleContentArea>
  );
}
