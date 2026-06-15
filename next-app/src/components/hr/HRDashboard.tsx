/**
 * HRDashboard Component
 * Vue d'ensemble du capital humain — design harmonisé avec le pattern pédagogie.
 */

'use client';

import {
  Users,
  Clock,
  TrendingUp,
  Calendar,
  UserPlus,
  AlertCircle,
  ArrowRight,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import Link from 'next/link';

const PRIMARY = '#1A2BA6';

const STATS = [
  { label: 'Nouveaux ce mois', value: '12', icon: UserPlus,     colorStyle: { color: PRIMARY },         bgClass: 'bg-blue-50' },
  { label: 'Taux de Rétention', value: '98.5%', icon: TrendingUp, colorStyle: { color: '#10b981' },    bgClass: 'bg-emerald-50' },
  { label: 'Absences (Moy.)',   value: '2.4j',  icon: Clock,      colorStyle: { color: '#f59e0b' },    bgClass: 'bg-amber-50' },
  { label: 'Alerte Contrats',  value: '5',     icon: AlertCircle, colorStyle: { color: '#f43f5e' },   bgClass: 'bg-rose-50' },
];

const ACTIVITY = [
  { name: 'Dr. Kouadio Koffi',   type: 'Signature Contrat',    date: "Aujourd'hui 09:45", dot: 'bg-emerald-500' },
  { name: 'Mme. Traoré Alima',  type: 'Demande de Congé',      date: 'Hier 16:30',         dot: 'bg-amber-500' },
  { name: 'M. Sylla Moussa',    type: 'Nouvelle Affectation',  date: 'Hier 11:15',         dot: 'bg-[#1A2BA6]' },
];

const DEPARTMENTS = [
  { label: 'Enseignement',  value: 65 },
  { label: 'Administration', value: 20 },
  { label: 'Logistique',    value: 15 },
];

const BAR_COLORS = [PRIMARY, '#10b981', '#f59e0b'];

export default function HRDashboard() {
  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {STATS.map((stat, i) => {
          const Icon = stat.icon;
          return (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.07 }}
              className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all flex items-center justify-between group"
            >
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{stat.label}</p>
                <p className="text-2xl font-black text-slate-900 mt-1">{stat.value}</p>
              </div>
              <div className={cn('rounded-xl p-3 transition-transform group-hover:scale-105', stat.bgClass)}>
                <Icon className="w-5 h-5" style={stat.colorStyle} />
              </div>
            </motion.div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Activity */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="lg:col-span-2 rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden"
        >
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-bold text-slate-900 flex items-center gap-2 text-sm">
              <Calendar className="w-4 h-4" style={{ color: PRIMARY }} />
              Activité Récente RH
            </h3>
            <Link
              href="/app/hr/staff"
              className="text-xs font-bold hover:underline"
              style={{ color: PRIMARY }}
            >
              Voir tout
            </Link>
          </div>
          <div className="divide-y divide-slate-100">
            {ACTIVITY.map((act, i) => (
              <div
                key={i}
                className="px-5 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm"
                    style={{ backgroundColor: PRIMARY + '15', color: PRIMARY }}
                  >
                    {act.name.charAt(0)}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900">{act.name}</p>
                    <p className="text-xs text-slate-400">{act.type}</p>
                  </div>
                </div>
                <div className="text-right flex flex-col items-end gap-1">
                  <p className="text-[10px] text-slate-400 font-medium">{act.date}</p>
                  <div className={cn('w-2 h-2 rounded-full', act.dot)} />
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Department Distribution */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.4 }}
          className="rounded-xl bg-slate-900 p-6 shadow-sm text-white flex flex-col justify-between"
        >
          <div>
            <h3 className="font-bold flex items-center gap-2 mb-6 text-sm">
              <Users className="w-4 h-4 text-blue-400" />
              Effectif par Département
            </h3>
            <div className="space-y-5">
              {DEPARTMENTS.map((dept, i) => (
                <div key={dept.label} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400 font-semibold uppercase tracking-wider">{dept.label}</span>
                    <span className="font-black text-white">{dept.value}%</span>
                  </div>
                  <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${dept.value}%` }}
                      transition={{ duration: 1, delay: 0.5 + i * 0.1, ease: 'easeOut' }}
                      className="h-full rounded-full"
                      style={{ backgroundColor: BAR_COLORS[i] }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-white/10">
            <p className="text-xs text-slate-400 leading-relaxed italic">
              "La force d'une institution réside dans l'excellence de son capital humain."
            </p>
            <Link
              href="/app/hr/staff"
              className="mt-4 flex items-center gap-2 text-xs font-bold text-blue-400 hover:text-blue-300 transition-colors"
            >
              Gérer le personnel <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
