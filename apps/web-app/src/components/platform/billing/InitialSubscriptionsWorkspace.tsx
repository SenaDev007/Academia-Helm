'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Search,
  Filter,
  Plus,
  ArrowUpRight,
  CheckCircle2,
  XCircle,
  Clock,
  MoreVertical,
  FileText,
  DollarSign,
  Download,
} from 'lucide-react';

const MOCK_INITIAL_SUBS = [
  {
    id: '1',
    schoolName: 'Lycée Excellence',
    amount: 250000,
    currency: 'FCFA',
    status: 'PAID',
    issuedAt: '2025-05-10',
    paidAt: '2025-05-12',
    reference: 'PAY-882190',
  },
  {
    id: '2',
    schoolName: 'Collège Jean-Paul II',
    amount: 150000,
    currency: 'FCFA',
    status: 'PENDING',
    issuedAt: '2025-05-14',
    paidAt: null,
    reference: 'PAY-992100',
  },
  {
    id: '3',
    schoolName: 'Maternelle Les Anges',
    amount: 75000,
    currency: 'FCFA',
    status: 'PARTIAL',
    issuedAt: '2025-05-08',
    paidAt: null,
    reference: 'PAY-773322',
  },
];

export default function InitialSubscriptionsWorkspace() {
  const [searchTerm, setSearchTerm] = useState('');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Souscriptions Initiales</h1>
          <p className="text-slate-500">Frais d'activation et d'entrée des écoles</p>
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
          <button className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 rounded-xl text-sm font-semibold text-white hover:bg-indigo-700 transition-all shadow-md">
            <Plus className="w-4 h-4" />
            Créer une Souscription
          </button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-5 bg-white rounded-2xl border border-slate-100 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <span className="text-sm font-medium text-slate-500">Payées ce mois</span>
          </div>
          <div className="text-2xl font-bold text-slate-900">1.25M FCFA</div>
          <p className="text-xs text-emerald-600 font-medium mt-1">+12% vs mois dernier</p>
        </div>
        <div className="p-5 bg-white rounded-2xl border border-slate-100 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-amber-50 text-amber-600 rounded-lg">
              <Clock className="w-5 h-5" />
            </div>
            <span className="text-sm font-medium text-slate-500">En attente</span>
          </div>
          <div className="text-2xl font-bold text-slate-900">450K FCFA</div>
          <p className="text-xs text-amber-600 font-medium mt-1">5 dossiers à valider</p>
        </div>
        <div className="p-5 bg-white rounded-2xl border border-slate-100 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
              <FileText className="w-5 h-5" />
            </div>
            <span className="text-sm font-medium text-slate-500">Factures émises</span>
          </div>
          <div className="text-2xl font-bold text-slate-900">1.7M FCFA</div>
          <p className="text-xs text-blue-600 font-medium mt-1">Total période</p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">École</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Montant</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Statut</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Dates</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {MOCK_INITIAL_SUBS.map((sub) => (
                <tr key={sub.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="font-bold text-slate-900">{sub.schoolName}</div>
                    <div className="text-xs text-slate-500 font-mono">Ref: {sub.reference}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm font-bold text-slate-900">{sub.amount.toLocaleString()} {sub.currency}</div>
                    <div className="text-[10px] text-slate-400">Toutes taxes comprises</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      {sub.status === 'PAID' ? (
                        <span className="px-2.5 py-1 bg-emerald-100 text-emerald-700 rounded-full text-[10px] font-bold uppercase">Payée</span>
                      ) : sub.status === 'PARTIAL' ? (
                        <span className="px-2.5 py-1 bg-blue-100 text-blue-700 rounded-full text-[10px] font-bold uppercase">Partiel</span>
                      ) : (
                        <span className="px-2.5 py-1 bg-amber-100 text-amber-700 rounded-full text-[10px] font-bold uppercase">En attente</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-xs text-slate-600">Émise: {sub.issuedAt}</div>
                    {sub.paidAt && <div className="text-[10px] text-emerald-600 mt-0.5">Payée: {sub.paidAt}</div>}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button className="p-2 hover:bg-white rounded-lg border border-transparent hover:border-slate-200 transition-all text-slate-400 hover:text-emerald-600" title="Enregistrer paiement">
                        <DollarSign className="w-4 h-4" />
                      </button>
                      <button className="p-2 hover:bg-white rounded-lg border border-transparent hover:border-slate-200 transition-all text-slate-400 hover:text-indigo-600" title="Télécharger facture">
                        <Download className="w-4 h-4" />
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
      </div>
    </div>
  );
}
