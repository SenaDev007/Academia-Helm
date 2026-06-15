/**
 * ============================================================================
 * INFIRMARY VISITS TAB
 * ============================================================================
 */

'use client';

import { motion } from 'framer-motion';
import { 
  Plus, 
  Search, 
  Calendar as CalendarIcon, 
  Filter,
  CheckCircle2,
  Clock,
  ExternalLink,
  UserCheck,
  Home,
  AlertTriangle
} from 'lucide-react';

export default function InfirmaryVisits() {
  return (
    <div className="space-y-6">
      {/* Action Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-2">
          <button className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold flex items-center hover:bg-blue-700 transition-colors shadow-sm">
            <Plus className="w-4 h-4 mr-2" />
            Nouveau Passage
          </button>
          <button className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors">
            <CalendarIcon className="w-4 h-4 mr-2 inline" />
            Aujourd'hui
          </button>
        </div>
        
        <div className="flex items-center space-x-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Rechercher une visite..."
              className="pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
          <button className="p-2 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors">
            <Filter className="w-4 h-4 text-slate-600" />
          </button>
        </div>
      </div>

      {/* Visits Log */}
      <div className="grid grid-cols-1 gap-4">
        {[
          { 
            student: 'Jean Dupont', 
            class: '6ème A', 
            time: '14:20', 
            reason: 'Maux de tête', 
            action: 'Repos 30min + Paracétamol', 
            status: 'IN_PROGRESS',
            statusLabel: 'En observation',
            icon: Clock,
            color: 'text-amber-600 bg-amber-50 border-amber-100'
          },
          { 
            student: 'Marie Kassa', 
            class: 'CM2 B', 
            time: '13:45', 
            reason: 'Chute cour de récré', 
            action: 'Désinfection + Pansement', 
            status: 'COMPLETED',
            statusLabel: 'Retour en classe',
            icon: UserCheck,
            color: 'text-emerald-600 bg-emerald-50 border-emerald-100'
          },
          { 
            student: 'Sarah Lawson', 
            class: '3ème B', 
            time: '10:15', 
            reason: 'Douleur abdominale sévère', 
            action: 'Appel parents + Transfert', 
            status: 'TRANSFERRED',
            statusLabel: 'Transféré / Foyer',
            icon: Home,
            color: 'text-rose-600 bg-rose-50 border-rose-100'
          },
          { 
            student: 'Marc Yao', 
            class: 'CE1', 
            time: '09:30', 
            reason: 'Réaction allergique', 
            action: 'Épi-pen administré + SAMU', 
            status: 'EMERGENCY',
            statusLabel: 'Urgence Vitale',
            icon: AlertTriangle,
            color: 'text-red-700 bg-red-50 border-red-200'
          },
        ].map((visit, i) => (
          <motion.div 
            key={i}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
            className={`p-5 rounded-2xl border bg-white shadow-sm hover:shadow-md transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 border-l-4 ${visit.color.split(' ')[2]}`}
          >
            <div className="flex items-start space-x-4">
              <div className={`mt-1 p-2 rounded-xl ${visit.color.split(' ')[0]} ${visit.color.split(' ')[1]}`}>
                <visit.icon className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h4 className="font-bold text-slate-900">{visit.student}</h4>
                  <span className="text-xs font-medium text-slate-400">• {visit.time}</span>
                </div>
                <p className="text-xs text-slate-500 font-medium mb-2">{visit.class}</p>
                <div className="flex flex-col space-y-1">
                  <p className="text-sm text-slate-700"><span className="font-bold">Motif:</span> {visit.reason}</p>
                  <p className="text-sm text-slate-600 italic"><span className="font-bold not-italic">Action:</span> {visit.action}</p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between md:justify-end gap-3 pt-4 md:pt-0 border-t md:border-t-0 border-slate-100">
              <div className="text-right">
                <span className={`text-[10px] uppercase tracking-widest font-black px-3 py-1 rounded-full ${visit.color.split(' ')[0]} ${visit.color.split(' ')[1]}`}>
                  {visit.statusLabel}
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <button className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-blue-600 transition-colors">
                  <ExternalLink className="w-4 h-4" />
                </button>
                <button className="px-4 py-2 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl text-xs font-bold transition-colors">
                  Détails
                </button>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <button className="w-full py-4 border-2 border-dashed border-slate-200 rounded-2xl text-slate-400 text-sm font-bold hover:border-slate-300 hover:text-slate-500 transition-all">
        Afficher les visites des jours précédents
      </button>
    </div>
  );
}
