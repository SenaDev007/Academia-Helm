'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Search,
  Filter,
  Plus,
  MoreVertical,
  ExternalLink,
  Shield,
  CreditCard,
  Building,
  CheckCircle2,
  XCircle,
  Clock,
  Download,
} from 'lucide-react';

const MOCK_TENANTS = [
  {
    id: '1',
    name: 'Lycée Excellence',
    slug: 'lycee-excellence',
    country: 'Bénin',
    city: 'Cotonou',
    plan: 'PREMIUM',
    status: 'ACTIVE',
    students: 1250,
    lastActivity: 'Il y a 5 min',
    expiration: '2025-12-31',
  },
  {
    id: '2',
    name: 'Collège Jean-Paul II',
    slug: 'jp2',
    country: 'Togo',
    city: 'Lomé',
    plan: 'STANDARD',
    status: 'ACTIVE',
    students: 850,
    lastActivity: 'Il y a 2h',
    expiration: '2025-08-15',
  },
  {
    id: '3',
    name: 'Groupe Scolaire Horizon',
    slug: 'horizon',
    country: 'Bénin',
    city: 'Porto-Novo',
    plan: 'BASIC',
    status: 'SUSPENDED',
    students: 450,
    lastActivity: 'Il y a 3 jours',
    expiration: '2024-05-01',
  },
  {
    id: '4',
    name: 'Maternelle Les Anges',
    slug: 'les-anges',
    country: 'Côte d\'Ivoire',
    city: 'Abidjan',
    plan: 'TRIAL',
    status: 'TRIAL',
    students: 120,
    lastActivity: 'Aujourd\'hui',
    expiration: '2024-06-12',
  },
];

export default function TenantsWorkspace() {
  const [searchTerm, setSearchTerm] = useState('');

  return (
    <div className="space-y-6">
      {/* Header & Search */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Écoles / Tenants</h1>
          <p className="text-slate-500">Gérer les établissements et leurs accès</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Rechercher une école..."
              className="pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all w-full md:w-64"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button className="p-2.5 bg-white border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 transition-all">
            <Filter className="w-5 h-5" />
          </button>
          <button className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 rounded-xl text-sm font-semibold text-white hover:bg-indigo-700 transition-all shadow-md">
            <Plus className="w-4 h-4" />
            Créer un Tenant
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">École</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Localisation</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Plan / Élèves</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Statut</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Expiration</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {MOCK_TENANTS.map((tenant) => (
                <tr key={tenant.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 font-bold">
                        {tenant.name.substring(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-bold text-slate-900">{tenant.name}</div>
                        <div className="text-xs text-slate-500 font-mono">{tenant.slug}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-slate-700">{tenant.country}</div>
                    <div className="text-xs text-slate-500">{tenant.city}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        tenant.plan === 'PREMIUM' ? 'bg-amber-100 text-amber-700' :
                        tenant.plan === 'STANDARD' ? 'bg-blue-100 text-blue-700' :
                        'bg-slate-100 text-slate-700'
                      }`}>
                        {tenant.plan}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500">{tenant.students} élèves</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      {tenant.status === 'ACTIVE' ? (
                        <span className="flex items-center gap-1 text-emerald-600 text-xs font-bold">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          ACTIF
                        </span>
                      ) : tenant.status === 'SUSPENDED' ? (
                        <span className="flex items-center gap-1 text-red-600 text-xs font-bold">
                          <XCircle className="w-3.5 h-3.5" />
                          SUSPENDU
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-amber-600 text-xs font-bold">
                          <Clock className="w-3.5 h-3.5" />
                          ESSAI
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">Dernière activité: {tenant.lastActivity}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-slate-700">{tenant.expiration}</div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button className="p-2 hover:bg-white rounded-lg border border-transparent hover:border-slate-200 transition-all text-slate-400 hover:text-indigo-600" title="Accéder au tenant">
                        <ExternalLink className="w-4 h-4" />
                      </button>
                      <button className="p-2 hover:bg-white rounded-lg border border-transparent hover:border-slate-200 transition-all text-slate-400 hover:text-slate-600" title="Paramètres">
                        <Shield className="w-4 h-4" />
                      </button>
                      <button className="p-2 hover:bg-white rounded-lg border border-transparent hover:border-slate-200 transition-all text-slate-400 hover:text-slate-600" title="Plus d'actions">
                        <MoreVertical className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        <div className="px-6 py-4 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between">
          <div className="text-sm text-slate-500">
            Affichage de <b>4</b> sur 124 écoles
          </div>
          <div className="flex gap-2">
            <button className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-400 cursor-not-allowed">Précédent</button>
            <button className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-all">Suivant</button>
          </div>
        </div>
      </div>

      {/* Quick Actions Footer */}
      <div className="flex items-center justify-end gap-4">
        <button className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-700 transition-all">
          <Download className="w-4 h-4" />
          Exporter la liste (CSV)
        </button>
      </div>
    </div>
  );
}
