'use client';

import { useState, useEffect } from 'react';
import {
  Plus, Search, FileText, Calendar, DollarSign, AlertCircle,
  FileCheck, Files, Download, PenTool, Loader2, X, FileX2,
} from 'lucide-react';
import { useModuleContext } from '@/hooks/useModuleContext';
import { hrFetch, hrUrl } from '@/lib/hr/hr-client';
import { toast } from '@/components/ui/toast';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { cn, formatCurrency } from '@/lib/utils';
import { ContractTerminationModal } from '../modals/ContractTerminationModal';

const PRIMARY = '#1A2BA6';

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  ACTIVE:     { label: 'En vigueur',                className: 'bg-emerald-50 text-emerald-700 border border-emerald-200' },
  PENDING:    { label: 'En attente de signature',   className: 'bg-amber-50 text-amber-600 border border-amber-200' },
  DRAFT:      { label: 'En attente de signature',   className: 'bg-amber-50 text-amber-600 border border-amber-200' },
  EXPIRED:    { label: 'Expiré',                    className: 'bg-slate-100 text-slate-500 border border-slate-200' },
  TERMINATED: { label: 'Résilié',                   className: 'bg-rose-50 text-rose-600 border border-rose-200' },
  DELETED:    { label: 'Supprimé',                  className: 'bg-slate-100 text-slate-400 border border-slate-200' },
};

// Fallback neutre — on n'utilise PLUS 'EXPIRED' comme défaut pour éviter qu'un
// contrat avec un statut inattendu (ou un nouveau statut backend non mappé) soit
// affiché à tort comme « Expiré ».
const STATUS_FALLBACK = {
  label: 'En attente',
  className: 'bg-amber-50 text-amber-600 border border-amber-200',
};

const inputClass =
  'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 ' +
  'focus:outline-none focus:border-[#1A2BA6] focus:ring-2 focus:ring-[#1A2BA6]/10 transition';

const labelClass = 'block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5';

export function ContractsWorkspace() {
  const { tenant } = useModuleContext();
  const [contracts, setContracts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('ALL');

  // New contract modal
  const [modalOpen, setModalOpen] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [staffList, setStaffList] = useState<any[]>([]);
  const [modalForm, setModalForm] = useState({
    staffId: '',
    contractType: 'CDD',
    startDate: new Date().toISOString().split('T')[0],
    endDate: '',
    baseSalary: '150000',
    paymentMode: 'BANK',
  });

  // Contract termination modal
  const [terminationModalOpen, setTerminationModalOpen] = useState(false);
  const [selectedContract, setSelectedContract] = useState<any>(null);

  async function fetchContracts() {
    if (!tenant?.id) return;
    try {
      setLoading(true);
      const queryParams: Record<string, string> = { tenantId: tenant.id };
      if (filterStatus !== 'ALL') queryParams.status = filterStatus;
      const result = await hrFetch<any[]>(hrUrl('contracts', queryParams));
      setContracts(result);
      // Also fetch staff to show those without contracts
      const staffResult = await hrFetch<any[]>(hrUrl('staff', { tenantId: tenant.id }));
      setStaffList(staffResult.filter((s: any) => s.status === 'ACTIVE' || s.status === 'PENDING_SIGNATURE'));
    } catch (error) {
      console.error('Error fetching contracts:', error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchContracts(); }, [tenant?.id, filterStatus]);

  // Fetch staff list when modal opens
  useEffect(() => {
    if (modalOpen && tenant?.id) {
      hrFetch<any[]>(hrUrl('staff', { tenantId: tenant.id }))
        .then((list) => setStaffList(list.filter((s: any) => s.status === 'ACTIVE' || s.status === 'PENDING_SIGNATURE')))
        .catch(() => {});
    }
  }, [modalOpen, tenant?.id]);

  const handleCreateContract = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setModalLoading(true);
      await hrFetch(hrUrl('contracts', { tenantId: tenant.id }), {
        method: 'POST',
        body: {
          staffId: modalForm.staffId,
          contractType: modalForm.contractType,
          startDate: new Date(modalForm.startDate).toISOString(),
          endDate: modalForm.endDate ? new Date(modalForm.endDate).toISOString() : null,
          baseSalary: parseFloat(modalForm.baseSalary),
          paymentMode: modalForm.paymentMode,
          status: 'PENDING',
        },
      });
      toast({ variant: 'success', title: 'Contrat créé avec succès' });
      setModalOpen(false);
      setModalForm({ staffId: '', contractType: 'CDD', startDate: new Date().toISOString().split('T')[0], endDate: '', baseSalary: '150000', paymentMode: 'BANK' });
      fetchContracts();
    } catch (err) {
      toast({ variant: 'error', title: 'Erreur lors de la création du contrat' });
    } finally {
      setModalLoading(false);
    }
  };

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

  // Staff without contracts (only show when filterStatus is ALL or ACTIVE, and no search query)
  const staffWithContractIds = new Set(contracts.map(c => c.staffId));
  const staffWithoutContracts = (filterStatus === 'ALL' || filterStatus === 'ACTIVE')
    ? staffList.filter(s =>
        !staffWithContractIds.has(s.id) &&
        `${s.firstName} ${s.lastName}`.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : [];

  const selectClass =
    'rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 ' +
    'focus:outline-none focus:border-[#1A2BA6] focus:ring-2 focus:ring-[#1A2BA6]/10 transition shadow-sm';

  return (
    <div className="space-y-6 pb-12">
      {/* New Contract Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-6 py-5 text-white" style={{ background: PRIMARY }}>
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-white/15 p-2"><FileText className="h-5 w-5" /></div>
                <div>
                  <h3 className="text-base font-bold">Nouveau Contrat / Avenant</h3>
                  <p className="text-xs text-white/70">Renseignez les informations du contrat</p>
                </div>
              </div>
              <button onClick={() => setModalOpen(false)} className="rounded-lg p-1.5 hover:bg-white/15 transition-colors"><X className="h-5 w-5" /></button>
            </div>
            <form onSubmit={handleCreateContract} className="p-6 space-y-4">
              <div>
                <label className={labelClass}>Collaborateur</label>
                <select className={inputClass} value={modalForm.staffId} onChange={(e) => setModalForm({ ...modalForm, staffId: e.target.value })} required>
                  <option value="">Sélectionner un collaborateur…</option>
                  {staffList.map((s) => (
                    <option key={s.id} value={s.id}>{s.firstName} {s.lastName} ({s.staffCode || s.position})</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Type de contrat</label>
                  <select className={inputClass} value={modalForm.contractType} onChange={(e) => setModalForm({ ...modalForm, contractType: e.target.value })}>
                    <option value="CDD">CDD</option>
                    <option value="CDI">CDI</option>
                    <option value="VACATAIRE">Vacataire</option>
                    <option value="STAGE">Stage</option>
                    <option value="CONSULTANT">Consultant</option>
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Mode de paiement</label>
                  <select className={inputClass} value={modalForm.paymentMode} onChange={(e) => setModalForm({ ...modalForm, paymentMode: e.target.value })}>
                    <option value="BANK">Virement Bancaire</option>
                    <option value="CASH">Espèces</option>
                    <option value="MOBILE_MONEY">Mobile Money</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Date de début</label>
                  <input type="date" className={inputClass} value={modalForm.startDate} onChange={(e) => setModalForm({ ...modalForm, startDate: e.target.value })} required />
                </div>
                <div>
                  <label className={labelClass}>Date de fin{modalForm.contractType === 'CDI' ? ' (optionnel)' : ''}</label>
                  <input type="date" className={inputClass} value={modalForm.endDate} onChange={(e) => setModalForm({ ...modalForm, endDate: e.target.value })} required={modalForm.contractType !== 'CDI'} />
                </div>
              </div>
              <div>
                <label className={labelClass}>Salaire de base (Mensuel)</label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input type="number" className={inputClass + ' pl-9'} value={modalForm.baseSalary} onChange={(e) => setModalForm({ ...modalForm, baseSalary: e.target.value })} required min={0} />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-sm font-semibold hover:bg-slate-50 transition">Annuler</button>
                <button type="submit" disabled={modalLoading || !modalForm.staffId} className="flex items-center gap-2 px-5 py-2.5 text-white rounded-xl text-sm font-bold shadow-sm hover:opacity-90 disabled:opacity-50 transition" style={{ backgroundColor: PRIMARY }}>
                  {modalLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Créer le contrat
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Contrats actifs', value: contracts.filter((c) => c.status === 'ACTIVE').length },
          { label: 'En attente de signature', value: contracts.filter((c) => c.status === 'DRAFT' || c.status === 'PENDING').length },
          { label: 'Actifs non signés', value: contracts.filter((c) => c.status === 'ACTIVE' && !c.signedAt).length },
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
              className={selectClass + ' pl-9 w-full'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <select className={selectClass} value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            <option value="ACTIVE">Contrats Actifs</option>
            <option value="DRAFT">En attente de signature</option>
            <option value="ALL">Historique Complet</option>
            <option value="EXPIRED">Expirés</option>
            <option value="TERMINATED">Terminés</option>
          </select>
        </div>
        <button
          onClick={() => setModalOpen(true)}
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
      ) : filteredContracts.length === 0 && staffWithoutContracts.length === 0 ? (
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
            <ContractRow
              key={contract.id}
              contract={contract}
              index={idx}
              tenantId={tenant.id}
              onTerminate={(c) => { setSelectedContract(c); setTerminationModalOpen(true); }}
            />
          ))}
          {/* Staff without contracts - shown as "pending" entries */}
          {staffWithoutContracts.length > 0 && (
            <>
              <div className="flex items-center gap-2 pt-4 pb-1">
                <AlertCircle className="h-4 w-4 text-amber-500" />
                <p className="text-xs font-bold text-amber-700 uppercase tracking-wider">
                  Personnel sans contrat ({staffWithoutContracts.length})
                </p>
              </div>
              {staffWithoutContracts.map((staff, idx) => (
                <PendingContractRow
                  key={staff.id}
                  staff={staff}
                  index={idx + filteredContracts.length}
                  onCreate={() => {
                    setModalForm({
                      ...modalForm,
                      staffId: staff.id,
                    });
                    setModalOpen(true);
                  }}
                />
              ))}
            </>
          )}
        </div>
      )}

      {/* Contract Termination Modal */}
      <ContractTerminationModal
        isOpen={terminationModalOpen}
        onClose={() => { setTerminationModalOpen(false); setSelectedContract(null); }}
        onSuccess={fetchContracts}
        contract={selectedContract}
        tenantId={tenant?.id || ''}
      />
    </div>
  );
}

function ContractRow({ contract, index, tenantId, onTerminate }: { contract: any; index: number; tenantId: string; onTerminate: (contract: any) => void }) {
  const [generating, setGenerating] = useState(false);

  const isExpiringSoon = () => {
    if (!contract.endDate || contract.status !== 'ACTIVE') return false;
    const diff = (new Date(contract.endDate).getTime() - Date.now()) / 86400000;
    return diff > 0 && diff <= 30;
  };
  const status = STATUS_CONFIG[contract.status] || STATUS_FALLBACK;
  const isSigned = !!contract.signedAt;

  async function handleGeneratePdf() {
    try {
      setGenerating(true);
      await hrFetch(hrUrl(`contracts/${contract.id}/generate-pdf`, { tenantId }), { method: 'POST' });
      toast({ variant: 'success', title: 'PDF généré avec succès !' });
    } catch {
      toast({ variant: 'error', title: 'Erreur lors de la génération PDF.' });
    } finally {
      setGenerating(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      className={cn('rounded-xl border bg-white shadow-sm hover:shadow-md transition-all overflow-hidden', isExpiringSoon() ? 'border-amber-200 bg-amber-50/20' : 'border-slate-200')}
    >
      <div className="p-4 md:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          {contract.staff?.photoUrl ? (
            <img
              src={contract.staff.photoUrl}
              alt={`${contract.staff?.firstName} ${contract.staff?.lastName}`}
              className="w-11 h-11 rounded-xl object-cover shrink-0 border border-slate-200"
            />
          ) : (
            <div className="w-11 h-11 rounded-xl flex items-center justify-center font-bold text-base shrink-0" style={{ backgroundColor: PRIMARY + '15', color: PRIMARY }}>
              {contract.staff?.firstName?.[0]}{contract.staff?.lastName?.[0]}
            </div>
          )}
          <div className="min-w-0">
            <h4 className="font-bold text-slate-900 text-sm truncate">{contract.staff?.firstName} {contract.staff?.lastName}</h4>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border border-slate-200 bg-slate-50 text-slate-500">{contract.contractType}</span>
              <span className="text-[10px] text-slate-400 font-medium">#{contract.staff?.staffCode}</span>
              {isSigned ? (
                <span className="text-[10px] font-bold text-emerald-700 flex items-center gap-0.5">
                  <PenTool className="h-2.5 w-2.5" /> Signé
                </span>
              ) : (
                <span className="text-[10px] font-bold text-amber-600 flex items-center gap-0.5">
                  <PenTool className="h-2.5 w-2.5" /> Non signé
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-6 flex-grow w-full md:max-w-xl">
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
              <DollarSign className="h-3.5 w-3.5 shrink-0" />{formatCurrency(contract.baseSalary)}
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
          <button
            onClick={handleGeneratePdf}
            disabled={generating}
            className="flex-shrink-0 p-2 text-slate-400 hover:text-[#1A2BA6] transition-colors rounded-lg hover:bg-slate-50"
            title="Générer PDF"
          >
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          </button>
          {contract.status === 'ACTIVE' && (
            <button
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onTerminate(contract); }}
              className="flex-shrink-0 p-2 text-rose-400 hover:text-rose-600 transition-colors rounded-lg hover:bg-rose-50"
              title="Résilier le contrat"
            >
              <FileX2 className="h-4 w-4" />
            </button>
          )}
          <Link href={`/app/hr/contracts/${contract.id}`} className="flex-grow md:flex-grow-0 flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-slate-50 transition-colors" style={{ color: PRIMARY }}>
            <FileCheck className="h-4 w-4" /> Ouvrir le contrat
          </Link>
        </div>
      </div>
    </motion.div>
  );
}

function PendingContractRow({ staff, index, onCreate }: { staff: any; index: number; onCreate: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      className="rounded-xl border border-dashed border-amber-200 bg-amber-50/30 shadow-sm hover:shadow-md transition-all overflow-hidden"
    >
      <div className="p-4 md:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          {staff.photoUrl ? (
            <img
              src={staff.photoUrl}
              alt={`${staff.firstName} ${staff.lastName}`}
              className="w-11 h-11 rounded-xl object-cover shrink-0 border border-amber-200"
            />
          ) : (
            <div className="w-11 h-11 rounded-xl flex items-center justify-center font-bold text-base shrink-0 bg-amber-100 text-amber-700">
              {staff.firstName?.[0]}{staff.lastName?.[0]}
            </div>
          )}
          <div className="min-w-0">
            <h4 className="font-bold text-slate-900 text-sm truncate">{staff.firstName} {staff.lastName}</h4>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border border-amber-200 bg-amber-50 text-amber-700">
                Aucun contrat
              </span>
              <span className="text-[10px] text-slate-400 font-medium">
                {staff.position || 'Personnel'} · {staff.tenantMatricule || staff.employeeNumber || 'N/A'}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 border-t md:border-none pt-3 md:pt-0 w-full md:w-auto">
          <button
            onClick={onCreate}
            className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg text-white transition-colors whitespace-nowrap"
            style={{ backgroundColor: PRIMARY }}
          >
            <Plus className="h-4 w-4" /> Créer un contrat
          </button>
        </div>
      </div>
    </motion.div>
  );
}
