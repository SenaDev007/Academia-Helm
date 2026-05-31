'use client';

import { useState, useEffect } from 'react';
import {
  Plus, Search, Phone, Briefcase, GraduationCap,
  Users, Loader2,
} from 'lucide-react';
import { useModuleContext } from '@/hooks/useModuleContext';
import { apiFetch } from '@/lib/api/client';
import Link from 'next/link';
import { OnboardingWizardModal } from '../modals/OnboardingWizardModal';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

const PRIMARY = '#1A2BA6';

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  ACTIVE:    { label: 'En poste',  className: 'bg-emerald-50 text-emerald-700 border border-emerald-200' },
  INACTIVE:  { label: 'Inactif',   className: 'bg-slate-100 text-slate-500 border border-slate-200' },
  SUSPENDED: { label: 'Suspendu', className: 'bg-amber-50 text-amber-700 border border-amber-200' },
};

const CATEGORY_LABEL: Record<string, string> = {
  PEDAGOGICAL: 'Corps Enseignant',
  ADMIN: 'Administration',
  SUPPORT: "Personnel d'appui",
};

export function StaffWorkspace() {
  const { tenant } = useModuleContext();
  const [staff, setStaff] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ACTIVE');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  useEffect(() => { fetchStaff(); }, [tenant?.id, filterCategory, filterStatus]);

  async function fetchStaff() {
    if (!tenant?.id) return;
    try {
      setLoading(true);
      let url = `/hr/staff?tenantId=${tenant.id}`;
      if (filterCategory !== 'ALL') url += `&category=${filterCategory}`;
      if (filterStatus !== 'ALL') url += `&status=${filterStatus}`;
      const result = await apiFetch<any[]>(url);
      setStaff(result);
    } catch (error) {
      console.error('Error fetching staff:', error);
    } finally {
      setLoading(false);
    }
  }

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
            <StaffCard key={member.id} member={member} index={idx} />
          ))}
        </div>
      )}
    </div>
  );
}

function StaffCard({ member, index }: { member: any; index: number }) {
  const status = STATUS_CONFIG[member.status] || STATUS_CONFIG.INACTIVE;
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      className="group rounded-xl border border-slate-200 bg-white shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 overflow-hidden"
    >
      <div className="p-5">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center text-base font-bold shadow-sm"
              style={{ backgroundColor: PRIMARY + '15', color: PRIMARY }}
            >
              {member.firstName?.[0]}{member.lastName?.[0]}
            </div>
            <div>
              <h4 className="font-bold text-slate-900 text-sm leading-tight group-hover:text-[#1A2BA6] transition-colors">
                {member.firstName} {member.lastName}
              </h4>
              <p className="text-[10px] font-bold uppercase tracking-wider mt-0.5" style={{ color: PRIMARY }}>
                {member.staffCode || 'MAT-PENDING'}
              </p>
            </div>
          </div>
          <span className={cn('px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase', status.className)}>
            {status.label}
          </span>
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
            {['CNI', 'DIP', 'CNSS'].map((doc) => (
              <span key={doc} className="px-1.5 py-0.5 text-[9px] font-bold uppercase rounded border border-slate-200 text-slate-400 bg-slate-50">
                {doc}
              </span>
            ))}
          </div>
          <Link
            href={`/app/hr/staff/${member.id}`}
            className="text-xs font-bold hover:underline"
            style={{ color: PRIMARY }}
          >
            Gérer la fiche →
          </Link>
        </div>
      </div>
    </motion.div>
  );
}
