'use client';

import { useState, useEffect } from 'react';
import { Plus, Search, FileText, Calendar, DollarSign, AlertCircle, FileCheck, Files } from 'lucide-react';
import { useModuleContext } from '@/hooks/useModuleContext';
import { apiFetch } from '@/lib/api/client';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

const PRIMARY = '#1A2BA6';

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  ACTIVE:     { label: 'En vigueur',  className: 'bg-emerald-50 text-emerald-700 border border-emerald-200' },
  EXPIRED:    { label: 'Expiré',      className: 'bg-slate-100 text-slate-500 border border-slate-200' },
  TERMINATED: { label: 'Résilié',     className: 'bg-rose-50 text-rose-600 border border-rose-200' },
};

export function ContractsWorkspace() {
  const { tenant } = useModuleContext();
  const [contracts, setContracts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('ACTIVE');

  useEffect(() => {
    async function fetchContracts() {
      if (!tenant?.id) return;
      try {
        setLoading(true);
        let url = `/hr/contracts?tenantId=${tenant.id}`;
        if (filterStatus !== 'ALL') url += `&status=${filterStatus}`;
        const result = await apiFetch<any[]>(url);
        setContracts(result);
      } catch (error) {
        console.error('Error fetching contracts:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchContracts();
  }, [tenant?.id, filterStatus]);

  const expiringSoon = contracts.filter((c) => {
    if (!c.endDate || c.status !== 'ACTIVE') return false;
    const diff = (new Date(c.endDate).getTime() - Date.now()) / 86400000;
    return diff > 0 && diff <= 30;
  });

  const filteredContracts = contracts.filter(
    (c) =>
      `${c.staff?.firstName} ${c.staff?.lastName}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.staff?.staffCode && c.staff.staffCode.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const inputClass =
    'rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 ' +
    'focus:outline-none focus:border-[#1A2BA6] focus:ring-2 focus:ring-[#1A2BA6]/10 transition shadow-sm';

  return (
    <div className="space-y-6 pb-12">
      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {[
          { label: 'Contrats actifs', value: contracts.filter((c) => c.status === 'ACTIVE').length },
          { label: 'CDI en cours', value: contracts.filter((c) => c.type === 'CDI' && c.status === 'ACTIVE').length },
          { label: 'Échéances J-30', value: expiringSoon.length },
        ].map((k, i) => (
          <div key={i} className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{k.label}</p>
            <p className="text-xl font-bold text-slate-900 mt-0.5">{k.value}</p>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <div className="relative flex-grow md:flex-grow-0 md:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Rechercher par nom ou matricule…"
              className={inputClass + ' pl-9 w-full'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <select className={inputClass} value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            <option value="ACTIVE">Contrats Actifs</option>
            <option value="ALL">Historique Complet</option>
            <option value="EXPIRED">Expirés</option>
            <option value="TERMINATED">Terminés</option>
          </select>
        </div>
        <button
          className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:opacity-90 transition whitespace-nowrap"
          style={{ backgroundColor: PRIMARY }}
        >
          <Plus className="h-4 w-4" />
          Nouveau contrat / Avenant
        </button>
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 rounded-xl border border-slate-200 bg-slate-100 animate-pulse" />
          ))}
        </div>
      ) : filteredContracts.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/30 p-16 text-center">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm mb-4">
            <Files className="h-10 w-10 text-slate-300" />
          </div>
          <h3 className="text-base font-bold text-slate-800">Aucun contrat trouvé</h3>
          <p className="text-sm text-slate-500 mt-2">Commencez par générer un contrat pour un membre du personnel.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredContracts.map((contract, idx) => (
            <ContractRow key={contract.id} contract={contract} index={idx} />
          ))}
        </div>
      )}
    </div>
  );
}

function ContractRow({ contract, index }: { contract: any; index: number }) {
  const isExpiringSoon = () => {
    if (!contract.endDate || contract.status !== 'ACTIVE') return false;
    const diff = (new Date(contract.endDate).getTime() - Date.now()) / 86400000;
    return diff > 0 && diff <= 30;
  };
  const status = STATUS_CONFIG[contract.status] || STATUS_CONFIG.EXPIRED;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      className={cn('rounded-xl border bg-white shadow-sm hover:shadow-md transition-all overflow-hidden', isExpiringSoon() ? 'border-amber-200 bg-amber-50/20' : 'border-slate-200')}
    >
      <div className="p-4 md:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center font-bold text-base shrink-0" style={{ backgroundColor: PRIMARY + '15', color: PRIMARY }}>
            {contract.type?.[0]}
          </div>
          <div className="min-w-0">
            <h4 className="font-bold text-slate-900 text-sm truncate">{contract.staff?.firstName} {contract.staff?.lastName}</h4>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border border-slate-200 bg-slate-50 text-slate-500">{contract.type}</span>
              <span className="text-[10px] text-slate-400 font-medium">#{contract.staff?.staffCode}</span>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-6 flex-grow max-w-xl">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">Période</p>
            <div className="flex items-center gap-1.5 text-sm font-medium text-slate-700">
              <Calendar className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              <span>{new Date(contract.startDate).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' })} → {contract.endDate ? new Date(contract.endDate).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' }) : 'Indéfini'}</span>
            </div>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">Salaire de base</p>
            <div className="flex items-center gap-1.5 text-sm font-bold text-emerald-600">
              <DollarSign className="h-3.5 w-3.5 shrink-0" />{Number(contract.baseSalary).toLocaleString()} XOF
            </div>
          </div>
          <div className="hidden md:block">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">Statut</p>
            {isExpiringSoon() ? (
              <div className="flex items-center gap-1 text-xs font-bold text-amber-600 animate-pulse"><AlertCircle className="h-3.5 w-3.5" /> Expiration proche</div>
            ) : (
              <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-bold uppercase', status.className)}>{status.label}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 border-t md:border-none pt-3 md:pt-0 w-full md:w-auto">
          <button className="flex-grow md:flex-grow-0 text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-slate-50 transition-colors" style={{ color: PRIMARY }}>Gérer l'avenant</button>
          <Link href={`/app/hr/contracts/${contract.id}`} className="p-2 text-slate-400 hover:text-[#1A2BA6] transition-colors rounded-lg hover:bg-slate-50"><FileCheck className="h-5 w-5" /></Link>
        </div>
      </div>
    </motion.div>
  );
}
