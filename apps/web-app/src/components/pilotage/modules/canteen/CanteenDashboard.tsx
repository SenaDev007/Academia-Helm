'use client';

import React from 'react';
import { 
  Users, UtensilsCrossed, Package, CheckCircle2, 
  BarChart3, Activity, TrendingUp, TrendingDown,
  Clock, AlertTriangle, Loader2
} from 'lucide-react';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useModulesDashboard } from '@/lib/modules-complementaires/hooks';

interface CanteenStats {
  enrolledStudents?: number;
  mealsToday?: number;
  stockAlerts?: number;
  hygieneScore?: string;
  todayMenu?: Array<{ label: string; value: string; icon?: string }>;
  recentActivity?: Array<{ id?: string; student: string; time: string; status: string; color?: string }>;
  alerts?: Array<{ id?: string; type: string; title: string; desc: string; time: string }>;
}

const DEFAULT_STATS: CanteenStats = {
  enrolledStudents: 0,
  mealsToday: 0,
  stockAlerts: 0,
  hygieneScore: '—',
  todayMenu: [],
  recentActivity: [],
  alerts: [],
};

export default function CanteenDashboard() {
  const { academicYear } = useModuleContext();
  const { data, loading, error } = useModulesDashboard<CanteenStats>('canteen', academicYear?.id);

  const stats = { ...DEFAULT_STATS, ...(data ?? {}) };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        <span className="ml-2 text-gray-600">Chargement...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {error && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          ⚠ Impossible de charger les statistiques. Affichage des valeurs par défaut.
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title="Élèves Inscrits" 
          value={String(stats.enrolledStudents ?? 0)} 
          change="+12" 
          trend="up" 
          icon={Users} 
          color="blue" 
        />
        <StatCard 
          title="Repas Prévus (Midi)" 
          value={String(stats.mealsToday ?? 0)} 
          change="-5" 
          trend="down" 
          icon={UtensilsCrossed} 
          color="green" 
        />
        <StatCard 
          title="Alertes Stock" 
          value={String(stats.stockAlerts ?? 0).padStart(2, '0')} 
          change="Critical" 
          trend="neutral" 
          icon={Package} 
          color="amber" 
        />
        <StatCard 
          title="Score Hygiène" 
          value={stats.hygieneScore ?? '—'} 
          change="Excellent" 
          trend="up" 
          icon={CheckCircle2} 
          color="blue" 
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Today's Menu Card */}
        <div className="lg:col-span-2 bg-white rounded-3xl border border-gray-100 shadow-xl shadow-gray-200/50 overflow-hidden group">
          <div className="p-8 border-b border-gray-50 bg-gradient-to-r from-gray-50 to-white flex items-center justify-between">
            <div>
              <h3 className="font-black text-navy-900 text-xl tracking-tight">Menu du Jour</h3>
              <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mt-1">Vendredi 15 Mai 2026</p>
            </div>
            <div className="bg-navy-900 text-white px-4 py-2 rounded-2xl text-xs font-bold shadow-lg shadow-navy-900/20">
              Matin & Midi
            </div>
          </div>
          <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
            {(stats.todayMenu?.length ? stats.todayMenu : []).map((item, i) => (
              <MenuSection 
                key={i}
                label={item.label} 
                value={item.value} 
                icon={item.icon ?? '🍽️'}
              />
            ))}
            {(!stats.todayMenu || stats.todayMenu.length === 0) && (
              <div className="md:col-span-2 text-center py-8 text-sm text-slate-400">
                Aucun menu disponible pour aujourd'hui.
              </div>
            )}
          </div>
          <div className="px-8 py-4 bg-navy-50/50 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <span className="text-[10px] font-bold text-gray-500 uppercase">Allergènes : Arachides, Lactose</span>
            </div>
            <button className="text-navy-600 text-xs font-black uppercase hover:underline">Modifier le menu</button>
          </div>
        </div>

        {/* ORION Insights */}
        <div className="bg-navy-900 rounded-3xl p-8 text-white shadow-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 -mt-8 -mr-8 w-32 h-32 bg-white/5 rounded-full blur-3xl group-hover:bg-white/10 transition-all duration-700"></div>
          <div className="relative z-10">
            <div className="flex items-center space-x-3 mb-8">
              <div className="p-2 bg-white/10 rounded-xl backdrop-blur-md">
                <BarChart3 className="w-5 h-5 text-navy-200" />
              </div>
              <h3 className="font-black text-lg tracking-tight">Pilotage ORION</h3>
            </div>
            
            <div className="space-y-6">
              <InsightItem 
                title="Prévision Demain"
                value="425 repas"
                desc="Hausse de 3% prévue vs moyenne"
              />
              <InsightItem 
                title="Gaspillage"
                value="-12.4%"
                desc="Optimisation des stocks réussie"
                isPositive={true}
              />
              <InsightItem 
                title="Coût Moyen / Repas"
                value="850 F"
                desc="Stabilité des prix fournisseurs"
              />
            </div>

            <button className="w-full mt-10 py-4 bg-white text-navy-900 rounded-2xl text-sm font-black uppercase tracking-widest hover:bg-navy-50 transition-all shadow-xl shadow-white/10 active:scale-[0.98]">
              Rapport Stratégique
            </button>
          </div>
        </div>
      </div>

      {/* Recent Activity & Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-3xl border border-gray-100 p-8 shadow-sm">
          <h3 className="font-black text-navy-900 mb-6 flex items-center space-x-2">
            <Activity className="w-5 h-5 text-navy-400" />
            <span>Service en Temps Réel</span>
          </h3>
          <div className="space-y-4">
            {(stats.recentActivity?.length ? stats.recentActivity : []).map((row, i) => (
              <LiveRow 
                key={row.id ?? i}
                student={row.student}
                time={row.time}
                status={row.status}
                color={row.color ?? 'green'}
              />
            ))}
            {(!stats.recentActivity || stats.recentActivity.length === 0) && (
              <div className="text-center py-8 text-sm text-slate-400">
                Aucune activité récente.
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-3xl border border-gray-100 p-8 shadow-sm">
          <h3 className="font-black text-navy-900 mb-6 flex items-center space-x-2">
            <Clock className="w-5 h-5 text-navy-400" />
            <span>Alertes & Rappels</span>
          </h3>
          <div className="space-y-4">
            {(stats.alerts?.length ? stats.alerts : []).map((alert, i) => (
              <AlertItem 
                key={alert.id ?? i}
                type={alert.type} 
                title={alert.title} 
                desc={alert.desc} 
                time={alert.time}
              />
            ))}
            {(!stats.alerts || stats.alerts.length === 0) && (
              <div className="text-center py-8 text-sm text-slate-400">
                Aucune alerte.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Helpers ---

function StatCard({ title, value, change, trend, icon: Icon, color }: any) {
  const colors: any = {
    blue: 'from-blue-500 to-blue-600 shadow-blue-500/20',
    green: 'from-emerald-500 to-emerald-600 shadow-emerald-500/20',
    amber: 'from-amber-500 to-amber-600 shadow-amber-500/20',
    indigo: 'from-blue-500 to-blue-600 shadow-blue-500/20',
  };

  const bgColors: any = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-emerald-50 text-emerald-600',
    amber: 'bg-amber-50 text-amber-600',
    indigo: 'bg-blue-50 text-blue-600',
  };

  return (
    <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm hover:shadow-xl transition-all duration-500 group relative overflow-hidden">
      <div className="flex justify-between items-start mb-4 relative z-10">
        <div className={`p-4 rounded-2xl ${bgColors[color]} group-hover:scale-110 transition-transform duration-500`}>
          <Icon className="w-6 h-6" />
        </div>
        <div className={`flex items-center space-x-1 text-[10px] font-black uppercase px-2 py-1 rounded-lg ${
          trend === 'up' ? 'text-emerald-600 bg-emerald-50' : 
          trend === 'down' ? 'text-red-600 bg-red-50' : 
          'text-amber-600 bg-amber-50'
        }`}>
          {trend === 'up' && <TrendingUp className="w-3 h-3" />}
          {trend === 'down' && <TrendingDown className="w-3 h-3" />}
          <span>{change}</span>
        </div>
      </div>
      <p className="text-gray-400 text-xs font-bold uppercase tracking-widest relative z-10">{title}</p>
      <p className="text-3xl font-black text-navy-900 mt-1 relative z-10">{value}</p>
      
      <div className={`absolute bottom-0 left-0 h-1 w-0 bg-gradient-to-r ${colors[color]} group-hover:w-full transition-all duration-700`}></div>
    </div>
  );
}

function MenuSection({ label, value, icon }: any) {
  return (
    <div className="flex items-start space-x-4 group/item">
      <div className="text-2xl">{icon}</div>
      <div>
        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 group-hover/item:text-navy-500 transition-colors">{label}</p>
        <p className="text-sm font-bold text-navy-900 leading-tight">{value}</p>
      </div>
    </div>
  );
}

function InsightItem({ title, value, desc, isPositive }: any) {
  return (
    <div className="p-4 bg-white/5 rounded-2xl border border-white/5 hover:bg-white/10 transition-all">
      <div className="flex justify-between items-center mb-1">
        <p className="text-navy-300 text-[10px] font-bold uppercase tracking-widest">{title}</p>
        {isPositive && <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]"></div>}
      </div>
      <p className="text-lg font-black text-white">{value}</p>
      <p className="text-[10px] text-navy-400 font-medium">{desc}</p>
    </div>
  );
}

function LiveRow({ student, time, status, color = 'green' }: any) {
  const colors: any = {
    green: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    amber: 'bg-amber-50 text-amber-600 border-amber-100',
  };
  return (
    <div className="flex items-center justify-between p-4 rounded-2xl hover:bg-gray-50 transition-all border border-transparent hover:border-gray-100">
      <div className="flex items-center space-x-4">
        <div className="w-10 h-10 rounded-xl bg-navy-50 flex items-center justify-center text-navy-600 font-black text-xs shadow-sm">
          {student.split(' ').map((n: string) => n[0]).join('')}
        </div>
        <div>
          <p className="text-sm font-bold text-navy-900">{student}</p>
          <p className="text-[10px] text-gray-400 font-bold">{time}</p>
        </div>
      </div>
      <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase border ${colors[color]}`}>
        {status}
      </span>
    </div>
  );
}

function AlertItem({ type, title, desc, time }: any) {
  return (
    <div className="flex items-start space-x-4 p-4 rounded-2xl bg-gray-50/50 hover:bg-gray-50 transition-all">
      <div className={`p-3 rounded-xl ${type === 'stock' ? 'bg-amber-100 text-amber-600' : 'bg-red-100 text-red-600'}`}>
        {type === 'stock' ? <Package className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
      </div>
      <div className="flex-1">
        <div className="flex justify-between items-start">
          <p className="text-sm font-black text-navy-900">{title}</p>
          <span className="text-[9px] font-bold text-gray-400 uppercase">{time}</span>
        </div>
        <p className="text-xs text-gray-500 mt-1">{desc}</p>
      </div>
    </div>
  );
}
