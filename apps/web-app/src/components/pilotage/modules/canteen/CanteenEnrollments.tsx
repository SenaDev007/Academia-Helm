/**
 * ============================================================================
 * CANTEEN ENROLLMENTS — Branché sur backend réel
 * ============================================================================
 *
 * Endpoint (lecture)   : GET  /modules-complementaires/canteen/enrollments
 * Endpoint (création)  : POST /modules-complementaires/canteen/enrollments
 * Endpoint (validation): PUT  /modules-complementaires/canteen/enrollments/:id/validate
 * ============================================================================
 */

import React, { useState } from 'react';
import {
  Search, Filter,
  CheckCircle2, XCircle, Clock,
  Calendar, CreditCard, ChevronRight,
  Plus, AlertTriangle, Loader2
} from 'lucide-react';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useModulesList } from '@/lib/modules-complementaires/hooks';
import { modulesApi, buildModulesApiOptions } from '@/lib/modules-complementaires/client';

interface EnrollmentItem {
  id: string;
  date?: string;
  requestDate?: string;
  createdAt?: string;
  student?: string;
  studentName?: string;
  class?: string;
  className?: string;
  parent?: string;
  parentName?: string;
  plan?: string;
  subscriptionPlan?: string;
  diet?: string;
  dietType?: string;
  allergy?: string;
  allergies?: string;
  status?: string;
  [key: string]: any;
}

interface NewEnrollmentFormData {
  studentId: string;
  regime: string;
}

const emptyEnrollmentForm: NewEnrollmentFormData = { studentId: '', regime: 'STANDARD' };

export default function CanteenEnrollments() {
  const { academicYear } = useModuleContext();
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [formData, setFormData] = useState<NewEnrollmentFormData>(emptyEnrollmentForm);
  const [submitting, setSubmitting] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const { data: enrollments, loading, error, refetch } = useModulesList<EnrollmentItem>(
    'canteen',
    'enrollments',
    academicYear?.id,
    search ? { search } : undefined,
  );

  const handleCreate = async () => {
    try {
      setSubmitting(true);
      await modulesApi.post(
        'canteen/enrollments',
        formData,
        buildModulesApiOptions(academicYear?.id),
      );
      setModalOpen(false);
      setFormData(emptyEnrollmentForm);
      await refetch();
    } catch (e: any) {
      console.error('Erreur création inscription :', e?.message || e);
      alert(e?.message || 'Erreur lors de la création de l\'inscription');
    } finally {
      setSubmitting(false);
    }
  };

  const handleValidate = async (enrollmentId: string) => {
    try {
      setActionLoading(enrollmentId);
      await modulesApi.put(
        `canteen/enrollments/${enrollmentId}/validate`,
        {},
        buildModulesApiOptions(academicYear?.id),
      );
      await refetch();
    } catch (e: any) {
      console.error('Erreur validation inscription :', e?.message || e);
      alert(e?.message || 'Erreur lors de la validation de l\'inscription');
    } finally {
      setActionLoading(null);
    }
  };

  const pendingCount = enrollments.filter((e) => (e.status ?? '').toLowerCase().includes('attente') || (e.status ?? '').toLowerCase().includes('pending')).length;
  const acceptedCount = enrollments.filter((e) => (e.status ?? '').toLowerCase().includes('valid') || (e.status ?? '').toLowerCase().includes('accept')).length;
  const acceptanceRate = enrollments.length > 0 ? Math.round((acceptedCount / enrollments.length) * 100) : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        <span className="ml-2 text-gray-600">Chargement des inscriptions...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {error && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          ⚠ Impossible de charger les données. {error}
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <SummaryCard
          title="Demandes en attente"
          value={String(pendingCount)}
          icon={Clock}
          color="amber"
        />
        <SummaryCard
          title="Inscriptions (Total)"
          value={String(enrollments.length)}
          icon={Plus}
          color="blue"
        />
        <SummaryCard
          title="Taux d'Acceptation"
          value={`${acceptanceRate}%`}
          icon={CheckCircle2}
          color="green"
        />
      </div>

      <div className="bg-white rounded-3xl border border-gray-100 shadow-xl shadow-gray-200/50 overflow-hidden">
        <div className="p-8 border-b border-gray-50 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <h3 className="font-black text-navy-900 text-xl tracking-tight">Gestion des Inscriptions</h3>
            <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mt-1">Validez les demandes d'accès à la restauration</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative group">
              <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-navy-600 transition-colors" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Élève, parent, classe..."
                className="pl-11 pr-4 py-2.5 bg-gray-50/50 border border-gray-100 rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-navy-500/20 w-64 transition-all"
              />
            </div>
            <button className="flex items-center space-x-2 px-4 py-2.5 bg-white border border-gray-100 text-gray-500 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:border-navy-200 hover:text-navy-600 transition-all shadow-sm">
              <Filter className="w-4 h-4" />
              <span>Filtres</span>
            </button>
            <button
              onClick={() => setModalOpen(true)}
              className="flex items-center space-x-2 px-6 py-2.5 bg-navy-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-navy-800 transition-all shadow-xl shadow-navy-900/20"
            >
              <Plus className="w-4 h-4" />
              <span>Inscrire un élève</span>
            </button>
          </div>
        </div>

        {enrollments.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            Aucune inscription pour cette année scolaire.
          </div>
        ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50/50">
                <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Date Demande</th>
                <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Élève & Parent</th>
                <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Abonnement</th>
                <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Régime / Allergies</th>
                <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Statut</th>
                <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {enrollments.map((enr) => (
                <EnrollmentRow
                  key={enr.id}
                  enrollmentId={enr.id}
                  date={enr.date ?? enr.requestDate ?? enr.createdAt ?? '—'}
                  student={enr.student ?? enr.studentName ?? '—'}
                  class={enr.class ?? enr.className ?? '—'}
                  parent={enr.parent ?? enr.parentName ?? '—'}
                  plan={enr.plan ?? enr.subscriptionPlan ?? '—'}
                  diet={enr.diet ?? enr.dietType ?? 'Standard'}
                  allergy={enr.allergy ?? enr.allergies}
                  status={enr.status ?? 'En attente'}
                  onValidate={() => handleValidate(enr.id)}
                  actionLoading={actionLoading}
                />
              ))}
            </tbody>
          </table>
        </div>
        )}
      </div>

      {/* Modal Inscrire un élève */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full space-y-4">
            <h3 className="text-lg font-black text-navy-900">Inscrire un élève</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Élève (ID)</label>
                <input
                  type="text"
                  placeholder="ex : student-123"
                  value={formData.studentId}
                  onChange={(e) => setFormData({ ...formData, studentId: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Régime alimentaire</label>
                <select
                  value={formData.regime}
                  onChange={(e) => setFormData({ ...formData, regime: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500/20"
                >
                  <option value="STANDARD">Standard</option>
                  <option value="VEGETARIEN">Végétarien</option>
                  <option value="SANS_PORC">Sans porc</option>
                  <option value="SANS_GLUTEN">Sans gluten</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <button
                onClick={() => setModalOpen(false)}
                disabled={submitting}
                className="px-4 py-2 border border-slate-200 rounded-lg text-sm font-bold hover:bg-slate-50"
              >
                Annuler
              </button>
              <button
                onClick={handleCreate}
                disabled={submitting}
                className="px-4 py-2 bg-navy-900 text-white rounded-lg text-sm font-bold disabled:opacity-50"
              >
                {submitting ? 'Envoi…' : 'Inscrire'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryCard({ title, value, icon: Icon, color }: any) {
  const colors: any = {
    amber: 'bg-amber-50 text-amber-600 border-amber-100',
    blue: 'bg-blue-50 text-blue-600 border-blue-100',
    green: 'bg-emerald-50 text-emerald-600 border-emerald-100',
  };
  return (
    <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex items-center space-x-6">
      <div className={`p-4 rounded-2xl ${colors[color]}`}>
        <Icon className="w-6 h-6" />
      </div>
      <div>
        <p className="text-gray-400 text-[10px] font-black uppercase tracking-widest">{title}</p>
        <p className="text-2xl font-black text-navy-900 mt-1">{value}</p>
      </div>
    </div>
  );
}

function EnrollmentRow({ enrollmentId, date, student, class: className, parent, plan, diet, allergy, status, onValidate, actionLoading }: any) {
  const statusStyles: any = {
    'En attente': 'bg-amber-50 text-amber-600 border-amber-100',
    'Validé': 'bg-emerald-50 text-emerald-600 border-emerald-100',
    'Rejeté': 'bg-red-50 text-red-600 border-red-100',
  };
  const statusStyle = statusStyles[status] ?? statusStyles['En attente'];
  const isLoading = actionLoading === enrollmentId;

  return (
    <tr className="group hover:bg-navy-50/30 transition-all duration-300">
      <td className="px-8 py-6">
        <div className="flex items-center space-x-2">
          <Calendar className="w-3.5 h-3.5 text-gray-400" />
          <p className="text-xs font-bold text-navy-900">{date}</p>
        </div>
      </td>
      <td className="px-8 py-6">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center text-gray-500 font-black text-xs group-hover:bg-white transition-colors">
            {typeof student === 'string' ? student.split(' ').map((n: string) => n[0]).join('') : '—'}
          </div>
          <div>
            <p className="text-sm font-black text-navy-900">{student}</p>
            <div className="flex items-center space-x-2 mt-0.5">
              <span className="text-[10px] font-bold text-navy-500 uppercase tracking-tighter">{className}</span>
              <span className="text-[10px] font-medium text-gray-400">| {parent}</span>
            </div>
          </div>
        </div>
      </td>
      <td className="px-8 py-6">
        <div className="flex items-center space-x-2">
          <CreditCard className="w-3.5 h-3.5 text-navy-400" />
          <p className="text-xs font-black text-navy-900 uppercase tracking-wider">{plan}</p>
        </div>
      </td>
      <td className="px-8 py-6">
        <div className="space-y-1">
          <p className="text-xs font-bold text-gray-600">{diet}</p>
          {allergy && (
            <div className="flex items-center space-x-1 text-[9px] font-black text-red-500 uppercase bg-red-50 px-2 py-0.5 rounded border border-red-100 w-fit">
              <AlertTriangle className="w-2.5 h-2.5" />
              <span>{allergy}</span>
            </div>
          )}
        </div>
      </td>
      <td className="px-8 py-6">
        <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase border w-fit ${statusStyle}`}>
          {status}
        </div>
      </td>
      <td className="px-8 py-6 text-right">
        <div className="flex items-center justify-end space-x-2">
          {status === 'En attente' ? (
            <>
              <button
                onClick={onValidate}
                disabled={isLoading}
                className="px-4 py-1.5 bg-emerald-500 text-white rounded-xl text-[10px] font-black uppercase hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50"
              >
                {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                {isLoading ? '…' : 'Valider'}
              </button>
              <button className="p-2 text-gray-400 hover:text-red-500 hover:bg-white rounded-xl transition-all border border-transparent hover:border-gray-100"><XCircle className="w-4 h-4" /></button>
            </>
          ) : (
            <button className="p-2 text-gray-400 hover:text-navy-600 hover:bg-white rounded-xl transition-all border border-transparent hover:border-gray-100">
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}
