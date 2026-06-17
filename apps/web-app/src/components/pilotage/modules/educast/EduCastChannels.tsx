/**
 * ============================================================================
 * EDUCAST CHANNELS
 * ============================================================================
 */

'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { MonitorPlay, Users, Settings, Plus, ChevronRight, Star, Loader2, X, CheckCircle2, UserPlus } from 'lucide-react';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useModulesList } from '@/lib/modules-complementaires/hooks';
import { modulesApi, buildModulesApiOptions } from '@/lib/modules-complementaires/client';

interface ChannelItem {
  id: string | number;
  name?: string;
  title?: string;
  owner?: string;
  ownerName?: string;
  contents?: number;
  contentCount?: number;
  subs?: number;
  subscribers?: number;
  subscriberCount?: number;
  status?: string;
  color?: string;
  description?: string;
  subject?: string;
}

const PALETTE = ['bg-navy-900', 'bg-emerald-600', 'bg-blue-600', 'bg-rose-600', 'bg-amber-600'];

const EMPTY_FORM = { name: '', description: '', subject: '' };

export default function EduCastChannels() {
  const { academicYear } = useModuleContext();
  const { data: channels, loading, error, refetch } = useModulesList<ChannelItem>('educast', 'teacher-channel', academicYear?.id);

  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ChannelItem | null>(null);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | number | null>(null);

  const openCreate = () => {
    setEditTarget(null);
    setFormData(EMPTY_FORM);
    setModalOpen(true);
  };

  const openEdit = (channel: ChannelItem) => {
    setEditTarget(channel);
    setFormData({
      name: channel.name || channel.title || '',
      description: channel.description || '',
      subject: channel.subject || '',
    });
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.name) {
      alert('Le nom est requis');
      return;
    }
    try {
      setSubmitting(true);
      if (editTarget) {
        await modulesApi.patch(`educast/teacher-channel/${editTarget.id}`, formData, buildModulesApiOptions(academicYear?.id));
      } else {
        await modulesApi.post('educast/teacher-channel', formData, buildModulesApiOptions(academicYear?.id));
      }
      setModalOpen(false);
      setFormData(EMPTY_FORM);
      setEditTarget(null);
      await refetch();
    } catch (e: any) {
      alert(e?.message || 'Erreur lors de l\'enregistrement');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubscribe = async (channelId: string | number) => {
    try {
      setActionLoading(channelId);
      await modulesApi.post(`educast/channels/${channelId}/subscribe`, {}, buildModulesApiOptions(academicYear?.id));
      await refetch();
    } catch (e: any) {
      alert(e?.message || 'Erreur lors de l\'abonnement');
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        <span className="ml-2 text-slate-600">Chargement des chaînes...</span>
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
          <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter">Chaînes EduCast</h3>
          <p className="text-slate-500 text-sm font-medium">Organisez vos contenus par thématiques ou services.</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center space-x-2 px-6 py-3 bg-navy-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-navy-900/10 hover:bg-navy-800 transition-all"
        >
          <Plus className="w-4 h-4 text-[#C9A84C]" />
          <span>Créer une Chaîne</span>
        </button>
      </div>

      {channels.length === 0 ? (
        <div className="text-center py-16 text-slate-500 bg-white rounded-3xl border border-slate-200">
          Aucune chaîne EduCast pour cette année scolaire.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {channels.map((channel, i) => {
            const name = channel.name || channel.title || 'Chaîne';
            const owner = channel.owner || channel.ownerName || '—';
            const contents = channel.contents ?? channel.contentCount ?? 0;
            const subs = channel.subs ?? channel.subscribers ?? channel.subscriberCount ?? 0;
            const status = channel.status || 'ACTIVE';
            const color = channel.color || PALETTE[i % PALETTE.length];
            return (
              <motion.div
                key={channel.id ?? i}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.05 }}
                className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm hover:shadow-xl transition-all relative overflow-hidden group"
              >
                <div className={`absolute top-0 left-0 w-2 h-full ${color}`} />
                
                <div className="space-y-6">
                  <div className="flex items-start justify-between">
                    <div className="p-4 bg-slate-50 rounded-2xl group-hover:bg-blue-50 transition-colors">
                      <MonitorPlay className={`w-8 h-8 ${color.replace('bg-', 'text-')}`} />
                    </div>
                    <button
                      onClick={() => openEdit(channel)}
                      className="p-2 hover:bg-slate-50 rounded-xl transition-colors"
                      title="Modifier"
                    >
                      <Settings className="w-5 h-5 text-slate-300" />
                    </button>
                  </div>

                  <div>
                    <h4 className="text-xl font-black text-slate-900 leading-tight group-hover:text-blue-600 transition-colors">{name}</h4>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Responsable: {owner}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4 py-4 border-y border-slate-50">
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Contenus</p>
                      <p className="text-lg font-black text-slate-900">{contents}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Abonnés</p>
                      <p className="text-lg font-black text-slate-900">{subs}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <span className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${
                      status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
                    }`}>
                      {status}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleSubscribe(channel.id)}
                        disabled={actionLoading === channel.id}
                        className="flex items-center gap-1 text-emerald-600 font-black text-[10px] uppercase tracking-widest hover:underline disabled:opacity-60"
                      >
                        {actionLoading === channel.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <UserPlus className="w-3 h-3" />}
                        S'abonner
                      </button>
                      <button className="flex items-center text-blue-600 font-black text-[10px] uppercase tracking-widest hover:translate-x-1 transition-transform">
                        Ouvrir
                        <ChevronRight className="w-4 h-4 ml-1" />
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Modal: Créer / Modifier une chaîne */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">{editTarget ? 'Modifier la chaîne' : 'Créer une chaîne'}</h3>
              <button onClick={() => setModalOpen(false)} className="p-1 hover:bg-slate-100 rounded-lg">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nom</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-50 border-none rounded-xl text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-blue-500/20"
                  placeholder="Ex: Chaîne Maths M. Dupont"
                />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sujet / Matière</label>
                <input
                  type="text"
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-50 border-none rounded-xl text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-blue-500/20"
                  placeholder="Ex: Mathématiques"
                />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Description</label>
                <textarea
                  rows={3}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-50 border-none rounded-xl text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-blue-500/20 resize-none"
                  placeholder="Décrivez votre chaîne..."
                />
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
                onClick={handleSubmit}
                disabled={submitting}
                className="px-4 py-2 bg-navy-900 text-white rounded-lg text-sm font-bold hover:bg-navy-800 disabled:opacity-60 flex items-center gap-2"
              >
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                {submitting ? 'Envoi...' : editTarget ? 'Modifier' : 'Créer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
