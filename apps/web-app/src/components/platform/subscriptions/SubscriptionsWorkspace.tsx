'use client';

import { useState } from 'react';
import { Package, Check, Zap, Users } from 'lucide-react';
import { usePlatformData } from '@/hooks/usePlatformData';
import { PlatformLoading, PlatformError, PlatformEmpty } from '../PlatformStates';

interface PlansData {
  plans: Array<{
    id: string;
    code: string;
    name: string;
    monthlyPrice: number;
    yearlyPrice: number;
    maxSchools: number;
    bilingualAllowed: boolean;
    activeSubscriptions: number;
  }>;
}

export default function SubscriptionsWorkspace() {
  const [activeTab, setActiveTab] = useState<'plans' | 'active'>('plans');
  const { data, loading, error, refetch } = usePlatformData<PlansData>('/plans');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Abonnements & Plans</h1>
        <p className="text-slate-500">Catalogue des plans et abonnements actifs</p>
      </div>

      <div className="flex gap-2 border-b border-slate-200">
        <button
          onClick={() => setActiveTab('plans')}
          className={`px-4 py-2 text-sm font-semibold transition-colors ${
            activeTab === 'plans' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          Catalogue des plans
        </button>
        <button
          onClick={() => setActiveTab('active')}
          className={`px-4 py-2 text-sm font-semibold transition-colors ${
            activeTab === 'active' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          Abonnements actifs
        </button>
      </div>

      {loading ? <PlatformLoading label="Chargement des plans…" /> :
       error ? <PlatformError message={error} onRetry={refetch} /> :
       !data || data.plans.length === 0 ? (
         <PlatformEmpty title="Aucun plan" description="Aucun plan d'abonnement n'a été configuré." />
       ) : activeTab === 'plans' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {data.plans.map((plan, idx) => (
            <div
              key={plan.id}
              className={`p-6 bg-white rounded-2xl border-2 shadow-sm ${
                idx === 0 ? 'border-indigo-200' : 'border-slate-200'
              }`}
            >
              <div className="flex items-center justify-between mb-4">
                <Package className="w-6 h-6 text-indigo-600" />
                {plan.bilingualAllowed && (
                  <span className="px-2 py-0.5 bg-violet-100 text-violet-700 rounded text-[9px] font-bold uppercase">Bilingue</span>
                )}
              </div>
              <h3 className="font-bold text-slate-900 text-lg mb-2">{plan.name}</h3>
              <p className="text-xs text-slate-500 font-mono mb-4">{plan.code}</p>
              <div className="mb-4">
                <div className="text-3xl font-bold text-slate-900">
                  {plan.monthlyPrice.toLocaleString('fr-FR')}
                  <span className="text-sm font-medium text-slate-500"> F CFA / mois</span>
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  ou {plan.yearlyPrice.toLocaleString('fr-FR')} F CFA / an
                </div>
              </div>
              <div className="space-y-2 text-xs text-slate-600">
                <div className="flex items-center gap-2">
                  <Check className="w-3 h-3 text-emerald-500" />
                  <span>Jusqu'à {plan.maxSchools} école(s)</span>
                </div>
                {plan.bilingualAllowed && (
                  <div className="flex items-center gap-2">
                    <Check className="w-3 h-3 text-emerald-500" />
                    <span>Mode bilingue autorisé</span>
                  </div>
                )}
              </div>
              <div className="mt-4 pt-4 border-t border-slate-100">
                <div className="text-xs text-slate-500">
                  <Users className="w-3 h-3 inline mr-1" />
                  <strong className="text-slate-900">{plan.activeSubscriptions}</strong> abonnement(s) actif(s)
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-100">
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Plan</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Code</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Prix mensuel</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Prix annuel</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Abonnements actifs</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {data.plans.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 font-bold text-slate-900">{p.name}</td>
                    <td className="px-6 py-4 text-xs font-mono text-slate-500">{p.code}</td>
                    <td className="px-6 py-4 text-sm font-bold text-slate-900">{p.monthlyPrice.toLocaleString('fr-FR')} F CFA</td>
                    <td className="px-6 py-4 text-sm text-slate-700">{p.yearlyPrice.toLocaleString('fr-FR')} F CFA</td>
                    <td className="px-6 py-4">
                      <span className="px-2.5 py-1 bg-emerald-100 text-emerald-700 rounded-full text-[10px] font-bold uppercase">
                        {p.activeSubscriptions} actif(s)
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
