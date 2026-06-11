/**
 * ============================================================================
 * PARENTAL AUTHORIZATIONS TAB
 * ============================================================================
 */

'use client';

import { motion } from 'framer-motion';
import { 
  ClipboardCheck, 
  UserCheck, 
  XCircle, 
  Clock, 
  FileText, 
  Search, 
  Download,
  AlertCircle,
  Mail
} from 'lucide-react';

export default function Authorizations() {
  return (
    <div className="space-y-6">
      {/* Overview */}
      <div className="bg-slate-900 rounded-3xl p-8 text-white flex flex-col md:flex-row items-center justify-between gap-8 shadow-xl shadow-slate-200">
        <div className="max-w-md">
          <h2 className="text-2xl font-black mb-3 flex items-center">
            <ClipboardCheck className="w-8 h-8 mr-3 text-emerald-400" />
            Autorisations de Soins
          </h2>
          <p className="text-slate-400 text-sm leading-relaxed">
            Gérez les permissions parentales pour l'administration de médicaments, les premiers soins et les transferts d'urgence.
          </p>
        </div>
        <div className="flex items-center space-x-6">
          <div className="text-center">
            <p className="text-3xl font-black text-emerald-400">92%</p>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Taux de Validation</p>
          </div>
          <div className="w-px h-12 bg-slate-800" />
          <div className="text-center">
            <p className="text-3xl font-black text-amber-400">12</p>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">En attente</p>
          </div>
          <button className="bg-white text-slate-900 px-6 py-3 rounded-2xl font-black text-sm hover:bg-slate-100 transition-all flex items-center">
            <Mail className="w-5 h-5 mr-2" />
            Relancer Parents
          </button>
        </div>
      </div>

      {/* Main List */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Chercher une autorisation..."
              className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
          <div className="flex items-center space-x-2">
            {['Toutes', 'Validées', 'En attente', 'Refusées'].map((f, i) => (
              <button key={i} className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${
                i === 0 ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-100'
              }`}>
                {f}
              </button>
            ))}
          </div>
        </div>
        
        <div className="divide-y divide-slate-100">
          {[
            { student: 'Jean Dupont', parent: 'M. Marc Dupont', type: 'Soins & Médicaments', status: 'VALIDATED', date: 'Sept 2023 - Juin 2024', color: 'text-emerald-600 bg-emerald-50' },
            { student: 'Marie Kassa', parent: 'Mme Kassa', type: 'Transfert Urgence', status: 'VALIDATED', date: 'Permanent', color: 'text-emerald-600 bg-emerald-50' },
            { student: 'Sarah Lawson', parent: 'M. Lawson', type: 'Soins & Médicaments', status: 'PENDING', date: 'En attente...', color: 'text-amber-600 bg-amber-50' },
            { student: 'Marc Yao', parent: 'Mme Yao', type: 'Médicaments Allergies', status: 'REFUSED', date: 'Refusé le 12/05', color: 'text-rose-600 bg-rose-50' },
            { student: 'Léa Sognon', parent: 'M. Sognon', type: 'Soins & Médicaments', status: 'VALIDATED', date: 'Année Scolaire', color: 'text-emerald-600 bg-emerald-50' },
          ].map((auth, i) => (
            <motion.div 
              key={i}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: i * 0.05 }}
              className="p-6 flex flex-col md:flex-row items-center justify-between gap-6 hover:bg-slate-50/50 transition-colors"
            >
              <div className="flex items-center space-x-4 w-full md:w-1/3">
                <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-400">
                  {auth.student.charAt(0)}
                </div>
                <div>
                  <h4 className="font-bold text-slate-900">{auth.student}</h4>
                  <p className="text-xs text-slate-500 font-medium">{auth.parent}</p>
                </div>
              </div>

              <div className="w-full md:w-1/3">
                <p className="text-sm font-bold text-slate-700">{auth.type}</p>
                <p className="text-xs text-slate-400 font-medium">Période: {auth.date}</p>
              </div>

              <div className="flex items-center justify-between md:justify-end gap-6 w-full md:w-1/3">
                <div className="flex items-center space-x-2">
                  {auth.status === 'VALIDATED' ? <UserCheck className="w-4 h-4 text-emerald-500" /> : 
                   auth.status === 'PENDING' ? <Clock className="w-4 h-4 text-amber-500" /> : 
                   <XCircle className="w-4 h-4 text-rose-500" />}
                  <span className={`text-[10px] font-black uppercase tracking-widest ${auth.color.split(' ')[0]}`}>
                    {auth.status === 'VALIDATED' ? 'Validée' : auth.status === 'PENDING' ? 'En attente' : 'Refusée'}
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <button className="p-2 hover:bg-white rounded-xl text-slate-400 hover:text-blue-600 transition-all">
                    <FileText className="w-5 h-5" />
                  </button>
                  <button className="p-2 hover:bg-white rounded-xl text-slate-400 hover:text-blue-600 transition-all">
                    <Download className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
