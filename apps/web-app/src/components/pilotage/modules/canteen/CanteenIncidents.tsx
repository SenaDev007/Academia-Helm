import React from 'react';
import { 
  AlertCircle, Search, Filter, Plus, 
  ShieldAlert, Activity, CheckCircle2, History,
  User, Calendar, Clock, ChevronRight,
  FileText, Camera, MoreHorizontal
} from 'lucide-react';

export default function CanteenIncidents() {
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Incident Status Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatusCard 
          title="Incidents Ouverts" 
          value="02" 
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
          title="Plaintes (Mois)" 
          value="05" 
          desc="Tendance en baisse" 
          icon={Activity} 
          color="blue" 
        />
        <StockCard 
          title="Résolus (Semaine)" 
          value="08" 
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

        <div className="divide-y divide-gray-50">
          <IncidentRow 
            type="Allergie"
            severity="CRITICAL"
            title="Suspicion d'allergie alimentaire"
            student="Marie-Laure (CM1)"
            date="14 Mai, 12:45"
            desc="Symptômes: Éruptions cutanées après le repas de midi. Parent informé."
            status="En cours"
          />
          <IncidentRow 
            type="Logistique"
            severity="MEDIUM"
            title="Retard de livraison fournisseur"
            date="15 Mai, 08:30"
            desc="Le fournisseur de légumes a livré avec 2h de retard. Menu adapté."
            status="Résolu"
          />
          <IncidentRow 
            type="Hygiène"
            severity="HIGH"
            title="Panne chambre froide n°2"
            date="13 Mai, 16:20"
            desc="Température remontée à 8°C. Transfert des denrées effectué."
            status="Résolu"
          />
        </div>
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
    'HIGH': 'bg-orange-500 text-white',
    'MEDIUM': 'bg-amber-500 text-white',
    'LOW': 'bg-blue-500 text-white',
  };

  const statusStyles: any = {
    'En cours': 'bg-amber-50 text-amber-600 border-amber-100',
    'Résolu': 'bg-emerald-50 text-emerald-600 border-emerald-100',
  };

  return (
    <div className="p-8 group hover:bg-red-50/10 transition-all duration-300">
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-8">
        <div className="flex items-start space-x-6 flex-1">
          <div className={`p-4 rounded-2xl shadow-lg shadow-gray-200/50 ${severityStyles[severity]} group-hover:scale-110 transition-transform duration-500`}>
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
            <p className="text-sm text-gray-500 leading-relaxed italic mt-4 max-w-2xl">"{desc}"</p>
          </div>
        </div>
        
        <div className="flex flex-col items-end gap-4">
          <div className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase border ${statusStyles[status]}`}>
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
