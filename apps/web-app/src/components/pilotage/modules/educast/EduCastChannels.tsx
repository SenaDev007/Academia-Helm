/**
 * ============================================================================
 * EDUCAST CHANNELS
 * ============================================================================
 */

'use client';

import { motion } from 'framer-motion';
import { MonitorPlay, Users, Settings, Plus, ChevronRight, Star, Loader2 } from 'lucide-react';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useModulesList } from '@/lib/modules-complementaires/hooks';

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
}

const PALETTE = ['bg-navy-900', 'bg-emerald-600', 'bg-blue-600', 'bg-rose-600', 'bg-amber-600'];

export default function EduCastChannels() {
  const { academicYear } = useModuleContext();
  const { data: channels, loading, error } = useModulesList<ChannelItem>('educast', 'teacher-channel', academicYear?.id);

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
        <button className="flex items-center space-x-2 px-6 py-3 bg-navy-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-navy-900/10 hover:bg-navy-800 transition-all">
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
                    <button className="p-2 hover:bg-slate-50 rounded-xl transition-colors">
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
                    <button className="flex items-center text-blue-600 font-black text-[10px] uppercase tracking-widest hover:translate-x-1 transition-transform">
                      Ouvrir la chaîne
                      <ChevronRight className="w-4 h-4 ml-1" />
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
