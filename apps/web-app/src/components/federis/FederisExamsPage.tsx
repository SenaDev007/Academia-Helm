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
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-gray-900 italic tracking-tighter">Examens nationaux</h1>
          <p className="text-gray-500 font-medium mt-1">
            {academicYear
              ? `Campagnes de l'année scolaire ${academicYear}`
              : 'Gérez vos campagnes d\u2019examens inter-écoles'}
          </p>
        </div>
        {canOrganize && (
          <button
            onClick={() => setShowCreate((v) => !v)}
            className="px-5 py-3 bg-blue-900 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-lg hover:bg-blue-800 transition-all inline-flex items-center gap-2"
          >
            <AppIcon name={showCreate ? 'close' : 'add'} size="submenu" />
            {showCreate ? 'Fermer' : 'Créer un examen'}
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-2xl px-6 py-4 text-sm font-semibold text-red-800">
          {error}
        </div>
      )}
      {formError && (
        <div className="bg-red-50 border border-red-200 rounded-2xl px-6 py-4 text-sm font-semibold text-red-800">
          {formError}
        </div>
      )}

      {/* Formulaire de création */}
      {showCreate && canOrganize && (
        <form onSubmit={handleCreate} className="bg-white rounded-3xl border border-blue-100 shadow-lg p-8 space-y-5">
          <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest">Nouvel examen</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Code</label>
              <input required value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })}
                placeholder="CEP-2027" className="w-full px-4 py-3 bg-gray-50 rounded-xl text-sm font-semibold outline-none focus:ring-2 focus:ring-blue-900" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Nom</label>
              <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="CEP Patronal 2027" className="w-full px-4 py-3 bg-gray-50 rounded-xl text-sm font-semibold outline-none focus:ring-2 focus:ring-blue-900" />
            </div>
            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Classe</label>
              <select value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value })}
                className="w-full px-4 py-3 bg-gray-50 rounded-xl text-sm font-semibold outline-none focus:ring-2 focus:ring-blue-900">
                {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Début</label>
              <input required type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                className="w-full px-4 py-3 bg-gray-50 rounded-xl text-sm font-semibold outline-none focus:ring-2 focus:ring-blue-900" />
            </div>
            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Fin</label>
              <input required type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                className="w-full px-4 py-3 bg-gray-50 rounded-xl text-sm font-semibold outline-none focus:ring-2 focus:ring-blue-900" />
            </div>
          </div>
          <div className="flex justify-end">
            <button type="submit" disabled={creating}
              className="px-8 py-3.5 bg-blue-900 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-xl hover:bg-blue-800 transition-all disabled:opacity-50">
              {creating ? 'Création…' : 'Créer'}
            </button>
          </div>
        </form>
      )}

      {/* Liste des examens */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Examen</th>
                <th className="px-6 py-3 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Classe</th>
                <th className="px-6 py-3 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Dates</th>
                <th className="px-6 py-3 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Statut</th>
                <th className="px-6 py-3 text-center text-[10px] font-black text-gray-400 uppercase tracking-widest">Centres</th>
                <th className="px-6 py-3 text-center text-[10px] font-black text-gray-400 uppercase tracking-widest">Candidats</th>
                <th className="px-6 py-3 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr><td colSpan={7} className="px-6 py-10 text-center text-sm font-bold text-gray-400">Chargement…</td></tr>
              ) : exams.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-10 text-center text-sm font-bold text-gray-400">
                    Aucun examen pour l&apos;année scolaire active.
                    {canOrganize ? ' Créez votre première campagne.' : ''}
                  </td>
                </tr>
              ) : (
                exams.map((exam) => (
                  <tr key={exam.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="text-sm font-black text-gray-900">{exam.name}</div>
                      <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{exam.code}</div>
                    </td>
                    <td className="px-6 py-4 text-sm font-bold text-blue-900">{exam.level}</td>
                    <td className="px-6 py-4 text-xs font-semibold text-gray-600">
                      {new Date(exam.startDate).toLocaleDateString('fr-FR')} → {new Date(exam.endDate).toLocaleDateString('fr-FR')}
                    </td>
                    <td className="px-6 py-4">
                      {canOrganize ? (
                        <select
                          value={exam.status}
                          onChange={(e) => changeStatus(exam.id, e.target.value)}
                          className={cn('px-2.5 py-1.5 rounded text-[10px] font-black uppercase tracking-widest border-none outline-none cursor-pointer', EXAM_STATUS_STYLES[exam.status] ?? EXAM_STATUS_STYLES.DRAFT)}
                        >
                          {Object.keys(EXAM_STATUS_LABELS).map((s) => (
                            <option key={s} value={s}>{EXAM_STATUS_LABELS[s]}</option>
                          ))}
                        </select>
                      ) : (
                        <span className={cn('px-2.5 py-1.5 rounded text-[10px] font-black uppercase tracking-widest inline-block', EXAM_STATUS_STYLES[exam.status] ?? EXAM_STATUS_STYLES.DRAFT)}>
                          {EXAM_STATUS_LABELS[exam.status] ?? exam.status}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center text-sm font-black text-gray-900">{exam.centersCount}</td>
                    <td className="px-6 py-4 text-center text-sm font-black text-gray-900">{exam.candidatesCount}</td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link href={federisPath(`/centers?exam=${exam.id}`)}
                          className="px-3 py-1.5 bg-gray-50 rounded-lg text-[10px] font-black uppercase tracking-widest text-gray-600 hover:bg-blue-50 hover:text-blue-900 transition-all">
                          Centres
                        </Link>
                        <Link href={federisPath(`/candidates?exam=${exam.id}`)}
                          className="px-3 py-1.5 bg-gray-50 rounded-lg text-[10px] font-black uppercase tracking-widest text-gray-600 hover:bg-blue-50 hover:text-blue-900 transition-all">
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
    </div>
  );
}
