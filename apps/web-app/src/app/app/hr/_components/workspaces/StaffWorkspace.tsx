'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Plus, Search, Phone, Briefcase, GraduationCap,
  Users, Loader2, Globe, Building2, UserX, UserCheck,
  RefreshCw, AlertCircle,
} from 'lucide-react';
import { useModuleContext } from '@/hooks/useModuleContext';
import { hrFetch, hrUrl } from '@/lib/hr/hr-client';
import { toast } from '@/components/ui/toast';
import Link from 'next/link';
import { OnboardingWizardModal } from '../modals/OnboardingWizardModal';
import { StaffTerminationModal } from '../modals/StaffTerminationModal';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

const PRIMARY = '#1A2BA6';

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  ACTIVE:    { label: 'En poste',  className: 'bg-emerald-50 text-emerald-700 border border-emerald-200' },
  INACTIVE:  { label: 'Inactif',   className: 'bg-slate-100 text-slate-500 border border-slate-200' },
  SUSPENDED: { label: 'Suspendu', className: 'bg-amber-50 text-amber-700 border border-amber-200' },
};

const TERMINATION_TYPE_LABELS: Record<string, string> = {
  RESIGNATION: 'Démission',
  DISMISSAL: 'Licenciement',
  MUTUAL_AGREEMENT: 'Rupture conv.',
  END_OF_CONTRACT: 'Fin de contrat',
  RETIREMENT: 'Retraite',
  DEATH: 'Décès',
  ABANDONMENT: 'Abandon',
  OTHER: 'Autre',
};

const CATEGORY_LABEL: Record<string, string> = {
  PEDAGOGICAL: 'Corps Enseignant',
  ADMIN: 'Administration',
  SUPPORT: "Personnel d'appui",
};

const MAX_STAFF_RETRIES = 3;
const STAFF_RETRY_DELAYS = [2000, 5000, 10000];

export function StaffWorkspace() {
  const { tenant } = useModuleContext();
  const [staff, setStaff] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ACTIVE');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [staffError, setStaffError] = useState<string | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);
  const retryCountRef = useRef(0);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Termination modal state
  const [terminationModalOpen, setTerminationModalOpen] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<any>(null);

  // Reactivation confirmation state
  const [reactivateId, setReactivateId] = useState<string | null>(null);
  const [reactivateLoading, setReactivateLoading] = useState(false);

  const fetchStaff = useCallback(async (isRetry = false) => {
    if (!tenant?.id) return;
    try {
      setLoading(true);
      setStaffError(null);
      const query: Record<string, string> = { tenantId: tenant.id };
      if (filterCategory !== 'ALL') query.category = filterCategory;
      if (filterStatus !== 'ALL') query.status = filterStatus;
      const result = await hrFetch<any[]>(hrUrl('staff', query));
      setStaff(Array.isArray(result) ? result : []);
      retryCountRef.current = 0; // Reset on success
    } catch (error: any) {
      console.error('Error fetching staff:', error);
      if (!isRetry) retryCountRef.current = 0;
      retryCountRef.current++;
      if (retryCountRef.current < MAX_STAFF_RETRIES) {
        const delay = STAFF_RETRY_DELAYS[retryCountRef.current - 1] || 10000;
        retryTimeoutRef.current = setTimeout(() => fetchStaff(true), delay);
      } else {
        setStaffError(error?.message || 'Erreur de chargement du personnel');
        toast({ variant: 'error', title: 'Erreur: impossible de charger la liste du personnel' });
      }
    } finally {
      setLoading(false);
      setIsRetrying(false);
    }
  }, [tenant?.id, filterCategory, filterStatus]);

  useEffect(() => {
    fetchStaff();
    return () => {
      if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
    };
  }, [fetchStaff]);

  const handleRetry = () => {
    retryCountRef.current = 0;
    setIsRetrying(true);
    if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
    fetchStaff();
  };

  const handleTerminate = (member: any) => {
    setSelectedStaff(member);
    setTerminationModalOpen(true);
  };

  const handleReactivate = async (id: string) => {
    if (!tenant?.id) return;
    try {
      setReactivateLoading(true);
      await hrFetch<any>(hrUrl(`staff/${id}/reactivate`, { tenantId: tenant.id }), {
        method: 'POST',
        body: { reason: 'Réintégration du collaborateur' },
      });
      toast({ variant: 'success', title: 'Collaborateur réactivé avec succès' });
      setReactivateId(null);
      fetchStaff();
    } catch (err: any) {
      toast({ variant: 'error', title: err.message || 'Erreur lors de la réactivation' });
    } finally {
      setReactivateLoading(false);
    }
  };

  const filteredStaff = staff.filter((s) =>
    `${s.firstName} ${s.lastName}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (s.staffCode && s.staffCode.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const selectClass =
    'rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 ' +
    'focus:outline-none focus:border-[#1A2BA6] focus:ring-2 focus:ring-[#1A2BA6]/10 transition shadow-sm';

  return (
    <div className="space-y-6 pb-12">
      <OnboardingWizardModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={fetchStaff}
        tenantId={tenant?.id || ''}
      />

      <StaffTerminationModal
        isOpen={terminationModalOpen}
        onClose={() => { setTerminationModalOpen(false); setSelectedStaff(null); }}
        onSuccess={fetchStaff}
        staff={selectedStaff}
        tenantId={tenant?.id || ''}
      />

      {/* Reactivation Confirmation */}
      {reactivateId && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="flex items-center gap-3 px-6 py-5 text-white" style={{ background: PRIMARY }}>
              <div className="rounded-lg bg-white/15 p-2"><UserCheck className="h-5 w-5" /></div>
              <div>
                <h3 className="text-base font-bold">Réactivation du collaborateur</h3>
                <p className="text-xs text-white/70">Remettre le statut à ACTIF</p>
              </div>
            </div>
            <div className="p-6">
              <p className="text-sm text-slate-700">
                Voulez-vous réactiver ce collaborateur ? Son statut sera remis à <strong>ACTIF</strong> et les
                données de débauche seront archivées dans ses notes.
              </p>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/50">
              <button
                onClick={() => setReactivateId(null)}
                className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-sm font-semibold hover:bg-slate-50 transition"
              >
                Annuler
              </button>
              <button
                disabled={reactivateLoading}
                onClick={() => handleReactivate(reactivateId)}
                className="flex items-center gap-2 px-5 py-2.5 text-white rounded-xl text-sm font-bold shadow-sm hover:opacity-90 disabled:opacity-50 transition"
                style={{ backgroundColor: PRIMARY }}
              >
                {reactivateLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserCheck className="h-4 w-4" />}
                Confirmer la réactivation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <div className="relative flex-grow md:flex-grow-0 md:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Nom, prénom ou matricule…"
              className={
                'w-full rounded-xl border border-slate-200 bg-white pl-9 pr-4 py-2.5 text-sm ' +
                'placeholder:text-slate-400 focus:outline-none focus:border-[#1A2BA6] ' +
                'focus:ring-2 focus:ring-[#1A2BA6]/10 transition shadow-sm'
              }
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <select className={selectClass} value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
            <option value="ALL">Toutes les catégories</option>
            <option value="PEDAGOGICAL">Corps Enseignant</option>
            <option value="ADMIN">Administration</option>
            <option value="SUPPORT">Personnel d'appui</option>
          </select>
          <select className={selectClass} value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            <option value="ALL">Tous les statuts</option>
            <option value="ACTIVE">Actif</option>
            <option value="INACTIVE">Inactif</option>
            <option value="SUSPENDED">Suspendu</option>
          </select>
        </div>
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:opacity-90 transition whitespace-nowrap"
          style={{ backgroundColor: PRIMARY }}
        >
          <Plus className="h-4 w-4" />
          Nouveau collaborateur
        </button>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Effectif total', value: staff.length },
          { label: 'Enseignants', value: staff.filter((s) => s.category === 'PEDAGOGICAL').length },
          { label: 'Administratifs', value: staff.filter((s) => s.category === 'ADMIN').length },
          { label: 'Non déclarés CNSS', value: staff.filter((s) => s.cnssStatus === 'NOT_DECLARED').length },
        ].map((k, i) => (
          <div key={i} className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{k.label}</p>
            <p className="text-xl font-bold text-slate-900 mt-0.5">{k.value}</p>
          </div>
        ))}
      </div>

      {/* Error banner with retry */}
      {staffError && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-rose-100 p-2">
              <AlertCircle className="h-5 w-5 text-rose-600" />
            </div>
            <div>
              <p className="text-sm font-bold text-rose-900">Impossible de charger le personnel</p>
              <p className="text-xs text-rose-600 mt-0.5">{staffError}</p>
            </div>
          </div>
          <button
            onClick={handleRetry}
            disabled={isRetrying}
            className="flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-xs font-bold text-white hover:bg-rose-700 disabled:opacity-50 transition shrink-0"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', isRetrying && 'animate-spin')} />
            Réessayer
          </button>
        </div>
      )}

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-56 rounded-xl border border-slate-200 bg-slate-100 animate-pulse" />
          ))}
        </div>
      ) : filteredStaff.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/30 p-16 text-center">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm mb-4">
            <Users className="h-10 w-10 text-slate-300" />
          </div>
          <h3 className="text-base font-bold text-slate-800">Aucun collaborateur trouvé</h3>
          <p className="text-sm text-slate-500 mt-2 max-w-sm">
            Ajustez vos filtres ou commencez par ajouter un nouveau membre.
          </p>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="mt-5 flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:opacity-90 transition"
            style={{ backgroundColor: PRIMARY }}
          >
            <Plus className="h-4 w-4" /> Ajouter un collaborateur
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredStaff.map((member, idx) => (
            <StaffCard
              key={member.id}
              member={member}
              index={idx}
              onTerminate={handleTerminate}
              onReactivate={(id) => setReactivateId(id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function StaffCard({
  member,
  index,
  onTerminate,
  onReactivate,
}: {
  member: any;
  index: number;
  onTerminate: (member: any) => void;
  onReactivate: (id: string) => void;
}) {
  const status = STATUS_CONFIG[member.status] || STATUS_CONFIG.INACTIVE;
  const isInactive = member.status === 'INACTIVE' && member.terminationType;
  const terminationLabel = TERMINATION_TYPE_LABELS[member.terminationType] || member.terminationType;

  // Collect document badges from the documents array
  const docTypes = [...new Set<string>((member.documents || []).map((d: any) => d.documentType as string))];
  const docBadges = docTypes.length > 0
    ? docTypes.slice(0, 4).map((t) => {
        const shortMap: Record<string, string> = {
          CV: 'CV', CNI: 'CNI', PASSPORT: 'PSP', BIRTH_CERTIFICATE: 'NAI',
          DIPLOMA: 'DIP', CERTIFICATE: 'CERT', CONTRACT: 'CTR',
          CNSS_CERTIFICATE: 'CNSS', MEDICAL_CERTIFICATE: 'MED', WORK_PERMIT: 'AUT',
        };
        return shortMap[t] || t.slice(0, 3);
      })
    : ['CNI', 'DIP', 'CNSS']; // placeholder badges

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      className={cn(
        'group rounded-xl border bg-white shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 overflow-hidden',
        isInactive ? 'border-rose-200' : 'border-slate-200',
      )}
    >
      <div className="p-5">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            {/* Photo or Initials */}
            {member.photoUrl ? (
              <img
                src={member.photoUrl}
                alt={`${member.firstName} ${member.lastName}`}
                className="w-12 h-12 rounded-xl object-cover shadow-sm"
              />
            ) : (
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center text-base font-bold shadow-sm"
                style={{ backgroundColor: isInactive ? '#FEE2E2' : PRIMARY + '15', color: isInactive ? '#DC2626' : PRIMARY }}
              >
                {member.firstName?.[0]}{member.lastName?.[0]}
              </div>
            )}
            <div>
              <h4 className="font-bold text-slate-900 text-sm leading-tight group-hover:text-[#1A2BA6] transition-colors">
                {member.firstName} {member.lastName}
              </h4>
              {/* Dual Matricules */}
              <div className="space-y-0.5 mt-0.5">
                {member.tenantMatricule ? (
                  <div className="flex items-center gap-1">
                    <Building2 className="h-2.5 w-2.5 text-emerald-500" />
                    <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">
                      {member.tenantMatricule}
                    </p>
                  </div>
                ) : member.globalMatricule ? (
                  <div className="flex items-center gap-1">
                    <Globe className="h-2.5 w-2.5 text-blue-500" />
                    <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: PRIMARY }}>
                      {member.globalMatricule}
                    </p>
                  </div>
                ) : (
                  <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: PRIMARY }}>
                    {member.staffCode || 'MAT-PENDING'}
                  </p>
                )}
              </div>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <span className={cn('px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase', status.className)}>
              {status.label}
            </span>
            {isInactive && terminationLabel && (
              <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-rose-50 text-rose-600 border border-rose-200">
                {terminationLabel}
              </span>
            )}
          </div>
        </div>
        <div className="space-y-2 mb-4">
          {[
            { icon: Briefcase, text: member.position || 'Poste non défini' },
            { icon: GraduationCap, text: CATEGORY_LABEL[member.category] || member.category },
            ...(member.phone ? [{ icon: Phone, text: member.phone }] : []),
          ].map(({ icon: Icon, text }, i) => (
            <div key={i} className="flex items-center gap-2.5 text-sm text-slate-600">
              <div className="w-7 h-7 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center">
                <Icon className="h-3.5 w-3.5 text-slate-400" />
              </div>
              <span className="truncate">{text}</span>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between pt-4 border-t border-slate-100">
          <div className="flex gap-1.5">
            {docBadges.map((doc, i) => (
              <span key={i} className="px-1.5 py-0.5 text-[9px] font-bold uppercase rounded border border-slate-200 text-slate-400 bg-slate-50">
                {doc}
              </span>
            ))}
          </div>
          <div className="flex items-center gap-2">
            {/* Terminate or Reactivate button */}
            {member.status === 'ACTIVE' ? (
              <button
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); onTerminate(member); }}
                className="flex items-center gap-1 text-[10px] font-bold text-rose-600 hover:text-rose-800 px-2 py-1 rounded-lg hover:bg-rose-50 transition"
                title="Procéder à la débauche"
              >
                <UserX className="h-3 w-3" /> Débauche
              </button>
            ) : isInactive ? (
              <button
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); onReactivate(member.id); }}
                className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 hover:text-emerald-800 px-2 py-1 rounded-lg hover:bg-emerald-50 transition"
                title="Réactiver le collaborateur"
              >
                <UserCheck className="h-3 w-3" /> Réactiver
              </button>
            ) : null}
            <Link
              href={`/app/hr/staff/${member.id}`}
              className="text-xs font-bold hover:underline"
              style={{ color: PRIMARY }}
            >
              Gérer la fiche →
            </Link>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
