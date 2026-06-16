'use client';

import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Search,
  Plus,
  ArrowUpRight,
  CheckCircle2,
  XCircle,
  Clock,
  MoreVertical,
  FileText,
  DollarSign,
  Download,
  Filter,
  ShieldAlert,
  History,
  Users,
  HelpCircle,
  CreditCard,
  PieChart,
  Building,
  LayoutDashboard,
  Briefcase,
  Zap,
  BarChart3,
  Lock,
  Settings,
  Loader2,
  AlertCircle,
  RefreshCw,
  Inbox,
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { usePlatformData } from '@/hooks/usePlatformData';
import { PlatformLoading, PlatformError, PlatformEmpty } from './PlatformStates';

interface InitialSubData {
  summary: { paidThisMonth: number; pending: number; invoicedTotal: number; currency: string };
  items: Array<{
    id: string; schoolName: string; amount: number; currency: string;
    status: 'PAID' | 'PENDING' | 'PARTIAL' | 'FAILED';
    issuedAt: string; paidAt: string | null; reference: string;
  }>;
}

export default function InitialSubscriptionsWorkspace() {
  const [searchTerm, setSearchTerm] = useState('');
  const { data, loading, error, refetch } = usePlatformData<InitialSubData>('/initial-subscriptions');

  const items = useMemo(() => {
    if (!data?.items) return [];
    if (!searchTerm.trim()) return data.items;
    const q = searchTerm.toLowerCase();
    return data.items.filter((i) => i.schoolName.toLowerCase().includes(q) || i.reference.toLowerCase().includes(q));
  }, [data, searchTerm]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Souscriptions Initiales</h1>
          <p className="text-slate-500">Frais d'activation et d'entrée des écoles</p>
        </div>
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
      </div>

      {loading ? <PlatformLoading label="Chargement des souscriptions…" /> :
       error ? <PlatformError message={error} onRetry={refetch} /> :
       !data ? <PlatformEmpty /> : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-5 bg-white rounded-2xl border border-slate-100 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg"><CheckCircle2 className="w-5 h-5" /></div>
                <span className="text-sm font-medium text-slate-500">Payées ce mois</span>
              </div>
              <div className="text-2xl font-bold text-slate-900">{formatCurrency(data.summary.paidThisMonth)}</div>
              <p className="text-xs text-emerald-600 font-medium mt-1">Total encaissé</p>
            </div>
            <div className="p-5 bg-white rounded-2xl border border-slate-100 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-amber-50 text-amber-600 rounded-lg"><Clock className="w-5 h-5" /></div>
                <span className="text-sm font-medium text-slate-500">En attente</span>
              </div>
              <div className="text-2xl font-bold text-slate-900">{formatCurrency(data.summary.pending)}</div>
              <p className="text-xs text-amber-600 font-medium mt-1">{data.items.filter((i) => i.status === 'PENDING').length} dossier(s) à valider</p>
            </div>
            <div className="p-5 bg-white rounded-2xl border border-slate-100 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><FileText className="w-5 h-5" /></div>
                <span className="text-sm font-medium text-slate-500">Factures émises</span>
              </div>
              <div className="text-2xl font-bold text-slate-900">{formatCurrency(data.summary.invoicedTotal)}</div>
              <p className="text-xs text-blue-600 font-medium mt-1">Total période</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            {items.length === 0 ? <PlatformEmpty title="Aucune souscription" /> : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/50 border-b border-slate-100">
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">École</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Montant</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Statut</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Dates</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {items.map((sub) => (
                      <tr key={sub.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="font-bold text-slate-900">{sub.schoolName}</div>
                          <div className="text-xs text-slate-500 font-mono">Ref: {sub.reference}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm font-bold text-slate-900">{formatCurrency(sub.amount)}</div>
                          <div className="text-[10px] text-slate-400">TTC</div>
                        </td>
                        <td className="px-6 py-4">
                          {sub.status === 'PAID' ? (
                            <span className="px-2.5 py-1 bg-emerald-100 text-emerald-700 rounded-full text-[10px] font-bold uppercase">Payée</span>
                          ) : sub.status === 'PARTIAL' ? (
                            <span className="px-2.5 py-1 bg-blue-100 text-blue-700 rounded-full text-[10px] font-bold uppercase">Partiel</span>
                          ) : sub.status === 'FAILED' ? (
                            <span className="px-2.5 py-1 bg-rose-100 text-rose-700 rounded-full text-[10px] font-bold uppercase">Échec</span>
                          ) : (
                            <span className="px-2.5 py-1 bg-amber-100 text-amber-700 rounded-full text-[10px] font-bold uppercase">En attente</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-xs text-slate-600">Émise: {new Date(sub.issuedAt).toLocaleDateString('fr-FR')}</div>
                          {sub.paidAt && <div className="text-[10px] text-emerald-600 mt-0.5">Payée: {new Date(sub.paidAt).toLocaleDateString('fr-FR')}</div>}
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
            )}
          </div>
        </>
      )}
    </div>
  );
}
