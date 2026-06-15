/**
 * ============================================================================
 * PRACTICAL SESSIONS (SÉANCES PRATIQUES)
 * ============================================================================
 */

'use client';

import { motion } from 'framer-motion';
import { 
  GraduationCap, 
  Search, 
  FileText, 
  Users, 
  CheckCircle,
  MoreVertical,
  Plus,
  ArrowRight
} from 'lucide-react';

export default function PracticalSessions() {
  const sessions = [
    { id: 'SES-202', theme: 'Mesure de la pesanteur', subject: 'Physique', teacher: 'M. Saliou', date: '15/05/2026', students: 28, status: 'COMPLETED' },
    { id: 'SES-203', theme: 'Synthèse du savon', subject: 'Chimie', teacher: 'Mme. Koffi', date: '14/05/2026', students: 24, status: 'COMPLETED' },
    { id: 'SES-204', theme: 'Dissection de grenouille', subject: 'SVT', teacher: 'M. Lawson', date: '12/05/2026', students: 30, status: 'COMPLETED' },
    { id: 'SES-205', theme: 'Circuits logiques NAND', subject: 'Électronique', teacher: 'M. Saliou', date: '10/05/2026', students: 18, status: 'COMPLETED' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter">Historique des Travaux Pratiques</h3>
        <div className="flex gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input type="text" placeholder="Rechercher..." className="pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm outline-none" />
          </div>
          <button className="flex items-center space-x-2 px-4 py-2 bg-[#C9A84C] text-white rounded-xl font-bold text-sm">
            <Plus className="w-4 h-4" />
            <span>Enregistrer Séance</span>
          </button>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100">
              <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Séance</th>
              <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Enseignant</th>
              <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Élèves</th>
              <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Date</th>
              <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Rapport</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {sessions.map((ses, i) => (
              <motion.tr
                key={ses.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.05 }}
                className="hover:bg-slate-50 transition-colors"
              >
                <td className="px-8 py-5">
                  <div className="flex items-center gap-4">
                    <div className="p-2.5 bg-slate-100 rounded-xl">
                      <GraduationCap className="w-5 h-5 text-slate-500" />
                    </div>
                    <div>
                      <p className="font-black text-slate-900">{ses.theme}</p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase">{ses.subject} • {ses.id}</p>
                    </div>
                  </div>
                </td>
                <td className="px-8 py-5 text-sm font-bold text-slate-600">{ses.teacher}</td>
                <td className="px-8 py-5">
                  <div className="flex items-center text-sm font-bold text-slate-600">
                    <Users className="w-4 h-4 mr-2 text-slate-300" />
                    {ses.students} Présents
                  </div>
                </td>
                <td className="px-8 py-5 text-sm font-bold text-slate-500">{ses.date}</td>
                <td className="px-8 py-5 text-right">
                  <button className="inline-flex items-center px-4 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-blue-600 hover:text-white transition-all">
                    <FileText className="w-3.5 h-3.5 mr-2" />
                    Voir Rapport
                  </button>
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
