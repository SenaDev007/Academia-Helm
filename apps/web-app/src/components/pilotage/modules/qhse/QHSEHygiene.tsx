/**
 * ============================================================================
 * QHSE HYGIENE & SALUBRITE
 * ============================================================================
 */

'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Droplets, CheckCircle2, AlertCircle, Trash2, Wind, Utensils, Home, MapPin, Plus, ListChecks, Loader2, X } from 'lucide-react';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useModulesList } from '@/lib/modules-complementaires/hooks';
import { modulesApi, buildModulesApiOptions } from '@/lib/modules-complementaires/client';

interface HygieneItem {
  id: string | number;
  zone?: string;
  name?: string;
  title?: string;
  status?: string;
  score?: number;
  lastAudit?: string;
  auditDate?: string;
  inspector?: string;
  auditedBy?: string;
  icon?: any;
  color?: string;
  bg?: string;
}

const ZONE_ICONS: Record<string, any> = {
  Cantine: Utensils,
  Sanitaires: Droplets,
  Dortoirs: Home,
  Salles: ListChecks,
};

function pickZoneIcon(zone?: string) {
  if (!zone) return ListChecks;
  const key = Object.keys(ZONE_ICONS).find((k) => zone.includes(k));
  return key ? ZONE_ICONS[key] : ListChecks;
}

const EMPTY_FORM = { checklistId: '', label: '', status: 'CONFORME' };

export default function QHSEHygiene() {
  const { academicYear } = useModuleContext();
  const { data: inspections, loading, error, refetch } = useModulesList<HygieneItem>('qhse', 'hygiene', academicYear?.id);

  const [modalOpen, setModalOpen] = useState(false);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  const handleAddItem = async () => {
    if (!formData.checklistId || !formData.label) {
      alert('L\'ID checklist et le libellé sont requis');
      return;
    }
    try {
      setSubmitting(true);
      await modulesApi.post(
        `qhse/hygiene/${formData.checklistId}/items`,
        { label: formData.label, status: formData.status },
        buildModulesApiOptions(academicYear?.id),
      );
      setModalOpen(false);
      setFormData(EMPTY_FORM);
      await refetch();
    } catch (e: any) {
      alert(e?.message || 'Erreur lors de l\'ajout de l\'item');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        <span className="ml-2 text-slate-600">Chargement des inspections...</span>
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

      {/* Hygiene Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="p-4 bg-emerald-50 text-emerald-600 rounded-2xl">
            <Droplets className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Score Global</p>
            <p className="text-2xl font-black text-slate-900 tracking-tighter">
              {inspections.length > 0
                ? `${Math.round(inspections.reduce((acc, x) => acc + (x.score ?? 0), 0) / inspections.length)}%`
                : '—'}
            </p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="p-4 bg-rose-50 text-rose-600 rounded-2xl">
            <Trash2 className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Non-conformités</p>
            <p className="text-2xl font-black text-slate-900 tracking-tighter">
              {String(inspections.filter((x) => x.status && x.status !== 'CONFORME').length).padStart(2, '0')}
            </p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="p-4 bg-blue-50 text-blue-600 rounded-2xl">
            <Wind className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Inspections ce mois</p>
            <p className="text-2xl font-black text-slate-900 tracking-tighter">{inspections.length}</p>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={() => setModalOpen(true)}
          className="px-6 py-3 bg-emerald-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-emerald-600/20 hover:bg-emerald-700 transition-all flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Ajouter un Item
        </button>
      </div>

      {inspections.length === 0 ? (
        <div className="text-center py-16 text-slate-500 bg-white rounded-[2.5rem] border border-slate-100">
          Aucune inspection d'hygiène pour cette année scolaire.
        </div>
      ) : (
        /* Zone Grid */
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {inspections.map((inspection, i) => {
            const Icon = inspection.icon || pickZoneIcon(inspection.zone);
            const color = inspection.color || 'text-slate-600';
            const bg = inspection.bg || 'bg-slate-50';
            const zone = inspection.zone || inspection.name || inspection.title || 'Zone';
            const status = inspection.status || 'CONFORME';
            const score = inspection.score ?? 0;
            const lastAudit = inspection.lastAudit || inspection.auditDate || '—';
            const inspector = inspection.inspector || inspection.auditedBy || '—';
            return (
              <motion.div
                key={inspection.id ?? i}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.1 }}
                className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm group hover:shadow-lg transition-all"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`p-4 rounded-2xl ${bg} ${color} group-hover:scale-110 transition-transform`}>
                      <Icon className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="font-black text-slate-900 uppercase tracking-tight">{zone}</h4>
                      <div className="flex items-center gap-3 mt-1">
                        <p className="text-[10px] font-bold text-slate-400 flex items-center gap-1 uppercase tracking-widest">
                          <MapPin className="w-3 h-3" /> {lastAudit}
                        </p>
                        <p className="text-[10px] font-bold text-slate-400 flex items-center gap-1 uppercase tracking-widest border-l border-slate-100 pl-3">
                          Par {inspector}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`text-xl font-black tracking-tighter mb-1 ${
                      score >= 90 ? 'text-emerald-600' : score >= 70 ? 'text-amber-600' : 'text-rose-600'
                    }`}>
                      {score}%
                    </div>
                    <span className={`px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-widest border ${
                      status === 'CONFORME' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-rose-50 text-rose-600 border-rose-100'
                    }`}>
                      {status === 'CONFORME' ? 'Conforme' : 'Alerte'}
                    </span>
                  </div>
                </div>
                
                <div className="mt-6 flex items-center gap-2">
                  <button className="flex-1 py-3 bg-slate-50 hover:bg-slate-100 text-slate-400 hover:text-slate-900 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">
                    Détails du contrôle
                  </button>
                  <button className="px-4 py-3 bg-emerald-50 hover:bg-emerald-600 text-emerald-600 hover:text-white rounded-xl transition-all">
                    <CheckCircle2 className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Modal: Ajouter un item d'hygiène */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">Ajouter un item d'hygiène</h3>
              <button onClick={() => setModalOpen(false)} className="p-1 hover:bg-slate-100 rounded-lg">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">ID de la checklist</label>
                <input
                  type="text"
                  value={formData.checklistId}
                  onChange={(e) => setFormData({ ...formData, checklistId: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-50 border-none rounded-xl text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-emerald-500/20"
                  placeholder="Ex: 123 ou uuid"
                />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Libellé</label>
                <input
                  type="text"
                  value={formData.label}
                  onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-50 border-none rounded-xl text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-emerald-500/20"
                  placeholder="Ex: Nettoyage des sanitaires"
                />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Statut</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-50 border-none rounded-xl text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-emerald-500/20"
                >
                  <option value="CONFORME">Conforme</option>
                  <option value="NON_CONFORME">Non conforme</option>
                  <option value="A_VERIFIER">À vérifier</option>
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
                onClick={handleAddItem}
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
