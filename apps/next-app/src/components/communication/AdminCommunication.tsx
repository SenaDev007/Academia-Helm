/**
 * AdminCommunication Component
 * 
 * ONGLET 10 — Communication Administrative
 * Notes de service, convocations et registre officiel interne.
 */

'use client';

import { useState } from 'react';
import { 
  Building2, 
  Search, 
  Plus, 
  FileText, 
  CheckCheck,
  Eye,
  Download,
  Filter
} from 'lucide-react';
import { cn } from '@/lib/utils';

export default function AdminCommunication() {
  const [documents] = useState([
    { id: 'ADM-2026-001', title: 'Note de Service : Procédure des Examens Blancs', type: 'NOTE DE SERVICE', target: 'Enseignants, Censeur', date: '15 Mai 2026', reads: '42/45', status: 'PUBLISHED' },
    { id: 'ADM-2026-002', title: 'Convocation Conseil de Discipline', type: 'CONVOCATION', target: 'M. Diallo, Direction', date: '14 Mai 2026', reads: '2/2', status: 'PUBLISHED' },
    { id: 'ADM-2026-003', title: 'Circulaire de Fin d\'Année', type: 'CIRCULAIRE', target: 'Tout le personnel', date: '—', reads: '0/0', status: 'DRAFT' },
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex-wrap gap-3">
        <div className="flex items-center gap-3 flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input placeholder="Rechercher une note, référence..." className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-violet-500/20 transition-all" />
          </div>
          <select className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none text-slate-600 focus:ring-2 focus:ring-violet-500/20">
            <option>Tous les types</option>
            <option>Note de service</option>
            <option>Circulaire</option>
            <option>Convocation</option>
          </select>
        </div>
        <button className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-slate-800 transition-all shadow-lg shadow-slate-900/20">
          <Plus className="w-4 h-4" /> Nouveau Document Officiel
        </button>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
            <Building2 className="w-4 h-4 text-slate-700" /> Registre Administratif Officiel
          </h3>
          <button className="text-[10px] font-black text-slate-500 flex items-center gap-1 hover:text-slate-700">
            <Download className="w-3 h-3" /> Exporter le Registre
          </button>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Réf & Titre</th>
                <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Destinataires</th>
                <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Type</th>
                <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Accusés Lecture</th>
                <th className="px-6 py-4 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {documents.map((doc) => (
                <tr key={doc.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-6 py-4">
                    <p className="text-sm font-bold text-slate-900">{doc.title}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5 font-mono">{doc.id} · {doc.date}</p>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-xs font-medium text-slate-700">{doc.target}</p>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-[10px] font-black bg-slate-100 text-slate-600 px-2 py-1 rounded-md uppercase tracking-wider">
                      {doc.type}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {doc.status === 'PUBLISHED' ? (
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-emerald-600">{doc.reads}</span>
                        <CheckCheck className="w-4 h-4 text-emerald-500" />
                      </div>
                    ) : (
                      <span className="text-xs font-medium text-slate-400 italic">Brouillon</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors">
                      <FileText className="w-5 h-5" />
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
