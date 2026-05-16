import React from 'react';
import { 
  BarChart3, PieChart, TrendingUp, Download, 
  Calendar, Filter, FileText, Share2,
  CheckCircle2, Users, UtensilsCrossed, Package,
  ArrowRight, Search
} from 'lucide-react';

export default function CanteenReports() {
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Report Types Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <ReportTemplateCard 
          title="Rapport de Fréquentation" 
          desc="Analyse quotidienne et hebdomadaire des repas servis." 
          icon={Users} 
          color="blue" 
        />
        <ReportTemplateCard 
          title="Bilan Financier Cantine" 
          desc="Recettes, impayés et rentabilité du module." 
          icon={TrendingUp} 
          color="emerald" 
        />
        <ReportTemplateCard 
          title="État des Stocks & Achats" 
          desc="Consommation réelle vs achats fournisseurs." 
          icon={Package} 
          color="amber" 
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Analytics Area */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-3xl border border-gray-100 shadow-xl shadow-gray-200/50 p-8">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="font-black text-navy-900 text-xl tracking-tight">Analyse de Performance</h3>
                <p className="text-gray-400 text-[10px] font-black uppercase tracking-widest mt-1">Évolution des repas servis ce mois-ci</p>
              </div>
              <div className="flex items-center space-x-2">
                <button className="px-4 py-2 border border-gray-100 rounded-xl text-[10px] font-black text-gray-500 uppercase tracking-widest hover:bg-gray-50 transition-all">Mai 2026</button>
                <button className="p-2 border border-gray-100 rounded-xl text-gray-400 hover:text-navy-900 transition-all"><Download className="w-4 h-4" /></button>
              </div>
            </div>
            
            {/* Chart Placeholder */}
            <div className="h-64 bg-gradient-to-b from-gray-50/50 to-white rounded-2xl border border-dashed border-gray-200 flex items-center justify-center relative overflow-hidden group">
              <div className="absolute inset-0 flex items-end justify-between px-12 pb-8">
                {[40, 70, 45, 90, 65, 80, 55].map((h, i) => (
                  <div key={i} className="w-8 bg-navy-100 rounded-t-lg group-hover:bg-navy-500 transition-all duration-700" style={{ height: `${h}%` }}></div>
                ))}
              </div>
              <div className="relative z-10 flex flex-col items-center">
                <BarChart3 className="w-8 h-8 text-navy-300 mb-2 animate-pulse" />
                <p className="text-[10px] font-black text-navy-400 uppercase tracking-widest">Visualisation Interactive</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-8 mt-8 pt-8 border-t border-gray-50">
              <div className="text-center">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Total Repas</p>
                <p className="text-xl font-black text-navy-900">12,450</p>
              </div>
              <div className="text-center border-x border-gray-50">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Satisfaction</p>
                <p className="text-xl font-black text-emerald-600">4.8/5</p>
              </div>
              <div className="text-center">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Gaspillage</p>
                <p className="text-xl font-black text-red-500">2.1%</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-8">
            <h3 className="font-black text-navy-900 mb-6 flex items-center space-x-2">
              <FileText className="w-5 h-5 text-navy-400" />
              <span>Rapports Générés Récemment</span>
            </h3>
            <div className="space-y-4">
              <RecentReportRow title="Bilan Hebdomadaire S19" date="14 Mai, 18:00" type="PDF" size="1.2 MB" />
              <RecentReportRow title="Inventaire Stock Fin Avril" date="01 Mai, 09:30" type="XLS" size="450 KB" />
              <RecentReportRow title="Rapport Incidents QHSE Q1" date="15 Avr, 14:15" type="PDF" size="2.8 MB" />
            </div>
          </div>
        </div>

        {/* Custom Report Builder Sidebar */}
        <div className="bg-navy-900 rounded-3xl p-8 text-white shadow-2xl h-fit relative overflow-hidden group">
          <div className="absolute top-0 right-0 -mt-12 -mr-12 w-48 h-48 bg-white/5 rounded-full blur-3xl group-hover:bg-white/10 transition-all duration-700"></div>
          <div className="relative z-10">
            <h4 className="text-xl font-black mb-2 tracking-tight">Sara AI Report Builder</h4>
            <p className="text-xs text-navy-200 leading-relaxed mb-8">Générez des rapports personnalisés en demandant simplement à l'IA.</p>
            
            <div className="space-y-4 mb-8">
              <div className="p-4 bg-white/5 rounded-2xl border border-white/10 hover:bg-white/10 cursor-pointer transition-all">
                <p className="text-xs font-bold text-white/90">"Analyse du coût des repas par niveau scolaire sur les 3 derniers mois"</p>
              </div>
              <div className="p-4 bg-white/5 rounded-2xl border border-white/10 hover:bg-white/10 cursor-pointer transition-all">
                <p className="text-xs font-bold text-white/90">"Comparaison de la consommation de viande vs poisson"</p>
              </div>
            </div>

            <div className="relative group/input">
              <input 
                type="text" 
                placeholder="Décrivez votre besoin..." 
                className="w-full bg-white/10 border border-white/10 rounded-2xl py-4 pl-4 pr-12 text-sm text-white placeholder-white/30 outline-none focus:ring-2 focus:ring-white/20 transition-all"
              />
              <button className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-white text-navy-900 rounded-xl hover:scale-105 transition-all shadow-lg">
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ReportTemplateCard({ title, desc, icon: Icon, color }: any) {
  const colors: any = {
    blue: 'bg-blue-50 text-blue-600 border-blue-100',
    emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    amber: 'bg-amber-50 text-amber-600 border-amber-100',
  };
  return (
    <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm hover:shadow-xl hover:border-navy-100 transition-all duration-500 group">
      <div className={`p-4 rounded-2xl w-fit mb-6 ${colors[color]} group-hover:scale-110 transition-transform duration-500`}>
        <Icon className="w-6 h-6" />
      </div>
      <h4 className="font-black text-navy-900 text-lg mb-2 tracking-tight">{title}</h4>
      <p className="text-xs text-gray-400 leading-relaxed font-medium mb-6">{desc}</p>
      <button className="flex items-center space-x-2 text-[10px] font-black text-navy-600 uppercase tracking-widest hover:underline group/btn">
        <span>Générer</span>
        <ArrowRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
      </button>
    </div>
  );
}

function RecentReportRow({ title, date, type, size }: any) {
  return (
    <div className="flex items-center justify-between p-4 rounded-2xl bg-gray-50/50 hover:bg-gray-50 transition-all border border-transparent hover:border-gray-100 group">
      <div className="flex items-center space-x-4">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white font-black text-[10px] ${type === 'PDF' ? 'bg-red-500 shadow-red-500/20' : 'bg-emerald-500 shadow-emerald-500/20'} shadow-lg`}>
          {type}
        </div>
        <div>
          <p className="text-sm font-black text-navy-900">{title}</p>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">{date}</p>
        </div>
      </div>
      <div className="flex items-center space-x-4">
        <p className="text-[10px] font-black text-gray-400 uppercase">{size}</p>
        <button className="p-2 text-gray-400 hover:text-navy-900 hover:bg-white rounded-xl transition-all border border-transparent hover:border-gray-100 shadow-sm"><Download className="w-4 h-4" /></button>
        <button className="p-2 text-gray-400 hover:text-navy-900 hover:bg-white rounded-xl transition-all border border-transparent hover:border-gray-100 shadow-sm"><Share2 className="w-4 h-4" /></button>
      </div>
    </div>
  );
}
