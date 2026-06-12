'use client';

import { motion } from 'framer-motion';
import {
  Building,
  Users,
  GraduationCap,
  TrendingUp,
  CreditCard,
  AlertCircle,
  Activity,
  ShieldAlert,
  ArrowRight,
  Plus,
  Zap,
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from 'recharts';

const MOCK_STATS = [
  { label: 'Écoles inscrites', value: '124', icon: Building, color: 'text-blue-600', bg: 'bg-blue-50' },
  { label: 'Écoles actives', value: '112', icon: Activity, color: 'text-emerald-600', bg: 'bg-emerald-50' },
  { label: 'Total Élèves', value: '45,200', icon: GraduationCap, color: 'text-violet-600', bg: 'bg-violet-50' },
  { label: 'Utilisateurs total', value: '8,450', icon: Users, color: 'text-amber-600', bg: 'bg-amber-50' },
  { label: 'MRR (Revenus Mensuels)', value: '12,5M F CFA', icon: TrendingUp, color: 'text-indigo-600', bg: 'bg-indigo-50' },
  { label: 'Incidents Critiques', value: '2', icon: ShieldAlert, color: 'text-red-600', bg: 'bg-red-50' },
];

const REVENUE_DATA = [
  { name: 'Jan', revenue: 8.5 },
  { name: 'Fév', revenue: 9.2 },
  { name: 'Mar', revenue: 10.1 },
  { name: 'Avr', revenue: 11.5 },
  { name: 'Mai', revenue: 12.5 },
];

const TENANTS_DATA = [
  { name: 'Jan', schools: 80 },
  { name: 'Fév', schools: 92 },
  { name: 'Mar', schools: 105 },
  { name: 'Avr', schools: 115 },
  { name: 'Mai', schools: 124 },
];

export default function PlatformDashboard() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Tableau de Bord Global</h1>
          <p className="text-slate-500">Supervision centrale d'Academia Helm</p>
        </div>
        <div className="flex gap-3">
          <button className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 transition-all shadow-sm">
            <Plus className="w-4 h-4" />
            Nouvelle École
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-indigo-600 rounded-xl text-sm font-semibold text-white hover:bg-indigo-700 transition-all shadow-md shadow-indigo-200">
            <Zap className="w-4 h-4" />
            Actions Rapides
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {MOCK_STATS.map((stat, i) => {
          const Icon = stat.icon;
          return (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="p-5 bg-white rounded-2xl border border-slate-100 shadow-sm"
            >
              <div className={`w-10 h-10 ${stat.bg} ${stat.color} rounded-xl flex items-center justify-center mb-4`}>
                <Icon className="w-5 h-5" />
              </div>
              <p className="text-sm font-medium text-slate-500">{stat.label}</p>
              <h3 className="text-xl font-bold text-slate-900 mt-1">{stat.value}</h3>
            </motion.div>
          );
        })}
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="p-6 bg-white rounded-2xl border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-slate-900">Évolution du Chiffre d'Affaires (Millions F CFA)</h3>
            <select className="text-sm bg-slate-50 border-none rounded-lg focus:ring-2 focus:ring-indigo-500/20 px-3 py-1.5 font-medium text-slate-600">
              <option>6 derniers mois</option>
              <option>Cette année</option>
            </select>
          </div>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={REVENUE_DATA}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Area type="monotone" dataKey="revenue" stroke="#4f46e5" strokeWidth={3} fillOpacity={1} fill="url(#colorRevenue)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="p-6 bg-white rounded-2xl border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-slate-900">Croissance du Parc Écoles</h3>
            <select className="text-sm bg-slate-50 border-none rounded-lg focus:ring-2 focus:ring-indigo-500/20 px-3 py-1.5 font-medium text-slate-600">
              <option>6 derniers mois</option>
              <option>Cette année</option>
            </select>
          </div>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={TENANTS_DATA}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Line type="monotone" dataKey="schools" stroke="#10b981" strokeWidth={3} dot={{ fill: '#10b981', r: 4 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Alerts & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 p-6 bg-white rounded-2xl border border-slate-100 shadow-sm">
          <h3 className="font-bold text-slate-900 mb-6">Point de Vigilance ORION</h3>
          <div className="space-y-4">
            {[
              { title: 'Abonnements proches expiration', text: '12 écoles arrivent à échéance dans moins de 7 jours.', level: 'ATTENTION' },
              { title: 'Incident Critique détecté', text: 'Problème de synchronisation sur le tenant "Lycée Excellence".', level: 'CRITIQUE' },
              { title: 'Paiement en attente', text: '5 souscriptions initiales attendent une validation manuelle.', level: 'INFO' },
            ].map((alert, i) => (
              <div key={i} className={`p-4 rounded-xl border flex items-start gap-4 ${
                alert.level === 'CRITIQUE' ? 'bg-red-50 border-red-100' :
                alert.level === 'ATTENTION' ? 'bg-amber-50 border-amber-100' :
                'bg-blue-50 border-blue-100'
              }`}>
                <div className={`p-2 rounded-lg ${
                  alert.level === 'CRITIQUE' ? 'bg-red-100 text-red-600' :
                  alert.level === 'ATTENTION' ? 'bg-amber-100 text-amber-600' :
                  'bg-blue-100 text-blue-600'
                }`}>
                  <AlertCircle className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-slate-900">{alert.title}</h4>
                    <span className="text-[10px] font-bold uppercase tracking-wider opacity-60">{alert.level}</span>
                  </div>
                  <p className="text-sm text-slate-600 mt-1">{alert.text}</p>
                </div>
                <button className="p-2 hover:bg-white/50 rounded-lg transition-colors">
                  <ArrowRight className="w-4 h-4 text-slate-400" />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="p-6 bg-slate-900 rounded-2xl shadow-xl text-white">
          <div className="flex items-center gap-2 mb-6 text-indigo-400">
            <Zap className="w-5 h-5" />
            <h3 className="font-bold">Sara AI Platform Assistant</h3>
          </div>
          <p className="text-sm text-slate-300 leading-relaxed">
            "Bonjour. J'ai analysé les tendances de ce mois. Le taux de churn est en baisse de 2%. Cependant, la consommation API sur la zone Ouest a augmenté de 40%."
          </p>
          <div className="mt-8 space-y-3">
            <button className="w-full p-3 bg-white/10 hover:bg-white/20 rounded-xl text-sm font-medium transition-all text-left flex items-center justify-between group">
              Générer rapport mensuel
              <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-all" />
            </button>
            <button className="w-full p-3 bg-white/10 hover:bg-white/20 rounded-xl text-sm font-medium transition-all text-left flex items-center justify-between group">
              Analyser pics consommation
              <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-all" />
            </button>
          </div>
          <div className="mt-8 p-4 bg-indigo-600/20 border border-indigo-500/30 rounded-xl">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-indigo-300 uppercase">Santé Plateforme</span>
              <span className="text-xs font-bold text-emerald-400">99.9% UP</span>
            </div>
            <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden">
              <div className="bg-emerald-400 h-full w-[99.9%]" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
