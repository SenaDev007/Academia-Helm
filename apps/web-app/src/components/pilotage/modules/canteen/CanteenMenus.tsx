import React, { useState } from 'react';
import { 
  Plus, Calendar, Search, Filter, Download, 
  ChevronLeft, ChevronRight, MoreHorizontal,
  Clock, ChefHat, Eye, Edit, Trash2, Printer,
  Share2, Sparkles, CheckCircle2
} from 'lucide-react';

export default function CanteenMenus() {
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('list');

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-2 bg-gray-100 p-1 rounded-2xl w-fit">
          <button 
            onClick={() => setViewMode('list')}
            className={`px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${viewMode === 'list' ? 'bg-white text-navy-900 shadow-sm' : 'text-gray-400 hover:text-navy-600'}`}
          >
            Vue Liste
          </button>
          <button 
            onClick={() => setViewMode('calendar')}
            className={`px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${viewMode === 'calendar' ? 'bg-white text-navy-900 shadow-sm' : 'text-gray-400 hover:text-navy-600'}`}
          >
            Calendrier
          </button>
        </div>

        <div className="flex items-center space-x-3">
          <button className="flex items-center space-x-2 px-4 py-2.5 bg-indigo-50 text-indigo-600 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-indigo-100 transition-all border border-indigo-100">
            <Sparkles className="w-4 h-4" />
            <span>Générer via Sara AI</span>
          </button>
          <button className="flex items-center space-x-2 px-6 py-2.5 bg-navy-900 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-navy-800 transition-all shadow-xl shadow-navy-900/20">
            <Plus className="w-4 h-4" />
            <span>Planifier</span>
          </button>
        </div>
      </div>

      {viewMode === 'list' ? (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-xl shadow-gray-200/50 overflow-hidden">
          <div className="p-8 border-b border-gray-50 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="relative group flex-1 max-w-md">
              <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-navy-600 transition-colors" />
              <input 
                type="text" 
                placeholder="Rechercher un plat, une date..." 
                className="w-full pl-11 pr-4 py-3 bg-gray-50/50 border border-gray-100 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-navy-500/20 focus:border-navy-500/50 transition-all"
              />
            </div>
            <div className="flex items-center space-x-2">
              <button className="p-3 text-gray-400 hover:text-navy-600 hover:bg-gray-50 rounded-xl transition-all border border-transparent hover:border-gray-100">
                <Filter className="w-4 h-4" />
              </button>
              <button className="p-3 text-gray-400 hover:text-navy-600 hover:bg-gray-50 rounded-xl transition-all border border-transparent hover:border-gray-100">
                <Download className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-50/50">
                  <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Date & Période</th>
                  <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Menu Principal</th>
                  <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Niveau Scolaire</th>
                  <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Coût Est.</th>
                  <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Statut</th>
                  <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                <MenuRow 
                  date="Lundi 11 Mai" 
                  period="Déjeuner" 
                  main="Poulet Yassa & Riz Blanc" 
                  level="Tous les niveaux" 
                  cost="450 000 F" 
                  status="Publié"
                />
                <MenuRow 
                  date="Mardi 12 Mai" 
                  period="Déjeuner" 
                  main="Sauce Graine & Foutou" 
                  level="Primaire & Collège" 
                  cost="380 000 F" 
                  status="Publié"
                />
                <MenuRow 
                  date="Mercredi 13 Mai" 
                  period="Petit-Déj" 
                  main="Bouillie de mil & Beignets" 
                  level="Maternelle" 
                  cost="120 000 F" 
                  status="Brouillon"
                />
                <MenuRow 
                  date="Jeudi 14 Mai" 
                  period="Déjeuner" 
                  main="Poisson Braisé & Alloco" 
                  level="Secondaire" 
                  cost="520 000 F" 
                  status="Publié"
                />
              </tbody>
            </table>
          </div>

          <div className="p-8 border-t border-gray-50 flex items-center justify-between">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Affichage de 4 sur 25 menus</p>
            <div className="flex items-center space-x-2">
              <button className="p-2 border border-gray-100 rounded-xl hover:bg-gray-50 transition-all">
                <ChevronLeft className="w-4 h-4 text-gray-400" />
              </button>
              <button className="px-4 py-2 border border-navy-500 bg-navy-50 text-navy-600 rounded-xl text-xs font-black shadow-sm shadow-navy-500/10">1</button>
              <button className="px-4 py-2 border border-gray-100 rounded-xl text-xs font-black text-gray-400 hover:bg-gray-50">2</button>
              <button className="p-2 border border-gray-100 rounded-xl hover:bg-gray-50 transition-all">
                <ChevronRight className="w-4 h-4 text-gray-400" />
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-xl shadow-gray-200/50 p-8 flex flex-col items-center justify-center min-h-[400px] text-center">
          <div className="p-6 bg-navy-50 rounded-full mb-6">
            <Calendar className="w-12 h-12 text-navy-600" />
          </div>
          <h3 className="text-2xl font-black text-navy-900 mb-2 tracking-tight">Vue Calendrier Interactive</h3>
          <p className="text-gray-400 max-w-sm text-sm font-medium leading-relaxed">Organisez visuellement vos menus par semaine ou par mois avec la fluidité Academia Helm.</p>
          <button className="mt-8 px-8 py-3 bg-navy-900 text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl shadow-navy-900/20">Activer la vue</button>
        </div>
      )}
    </div>
  );
}

function MenuRow({ date, period, main, level, cost, status }: any) {
  const statusColors: any = {
    'Publié': 'bg-emerald-50 text-emerald-600 border-emerald-100',
    'Brouillon': 'bg-gray-50 text-gray-500 border-gray-100',
    'Modifié': 'bg-amber-50 text-amber-600 border-amber-100',
  };

  return (
    <tr className="group hover:bg-navy-50/30 transition-all duration-300">
      <td className="px-8 py-6">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-navy-50 rounded-xl group-hover:bg-white transition-colors">
            <Calendar className="w-4 h-4 text-navy-600" />
          </div>
          <div>
            <p className="text-sm font-black text-navy-900 tracking-tight">{date}</p>
            <div className="flex items-center space-x-1 mt-0.5">
              <Clock className="w-3 h-3 text-gray-400" />
              <p className="text-[10px] font-bold text-gray-400 uppercase">{period}</p>
            </div>
          </div>
        </div>
      </td>
      <td className="px-8 py-6">
        <div className="flex items-center space-x-2">
          <ChefHat className="w-4 h-4 text-navy-300" />
          <p className="text-sm font-bold text-navy-800">{main}</p>
        </div>
      </td>
      <td className="px-8 py-6">
        <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest bg-gray-100 px-2.5 py-1 rounded-lg w-fit">{level}</p>
      </td>
      <td className="px-8 py-6 text-center">
        <p className="text-sm font-black text-navy-900">{cost}</p>
      </td>
      <td className="px-8 py-6">
        <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase border w-fit flex items-center space-x-1.5 ${statusColors[status]}`}>
          {status === 'Publié' && <CheckCircle2 className="w-3 h-3" />}
          <span>{status}</span>
        </div>
      </td>
      <td className="px-8 py-6 text-right">
        <div className="flex items-center justify-end space-x-1">
          <button className="p-2 text-gray-400 hover:text-navy-600 hover:bg-white rounded-lg transition-all"><Eye className="w-4 h-4" /></button>
          <button className="p-2 text-gray-400 hover:text-blue-600 hover:bg-white rounded-lg transition-all"><Edit className="w-4 h-4" /></button>
          <button className="p-2 text-gray-400 hover:text-red-600 hover:bg-white rounded-lg transition-all"><Trash2 className="w-4 h-4" /></button>
        </div>
      </td>
    </tr>
  );
}
