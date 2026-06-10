'use client';

import { Brain, Zap, Target, TrendingUp, AlertCircle, ShieldAlert, PieChart, ArrowRight, Activity } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from 'recharts';

const AI_USAGE_DATA = [
  { name: 'Jan', usage: 4500 },
  { name: 'Fév', usage: 5200 },
  { name: 'Mar', usage: 6100 },
  { name: 'Avr', usage: 8900 },
  { name: 'Mai', usage: 12400 },
];

export default function PlatformOrionWorkspace() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">ORION Global Intelligence</h1>
          <p className="text-slate-500">Supervision analytique et prédictive de la plateforme</p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl font-bold text-sm">
          <Activity className="w-4 h-4" />
          Moteur Actif
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 p-8 bg-white rounded-3xl border border-slate-100 shadow-sm">
          <h3 className="font-bold text-slate-900 mb-6">Consommation IA par Tenant (Top 5)</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={[
                { name: 'Lycée Excellence', value: 850 },
                { name: 'Collège Horizon', value: 620 },
                { name: 'JP II', value: 450 },
                { name: 'Les Anges', value: 310 },
                { name: 'Primaire Nord', value: 180 },
              ]}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} />
                <Tooltip 
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {[0, 1, 2, 3, 4].map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={index === 0 ? '#4f46e5' : '#818cf8'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="p-8 bg-indigo-900 rounded-3xl shadow-xl text-white">
          <div className="flex items-center gap-2 mb-6">
            <Brain className="w-6 h-6 text-indigo-400" />
            <h3 className="font-bold">Analyse Prédictive Churn</h3>
          </div>
          <div className="space-y-6">
            <div className="p-4 bg-white/10 rounded-2xl border border-white/10">
              <div className="text-xs font-bold text-indigo-300 uppercase mb-1">Risque Critique</div>
              <div className="text-2xl font-bold">3 Écoles</div>
              <p className="text-xs text-slate-300 mt-2">Baisse d'activité de 60% sur les 30 derniers jours.</p>
            </div>
            <div className="p-4 bg-emerald-500/10 rounded-2xl border border-emerald-500/20">
              <div className="text-xs font-bold text-emerald-400 uppercase mb-1">Potentiel Expansion</div>
              <div className="text-2xl font-bold">12 Écoles</div>
              <p className="text-xs text-slate-300 mt-2">Prêtes pour un passage au plan PREMIUM.</p>
            </div>
            <button className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2">
              Lancer audit global
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="p-6 bg-white rounded-2xl border border-slate-100 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <ShieldAlert className="w-5 h-5 text-red-600" />
            <h3 className="font-bold text-slate-900">Anomalies de Facturation</h3>
          </div>
          <div className="space-y-4">
            {[
              { school: 'Lycée Excellence', type: 'Dépassement Quota Storage', impact: '+15k FCFA' },
              { school: 'Primaire Nord', type: 'Paiement Stripe Échoué', impact: 'Retard' },
            ].map((item, i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                <div>
                  <div className="text-sm font-bold text-slate-900">{item.school}</div>
                  <div className="text-xs text-slate-500">{item.type}</div>
                </div>
                <div className="text-sm font-bold text-red-600">{item.impact}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="p-6 bg-white rounded-2xl border border-slate-100 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <TrendingUp className="w-5 h-5 text-emerald-600" />
            <h3 className="font-bold text-slate-900">Adoption des Modules</h3>
          </div>
          <div className="space-y-4">
            {[
              { name: 'Finance & Economat', value: '94%' },
              { name: 'ORION Pedagogy', value: '42%' },
              { name: 'Communication WhatsApp', value: '68%' },
            ].map((item, i) => (
              <div key={i}>
                <div className="flex items-center justify-between text-xs font-bold text-slate-600 mb-1">
                  <span>{item.name}</span>
                  <span>{item.value}</span>
                </div>
                <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500" style={{ width: item.value }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
