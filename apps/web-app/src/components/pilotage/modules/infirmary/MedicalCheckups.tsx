/**
 * ============================================================================
 * MEDICAL CHECKUPS TAB
 * ============================================================================
 */

'use client';

import { motion } from 'framer-motion';
import { 
  Calendar, 
  Plus, 
  Filter, 
  Search, 
  Users, 
  CheckCircle2, 
  Clock, 
  ChevronRight,
  MoreVertical,
  Stethoscope
} from 'lucide-react';

export default function MedicalCheckups() {
  return (
    <div className="space-y-6">
      {/* Action Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-2">
          <button className="px-6 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-black flex items-center hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200">
            <Plus className="w-4 h-4 mr-2" />
            Planifier Visite
          </button>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Rechercher une campagne..."
              className="pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20 w-64"
            />
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <button className="p-2.5 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors">
            <Filter className="w-4 h-4 text-slate-600" />
          </button>
        </div>
      </div>

      {/* Checkups List */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {[
          { 
            title: 'Visite Médicale Annuelle - Maternelle', 
            date: '15 Juin 2024', 
            time: '08:00 - 14:00',
            location: 'Infirmerie Centrale',
            target: 'Toute la Maternelle',
            provider: 'Dr. Lawson & Dr. Yao',
            status: 'PLANNED',
            color: 'bg-blue-600'
          },
          { 
            title: 'Dépistage Visuel - Primaire (CE2)', 
            date: '22 Juin 2024', 
            time: '09:00 - 12:00',
            location: 'Salle Polyvalente',
            target: 'Classes CE2 A, B & C',
            provider: 'Cabinet Ophtalmo-Vision',
            status: 'PLANNED',
            color: 'bg-blue-600'
          },
          { 
            title: 'Campagne de Vaccination Rappel', 
            date: '10 Mai 2024', 
            time: '08:00 - 16:00',
            location: 'Infirmerie Centrale',
            target: 'Élèves concernés (internat)',
            provider: 'Centre de Santé Public',
            status: 'COMPLETED',
            color: 'bg-emerald-500'
          },
          { 
            title: 'Suivi Sport-Études - Secondaire', 
            date: '05 Mai 2024', 
            time: '14:00 - 18:00',
            location: 'Gymnase / Vestiaires',
            target: 'Sections Sportives',
            provider: 'Infirmière Scolaire',
            status: 'COMPLETED',
            color: 'bg-emerald-500'
          },
        ].map((checkup, i) => (
          <motion.div 
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition-all group"
          >
            <div className="flex justify-between items-start mb-6">
              <div className={`p-3 rounded-2xl ${checkup.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'}`}>
                <Stethoscope className="w-6 h-6" />
              </div>
              <div className="flex items-center space-x-2">
                <span className={`text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest ${
                  checkup.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'
                }`}>
                  {checkup.status === 'COMPLETED' ? 'Terminé' : 'À venir'}
                </span>
                <button className="p-1 hover:bg-slate-100 rounded-lg text-slate-400">
                  <MoreVertical className="w-4 h-4" />
                </button>
              </div>
            </div>

            <h3 className="text-lg font-black text-slate-900 mb-2 group-hover:text-blue-600 transition-colors">{checkup.title}</h3>
            
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="space-y-1">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Date & Heure</p>
                <div className="flex items-center text-sm font-bold text-slate-700">
                  <Calendar className="w-3.5 h-3.5 mr-2 text-slate-400" />
                  {checkup.date}
                </div>
                <div className="flex items-center text-xs font-medium text-slate-500 pl-5">
                  {checkup.time}
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Cible</p>
                <div className="flex items-center text-sm font-bold text-slate-700">
                  <Users className="w-3.5 h-3.5 mr-2 text-slate-400" />
                  {checkup.target}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-slate-50">
              <div className="flex items-center text-xs font-medium text-slate-500">
                <CheckCircle2 className="w-4 h-4 mr-2 text-emerald-500" />
                {checkup.status === 'COMPLETED' ? 'Rapport validé' : '0% élèves examinés'}
              </div>
              <button className="text-blue-600 text-sm font-black flex items-center hover:translate-x-1 transition-transform">
                {checkup.status === 'COMPLETED' ? 'Voir Résultats' : 'Gérer la Visite'}
                <ChevronRight className="w-4 h-4 ml-1" />
              </button>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
