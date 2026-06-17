/**
 * ============================================================================
 * QHSE RISKS & PREVENTION
 * ============================================================================
 */

'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { ShieldAlert, Activity, ArrowUpRight, Zap, Droplets, Flame, Users, Lock, MoreVertical, Loader2, Plus, X } from 'lucide-react';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useModulesList } from '@/lib/modules-complementaires/hooks';
import { modulesApi, buildModulesApiOptions } from '@/lib/modules-complementaires/client';

interface RiskItem {
  id: string | number;
  title?: string;
  name?: string;
  category?: string;
  criticite?: string;
  criticality?: string;
  probability?: number;
  impact?: number;
  icon?: any;
  color?: string;
  bg?: string;
}

const CATEGORY_ICONS: Record<string, any> = {
  SECURITE: Lock,
  HYGIENE: Droplets,
  INFRA: Zap,
  ENVIRONNEMENT: Flame,
};

const EMPTY_FORM = { title: '', category: 'SECURITE', probability: 3, impact: 3 };

export default function QHSERisks() {
  const { academicYear } = useModuleContext();
  const { data: risks, loading, error, refetch } = useModulesList<RiskItem>('qhse', 'risks', academicYear?.id);

  const [modalOpen, setModalOpen] = useState(false);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  const handleCreate = async () => {
    if (!formData.title) {
      alert('Le titre est requis');
      return;
    }
    try {
      setSubmitting(true);
      await modulesApi.post('qhse/risks', formData, buildModulesApiOptions(academicYear?.id));
      setModalOpen(false);
      setFormData(EMPTY_FORM);
      await refetch();
    } catch (e: any) {
      alert(e?.message || 'Erreur lors de la création du risque');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        <span className="ml-2 text-slate-600">Chargement des risques...</span>
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

      <div className="flex justify-end">
        <button
          onClick={() => setModalOpen(true)}
          className="px-6 py-3 bg-rose-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-rose-600/20 hover:bg-rose-700 transition-all flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Nouveau Risque
        </button>
      </div>

      {/* Risk Matrix Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-6">
            <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest">Matrice de Criticité</h4>
            <div className="aspect-square grid grid-cols-5 grid-rows-5 gap-1">
              {Array.from({ length: 25 }).map((_, i) => {
                const x = i % 5;
                const y = Math.floor(i / 5);
                const isCritical = x + (4 - y) >= 6;
                const isHigh = x + (4 - y) >= 4 && !isCritical;
                return (
                  <div key={i} className={`rounded-sm transition-all hover:scale-110 cursor-help ${
                    isCritical ? 'bg-rose-500' : isHigh ? 'bg-amber-400' : 'bg-emerald-400'
                  } opacity-40 hover:opacity-100`} title={`Impact: ${x + 1}, Proba: ${5 - y}`} />
                );
              })}
            </div>
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2 text-[8px] font-black uppercase tracking-widest text-slate-400">
                <div className="w-2 h-2 rounded-full bg-rose-500" /> Critique
              </div>
              <div className="flex items-center gap-2 text-[8px] font-black uppercase tracking-widest text-slate-400">
                <div className="w-2 h-2 rounded-full bg-amber-400" /> Élevé
              </div>
              <div className="flex items-center gap-2 text-[8px] font-black uppercase tracking-widest text-slate-400">
                <div className="w-2 h-2 rounded-full bg-emerald-400" /> Modéré
              </div>
            </div>
          </div>
        </div>

        {/* Risk Cards */}
        <div className="lg:col-span-3">
          {risks.length === 0 ? (
            <div className="text-center py-16 text-slate-500 bg-white rounded-[2.5rem] border border-slate-100">
              Aucun risque enregistré pour cette année scolaire.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {risks.map((risk, i) => {
                const Icon = risk.icon || CATEGORY_ICONS[risk.category || ''] || ShieldAlert;
                const color = risk.color || 'text-slate-600';
                const bg = risk.bg || 'bg-slate-50';
                const criticite = risk.criticite || risk.criticality || 'MOYEN';
                return (
                  <motion.div
                    key={risk.id ?? i}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-xl transition-all group"
                  >
                    <div className="flex items-center justify-between mb-8">
                      <div className={`p-4 rounded-2xl ${bg} ${color}`}>
                        <Icon className="w-8 h-8" />
                      </div>
                      <button className="p-2 hover:bg-slate-50 rounded-xl">
                        <MoreVertical className="w-5 h-5 text-slate-300" />
                      </button>
                    </div>
                    
                    <div className="space-y-4">
                      <div>
                        <h4 className="text-xl font-black text-slate-900 tracking-tighter leading-tight">{risk.title || risk.name}</h4>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">{risk.category}</p>
                      </div>

                      <div className="flex items-center justify-between pt-4 border-t border-slate-50">
                        <div className="flex items-center gap-4">
                          <div className="text-center">
                            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Proba</p>
                            <p className="text-sm font-black text-slate-900">{risk.probability ?? '—'}/5</p>
                          </div>
                          <div className="text-center">
                            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Impact</p>
                            <p className="text-sm font-black text-slate-900">{risk.impact ?? '—'}/5</p>
                          </div>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${
                          criticite === 'CRITIQUE' ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/20' : 
                          criticite === 'ELEVE' || criticite === 'HIGH' ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-500'
                        }`}>
                          {criticite}
                        </span>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Modal: Nouveau risque */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">Nouveau risque</h3>
              <button onClick={() => setModalOpen(false)} className="p-1 hover:bg-slate-100 rounded-lg">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Titre</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-50 border-none rounded-xl text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-rose-500/20"
                  placeholder="Ex: Risque de chute"
                />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Catégorie</label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-50 border-none rounded-xl text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-rose-500/20"
                >
                  <option value="SECURITE">Sécurité</option>
                  <option value="HYGIENE">Hygiène</option>
                  <option value="INFRA">Infrastructure</option>
                  <option value="ENVIRONNEMENT">Environnement</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Probabilité (1-5)</label>
                  <input
                    type="number"
                    min={1}
                    max={5}
                    value={formData.probability}
                    onChange={(e) => setFormData({ ...formData, probability: Number(e.target.value) })}
                    className="w-full px-4 py-2.5 bg-slate-50 border-none rounded-xl text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-rose-500/20"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Impact (1-5)</label>
                  <input
                    type="number"
                    min={1}
                    max={5}
                    value={formData.impact}
                    onChange={(e) => setFormData({ ...formData, impact: Number(e.target.value) })}
                    className="w-full px-4 py-2.5 bg-slate-50 border-none rounded-xl text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-rose-500/20"
                  />
                </div>
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
                onClick={handleCreate}
                disabled={submitting}
                className="px-4 py-2 bg-rose-600 text-white rounded-lg text-sm font-bold hover:bg-rose-700 disabled:opacity-60 flex items-center gap-2"
              >
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                {submitting ? 'Envoi...' : 'Créer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
