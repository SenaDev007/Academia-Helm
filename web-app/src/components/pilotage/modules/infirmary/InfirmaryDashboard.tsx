/**
 * ============================================================================
 * INFIRMARY DASHBOARD TAB
 * ============================================================================
 */

'use client';

import { motion } from 'framer-motion';
import { 
  HeartPulse, 
  AlertCircle, 
  FileText, 
  Pill, 
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  Activity,
  TrendingUp,
  Clock
} from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  trend?: string;
  trendType?: 'up' | 'down' | 'neutral';
  icon: any;
  iconColor: string;
  delay?: number;
}

function StatCard({ title, value, trend, trendType, icon: Icon, iconColor, delay = 0 }: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition-shadow"
    >
      <div className="flex justify-between items-start mb-4">
        <div className={`p-3 rounded-xl ${iconColor} bg-opacity-10`}>
          <Icon className={`w-6 h-6 ${iconColor.replace('bg-', 'text-')}`} />
        </div>
        {trend && (
          <div className={`flex items-center text-xs font-medium ${
            trendType === 'up' ? 'text-emerald-600' : trendType === 'down' ? 'text-rose-600' : 'text-slate-500'
          }`}>
            {trendType === 'up' ? <ArrowUpRight className="w-3 h-3 mr-1" /> : <ArrowDownRight className="w-3 h-3 mr-1" />}
            {trend}
          </div>
        )}
      </div>
      <h3 className="text-slate-500 text-sm font-medium">{title}</h3>
      <p className="text-2xl font-bold text-slate-900 mt-1">{value}</p>
    </motion.div>
  );
}

export default function InfirmaryDashboard() {
  return (
    <div className="space-y-8">
      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title="Visites ce mois" 
          value="42" 
          trend="+12%" 
          trendType="up"
          icon={Activity} 
          iconColor="bg-blue-600"
          delay={0.1}
        />
        <StatCard 
          title="Urgences actives" 
          value="2" 
          trend="-50%" 
          trendType="down"
          icon={AlertCircle} 
          iconColor="bg-rose-600"
          delay={0.2}
        />
        <StatCard 
          title="Stock faible" 
          value="5" 
          trend="8 articles" 
          trendType="neutral"
          icon={Pill} 
          iconColor="bg-amber-600"
          delay={0.3}
        />
        <StatCard 
          title="Visites prévues" 
          value="15" 
          trend="Semaine" 
          trendType="up"
          icon={Calendar} 
          iconColor="bg-emerald-600"
          delay={0.4}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Recent Visits */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <h3 className="font-bold text-slate-900 flex items-center">
                <Clock className="w-5 h-5 mr-2 text-blue-600" />
                Passages récents
              </h3>
              <button className="text-blue-600 text-sm font-semibold hover:underline">Voir tout</button>
            </div>
            <div className="divide-y divide-slate-100">
              {[
                { name: 'Jean Dupont', class: '6ème A', reason: 'Maux de tête', time: 'Il y a 10 min', status: 'En cours', color: 'text-amber-600 bg-amber-50' },
                { name: 'Marie Kassa', class: 'CM2 B', reason: 'Chute cour de récré', time: 'Il y a 45 min', status: 'Terminé', color: 'text-emerald-600 bg-emerald-50' },
                { name: 'Koffi Mensah', class: 'Terminal D', reason: 'Fièvre légère', time: 'Il y a 2h', status: 'Terminé', color: 'text-emerald-600 bg-emerald-50' },
                { name: 'Sarah Lawson', class: '3ème B', reason: 'Douleur abdominale', time: 'Ce matin', status: 'Transféré', color: 'text-rose-600 bg-rose-50' },
              ].map((visit, i) => (
                <div key={i} className="p-4 hover:bg-slate-50 transition-colors flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-bold">
                      {visit.name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-bold text-slate-900">{visit.name}</p>
                      <p className="text-xs text-slate-500">{visit.class} • {visit.reason}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-4">
                    <span className="text-xs text-slate-400">{visit.time}</span>
                    <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-1 rounded-full ${visit.color}`}>
                      {visit.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Health Alerts */}
          <div className="bg-rose-50 rounded-2xl border border-rose-100 p-6">
            <h3 className="font-bold text-rose-900 flex items-center mb-4">
              <AlertCircle className="w-5 h-5 mr-2" />
              Alertes de Vigilance
            </h3>
            <div className="space-y-3">
              <div className="bg-white border border-rose-200 rounded-xl p-4 flex items-start space-x-3">
                <div className="mt-1 w-2 h-2 rounded-full bg-rose-600 animate-pulse" />
                <div>
                  <p className="text-sm font-bold text-slate-900 underline">ALERTE ALLERGIE : Marc Yao (CE1)</p>
                  <p className="text-xs text-slate-600 mt-1">Allergie sévère à l'arachide. Épi-pen disponible en pharmacie (Casier A2).</p>
                </div>
              </div>
              <div className="bg-white border border-rose-200 rounded-xl p-4 flex items-start space-x-3">
                <div className="mt-1 w-2 h-2 rounded-full bg-rose-600 animate-pulse" />
                <div>
                  <p className="text-sm font-bold text-slate-900 underline">CONTRE-INDICATION SPORT : Sophie Boli (3ème)</p>
                  <p className="text-xs text-slate-600 mt-1">Dispense médicale jusqu'au 15 Juin. Problème cardiaque mineur.</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Inventory & Reports summary */}
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <h3 className="font-bold text-slate-900 flex items-center mb-6">
              <TrendingUp className="w-5 h-5 mr-2 text-emerald-600" />
              État des Stocks
            </h3>
            <div className="space-y-4">
              {[
                { label: 'Paracétamol 500mg', level: 15, total: 100, color: 'bg-emerald-500' },
                { label: 'Pansements stériles', level: 85, total: 100, color: 'bg-emerald-500' },
                { label: 'Alcool chirurgical', level: 8, total: 100, color: 'bg-amber-500' },
                { label: 'Masques FFP2', level: 2, total: 100, color: 'bg-rose-500' },
              ].map((item, i) => (
                <div key={i} className="space-y-1.5">
                  <div className="flex justify-between text-xs font-medium">
                    <span className="text-slate-700">{item.label}</span>
                    <span className="text-slate-500">{item.level}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className={`h-full ${item.color}`} style={{ width: `${item.level}%` }} />
                  </div>
                </div>
              ))}
            </div>
            <button className="w-full mt-6 py-2 rounded-xl bg-slate-50 text-slate-600 text-sm font-bold hover:bg-slate-100 transition-colors">
              Gérer la pharmacie
            </button>
          </div>

          <div className="bg-navy-900 rounded-2xl p-6 text-white shadow-lg">
            <h3 className="font-bold flex items-center mb-4">
              <FileText className="w-5 h-5 mr-2 text-gold-500" />
              Rapport Mensuel
            </h3>
            <p className="text-navy-200 text-sm mb-6">Le rapport sanitaire de Mai est prêt pour validation directionnelle.</p>
            <div className="flex space-x-2">
              <button className="flex-1 py-2 bg-white/10 hover:bg-white/20 rounded-xl text-xs font-bold transition-colors">Visualiser</button>
              <button className="flex-1 py-2 bg-[#C9A84C] hover:bg-[#B8973B] rounded-xl text-xs font-bold transition-colors">Valider</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
