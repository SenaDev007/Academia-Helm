/**
 * ============================================================================
 * EMERGENCIES & INCIDENTS TAB
 * ============================================================================
 */

'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Loader2, X } from 'lucide-react';
import {
  AlertCircle,
  PhoneCall,
  MapPin,
  ShieldAlert,
  ArrowRight,
  Plus,
  History,
  LifeBuoy,
} from 'lucide-react';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useModulesList } from '@/lib/modules-complementaires/hooks';
import { modulesApi, buildModulesApiOptions } from '@/lib/modules-complementaires/client';

interface EmergencyItem {
  id: string;
  student?: string;
  studentName?: string;
  class?: string;
  className?: string;
  type?: string;
  emergencyType?: string;
  incidentType?: string;
  location?: string;
  incidentLocation?: string;
  severity?: string;
  status?: string;
  emergencyStatus?: string;
  duration?: string;
  elapsed?: string;
  services?: string;
  emergencyServices?: string;
  [key: string]: any;
}

const SEVERITY_COLORS: Record<string, string> = {
  CRITIQUE: 'bg-rose-600 text-white',
  HAUTE: 'bg-rose-100 text-rose-700',
  MOYENNE: 'bg-amber-100 text-amber-700',
  FAIBLE: 'text-blue-600 bg-blue-50',
};

const SEVERITY_BADGE: Record<string, string> = {
  HAUTE: 'text-orange-600 bg-orange-50',
  MOYENNE: 'text-amber-600 bg-amber-50',
  FAIBLE: 'text-blue-600 bg-blue-50',
};

export default function Emergencies() {
  const { academicYear } = useModuleContext();
  const { data, loading, error, refetch } = useModulesList<EmergencyItem>('infirmary', 'emergencies', academicYear?.id);

  const emergencies = data ?? [];

  const [modalOpen, setModalOpen] = useState(false);
  const [formData, setFormData] = useState({ studentId: '', severity: 'HAUTE', description: '' });
  const [submitting, setSubmitting] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const handleCreate = async () => {
    try {
      setSubmitting(true);
      await modulesApi.post('infirmary/emergencies', formData, buildModulesApiOptions(academicYear?.id));
      setModalOpen(false);
      setFormData({ studentId: '', severity: 'HAUTE', description: '' });
      await refetch();
    } catch (e: any) {
      alert(e?.response?.data?.message || e?.message || 'Erreur lors de la création de l\'urgence');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateStatus = async (id: string, status: string) => {
    try {
      setActionLoading(id);
      await modulesApi.post(`infirmary/emergencies/${id}`, { status }, buildModulesApiOptions(academicYear?.id));
      await refetch();
    } catch (e: any) {
      alert(e?.response?.data?.message || e?.message || 'Erreur lors de la mise à jour');
    } finally {
      setActionLoading(null);
    }
  };

  // Sépare les urgences actives (CRITIQUE / OPEN) de l'historique
  const active = emergencies.filter((e) => {
    const sev = (e.severity || '').toUpperCase();
    const status = (e.status || e.emergencyStatus || 'OPEN').toUpperCase();
    return sev === 'CRITIQUE' || status === 'OPEN' || status === 'IN_PROGRESS';
  });
  const history = emergencies.filter((e) => !active.includes(e));

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        <span className="ml-2 text-slate-600">Chargement...</span>
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

      {/* Active Emergencies Section */}
      <div className="bg-rose-50 border border-rose-100 rounded-3xl p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-black text-rose-900 flex items-center">
              <AlertCircle className="w-8 h-8 mr-3 animate-pulse" />
              Urgences Actives
            </h2>
            <p className="text-rose-700 font-medium">Interventions critiques nécessitant un suivi immédiat.</p>
          </div>
          <button
            onClick={() => { setFormData({ studentId: '', severity: 'HAUTE', description: '' }); setModalOpen(true); }}
            className="bg-rose-600 hover:bg-rose-700 text-white px-6 py-3 rounded-2xl font-black text-sm flex items-center transition-all shadow-lg shadow-rose-200"
          >
            <Plus className="w-5 h-5 mr-2" />
            DÉCLARER URGENCE
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {active.length === 0 ? (
            <div className="md:col-span-2 bg-white/50 border-2 border-dashed border-rose-200 rounded-2xl flex items-center justify-center p-12">
              <p className="text-rose-300 font-bold text-center">Aucune urgence active.<br />La situation est sous contrôle.</p>
            </div>
          ) : (
            active.map((e) => {
              const student = e.student || e.studentName || `Élève ${e.id}`;
              const className = e.class || e.className || '';
              const type = e.type || e.emergencyType || e.incidentType || 'Urgence';
              const location = e.location || e.incidentLocation || '—';
              const services = e.services || e.emergencyServices || '';
              const duration = e.duration || e.elapsed || '';
              return (
                <motion.div
                  key={e.id}
                  whileHover={{ y: -5 }}
                  className="bg-white rounded-2xl border-2 border-rose-200 p-6 shadow-xl shadow-rose-100/50"
                >
                  <div className="flex justify-between items-start mb-4">
                    <span className="bg-rose-600 text-white text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest">
                      CRITIQUE
                    </span>
                    {duration && (
                      <span className="text-slate-400 text-xs font-bold flex items-center">
                        <History className="w-3 h-3 mr-1" />
                        Depuis {duration}
                      </span>
                    )}
                  </div>
                  <h3 className="text-xl font-black text-slate-900 mb-1">{student}</h3>
                  <p className="text-sm font-bold text-slate-500 mb-4">{className} • {type}</p>

                  <div className="space-y-3 mb-6">
                    <div className="flex items-center text-sm text-slate-600">
                      <MapPin className="w-4 h-4 mr-2 text-rose-500" />
                      {location}
                    </div>
                    {services && (
                      <div className="flex items-center text-sm text-slate-600">
                        <LifeBuoy className="w-4 h-4 mr-2 text-rose-500" />
                        {services.toUpperCase()}
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <button className="flex-1 py-3 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl text-xs font-black transition-colors flex items-center justify-center">
                      <PhoneCall className="w-4 h-4 mr-2" />
                      Appeler Parent
                    </button>
                    <button
                      onClick={() => handleUpdateStatus(e.id, 'IN_PROGRESS')}
                      disabled={actionLoading === e.id}
                      className="flex-1 py-3 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-black transition-colors flex items-center justify-center disabled:opacity-50"
                    >
                      {actionLoading === e.id ? 'Envoi...' : 'Prendre en charge'}
                    </button>
                    <button
                      onClick={() => handleUpdateStatus(e.id, 'RESOLVED')}
                      disabled={actionLoading === e.id}
                      className="flex-1 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-black transition-colors flex items-center justify-center disabled:opacity-50"
                    >
                      Résoudre
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </button>
                  </div>
                </motion.div>
              );
            })
          )}
        </div>
      </div>

      {/* Incident History / Recent Logs */}
      <div>
        <h3 className="text-lg font-black text-slate-900 mb-4 flex items-center">
          <ShieldAlert className="w-5 h-5 mr-2 text-slate-400" />
          Historique des Incidents (7 derniers jours)
        </h3>
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Date / Heure</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Élève</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Incident</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Lieu</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Gravité</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Rapport</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {history.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-10 text-center text-slate-500 text-sm">
                      Aucun incident dans l'historique.
                    </td>
                  </tr>
                ) : history.map((incident) => {
                  const sev = (incident.severity || 'FAIBLE').toUpperCase();
                  const color = SEVERITY_BADGE[sev] ?? SEVERITY_BADGE.FAIBLE;
                  const date = incident.date || '';
                  const time = incident.time || '';
                  const student = incident.student || incident.studentName || `Élève ${incident.id}`;
                  const type = incident.type || incident.emergencyType || incident.incidentType || 'Incident';
                  const location = incident.location || incident.incidentLocation || '—';
                  return (
                    <tr key={incident.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 text-sm font-bold text-slate-900">
                        {date || '—'} {time && <span className="text-slate-400 text-xs font-medium ml-1">{time}</span>}
                      </td>
                      <td className="px-6 py-4 text-sm font-bold text-slate-700">{student}</td>
                      <td className="px-6 py-4 text-sm text-slate-600">{type}</td>
                      <td className="px-6 py-4 text-sm text-slate-600">{location}</td>
                      <td className="px-6 py-4">
                        <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-tighter ${color}`}>
                          {sev}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button className="text-blue-600 text-xs font-bold hover:underline">Consulter</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold">Nouvelle urgence</h3>
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
                <label className="text-xs font-bold text-slate-500 uppercase">Gravité</label>
                <select
                  value={formData.severity}
                  onChange={(e) => setFormData({ ...formData, severity: e.target.value })}
                  className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg text-sm"
                >
                  <option value="CRITIQUE">Critique</option>
                  <option value="HAUTE">Haute</option>
                  <option value="MOYENNE">Moyenne</option>
                  <option value="FAIBLE">Faible</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg text-sm"
                  rows={3}
                  placeholder="Description de l'urgence"
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
                className="px-4 py-2 bg-rose-600 text-white rounded-lg text-sm font-bold disabled:opacity-50"
              >
                {submitting ? 'Envoi...' : 'Déclarer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
