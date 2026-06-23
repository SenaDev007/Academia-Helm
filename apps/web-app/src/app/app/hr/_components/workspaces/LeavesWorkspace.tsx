'use client';

import { useState, useEffect } from 'react';
import { useConfirmDialog } from '@/components/ui/confirm-dialog';
import { Plus, Calendar, CheckCircle2, XCircle, FileText, Coffee, X, Loader2 } from 'lucide-react';
import { useModuleContext } from '@/hooks/useModuleContext';
import { hrFetch, hrUrl } from '@/lib/hr/hr-client';
import { toast } from '@/components/ui/toast';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

const PRIMARY = '#1A2BA6';

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  PENDING:  { label: 'En attente', className: 'text-amber-600' },
  APPROVED: { label: 'Approuvé',   className: 'text-emerald-600' },
  REJECTED: { label: 'Refusé',     className: 'text-rose-600' },
};

const LEAVE_TYPES = [
  { value: 'ANNUAL', label: 'Congé annuel' },
  { value: 'SICK', label: 'Maladie' },
  { value: 'MATERNITY', label: 'Maternité' },
  { value: 'PATERNITY', label: 'Paternité' },
  { value: 'UNPAID', label: 'Sans solde' },
  { value: 'EXCEPTIONAL', label: 'Exceptionnel' },
];

function calculateDays(start: string, end: string) {
  return Math.ceil(Math.abs(new Date(end).getTime() - new Date(start).getTime()) / 86400000) + 1;
}

const inputClass =
  'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 ' +
  'focus:outline-none focus:border-[#1A2BA6] focus:ring-2 focus:ring-[#1A2BA6]/10 transition';

const labelClass = 'block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5';

export function LeavesWorkspace() {
  const confirmDialog = useConfirmDialog();
  const { tenant, academicYear } = useModuleContext();
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('PENDING');

  // New leave request modal
  const [modalOpen, setModalOpen] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [staffList, setStaffList] = useState<any[]>([]);
  const [modalForm, setModalForm] = useState({
    staffId: '',
    type: 'ANNUAL',
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    reason: '',
  });

  async function fetchLeaves() {
    if (!tenant?.id) return;
    try {
      setLoading(true);
      const queryParams: Record<string, string> = { tenantId: tenant.id };
      if (filterStatus !== 'ALL') queryParams.status = filterStatus;
      const result = await hrFetch<any[]>(hrUrl('leaves/requests', queryParams));
      setRequests(result);
    } catch (error) {
      console.error('Error fetching leaves:', error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchLeaves(); }, [tenant?.id, filterStatus]);

  // Fetch staff list when modal opens
  useEffect(() => {
    if (modalOpen && tenant?.id) {
      hrFetch<any[]>(hrUrl('staff', { tenantId: tenant.id, status: 'ACTIVE' }))
        .then(setStaffList)
        .catch(() => {});
    }
  }, [modalOpen, tenant?.id]);

  const handleCreateRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setModalLoading(true);
      await hrFetch(hrUrl('leaves/requests', { tenantId: tenant.id }), {
        method: 'POST',
        body: {
          ...modalForm,
          academicYearId: academicYear?.id,
          tenantId: tenant?.id,
        },
      });
      toast({ variant: 'success', title: 'Demande de congé soumise avec succès' });
      setModalOpen(false);
      setModalForm({ staffId: '', type: 'ANNUAL', startDate: new Date().toISOString().split('T')[0], endDate: new Date().toISOString().split('T')[0], reason: '' });
      fetchLeaves();
    } catch (err) {
      toast({ variant: 'error', title: 'Erreur lors de la soumission de la demande' });
    } finally {
      setModalLoading(false);
    }
  };

  const handleProcessRequest = async (requestId: string, status: 'APPROVED' | 'REJECTED') => {
    try {
      await hrFetch(hrUrl(`leaves/requests/${requestId}/process`, { tenantId: tenant.id }), {
        method: 'PUT',
        body: { status },
      });
      toast({ variant: 'success', title: status === 'APPROVED' ? 'Demande approuvée' : 'Demande rejetée' });
      fetchLeaves();
    } catch (err) {
      toast({ variant: 'error', title: 'Erreur lors du traitement de la demande' });
    }
  };

  // Calculate "Absences ce jour" from leave requests data
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const absencesToday = requests.filter((r) => {
    if (r.status !== 'APPROVED') return false;
    const start = new Date(r.startDate).toISOString().split('T')[0];
    const end = new Date(r.endDate).toISOString().split('T')[0];
    return todayStr >= start && todayStr <= end;
  }).length;

  return (
    <>
    {confirmDialog.dialog}
    <div className="space-y-6 pb-12">
      {/* New Leave Request Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-6 py-5 text-white" style={{ background: PRIMARY }}>
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-white/15 p-2"><Calendar className="h-5 w-5" /></div>
                <div>
                  <h3 className="text-base font-bold">Nouvelle demande de congé</h3>
                  <p className="text-xs text-white/70">Renseignez les informations de la demande</p>
                </div>
              </div>
              <button onClick={() => setModalOpen(false)} className="rounded-lg p-1.5 hover:bg-white/15 transition-colors"><X className="h-5 w-5" /></button>
            </div>
            <form onSubmit={handleCreateRequest} className="p-6 space-y-4">
              <div>
                <label className={labelClass}>Collaborateur</label>
                <select className={inputClass} value={modalForm.staffId} onChange={(e) => setModalForm({ ...modalForm, staffId: e.target.value })} required>
                  <option value="">Sélectionner un collaborateur…</option>
                  {staffList.map((s) => (
                    <option key={s.id} value={s.id}>{s.firstName} {s.lastName} ({s.staffCode || s.position})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>Type de congé</label>
                <select className={inputClass} value={modalForm.type} onChange={(e) => setModalForm({ ...modalForm, type: e.target.value })}>
                  {LEAVE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Date de début</label>
                  <input type="date" className={inputClass} value={modalForm.startDate} onChange={(e) => setModalForm({ ...modalForm, startDate: e.target.value })} required />
                </div>
                <div>
                  <label className={labelClass}>Date de fin</label>
                  <input type="date" className={inputClass} value={modalForm.endDate} onChange={(e) => setModalForm({ ...modalForm, endDate: e.target.value })} required />
                </div>
              </div>
              <div>
                <label className={labelClass}>Motif</label>
                <textarea className={inputClass + ' min-h-[80px] resize-none'} value={modalForm.reason} onChange={(e) => setModalForm({ ...modalForm, reason: e.target.value })} placeholder="Raison de la demande…" />
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-sm font-semibold hover:bg-slate-50 transition">Annuler</button>
                <button type="submit" disabled={modalLoading || !modalForm.staffId} className="flex items-center gap-2 px-5 py-2.5 text-white rounded-xl text-sm font-bold shadow-sm hover:opacity-90 disabled:opacity-50 transition" style={{ backgroundColor: PRIMARY }}>
                  {modalLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Soumettre la demande
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {[
          { label: 'Demandes en attente', value: requests.filter((r) => r.status === 'PENDING').length },
          { label: 'Approuvées ce mois',  value: requests.filter((r) => r.status === 'APPROVED').length },
          { label: 'Absences ce jour',    value: absencesToday },
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
        <button onClick={() => setModalOpen(true)} className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:opacity-90 transition whitespace-nowrap" style={{ backgroundColor: PRIMARY }}>
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
          <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
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
                        {request.staff?.photoUrl ? (
                          <img src={request.staff.photoUrl} alt={`${request.staff?.firstName} ${request.staff?.lastName}`} className="w-9 h-9 rounded-xl object-cover shrink-0" />
                        ) : (
                          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold shrink-0" style={{ backgroundColor: PRIMARY + '15', color: PRIMARY }}>
                            {request.staff?.firstName?.[0]}{request.staff?.lastName?.[0]}
                          </div>
                        )}
                        <div>
                          <p className="text-sm font-bold text-slate-900">{request.staff?.firstName} {request.staff?.lastName}</p>
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{request.staff?.staffCode || request.staff?.employeeNumber}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <p className="text-sm font-semibold text-slate-700">{LEAVE_TYPES.find(t => t.value === request.type)?.label || request.type}</p>
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
                          <button onClick={() => handleProcessRequest(request.id, 'APPROVED')} className="p-1.5 rounded-lg hover:bg-emerald-50 text-emerald-600 transition-colors" title="Approuver"><CheckCircle2 className="h-5 w-5" /></button>
                          <button onClick={async () => { const ok = await confirmDialog.danger('Cette demande de congé sera rejetée définitivement.', 'Rejeter la demande'); if (ok) handleProcessRequest(request.id, 'REJECTED') }} className="p-1.5 rounded-lg hover:bg-rose-50 text-rose-500 transition-colors" title="Rejeter"><XCircle className="h-5 w-5" /></button>
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
          </div>
        </motion.div>
      )}
    </div>
    </>
  );
}
