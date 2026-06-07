'use client';

import { motion } from 'framer-motion';
import {
  Activity,
  ShieldAlert,
  Server,
  Database,
  Cpu,
  HardDrive,
  Clock,
  CheckCircle2,
  AlertCircle,
  XCircle,
  RefreshCw,
  Search,
  Filter,
  BarChart3,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

const SYSTEM_HEALTH = [
  { id: 'api', name: 'API Server', status: 'HEALTHY', uptime: '99.98%', latency: '45ms', icon: Server, color: 'text-emerald-600', bg: 'bg-emerald-50' },
  { id: 'db', name: 'Database (Neon)', status: 'HEALTHY', uptime: '99.99%', latency: '12ms', icon: Database, color: 'text-blue-600', bg: 'bg-blue-50' },
  { id: 'sync', name: 'Sync Service', status: 'DEGRADED', uptime: '98.5%', latency: '240ms', icon: RefreshCw, color: 'text-amber-600', bg: 'bg-amber-50' },
  { id: 'storage', name: 'Cloud Storage', status: 'HEALTHY', uptime: '100%', latency: '-', icon: HardDrive, color: 'text-indigo-600', bg: 'bg-indigo-50' },
];

const PERFORMANCE_DATA = [
  { time: '10:00', api: 45, db: 12 },
  { time: '11:00', api: 52, db: 15 },
  { time: '12:00', api: 48, db: 14 },
  { time: '13:00', api: 85, db: 22 }, // Spike
  { time: '14:00', api: 65, db: 18 },
  { time: '15:00', api: 50, db: 14 },
];

export default function MonitoringWorkspace() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Incidents & Monitoring</h1>
          <p className="text-slate-500">Santé technique et supervision des services</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 rounded-xl text-sm font-semibold text-white hover:bg-indigo-700 transition-all shadow-md">
          <RefreshCw className="w-4 h-4" />
          Actualiser les métriques
        </button>
      </div>

      {/* Services Health */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {SYSTEM_HEALTH.map((service) => {
          const Icon = service.icon;
          return (
            <div key={service.id} className="p-5 bg-white rounded-2xl border border-slate-100 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className={`p-2 rounded-lg ${service.bg} ${service.color}`}>
                  <Icon className="w-5 h-5" />
                </div>
                {service.status === 'HEALTHY' ? (
                  <span className="flex items-center gap-1 text-emerald-600 text-[10px] font-bold">
                    <CheckCircle2 className="w-3 h-3" /> OPERATIONAL
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-amber-600 text-[10px] font-bold animate-pulse">
                    <AlertCircle className="w-3 h-3" /> DEGRADED
                  </span>
                )}
              </div>
              <h3 className="font-bold text-slate-900">{service.name}</h3>
              <div className="mt-4 flex items-center justify-between text-xs text-slate-500 font-medium">
                <span>Uptime: {service.uptime}</span>
                <span>{service.latency}</span>
              </div>
              <div className="w-full bg-slate-100 h-1 rounded-full mt-3 overflow-hidden">
                <div className={`h-full ${service.status === 'HEALTHY' ? 'bg-emerald-500' : 'bg-amber-500'}`} style={{ width: service.uptime }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Real-time Latency Chart */}
      <div className="p-6 bg-white rounded-2xl border border-slate-100 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-bold text-slate-900">Temps de réponse (Latency ms)</h3>
          <div className="flex gap-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-indigo-500 rounded-full" />
              <span className="text-xs font-medium text-slate-600">API Gateway</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-blue-500 rounded-full" />
              <span className="text-xs font-medium text-slate-600">PostgreSQL</span>
            </div>
          </div>
        </div>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={PERFORMANCE_DATA}>
              <defs>
                <linearGradient id="colorApi" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.1}/>
                  <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorDb" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
              <Tooltip 
                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
              />
              <Area type="monotone" dataKey="api" stroke="#4f46e5" strokeWidth={2} fillOpacity={1} fill="url(#colorApi)" />
              <Area type="monotone" dataKey="db" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorDb)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recent Incidents Table */}
      <div className="p-6 bg-white rounded-2xl border border-slate-100 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-bold text-slate-900">Journal des Incidents Récents</h3>
          <button className="text-xs font-bold text-indigo-600 hover:underline">Voir tout l'historique</button>
        </div>
        <div className="space-y-3">
          {[
            { id: 'INC-452', title: 'Timeout API Gateway', level: 'MAJOR', status: 'INVESTIGATING', time: 'Il y a 12 min', tenant: 'GLOBAL' },
            { id: 'INC-451', title: 'Échec synchronisation SQLite', level: 'MINOR', status: 'RESOLVED', time: 'Il y a 2h', tenant: 'Collège Horizon' },
            { id: 'INC-450', title: 'Lenteur Database Neon', level: 'MAJOR', status: 'RESOLVED', time: 'Aujourd\'hui 08:45', tenant: 'GLOBAL' },
          ].map((incident) => (
            <div key={incident.id} className="p-4 rounded-xl border border-slate-100 bg-slate-50/30 flex items-center justify-between group hover:border-slate-200 transition-all">
              <div className="flex items-center gap-4">
                <div className={`p-2 rounded-lg ${
                  incident.level === 'CRITICAL' ? 'bg-red-100 text-red-600' :
                  incident.level === 'MAJOR' ? 'bg-amber-100 text-amber-600' :
                  'bg-blue-100 text-blue-600'
                }`}>
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-slate-400">{incident.id}</span>
                    <h4 className="font-bold text-slate-900">{incident.title}</h4>
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">
                    Tenant: <span className="font-semibold">{incident.tenant}</span> • {incident.time}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${
                  incident.status === 'RESOLVED' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700 animate-pulse'
                }`}>
                  {incident.status}
                </span>
                <button className="p-2 opacity-0 group-hover:opacity-100 transition-all">
                  <BarChart3 className="w-4 h-4 text-slate-400" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
