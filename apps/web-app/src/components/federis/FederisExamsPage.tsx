/**
 * FederisExamsPage — Examens nationaux (Academia Federis)
 *
 * Données réelles via GET /federis/exams (année scolaire active du patronat).
 * Création (POST /federis/exams) et changement de statut (PATCH) réservés au
 * coordonnateur et à l'organisateur (canWrite 'exam_org' — la garde finale
 * est appliquée par l'API). Liens croisés vers Centres et Candidats.
 */

'use client';

import { useState } from 'react';
import Link from 'next/link';
import AppIcon from '@/components/ui/AppIcon';
import { cn } from '@/lib/utils';
import { apiClient } from '@/lib/api/client';
import { useFederisPath } from '@/lib/federis/useFederisPath';
import { canWrite } from '@/lib/patronat/permissions';
import {
  useFederisExams,
  EXAM_STATUS_LABELS,
  EXAM_STATUS_STYLES,
} from '@/hooks/useFederisExams';
import { FedPage } from '@/components/federis/federis-motion';

interface FederisExamsPageProps {
  tenantId?: string;
  /** User.role de la session — normalisé pour les gardes d'écriture UI */
  userRole?: string | null;
}

const LEVELS = ['CM2', '3EME', 'TERMINALE'];

export default function FederisExamsPage({ userRole }: FederisExamsPageProps) {
  const { path: federisPath } = useFederisPath();
  const { exams, academicYear, loading, error, reload } = useFederisExams();
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState({
    code: '',
    name: '',
    examType: 'NATIONAL',
    level: 'CM2',
    startDate: '',
    endDate: '',
    description: '',
  });

  const canOrganize = canWrite(userRole, 'exam_org');

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setFormError(null);
    try {
      await apiClient.post('/federis/exams', form, { timeout: 20000 });
      setShowCreate(false);
      setForm({ code: '', name: '', examType: 'NATIONAL', level: 'CM2', startDate: '', endDate: '', description: '' });
      await reload();
    } catch (err: any) {
      setFormError(err?.response?.data?.message ?? 'Création impossible.');
    } finally {
      setCreating(false);
    }
  };

  const changeStatus = async (examId: string, status: string) => {
    try {
      await apiClient.patch(`/federis/exams/${examId}`, { status }, { timeout: 20000 });
      await reload();
    } catch (err: any) {
      setFormError(err?.response?.data?.message ?? 'Modification impossible.');
    }
  };

  return (
    <FedPage className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="fed-badge mb-3">Module examens</div>
          <h1 className="text-2xl md:text-3xl font-bold text-blue-900 tracking-tight">Examens nationaux</h1>
          <p className="text-slate-500 font-medium mt-1 text-sm">
            {academicYear
              ? `Campagnes de l'année scolaire ${academicYear}`
              : 'Gérez vos campagnes d\u2019examens inter-écoles'}
          </p>
        </div>
        {canOrganize && (
          <button
            onClick={() => setShowCreate((v) => !v)}
            className="fed-btn-gold px-4 py-2.5 text-sm"
          >
            <AppIcon name={showCreate ? 'close' : 'add'} size="submenu" />
            {showCreate ? 'Fermer' : 'Créer un examen'}
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-6 py-4 text-sm font-semibold text-red-800">
          {error}
        </div>
      )}
      {formError && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-6 py-4 text-sm font-semibold text-red-800">
          {formError}
        </div>
      )}

      {/* Formulaire de création */}
      {showCreate && canOrganize && (
        <form onSubmit={handleCreate} className="fed-card p-8 space-y-5">
          <h3 className="text-sm font-bold text-blue-900 uppercase">Nouvel examen</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-2">Code</label>
              <input required value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })}
                placeholder="CEP-2027" className="fed-input-light px-4 py-3 font-semibold" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-2">Nom</label>
              <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="CEP Patronal 2027" className="fed-input-light px-4 py-3 font-semibold" />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-2">Classe</label>
              <select value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value })}
                className="fed-input-light px-4 py-3 font-semibold">
                {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-2">Début</label>
              <input required type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                className="fed-input-light px-4 py-3 font-semibold" />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-2">Fin</label>
              <input required type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                className="fed-input-light px-4 py-3 font-semibold" />
            </div>
          </div>
          <div className="flex justify-end">
            <button type="submit" disabled={creating}
              className="fed-btn-gold px-8 py-3 text-sm disabled:opacity-50">
              {creating ? 'Création…' : 'Créer'}
            </button>
          </div>
        </form>
      )}

      {/* Liste des examens */}
      <div className="fed-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-[#f7f9fc]">
              <tr>
                <th className="px-6 py-3 text-left text-[10px] font-bold text-slate-400 uppercase">Examen</th>
                <th className="px-6 py-3 text-left text-[10px] font-bold text-slate-400 uppercase">Classe</th>
                <th className="px-6 py-3 text-left text-[10px] font-bold text-slate-400 uppercase">Dates</th>
                <th className="px-6 py-3 text-left text-[10px] font-bold text-slate-400 uppercase">Statut</th>
                <th className="px-6 py-3 text-center text-[10px] font-bold text-slate-400 uppercase">Centres</th>
                <th className="px-6 py-3 text-center text-[10px] font-bold text-slate-400 uppercase">Candidats</th>
                <th className="px-6 py-3 text-right text-[10px] font-bold text-slate-400 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {loading ? (
                <tr><td colSpan={7} className="px-6 py-10 text-center text-sm font-bold text-slate-400">Chargement…</td></tr>
              ) : exams.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-10 text-center text-sm font-bold text-slate-400">
                    Aucun examen pour l&apos;année scolaire active.
                    {canOrganize ? ' Créez votre première campagne.' : ''}
                  </td>
                </tr>
              ) : (
                exams.map((exam) => (
                  <tr key={exam.id} className="hover:bg-[#f7f9fc]">
                    <td className="px-6 py-4">
                      <div className="text-sm font-bold text-blue-900">{exam.name}</div>
                      <div className="text-[10px] font-bold text-slate-400 uppercase">{exam.code}</div>
                    </td>
                    <td className="px-6 py-4 text-sm font-bold text-blue-800">{exam.level}</td>
                    <td className="px-6 py-4 text-xs font-semibold text-slate-600">
                      {new Date(exam.startDate).toLocaleDateString('fr-FR')} → {new Date(exam.endDate).toLocaleDateString('fr-FR')}
                    </td>
                    <td className="px-6 py-4">
                      {canOrganize ? (
                        <select
                          value={exam.status}
                          onChange={(e) => changeStatus(exam.id, e.target.value)}
                          className={cn('px-2.5 py-1.5 rounded text-[10px] font-bold uppercase border-none outline-none cursor-pointer', EXAM_STATUS_STYLES[exam.status] ?? EXAM_STATUS_STYLES.DRAFT)}
                        >
                          {Object.keys(EXAM_STATUS_LABELS).map((s) => (
                            <option key={s} value={s}>{EXAM_STATUS_LABELS[s]}</option>
                          ))}
                        </select>
                      ) : (
                        <span className={cn('px-2.5 py-1.5 rounded text-[10px] font-bold uppercase inline-block', EXAM_STATUS_STYLES[exam.status] ?? EXAM_STATUS_STYLES.DRAFT)}>
                          {EXAM_STATUS_LABELS[exam.status] ?? exam.status}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center text-sm font-bold text-blue-900">{exam.centersCount}</td>
                    <td className="px-6 py-4 text-center text-sm font-bold text-blue-900">{exam.candidatesCount}</td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link href={federisPath(`/centers?exam=${exam.id}`)}
                          className="px-3 py-1.5 bg-blue-50 rounded-lg text-[11px] font-semibold text-blue-800 hover:bg-blue-800 hover:text-white transition-colors">
                          Centres
                        </Link>
                        <Link href={federisPath(`/candidates?exam=${exam.id}`)}
                          className="px-3 py-1.5 bg-blue-50 rounded-lg text-[11px] font-semibold text-blue-800 hover:bg-blue-800 hover:text-white transition-colors">
                          Candidats
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </FedPage>
  );
}
