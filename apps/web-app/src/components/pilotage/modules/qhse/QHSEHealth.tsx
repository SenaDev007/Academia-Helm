/**
 * ============================================================================
 * QHSE SANTE & INFIRMERIE
 * ============================================================================
 */

'use client';

import { motion } from 'framer-motion';
import { Stethoscope, User, Calendar, Activity, Thermometer, Pill, AlertCircle, Plus, Search, Filter, Phone, Loader2 } from 'lucide-react';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useModulesList } from '@/lib/modules-complementaires/hooks';

interface HealthVisitItem {
  id: string;
  patient?: string;
  patientName?: string;
  reason?: string;
  motif?: string;
  time?: string;
  timeOfVisit?: string;
  status?: string;
  emergency?: boolean;
  isEmergency?: boolean;
}

export default function QHSEHealth() {
  const { academicYear } = useModuleContext();
  const { data: visits, loading, error } = useModulesList<HealthVisitItem>('qhse', 'health', academicYear?.id);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        <span className="ml-2 text-slate-600">Chargement des passages infirmerie...</span>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {error && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          ⚠ Impossible de charger les données. {error}
        </div>
      )}

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          { label: 'Passages Jour', value: String(visits.length), icon: Calendar, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Urgences', value: String(visits.filter((v) => v.emergency || v.isEmergency).length).padStart(2, '0'), icon: AlertCircle, color: 'text-rose-600', bg: 'bg-rose-50' },
          { label: 'Repos actuel', value: String(visits.filter((v) => v.status === 'REPOS').length).padStart(2, '0'), icon: Pill, color: 'text-amber-600', bg: 'bg-amber-50' },
          { label: 'Stabilité Sanitaire', value: 'ALERTE', icon: Activity, color: 'text-emerald-600', bg: 'bg-emerald-50' },
        ].map((stat, i) => (
          <div key={i} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
            <div className={`p-3 rounded-2xl ${stat.bg} ${stat.color}`}>
              <stat.icon className="w-6 h-6" />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{stat.label}</p>
              <p className="text-xl font-black text-slate-900 tracking-tighter">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Recent Visits */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter flex items-center">
              <Stethoscope className="w-6 h-6 mr-3 text-emerald-600" /> Passages Récents
            </h3>
            <button className="px-6 py-2 bg-emerald-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-600/10">
              Nouveau Passage
            </button>
          </div>
          {visits.length === 0 ? (
            <div className="text-center py-16 text-slate-500 bg-white rounded-[2.5rem] border border-slate-100">
              Aucun passage infirmerie enregistré pour cette année scolaire.
            </div>
          ) : (
            <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
              <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest font-mono">
                    <th className="px-8 py-5">Patient</th>
                    <th className="px-8 py-5">Motif / Symptômes</th>
                    <th className="px-8 py-5">Heure</th>
                    <th className="px-8 py-5 text-right">Statut</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {visits.map((visit) => {
                    const patient = visit.patient || visit.patientName || 'Patient';
                    const reason = visit.reason || visit.motif || '—';
                    const time = visit.time || visit.timeOfVisit || '—';
                    const status = visit.status || '—';
                    const emergency = visit.emergency || visit.isEmergency;
                    return (
                      <tr key={visit.id} className="hover:bg-slate-50/50 transition-colors group cursor-pointer">
                        <td className="px-8 py-5">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 font-black text-xs">
                              {patient[0]}
                            </div>
                            <div>
                              <p className="font-black text-slate-900 leading-tight">{patient}</p>
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{visit.id}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-8 py-5">
                          <div className="flex items-center gap-2">
                            {emergency && <AlertCircle className="w-4 h-4 text-rose-600 animate-pulse" />}
                            <p className="text-xs font-bold text-slate-600">{reason}</p>
                          </div>
                        </td>
                        <td className="px-8 py-5 text-xs font-black text-slate-900 uppercase">{time}</td>
                        <td className="px-8 py-5 text-right">
                          <span className={`px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest ${
                            status === 'ÉVACUÉ' || status === 'EVACUE' ? 'bg-rose-50 text-rose-600' : 
                            status === 'REPOS' ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'
                          }`}>
                            {status.replace(/_/g, ' ')}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              </div>
            </div>
          )}
        </div>

        {/* Medical Stock Alert */}
        <div className="space-y-6">
          <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter">Vigilance Pharmacie</h3>
          <div className="bg-white rounded-[2.5rem] border border-slate-100 p-8 space-y-6 shadow-sm">
            {/* TODO: endpoint dédié au stock pharmacie non disponible, données locales */}
            {[
              { item: 'Paracétamol (Boîtes)', stock: 5, min: 10, status: 'CRITIQUE' },
              { item: 'Compresses Stériles', stock: 12, min: 20, status: 'FAIBLE' },
              { item: 'Solution Hydro-alcoolique', stock: 45, min: 20, status: 'OK' },
            ].map((stock, i) => (
              <div key={i} className="space-y-2">
                <div className="flex justify-between items-center">
                  <p className="text-xs font-black text-slate-900 uppercase tracking-tight">{stock.item}</p>
                  <span className={`text-[8px] font-black uppercase tracking-widest ${
                    stock.status === 'CRITIQUE' ? 'text-rose-600' : stock.status === 'FAIBLE' ? 'text-amber-600' : 'text-emerald-600'
                  }`}>
                    {stock.status}
                  </span>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${
                    stock.status === 'CRITIQUE' ? 'bg-rose-600' : stock.status === 'FAIBLE' ? 'bg-amber-600' : 'bg-emerald-600'
                  }`} style={{ width: `${(stock.stock / stock.min) * 100}%` }} />
                </div>
              </div>
            ))}
            <button className="w-full py-4 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-xl shadow-navy-900/10">
              Passer une Commande
            </button>
          </div>

          <div className="bg-rose-50 border border-rose-100 rounded-3xl p-6 flex items-start gap-4">
            <Phone className="w-5 h-5 text-rose-600 shrink-0 mt-1" />
            <div>
              <p className="text-sm font-black text-rose-900 uppercase tracking-tight">Numéros d'Urgence</p>
              <p className="text-xs text-rose-800/70 font-medium leading-relaxed">Samu: 15 • Pompiers: 18 • Médecin Référent: +225 07...</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
