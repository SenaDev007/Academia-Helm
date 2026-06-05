/**
 * ============================================================================
 * SAFETY & INCIDENTS (SÉCURITÉ & INCIDENTS)
 * ============================================================================
 */

'use client';

import { motion } from 'framer-motion';
import { 
  ShieldAlert, 
  AlertTriangle, 
  Search, 
  FileWarning, 
  Plus, 
  Eye,
  CheckCircle2,
  Activity
} from 'lucide-react';

export default function SafetyIncidents() {
  const incidents = [
    { id: 'INC-402', type: 'CASSE MATÉRIEL', item: 'Éprouvette graduée', severity: 'LOW', date: '14/05/2026', status: 'RESOLVED' },
    { id: 'INC-403', type: 'PRODUIT RENVERSÉ', item: 'Acide Sulfurique', severity: 'HIGH', date: '12/05/2026', status: 'PENDING' },
    { id: 'INC-404', type: 'BLESSURE LÉGÈRE', item: 'Coupure (verre)', severity: 'MEDIUM', date: '10/05/2026', status: 'RESOLVED' },
    { id: 'INC-405', type: 'DÉFAUT ÉLECTRIQUE', item: 'Prise paillasse 4', severity: 'CRITICAL', date: '08/05/2026', status: 'OPEN' },
  ];

  return (
    <div className="space-y-8">
      {/* Risk Alert Header */}
      <div className="bg-rose-50 border-2 border-rose-100 rounded-3xl p-8 flex items-center gap-8">
        <div className="p-4 bg-white rounded-2xl shadow-sm text-rose-600">
          <ShieldAlert className="w-10 h-10 animate-pulse" />
        </div>
        <div className="flex-1">
          <h3 className="text-xl font-black text-rose-900 mb-2 uppercase tracking-tighter">Vigilance Sécurité Active</h3>
          <p className="text-rose-700/80 text-sm font-medium max-w-2xl">
            1 incident critique non résolu (Défaut électrique Bâtiment A). L'accès au Lab de Physique est restreint jusqu'à nouvel ordre.
          </p>
        </div>
        <button className="px-6 py-3 bg-rose-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-rose-700 transition-all shadow-xl shadow-rose-600/20">
          Déclarer un Incident
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Incident List */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex justify-between items-center mb-4">
            <h4 className="text-lg font-black text-slate-900 uppercase tracking-tighter">Registre des Incidents</h4>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input type="text" placeholder="Filtrer..." className="pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs outline-none" />
            </div>
          </div>
          
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  <th className="px-8 py-4">Type & Objet</th>
                  <th className="px-8 py-4">Gravité</th>
                  <th className="px-8 py-4">Date</th>
                  <th className="px-8 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {incidents.map((inc, i) => (
                  <tr key={inc.id} className="hover:bg-slate-50 transition-colors group">
                    <td className="px-8 py-5">
                      <div>
                        <p className="font-black text-slate-900">{inc.type}</p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">{inc.item} • {inc.id}</p>
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      <span className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${
                        inc.severity === 'CRITICAL' ? 'bg-rose-100 text-rose-700' :
                        inc.severity === 'HIGH' ? 'bg-orange-100 text-orange-700' :
                        inc.severity === 'MEDIUM' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
                      }`}>
                        {inc.severity}
                      </span>
                    </td>
                    <td className="px-8 py-5 text-sm font-bold text-slate-500">{inc.date}</td>
                    <td className="px-8 py-5 text-right">
                      <button className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-navy-900 transition-all">
                        <Eye className="w-5 h-5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        </div>

        {/* Safety Rules Summary */}
        <div className="space-y-6">
          <div className="bg-navy-900 rounded-3xl p-8 text-white shadow-xl">
            <h4 className="text-lg font-black mb-6 uppercase tracking-tighter flex items-center">
              <Activity className="w-5 h-5 mr-3 text-[#C9A84C]" />
              Consignes de Sécurité
            </h4>
            <div className="space-y-6">
              {[
                { title: 'Port de la blouse obligatoire', desc: 'SVT, Physique & Chimie' },
                { title: 'Lunettes de protection', desc: 'Manipulations d\'acides' },
                { title: 'Gants nitrile', desc: 'Solvants & bases fortes' },
                { title: 'Extincteur à proximité', desc: 'Lab Physique paillasse 1-8' },
              ].map((rule, i) => (
                <div key={i} className="flex items-start gap-4">
                  <div className="p-1 bg-white/10 rounded-full mt-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#C9A84C]" />
                  </div>
                  <div>
                    <p className="text-sm font-black tracking-tight">{rule.title}</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{rule.desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <button className="w-full mt-10 py-3 bg-white/10 hover:bg-white/20 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all">
              Toutes les Règles
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
