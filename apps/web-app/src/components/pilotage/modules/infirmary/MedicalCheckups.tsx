/**
 * ============================================================================
 * MEDICAL CHECKUPS TAB
 * ============================================================================
 */

'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Loader2, X } from 'lucide-react';
import {
  Calendar,
  Plus,
  Filter,
  Search,
  Users,
  CheckCircle2,
  Clock,
  ChevronRight,
  MoreVertical,
  Stethoscope
} from 'lucide-react';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useModulesList } from '@/lib/modules-complementaires/hooks';
import { modulesApi, buildModulesApiOptions } from '@/lib/modules-complementaires/client';

interface CheckupItem {
  id: string;
  title?: string;
  name?: string;
  date?: string;
  checkupDate?: string;
  time?: string;
  timeSlot?: string;
  location?: string;
  checkupLocation?: string;
  target?: string;
  targetAudience?: string;
  provider?: string;
  healthProvider?: string;
  status?: string;
  checkupStatus?: string;
  [key: string]: any;
}

export default function MedicalCheckups() {
  const { academicYear } = useModuleContext();
  const { data, loading, error, refetch } = useModulesList<CheckupItem>('infirmary', 'checkups', academicYear?.id);

  const checkups = data ?? [];

  const [modalOpen, setModalOpen] = useState(false);
  const [formData, setFormData] = useState({ studentId: '', type: 'GENERAL', results: '' });
  const [submitting, setSubmitting] = useState(false);

  const handleCreate = async () => {
    try {
      setSubmitting(true);
      await modulesApi.post('infirmary/checkups', formData, buildModulesApiOptions(academicYear?.id));
      setModalOpen(false);
      setFormData({ studentId: '', type: 'GENERAL', results: '' });
      await refetch();
    } catch (e: any) {
      alert(e?.response?.data?.message || e?.message || 'Erreur lors de la création du bilan');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        <span className="ml-2 text-slate-600">Chargement...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          ⚠ Impossible de charger les données. {error}
        </div>
      )}

      {/* Action Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-2">
          <button
            onClick={() => { setFormData({ studentId: '', type: 'GENERAL', results: '' }); setModalOpen(true); }}
            className="px-6 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-black flex items-center hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200"
          >
            <Plus className="w-4 h-4 mr-2" />
            Nouveau Bilan
          </button>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Rechercher une campagne..."
              className="pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20 w-64"
            />
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button className="p-2.5 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors">
            <Filter className="w-4 h-4 text-slate-600" />
          </button>
        </div>
      </div>

      {/* Checkups List */}
      {checkups.length === 0 ? (
        <div className="text-center py-16 text-slate-500">
          Aucune donnée disponible pour cette année scolaire.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {checkups.map((checkup, i) => {
            const title = checkup.title || checkup.name || `Campagne ${checkup.id}`;
            const date = checkup.date || checkup.checkupDate || '—';
            const time = checkup.time || checkup.timeSlot || '';
            const location = checkup.location || checkup.checkupLocation || '—';
            const target = checkup.target || checkup.targetAudience || '—';
            const provider = checkup.provider || checkup.healthProvider || '—';
            const status = (checkup.status || checkup.checkupStatus || 'PLANNED').toUpperCase();
            const isCompleted = status === 'COMPLETED';
            return (
              <motion.div
                key={checkup.id ?? i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition-all group"
              >
                <div className="flex justify-between items-start mb-6">
                  <div className={`p-3 rounded-2xl ${isCompleted ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'}`}>
                    <Stethoscope className="w-6 h-6" />
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className={`text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest ${
                      isCompleted ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'
                    }`}>
                      {isCompleted ? 'Terminé' : 'À venir'}
                    </span>
                    <button className="p-1 hover:bg-slate-100 rounded-lg text-slate-400">
                      <MoreVertical className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <h3 className="text-lg font-black text-slate-900 mb-2 group-hover:text-blue-600 transition-colors">{title}</h3>

                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="space-y-1">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Date & Heure</p>
                    <div className="flex items-center text-sm font-bold text-slate-700">
                      <Calendar className="w-3.5 h-3.5 mr-2 text-slate-400" />
                      {date}
                    </div>
                    {time && (
                      <div className="flex items-center text-xs font-medium text-slate-500 pl-5">
                        {time}
                      </div>
                    )}
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Cible</p>
                    <div className="flex items-center text-sm font-bold text-slate-700">
                      <Users className="w-3.5 h-3.5 mr-2 text-slate-400" />
                      {target}
                    </div>
                    <p className="text-[10px] text-slate-400 pl-5">{provider}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-slate-50">
                  <div className="flex items-center text-xs font-medium text-slate-500">
                    <CheckCircle2 className="w-4 h-4 mr-2 text-emerald-500" />
                    {isCompleted ? 'Rapport validé' : '0% élèves examinés'}
                  </div>
                  <button className="text-blue-600 text-sm font-black flex items-center hover:translate-x-1 transition-transform">
                    {isCompleted ? 'Voir Résultats' : 'Gérer la Visite'}
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold">Nouveau bilan de santé</h3>
              <button onClick={() => setModalOpen(false)} className="p-1 text-slate-400 hover:text-slate-900">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase">Student ID</label>
                <input
                  type="text"
                  value={formData.studentId}
                  onChange={(e) => setFormData({ ...formData, studentId: e.target.value })}
                  className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg text-sm"
                  placeholder="student-001"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase">Type de bilan</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg text-sm"
                >
                  <option value="GENERAL">Bilan général</option>
                  <option value="VISION">Vision</option>
                  <option value="HEARING">Audition</option>
                  <option value="DENTAL">Bilan dentaire</option>
                  <option value="SCOLIOSIS">Dépistage scoliose</option>
                  <option value="BMI">IMC / Croissance</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase">Résultats</label>
                <textarea
                  value={formData.results}
                  onChange={(e) => setFormData({ ...formData, results: e.target.value })}
                  className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg text-sm"
                  rows={3}
                  placeholder="Détails des résultats du bilan"
                />
              </div>
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <button onClick={() => setModalOpen(false)} className="px-4 py-2 border border-slate-200 rounded-lg text-sm font-bold">
                Annuler
              </button>
              <button
                onClick={handleCreate}
                disabled={submitting}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold disabled:opacity-50"
              >
                {submitting ? 'Envoi...' : 'Créer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
