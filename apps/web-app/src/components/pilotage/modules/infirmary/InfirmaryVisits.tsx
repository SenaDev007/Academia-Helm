/**
 * ============================================================================
 * INFIRMARY VISITS TAB
 * ============================================================================
 */

'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Loader2, X } from 'lucide-react';
import {
  Plus,
  Search,
  Calendar as CalendarIcon,
  Filter,
  CheckCircle2,
  Clock,
  ExternalLink,
  UserCheck,
  Home,
  AlertTriangle,
} from 'lucide-react';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useModulesList } from '@/lib/modules-complementaires/hooks';
import { modulesApi, buildModulesApiOptions } from '@/lib/modules-complementaires/client';

interface VisitItem {
  id: string;
  student?: string;
  studentName?: string;
  class?: string;
  className?: string;
  time?: string;
  visitTime?: string;
  reason?: string;
  visitReason?: string;
  action?: string;
  actionTaken?: string;
  status?: string;
  visitStatus?: string;
  [key: string]: any;
}

const STATUS_META: Record<string, { icon: any; color: string; statusLabel: string }> = {
  IN_PROGRESS: { icon: Clock, color: 'text-amber-600 bg-amber-50 border-amber-100', statusLabel: 'En observation' },
  COMPLETED: { icon: UserCheck, color: 'text-emerald-600 bg-emerald-50 border-emerald-100', statusLabel: 'Retour en classe' },
  TRANSFERRED: { icon: Home, color: 'text-rose-600 bg-rose-50 border-rose-100', statusLabel: 'Transféré / Foyer' },
  EMERGENCY: { icon: AlertTriangle, color: 'text-red-700 bg-red-50 border-red-200', statusLabel: 'Urgence Vitale' },
};

export default function InfirmaryVisits() {
  const { academicYear } = useModuleContext();
  const { data, loading, error, refetch } = useModulesList<VisitItem>('infirmary', 'visits', academicYear?.id);

  const visits = data ?? [];

  const [modalOpen, setModalOpen] = useState(false);
  const [formData, setFormData] = useState({ studentId: '', reason: '', symptoms: '' });
  const [submitting, setSubmitting] = useState(false);

  const handleCreate = async () => {
    try {
      setSubmitting(true);
      await modulesApi.post('infirmary/visits', formData, buildModulesApiOptions(academicYear?.id));
      setModalOpen(false);
      setFormData({ studentId: '', reason: '', symptoms: '' });
      await refetch();
    } catch (e: any) {
      alert(e?.response?.data?.message || e?.message || 'Erreur lors de la création de la visite');
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
            onClick={() => { setFormData({ studentId: '', reason: '', symptoms: '' }); setModalOpen(true); }}
            className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold flex items-center hover:bg-blue-700 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4 mr-2" />
            Nouveau Passage
          </button>
          <button className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors">
            <CalendarIcon className="w-4 h-4 mr-2 inline" />
            Aujourd'hui
          </button>
        </div>

        <div className="flex items-center space-x-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Rechercher une visite..."
              className="pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
          <button className="p-2 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors">
            <Filter className="w-4 h-4 text-slate-600" />
          </button>
        </div>
      </div>

      {/* Visits Log */}
      {visits.length === 0 ? (
        <div className="text-center py-16 text-slate-500">
          Aucune donnée disponible pour cette année scolaire.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {visits.map((visit, i) => {
            const status = visit.status || visit.visitStatus || 'IN_PROGRESS';
            const meta = STATUS_META[status] ?? STATUS_META.IN_PROGRESS;
            const Icon = meta.icon;
            const student = visit.student || visit.studentName || `Élève ${visit.id}`;
            const className = visit.class || visit.className || '';
            const time = visit.time || visit.visitTime || '—';
            const reason = visit.reason || visit.visitReason || '—';
            const action = visit.action || visit.actionTaken || '—';
            return (
              <motion.div
                key={visit.id ?? i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className={`p-5 rounded-2xl border bg-white shadow-sm hover:shadow-md transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 border-l-4 ${meta.color.split(' ')[2]}`}
              >
                <div className="flex items-start space-x-4">
                  <div className={`mt-1 p-2 rounded-xl ${meta.color.split(' ')[0]} ${meta.color.split(' ')[1]}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <h4 className="font-bold text-slate-900">{student}</h4>
                      <span className="text-xs font-medium text-slate-400">• {time}</span>
                    </div>
                    <p className="text-xs text-slate-500 font-medium mb-2">{className}</p>
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm text-slate-700"><span className="font-bold">Motif:</span> {reason}</p>
                      <p className="text-sm text-slate-600 italic"><span className="font-bold not-italic">Action:</span> {action}</p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between md:justify-end gap-3 pt-4 md:pt-0 border-t md:border-t-0 border-slate-100">
                  <div className="text-right">
                    <span className={`text-[10px] uppercase tracking-widest font-black px-3 py-1 rounded-full ${meta.color.split(' ')[0]} ${meta.color.split(' ')[1]}`}>
                      {meta.statusLabel}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-blue-600 transition-colors">
                      <ExternalLink className="w-4 h-4" />
                    </button>
                    <button className="px-4 py-2 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl text-xs font-bold transition-colors">
                      Détails
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      <button className="w-full py-4 border-2 border-dashed border-slate-200 rounded-2xl text-slate-400 text-sm font-bold hover:border-slate-300 hover:text-slate-500 transition-all">
        Afficher les visites des jours précédents
      </button>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold">Nouvelle visite</h3>
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
                <label className="text-xs font-bold text-slate-500 uppercase">Motif de visite</label>
                <input
                  type="text"
                  value={formData.reason}
                  onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                  className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg text-sm"
                  placeholder="Maux de tête"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase">Symptômes</label>
                <textarea
                  value={formData.symptoms}
                  onChange={(e) => setFormData({ ...formData, symptoms: e.target.value })}
                  className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg text-sm"
                  rows={3}
                  placeholder="Description des symptômes"
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
