import React from 'react';
import { 
  Users, Search, Filter, Download, 
  ChevronLeft, ChevronRight, MoreHorizontal,
  Mail, Phone, MessageSquare, AlertTriangle,
  History, Eye, Edit
} from 'lucide-react';

export default function CanteenStudents() {
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="bg-white rounded-3xl border border-gray-100 shadow-xl shadow-gray-200/50 overflow-hidden">
        <div className="p-8 border-b border-gray-50 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <h3 className="font-black text-navy-900 text-xl tracking-tight">Effectif Cantine</h3>
            <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mt-1">450 élèves bénéficiaires du service</p>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative group">
              <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-navy-600 transition-colors" />
              <input 
                type="text" 
                placeholder="Rechercher un élève..." 
                className="pl-11 pr-4 py-2.5 bg-gray-50/50 border border-gray-100 rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-navy-500/20 w-64 transition-all"
              />
            </div>
            <button className="p-2.5 bg-white border border-gray-100 text-gray-500 rounded-2xl hover:border-navy-200 hover:text-navy-600 transition-all shadow-sm">
              <Filter className="w-4 h-4" />
            </button>
            <button className="flex items-center space-x-2 px-6 py-2.5 bg-navy-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-navy-800 transition-all shadow-xl shadow-navy-900/20">
              <Download className="w-4 h-4" />
              <span>Exporter</span>
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50/50">
                <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Élève</th>
                <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Classe & Niveau</th>
                <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Abonnement Actif</th>
                <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Régime & Santé</th>
                <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Présence (Mois)</th>
                <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Contact</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              <StudentRow 
                name="Félix Kouadio"
                id="AC-2026-001"
                class="CM1-A"
                level="Primaire"
                plan="Mensuel"
                diet="Standard"
                attendance="95%"
              />
              <StudentRow 
                name="Fatouma Bamba"
                id="AC-2026-042"
                class="6ème 1"
                level="Collège"
                plan="Trimestriel"
                diet="Sans Arachide"
                health="Allergie Sévère"
                attendance="88%"
              />
              <StudentRow 
                name="Lucas Martin"
                id="AC-2026-115"
                class="Moyenne Section"
                level="Maternelle"
                plan="Annuel"
                diet="Sans Lactose"
                attendance="100%"
              />
              <StudentRow 
                name="Grace Amon"
                id="AC-2026-089"
                class="Terminale D"
                level="Lycée"
                plan="Mensuel"
                diet="Végétarien"
                attendance="92%"
              />
            </tbody>
          </table>
        </div>

        <div className="p-8 border-t border-gray-50 flex items-center justify-between">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Page 1 sur 12</p>
          <div className="flex items-center space-x-2">
            <button className="p-2 border border-gray-100 rounded-xl hover:bg-gray-50 transition-all"><ChevronLeft className="w-4 h-4 text-gray-400" /></button>
            <button className="p-2 border border-gray-100 rounded-xl hover:bg-gray-50 transition-all"><ChevronRight className="w-4 h-4 text-gray-400" /></button>
          </div>
        </div>
      </div>
    </div>
  );
}

function StudentRow({ name, id, class: className, level, plan, diet, health, attendance }: any) {
  return (
    <tr className="group hover:bg-navy-50/30 transition-all duration-300">
      <td className="px-8 py-6">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-gray-100 to-gray-50 border border-gray-100 flex items-center justify-center text-navy-600 font-black text-xs shadow-sm group-hover:bg-white transition-all">
            {name.split(' ').map((n: string) => n[0]).join('')}
          </div>
          <div>
            <p className="text-sm font-black text-navy-900">{name}</p>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">{id}</p>
          </div>
        </div>
      </td>
      <td className="px-8 py-6">
        <p className="text-sm font-bold text-navy-800">{className}</p>
        <p className="text-[10px] font-bold text-navy-400 uppercase tracking-widest">{level}</p>
      </td>
      <td className="px-8 py-6">
        <span className="text-xs font-black text-navy-900 bg-navy-50 px-3 py-1.5 rounded-xl border border-navy-100 uppercase tracking-wider">{plan}</span>
      </td>
      <td className="px-8 py-6">
        <div className="space-y-1">
          <p className="text-xs font-bold text-gray-600">{diet}</p>
          {health && (
            <div className="flex items-center space-x-1 text-[9px] font-black text-red-500 uppercase bg-red-50 px-2 py-0.5 rounded border border-red-100 w-fit">
              <AlertTriangle className="w-2.5 h-2.5" />
              <span>{health}</span>
            </div>
          )}
        </div>
      </td>
      <td className="px-8 py-6 text-center">
        <div className="inline-flex flex-col items-center">
          <p className="text-sm font-black text-navy-900">{attendance}</p>
          <div className="w-12 bg-gray-100 h-1 rounded-full mt-1 overflow-hidden">
            <div className="bg-emerald-500 h-full" style={{ width: attendance }}></div>
          </div>
        </div>
      </td>
      <td className="px-8 py-6 text-right">
        <div className="flex items-center justify-end space-x-2">
          <button className="p-2 text-gray-400 hover:text-navy-600 hover:bg-white rounded-xl transition-all border border-transparent hover:border-gray-100"><Mail className="w-4 h-4" /></button>
          <button className="p-2 text-gray-400 hover:text-navy-600 hover:bg-white rounded-xl transition-all border border-transparent hover:border-gray-100"><Phone className="w-4 h-4" /></button>
          <button className="p-2 text-gray-400 hover:text-navy-900 hover:bg-white rounded-xl transition-all border border-transparent hover:border-gray-100"><MoreHorizontal className="w-4 h-4" /></button>
        </div>
      </td>
    </tr>
  );
}
