'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Package,
  Check,
  Zap,
  CreditCard,
  Settings,
  Plus,
  Search,
  ChevronRight,
  ShieldCheck,
  Users,
  HardDrive,
  Target,
} from 'lucide-react';

const PLANS = [
  {
    id: 'basic',
    name: 'BASIC',
    price: '25,000',
    cycle: 'mois',
    students: 'Jusqu\'à 200',
    modules: ['Élèves', 'Scolarité', 'Communication'],
    color: 'border-slate-200',
    text: 'text-slate-600',
    bg: 'bg-white',
  },
  {
    id: 'standard',
    name: 'STANDARD',
    price: '75,000',
    cycle: 'mois',
    students: 'Jusqu\'à 1000',
    modules: ['BASIC +', 'Finance', 'Examens', 'Pédagogie'],
    color: 'border-indigo-200',
    text: 'text-indigo-600',
    bg: 'bg-indigo-50/50',
    featured: true,
  },
  {
    id: 'premium',
    name: 'PREMIUM',
    price: '150,000',
    cycle: 'mois',
    students: 'Illimité',
    modules: ['STANDARD +', 'ORION AI', 'Sara AI Assistant', 'Multi-établissement'],
    color: 'border-amber-200',
    text: 'text-amber-600',
    bg: 'bg-amber-50/50',
  },
];

export default function SubscriptionsWorkspace() {
  const [activeTab, setActiveTab] = useState<'plans' | 'active'>('plans');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Abonnements & Plans SaaS</h1>
          <p className="text-slate-500">Gérer les offres commerciales et les abonnements actifs</p>
        </div>
        <div className="flex gap-2 p-1 bg-slate-100 rounded-xl">
          <button
            onClick={() => setActiveTab('plans')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeTab === 'plans' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Plans SaaS
          </button>
          <button
            onClick={() => setActiveTab('active')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeTab === 'active' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Abonnements Actifs
          </button>
        </div>
      </div>

      {activeTab === 'plans' ? (
        <div className="space-y-8">
          {/* Plans Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {PLANS.map((plan) => (
              <div key={plan.id} className={`p-8 rounded-3xl border ${plan.color} ${plan.bg} relative overflow-hidden group hover:shadow-xl transition-all`}>
                {plan.featured && (
                  <div className="absolute top-0 right-0 px-4 py-1 bg-indigo-600 text-white text-[10px] font-bold uppercase rounded-bl-xl">
                    Populaire
                  </div>
                )}
                <div className="mb-6">
                  <h3 className={`text-lg font-bold ${plan.text} mb-2`}>{plan.name}</h3>
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-extrabold text-slate-900">{plan.price}</span>
                    <span className="text-slate-500 text-sm font-medium">FCFA / {plan.cycle}</span>
                  </div>
                </div>
                
                <div className="space-y-4 mb-8">
                  <div className="flex items-center gap-3 text-sm text-slate-600">
                    <Users className="w-4 h-4 text-slate-400" />
                    <span>{plan.students} élèves</span>
                  </div>
                  {plan.modules.map((module) => (
                    <div key={module} className="flex items-center gap-3 text-sm text-slate-700">
                      <div className={`p-0.5 rounded-full ${plan.featured ? 'bg-indigo-600' : 'bg-slate-400'} text-white`}>
                        <Check className="w-3 h-3" />
                      </div>
                      <span className="font-medium">{module}</span>
                    </div>
                  ))}
                </div>

                <button className={`w-full py-3 rounded-xl text-sm font-bold transition-all border ${
                  plan.featured 
                    ? 'bg-indigo-600 text-white border-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-100' 
                    : 'bg-white text-slate-900 border-slate-200 hover:bg-slate-50'
                }`}>
                  Modifier le plan
                </button>
              </div>
            ))}
            
            <button className="flex flex-col items-center justify-center p-8 rounded-3xl border-2 border-dashed border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/50 transition-all group">
              <div className="w-12 h-12 rounded-full bg-slate-100 group-hover:bg-indigo-100 flex items-center justify-center mb-4 transition-all">
                <Plus className="w-6 h-6 text-slate-400 group-hover:text-indigo-600" />
              </div>
              <span className="font-bold text-slate-500 group-hover:text-indigo-600">Ajouter un nouveau plan</span>
            </button>
          </div>

          {/* Features Comparison Preview */}
          <div className="p-8 bg-white rounded-3xl border border-slate-100 shadow-sm">
            <h3 className="font-bold text-slate-900 mb-6">Limites et Quotas globaux</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
              {[
                { label: 'Stockage Cloud', icon: HardDrive, value: '5 TB', total: '10 TB', color: 'bg-blue-500' },
                { label: 'Tokens ORION', icon: Target, value: '2.5M', total: '5M', color: 'bg-violet-500' },
                { label: 'Requêtes Sara AI', icon: Zap, value: '850K', total: '1M', color: 'bg-amber-500' },
                { label: 'SMS / WhatsApp', icon: CreditCard, value: '150K', total: '500K', color: 'bg-emerald-500' },
              ].map((quota) => {
                const Icon = quota.icon;
                return (
                  <div key={quota.label}>
                    <div className="flex items-center gap-2 mb-3">
                      <Icon className="w-4 h-4 text-slate-400" />
                      <span className="text-sm font-medium text-slate-600">{quota.label}</span>
                    </div>
                    <div className="flex items-end justify-between mb-2">
                      <span className="text-lg font-bold text-slate-900">{quota.value}</span>
                      <span className="text-xs text-slate-400">/ {quota.total}</span>
                    </div>
                    <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                      <div className={`h-full ${quota.color} transition-all`} style={{ width: '50%' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        <div className="p-12 text-center bg-white rounded-3xl border border-slate-100">
          <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <CreditCard className="w-8 h-8 text-slate-400" />
          </div>
          <h3 className="text-lg font-bold text-slate-900">Liste des abonnements actifs</h3>
          <p className="text-slate-500 mt-2">Ici s'affichera la liste détaillée des écoles et leurs cycles de facturation.</p>
        </div>
      )}
    </div>
  );
}
