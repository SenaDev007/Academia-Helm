import React from 'react';
import { 
  AlertTriangle, Search, Filter, Plus, 
  ShieldAlert, Clipboard, User, Heart,
  ChevronRight, Info, CheckCircle2, Download
} from 'lucide-react';

export default function CanteenDiets() {
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Risk Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <RiskCard 
          title="Allergies Critiques" 
          value="12" 
          icon={ShieldAlert} 
          color="red" 
        />
        <RiskCard 
          title="Régimes Spéciaux" 
          value="85" 
          icon={Heart} 
          color="blue" 
        />
        <RiskCard 
          title="Médicalisés (PAI)" 
          value="05" 
          icon={Clipboard} 
          color="amber" 
        />
        <RiskCard 
          title="Mises à jour (Mois)" 
          value="18" 
          icon={CheckCircle2} 
          color="green" 
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main List */}
        <div className="lg:col-span-2 bg-white rounded-3xl border border-gray-100 shadow-xl shadow-gray-200/50 overflow-hidden">
          <div className="p-8 border-b border-gray-50 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <h3 className="font-black text-navy-900 text-xl tracking-tight">Profils Alimentaires</h3>
              <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mt-1">Suivi de la sécurité alimentaire des élèves</p>
            </div>
            <div className="flex items-center space-x-2">
              <div className="relative group">
                <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-navy-600 transition-colors" />
                <input 
                  type="text" 
                  placeholder="Élève, allergie..." 
                  className="pl-11 pr-4 py-2.5 bg-gray-50/50 border border-gray-100 rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-navy-500/20 w-56 transition-all"
                />
              </div>
              <button className="p-2.5 bg-white border border-gray-100 text-gray-400 hover:text-navy-600 rounded-xl transition-all shadow-sm">
                <Filter className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="divide-y divide-gray-50">
            <DietRow 
              student="Alice N'Guessan"
              class="CM1-B"
              diet="Sans Arachide"
              severity="CRITICAL"
              forbidden="Arachides, Huile d'arachide, Beurre de cacahuète"
            />
            <DietRow 
              student="Ibrahim Traoré"
              class="6ème 2"
              diet="Végétarien"
              severity="LOW"
              forbidden="Viande, Poisson"
            />
            <DietRow 
              student="Clara Dubois"
              class="CP2"
              diet="Sans Lactose"
              severity="HIGH"
              forbidden="Lait, Fromage, Beurre"
            />
          </div>

          <div className="p-6 bg-gray-50/50 flex justify-center">
            <button className="text-xs font-black text-navy-600 uppercase tracking-widest hover:underline flex items-center space-x-2">
              <span>Voir tous les profils</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Action Sidebar */}
        <div className="space-y-6">
          <div className="bg-navy-900 rounded-3xl p-8 text-white shadow-2xl relative overflow-hidden group">
            <div className="relative z-10">
              <h4 className="text-lg font-black mb-4">Alerte Menu</h4>
              <p className="text-xs text-navy-200 leading-relaxed mb-8">
                Le menu de demain (Mafé) contient des <span className="text-amber-400 font-bold">Arachides</span>. 
                <span className="text-white font-bold block mt-2">12 élèves concernés par cette alerte.</span>
              </p>
              <button className="w-full py-4 bg-white text-navy-900 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-navy-50 transition-all shadow-xl shadow-white/10">
                Générer les Repas Spéciaux
              </button>
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-gray-100 p-8 shadow-sm">
            <h4 className="font-black text-navy-900 mb-6 flex items-center space-x-2">
              <Info className="w-5 h-5 text-blue-500" />
              <span>Consignes d'Urgence</span>
            </h4>
            <div className="space-y-4">
              <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100">
                <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-1">Protocole Allergie</p>
                <p className="text-xs text-blue-800 font-medium leading-relaxed">Toujours vérifier le double étiquetage des plats en cas d'allergie critique signalée.</p>
              </div>
              <button className="w-full py-3 border border-gray-100 rounded-2xl text-[10px] font-black text-gray-500 uppercase tracking-widest hover:bg-gray-50 transition-all">
                Télécharger le Guide QHSE
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function RiskCard({ title, value, icon: Icon, color }: any) {
  const colors: any = {
    red: 'bg-red-50 text-red-600 border-red-100',
    blue: 'bg-blue-50 text-blue-600 border-blue-100',
    amber: 'bg-amber-50 text-amber-600 border-amber-100',
    green: 'bg-emerald-50 text-emerald-600 border-emerald-100',
  };
  return (
    <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex items-center space-x-6">
      <div className={`p-4 rounded-2xl ${colors[color]}`}>
        <Icon className="w-6 h-6" />
      </div>
      <div>
        <p className="text-gray-400 text-[10px] font-black uppercase tracking-widest">{title}</p>
        <p className="text-2xl font-black text-navy-900 mt-1">{value}</p>
      </div>
    </div>
  );
}

function DietRow({ student, class: className, diet, severity, forbidden }: any) {
  const severityColors: any = {
    'CRITICAL': 'bg-red-100 text-red-600 border-red-200',
    'HIGH': 'bg-orange-100 text-orange-600 border-orange-200',
    'MEDIUM': 'bg-amber-100 text-amber-600 border-amber-200',
    'LOW': 'bg-blue-100 text-blue-600 border-blue-200',
  };

  return (
    <div className="p-8 group hover:bg-navy-50/30 transition-all duration-300">
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
        <div className="flex items-start space-x-4">
          <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center text-gray-500 font-black text-sm group-hover:bg-white transition-all shadow-sm">
            {student.split(' ').map((n: string) => n[0]).join('')}
          </div>
          <div>
            <h4 className="font-black text-navy-900 text-base">{student}</h4>
            <p className="text-[10px] font-bold text-navy-400 uppercase tracking-widest">{className}</p>
            <div className={`mt-3 px-3 py-1 rounded-full text-[10px] font-black uppercase border w-fit ${severityColors[severity]}`}>
              {diet} — {severity}
            </div>
          </div>
        </div>
        <div className="flex-1 max-w-md">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Aliments Interdits</p>
          <p className="text-xs text-gray-600 font-medium leading-relaxed italic">"{forbidden}"</p>
          <div className="mt-4 flex items-center space-x-3">
            <button className="text-[10px] font-black text-navy-600 uppercase tracking-widest hover:underline">Fiche Médicale</button>
            <span className="text-gray-200">|</span>
            <button className="text-[10px] font-black text-navy-600 uppercase tracking-widest hover:underline">Contacter Parent</button>
          </div>
        </div>
      </div>
    </div>
  );
}
