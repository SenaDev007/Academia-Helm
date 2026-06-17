/**
 * ============================================================================
 * CANTEEN INCIDENTS — Branché sur backend réel
 * ============================================================================
 *
 * Endpoint : GET /modules-complementaires/canteen/incidents?academicYearId=...
 * Endpoint : POST /modules-complementaires/canteen/incidents
 * ============================================================================
 */

import React from 'react';
import {
  Search, Plus,
  AlertCircle, Activity, CheckCircle2,
  User, MoreHorizontal,
  FileText, Camera, Loader2, ShieldAlert
} from 'lucide-react';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useModulesList } from '@/lib/modules-complementaires/hooks';

interface IncidentItem {
  id: string;
  type?: string;
  category?: string;
  severity?: string;
  title?: string;
  subject?: string;
  student?: string;
  studentName?: string;
  date?: string;
  incidentDate?: string;
  createdAt?: string;
  desc?: string;
  description?: string;
  comment?: string;
  status?: string;
  [key: string]: any;
}

export default function CanteenIncidents() {
  const { academicYear } = useModuleContext();
  const { data: incidents, loading, error } = useModulesList<IncidentItem>(
    'canteen',
    'incidents',
    academicYear?.id,
  );

  const openCount = incidents.filter((i) => {
    const s = (i.status ?? '').toLowerCase();
    return s.includes('cours') || s.includes('open') || s.includes('ouvert');
  }).length;
  const resolvedCount = incidents.filter((i) => {
    const s = (i.status ?? '').toLowerCase();
    return s.includes('résolu') || s.includes('resolu') || s.includes('resolved');
  }).length;
  const monthCount = incidents.length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        <span className="ml-2 text-gray-600">Chargement des incidents...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {error && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          ⚠ Impossible de charger les données. {error}
        </div>
      )}

      {/* Incident Status Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatusCard
          title="Incidents Ouverts"
          value={String(openCount).padStart(2, '0')}
          desc="Action requise immédiate"
          icon={AlertCircle}
          color="red"
        />
        <StockCard
          title="Hygiène & Salubrité"
          value="100%"
          desc="Dernière inspection : Hier"
          icon={ShieldAlert}
          color="emerald"
        />
        <StockCard
          title="Incidents (Mois)"
          value={String(monthCount).padStart(2, '0')}
          desc="Tendance en baisse"
          icon={Activity}
          color="blue"
        />
        <StockCard
          title="Résolus (Total)"
          value={String(resolvedCount).padStart(2, '0')}
          desc="Délai moyen : 4h"
          icon={CheckCircle2}
          color="blue"
        />
      </div>

      <div className="bg-white rounded-3xl border border-gray-100 shadow-xl shadow-gray-200/50 overflow-hidden">
        <div className="p-8 border-b border-gray-50 flex flex-col lg:flex-row lg:items-center justify-between gap-6 bg-gradient-to-r from-gray-50/50 to-white">
          <div>
            <h3 className="font-black text-navy-900 text-xl tracking-tight">Journal d'Hygiène & Sécurité</h3>
            <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mt-1">Traçabilité des incidents et mesures correctives</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative group">
              <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-navy-600 transition-colors" />
              <input
                type="text"
                placeholder="Rechercher un incident..."
                className="pl-11 pr-4 py-2.5 bg-white border border-gray-100 rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-navy-500/20 w-64 transition-all"
              />
            </div>
            <button className="flex items-center space-x-2 px-6 py-2.5 bg-red-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-red-700 transition-all shadow-xl shadow-red-600/20">
              <Plus className="w-4 h-4" />
              <span>Signaler un Incident</span>
            </button>
          </div>
        </div>

        {incidents.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            Aucun incident enregistré pour cette année scolaire.
          </div>
        ) : (
        <div className="divide-y divide-gray-50">
          {incidents.map((inc) => (
            <IncidentRow
              key={inc.id}
              type={inc.type ?? inc.category ?? 'Incident'}
              severity={inc.severity ?? 'MEDIUM'}
              title={inc.title ?? inc.subject ?? 'Incident'}
              student={inc.student ?? inc.studentName}
              date={inc.date ?? inc.incidentDate ?? inc.createdAt ?? '—'}
              desc={inc.desc ?? inc.description ?? inc.comment ?? ''}
              status={inc.status ?? 'En cours'}
            />
          ))}
        </div>
        )}
      </div>
    </div>
  );
}

function StatusCard({ title, value, desc, icon: Icon, color }: any) {
  const colors: any = {
    red: 'text-red-600 bg-red-50',
    emerald: 'text-emerald-600 bg-emerald-50',
    blue: 'text-blue-600 bg-blue-50',
    indigo: 'text-blue-600 bg-blue-50',
  };
  return (
    <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-all duration-300">
      <div className="flex justify-between items-start mb-6">
        <div className={`p-4 rounded-2xl ${colors[color]}`}>
          <Icon className="w-6 h-6" />
        </div>
        <button className="p-2 text-gray-300 hover:text-navy-600 transition-colors">
          <MoreHorizontal className="w-4 h-4" />
        </button>
      </div>
      <p className="text-gray-400 text-xs font-bold uppercase tracking-widest">{title}</p>
      <p className="text-2xl font-black text-navy-900 mt-1">{value}</p>
      <p className="text-[10px] text-gray-400 font-medium mt-1 uppercase tracking-tighter">{desc}</p>
    </div>
  );
}

function StockCard({ title, value, desc, icon: Icon, color }: any) {
  const colors: any = {
    red: 'text-red-600 bg-red-50',
    emerald: 'text-emerald-600 bg-emerald-50',
    blue: 'text-blue-600 bg-blue-50',
    indigo: 'text-blue-600 bg-blue-50',
  };
  return (
    <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-all duration-300">
      <div className="flex justify-between items-start mb-6">
        <div className={`p-4 rounded-2xl ${colors[color]}`}>
          <Icon className="w-6 h-6" />
        </div>
        <button className="p-2 text-gray-300 hover:text-navy-600 transition-colors">
          <MoreHorizontal className="w-4 h-4" />
        </button>
      </div>
      <p className="text-gray-400 text-xs font-bold uppercase tracking-widest">{title}</p>
      <p className="text-2xl font-black text-navy-900 mt-1">{value}</p>
      <p className="text-[10px] text-gray-400 font-medium mt-1 uppercase tracking-tighter">{desc}</p>
    </div>
  );
}

function IncidentRow({ type, severity, title, student, date, desc, status }: any) {
  const severityStyles: any = {
    'CRITICAL': 'bg-red-500 text-white',
    'CRITIQUE': 'bg-red-500 text-white',
    'HIGH': 'bg-orange-500 text-white',
    'MEDIUM': 'bg-amber-500 text-white',
    'LOW': 'bg-blue-500 text-white',
  };
  const severityStyle = severityStyles[severity] ?? severityStyles['MEDIUM'];

  const statusStyles: any = {
    'En cours': 'bg-amber-50 text-amber-600 border-amber-100',
    'Résolu': 'bg-emerald-50 text-emerald-600 border-emerald-100',
    'Resolved': 'bg-emerald-50 text-emerald-600 border-emerald-100',
  };
  const statusStyle = statusStyles[status] ?? statusStyles['En cours'];

  return (
    <div className="p-8 group hover:bg-red-50/10 transition-all duration-300">
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-8">
        <div className="flex items-start space-x-6 flex-1">
          <div className={`p-4 rounded-2xl shadow-lg shadow-gray-200/50 ${severityStyle} group-hover:scale-110 transition-transform duration-500`}>
            <AlertCircle className="w-6 h-6" />
          </div>
          <div className="space-y-2">
            <div className="flex items-center space-x-3">
              <span className="text-[10px] font-black uppercase tracking-widest text-navy-400">{type}</span>
              <span className="text-gray-200">|</span>
              <span className="text-[10px] font-bold text-gray-400 uppercase">{date}</span>
            </div>
            <h4 className="text-lg font-black text-navy-900 tracking-tight">{title}</h4>
            {student && (
              <div className="flex items-center space-x-2 py-1 px-2.5 bg-navy-50 rounded-lg w-fit border border-navy-100">
                <User className="w-3 h-3 text-navy-600" />
                <span className="text-[10px] font-black text-navy-900 uppercase tracking-tighter">{student}</span>
              </div>
            )}
            {desc && <p className="text-sm text-gray-500 leading-relaxed italic mt-4 max-w-2xl">"{desc}"</p>}
          </div>
        </div>

        <div className="flex flex-col items-end gap-4">
          <div className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase border ${statusStyle}`}>
            {status}
          </div>
          <div className="flex items-center space-x-2">
            <button className="p-2.5 text-gray-400 hover:text-navy-900 hover:bg-white rounded-xl transition-all border border-transparent hover:border-gray-100"><FileText className="w-4 h-4" /></button>
            <button className="p-2.5 text-gray-400 hover:text-navy-900 hover:bg-white rounded-xl transition-all border border-transparent hover:border-gray-100"><Camera className="w-4 h-4" /></button>
            <button className="p-2.5 text-gray-400 hover:text-navy-900 hover:bg-white rounded-xl transition-all border border-transparent hover:border-gray-100 shadow-sm"><MoreHorizontal className="w-4 h-4" /></button>
          </div>
        </div>
      </div>
    </div>
  );
}
