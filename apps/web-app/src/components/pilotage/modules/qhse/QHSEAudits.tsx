/**
 * ============================================================================
 * QHSE AUDITS & INSPECTIONS
 * ============================================================================
 */

'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { ClipboardList, Calendar, User, Star, ArrowUpRight, CheckCircle2, Search, Filter, Plus, ChevronRight, Loader2, X, Flag } from 'lucide-react';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useModulesList } from '@/lib/modules-complementaires/hooks';
import { modulesApi, buildModulesApiOptions } from '@/lib/modules-complementaires/client';

interface AuditItem {
  id: string;
  title?: string;
  name?: string;
  type?: string;
  category?: string;
  date?: string;
  auditDate?: string;
  auditor?: string;
  auditedBy?: string;
  score?: number | null;
  status?: string;
}

const EMPTY_FORM = { auditId: '', description: '', severity: 'MOYEN' };

export default function QHSEAudits() {
  const { academicYear } = useModuleContext();
  const { data: audits, loading, error, refetch } = useModulesList<AuditItem>('qhse', 'audits', academicYear?.id);

  const [modalOpen, setModalOpen] = useState(false);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  const handleAddFinding = async () => {
    if (!formData.auditId || !formData.description) {
      alert('L\'ID audit et la description sont requis');
      return;
    }
    try {
      setSubmitting(true);
      await modulesApi.post(
        `qhse/audits/${formData.auditId}/findings`,
        { description: formData.description, severity: formData.severity },
        buildModulesApiOptions(academicYear?.id),
      );
      setModalOpen(false);
      setFormData(EMPTY_FORM);
      await refetch();
    } catch (e: any) {
      alert(e?.message || 'Erreur lors de l\'ajout du constat');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        <span className="ml-2 text-slate-600">Chargement des audits...</span>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {error && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          ⚠ Impossible de charger les données. {error}
        </div>
      )}

      <div className="flex justify-between items-center">
        <div className="space-y-1">
          <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter flex items-center">
            <ClipboardList className="w-6 h-6 mr-3 text-blue-600" /> Registre des Audits
          </h3>
          <p className="text-slate-500 text-sm font-medium">Planification et suivi des inspections réglementaires et internes.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setModalOpen(true)}
            className="px-6 py-3 bg-emerald-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-emerald-600/20 hover:bg-emerald-700 transition-all flex items-center gap-2"
          >
            <Flag className="w-4 h-4" />
            Ajouter un Constat
          </button>
          <button
            onClick={() => alert('Bientôt disponible')}
            className="px-6 py-3 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-blue-600/20 hover:bg-blue-700 transition-all flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Planifier un Audit
          </button>
        </div>
      </div>

      {audits.length === 0 ? (
        <div className="text-center py-16 text-slate-500 bg-white rounded-[2.5rem] border border-slate-100">
          Aucun audit planifié pour cette année scolaire.
        </div>
      ) : (
        <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest font-mono">
                <th className="px-8 py-5">Audit / ID</th>
                <th className="px-8 py-5">Auditeur</th>
                <th className="px-8 py-5">Date</th>
                <th className="px-8 py-5">Score</th>
                <th className="px-8 py-5 text-right">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {audits.map((audit, i) => {
                const title = audit.title || audit.name || 'Audit';
                const type = audit.type || audit.category || 'AUDIT';
                const auditor = audit.auditor || audit.auditedBy || '—';
                const date = audit.date || audit.auditDate || '—';
                const score = audit.score;
                const status = audit.status || 'PLANIFIE';
                return (
                  <motion.tr
                    key={audit.id ?? i}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.05 }}
                    className="hover:bg-slate-50/50 transition-colors group cursor-pointer"
                  >
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                          <ClipboardList className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="font-black text-slate-900">{title}</p>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{type} • {audit.id}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-5 text-xs font-black text-slate-700 uppercase">{auditor}</td>
                    <td className="px-8 py-5 text-xs font-bold text-slate-500 font-mono uppercase">{date}</td>
                    <td className="px-8 py-5">
                      {score ? (
                        <div className="flex items-center gap-2">
                          <div className="text-sm font-black text-slate-900">{score}%</div>
                          <div className="w-12 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-emerald-500" style={{ width: `${score}%` }} />
                          </div>
                        </div>
                      ) : <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest italic">En attente</span>}
                    </td>
                    <td className="px-8 py-5 text-right">
                      <div className="flex items-center justify-end gap-3">
                        <span className={`px-2.5 py-1 rounded-full text-[8px] font-black uppercase tracking-widest border ${
                          status === 'TERMINE' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 
                          status === 'EN_COURS' ? 'bg-blue-50 text-blue-600 border-blue-100' : 'bg-slate-50 text-slate-400 border-slate-100'
                        }`}>
                          {status.replace(/_/g, ' ')}
                        </span>
                        <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-blue-600 transition-all group-hover:translate-x-1" />
                      </div>
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {/* Modal: Ajouter un constat d'audit */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">Ajouter un constat</h3>
              <button onClick={() => setModalOpen(false)} className="p-1 hover:bg-slate-100 rounded-lg">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">ID de l'audit</label>
                <input
                  type="text"
                  value={formData.auditId}
                  onChange={(e) => setFormData({ ...formData, auditId: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-50 border-none rounded-xl text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-emerald-500/20"
                  placeholder="Ex: 123 ou uuid"
                />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Description</label>
                <textarea
                  rows={3}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-50 border-none rounded-xl text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-emerald-500/20 resize-none"
                  placeholder="Décrivez le constat..."
                />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Gravité</label>
                <select
                  value={formData.severity}
                  onChange={(e) => setFormData({ ...formData, severity: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-50 border-none rounded-xl text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-emerald-500/20"
                >
                  <option value="FAIBLE">Faible</option>
                  <option value="MOYEN">Moyen</option>
                  <option value="IMPORTANT">Important</option>
                  <option value="CRITIQUE">Critique</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <button
                onClick={() => setModalOpen(false)}
                className="px-4 py-2 border border-slate-200 rounded-lg text-sm font-bold text-slate-600 hover:bg-slate-50"
              >
                Annuler
              </button>
              <button
                onClick={handleAddFinding}
                disabled={submitting}
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-bold hover:bg-emerald-700 disabled:opacity-60 flex items-center gap-2"
              >
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                {submitting ? 'Envoi...' : 'Ajouter'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
