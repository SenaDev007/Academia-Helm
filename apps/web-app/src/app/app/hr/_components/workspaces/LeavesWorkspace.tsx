'use client';

import { useState, useEffect } from 'react';
import { Plus, Calendar, CheckCircle2, XCircle, FileText, Coffee } from 'lucide-react';
import { useModuleContext } from '@/hooks/useModuleContext';
import { apiFetch } from '@/lib/api/client';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

const PRIMARY = '#1A2BA6';

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  PENDING:  { label: 'En attente', className: 'text-amber-600' },
  APPROVED: { label: 'Approuvé',   className: 'text-emerald-600' },
  REJECTED: { label: 'Refusé',     className: 'text-rose-600' },
};

function calculateDays(start: string, end: string) {
  return Math.ceil(Math.abs(new Date(end).getTime() - new Date(start).getTime()) / 86400000) + 1;
}

export function LeavesWorkspace() {
  const { tenant } = useModuleContext();
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('PENDING');

  useEffect(() => {
    async function fetchLeaves() {
      if (!tenant?.id) return;
      try {
        setLoading(true);
        let url = `/hr/leaves/requests?tenantId=${tenant.id}`;
        if (filterStatus !== 'ALL') url += `&status=${filterStatus}`;
        const result = await apiFetch<any[]>(url);
        setRequests(result);
      } catch (error) {
        console.error('Error fetching leaves:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchLeaves();
  }, [tenant?.id, filterStatus]);

  return (
    <div className="space-y-6 pb-12">
      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {[
          { label: 'Demandes en attente', value: requests.filter((r) => r.status === 'PENDING').length },
          { label: 'Approuvées ce mois',  value: requests.filter((r) => r.status === 'APPROVED').length },
          { label: 'Absences ce jour',    value: 0 },
        ].map((k, i) => (
          <div key={i} className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{k.label}</p>
            <p className="text-xl font-bold text-slate-900 mt-0.5">{k.value}</p>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex bg-white border border-slate-200 rounded-xl p-1 shadow-sm gap-1">
          {[{ key: 'PENDING', label: 'En attente' }, { key: 'APPROVED', label: 'Approuvés' }, { key: 'ALL', label: 'Tous' }].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setFilterStatus(key)}
              className={cn('px-4 py-2 text-sm font-semibold rounded-lg transition-all', filterStatus === key ? 'text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50')}
              style={filterStatus === key ? { backgroundColor: PRIMARY } : undefined}
            >{label}</button>
          ))}
        </div>
        <button className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:opacity-90 transition whitespace-nowrap" style={{ backgroundColor: PRIMARY }}>
          <Plus className="h-4 w-4" /> Nouvelle demande
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="h-16 rounded-xl border border-slate-200 bg-slate-100 animate-pulse" />)}</div>
      ) : requests.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/30 p-16 text-center">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm mb-4"><Coffee className="h-10 w-10 text-slate-300" /></div>
          <h3 className="text-base font-bold text-slate-800">Aucune demande trouvée</h3>
          <p className="text-sm text-slate-500 mt-2">Le personnel est au complet ou aucune demande n'a été soumise.</p>
        </div>
      ) : (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                {['Collaborateur', 'Type / Motif', 'Période', 'Durée', 'Statut', 'Actions'].map((h, i) => (
                  <th key={h} className={cn('px-5 py-3.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500', i === 5 && 'text-right')}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {requests.map((request, idx) => {
                const s = STATUS_CONFIG[request.status] || STATUS_CONFIG.PENDING;
                return (
                  <motion.tr key={request.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.04 }} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold shrink-0" style={{ backgroundColor: PRIMARY + '15', color: PRIMARY }}>
                          {request.staff?.firstName?.[0]}{request.staff?.lastName?.[0]}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-900">{request.staff?.firstName} {request.staff?.lastName}</p>
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{request.staff?.staffCode}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <p className="text-sm font-semibold text-slate-700">{request.type}</p>
                      <p className="text-xs text-slate-400 italic truncate max-w-[180px]">"{request.reason || 'Pas de motif'}"</p>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-1.5 text-sm text-slate-600 font-medium">
                        <Calendar className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        {new Date(request.startDate).toLocaleDateString('fr-FR')}
                        <span className="text-slate-300">→</span>
                        {new Date(request.endDate).toLocaleDateString('fr-FR')}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200">
                        {calculateDays(request.startDate, request.endDate)} jrs
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-1.5">
                        {request.status === 'PENDING' && <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />}
                        <span className={cn('text-xs font-bold uppercase tracking-wider', s.className)}>{s.label}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-right">
                      {request.status === 'PENDING' ? (
                        <div className="flex justify-end gap-1.5">
                          <button className="p-1.5 rounded-lg hover:bg-emerald-50 text-emerald-600 transition-colors" title="Approuver"><CheckCircle2 className="h-5 w-5" /></button>
                          <button className="p-1.5 rounded-lg hover:bg-rose-50 text-rose-500 transition-colors" title="Rejeter"><XCircle className="h-5 w-5" /></button>
                        </div>
                      ) : (
                        <button className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"><FileText className="h-5 w-5" /></button>
                      )}
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </motion.div>
      )}
    </div>
  );
}
