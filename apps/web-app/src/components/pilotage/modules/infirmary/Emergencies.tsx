/**
 * ============================================================================
 * EMERGENCIES & INCIDENTS TAB
 * ============================================================================
 */

'use client';

import { motion } from 'framer-motion';
import { 
  AlertCircle, 
  PhoneCall, 
  MapPin, 
  ShieldAlert,
  ArrowRight,
  Plus,
  History,
  LifeBuoy
} from 'lucide-react';

export default function Emergencies() {
  return (
    <div className="space-y-8">
      {/* Active Emergencies Section */}
      <div className="bg-rose-50 border border-rose-100 rounded-3xl p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-black text-rose-900 flex items-center">
              <AlertCircle className="w-8 h-8 mr-3 animate-pulse" />
              Urgences Actives
            </h2>
            <p className="text-rose-700 font-medium">Interventions critiques nécessitant un suivi immédiat.</p>
          </div>
          <button className="bg-rose-600 hover:bg-rose-700 text-white px-6 py-3 rounded-2xl font-black text-sm flex items-center transition-all shadow-lg shadow-rose-200">
            <Plus className="w-5 h-5 mr-2" />
            DÉCLARER URGENCE
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <motion.div 
            whileHover={{ y: -5 }}
            className="bg-white rounded-2xl border-2 border-rose-200 p-6 shadow-xl shadow-rose-100/50"
          >
            <div className="flex justify-between items-start mb-4">
              <span className="bg-rose-600 text-white text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest">
                CRITIQUE
              </span>
              <span className="text-slate-400 text-xs font-bold flex items-center">
                <History className="w-3 h-3 mr-1" />
                Depuis 15 min
              </span>
            </div>
            <h3 className="text-xl font-black text-slate-900 mb-1">Marc Yao</h3>
            <p className="text-sm font-bold text-slate-500 mb-4">CE1 • Réaction Allergique</p>
            
            <div className="space-y-3 mb-6">
              <div className="flex items-center text-sm text-slate-600">
                <MapPin className="w-4 h-4 mr-2 text-rose-500" />
                Cantine Scolaire
              </div>
              <div className="flex items-center text-sm text-slate-600">
                <LifeBuoy className="w-4 h-4 mr-2 text-rose-500" />
                SAPEURS-POMPIERS APPELÉS (18)
              </div>
            </div>

            <div className="flex gap-2">
              <button className="flex-1 py-3 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl text-xs font-black transition-colors flex items-center justify-center">
                <PhoneCall className="w-4 h-4 mr-2" />
                Appeler Parent
              </button>
              <button className="flex-1 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-black transition-colors flex items-center justify-center">
                Suivre Dossier
                <ArrowRight className="w-4 h-4 ml-2" />
              </button>
            </div>
          </motion.div>

          <div className="bg-white/50 border-2 border-dashed border-rose-200 rounded-2xl flex items-center justify-center p-12">
            <p className="text-rose-300 font-bold text-center">Aucune autre urgence active.<br/>La situation est sous contrôle.</p>
          </div>
        </div>
      </div>

      {/* Incident History / Recent Logs */}
      <div>
        <h3 className="text-lg font-black text-slate-900 mb-4 flex items-center">
          <ShieldAlert className="w-5 h-5 mr-2 text-slate-400" />
          Historique des Incidents (7 derniers jours)
        </h3>
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Date / Heure</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Élève</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Incident</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Lieu</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Gravité</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Rapport</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {[
                { date: '21/05/2024', time: '10:30', student: 'Léa Sognon', type: 'Chute escalier', location: 'Bâtiment B', severity: 'MOYENNE', color: 'text-amber-600 bg-amber-50' },
                { date: '20/05/2024', time: '15:15', student: 'Yao Kouassi', type: 'Insolation', location: 'Terrain de Sport', severity: 'FAIBLE', color: 'text-blue-600 bg-blue-50' },
                { date: '18/05/2024', time: '09:45', student: 'Inès Atangana', type: 'Blessure coupante', location: 'Laboratoire SVT', severity: 'HAUTE', color: 'text-orange-600 bg-orange-50' },
              ].map((incident, i) => (
                <tr key={i} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 text-sm font-bold text-slate-900">
                    {incident.date} <span className="text-slate-400 text-xs font-medium ml-1">{incident.time}</span>
                  </td>
                  <td className="px-6 py-4 text-sm font-bold text-slate-700">{incident.student}</td>
                  <td className="px-6 py-4 text-sm text-slate-600">{incident.type}</td>
                  <td className="px-6 py-4 text-sm text-slate-600">{incident.location}</td>
                  <td className="px-6 py-4">
                    <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-tighter ${incident.color}`}>
                      {incident.severity}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button className="text-blue-600 text-xs font-bold hover:underline">Consulter</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      </div>
    </div>
  );
}
