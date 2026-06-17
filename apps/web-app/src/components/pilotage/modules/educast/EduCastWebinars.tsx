/**
 * ============================================================================
 * EDUCAST WEBINAIRES & DIRECTS
 * ============================================================================
 */

'use client';

import { motion } from 'framer-motion';
import { Globe, Calendar, Clock, Users, Video, Link as LinkIcon, Plus, ChevronRight, MonitorPlay, Loader2 } from 'lucide-react';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useModulesList } from '@/lib/modules-complementaires/hooks';

interface WebinarItem {
  id: string | number;
  title?: string;
  name?: string;
  presenter?: string;
  host?: string;
  presenterName?: string;
  date?: string;
  scheduledAt?: string;
  time?: string;
  duration?: number;
  durationMinutes?: number;
  audience?: string;
  targetAudience?: string;
  status?: string;
}

export default function EduCastWebinars() {
  const { academicYear } = useModuleContext();
  const { data: webinars, loading, error } = useModulesList<WebinarItem>('educast', 'webinars', academicYear?.id);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        <span className="ml-2 text-slate-600">Chargement des webinaires...</span>
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
            <Globe className="w-6 h-6 mr-3 text-emerald-600" />
            Webinaires & Directs
          </h3>
          <p className="text-slate-500 text-sm font-medium">Planifiez et diffusez vos événements en temps réel.</p>
        </div>
        <button
          onClick={() => alert('Bientôt disponible')}
          className="px-6 py-3 bg-navy-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-navy-900/10 hover:bg-navy-800 transition-all"
        >
          Nouvelle Session
        </button>
      </div>

      {webinars.length === 0 ? (
        <div className="text-center py-16 text-slate-500 bg-white rounded-3xl border border-slate-200">
          Aucun webinaire planifié pour cette année scolaire.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {webinars.map((webinar, i) => {
            const title = webinar.title || webinar.name || 'Webinaire';
            const presenter = webinar.presenter || webinar.host || webinar.presenterName || '—';
            const dateStr = webinar.date || (webinar.scheduledAt ? new Date(webinar.scheduledAt).toLocaleDateString('fr-FR') : '—');
            const time = webinar.time || (webinar.scheduledAt ? new Date(webinar.scheduledAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '—');
            const duration = webinar.duration ?? webinar.durationMinutes ?? 0;
            const audience = webinar.audience || webinar.targetAudience || '—';
            const status = webinar.status || 'PLANNED';
            return (
              <motion.div
                key={webinar.id ?? i}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 }}
                className="bg-white rounded-3xl border border-slate-200 p-8 flex flex-col lg:flex-row items-center justify-between gap-8 hover:shadow-xl transition-all group"
              >
                <div className="flex items-center gap-8 flex-1">
                  <div className="p-5 bg-emerald-50 text-emerald-600 rounded-2xl group-hover:bg-emerald-600 group-hover:text-white transition-all">
                    <MonitorPlay className="w-10 h-10" />
                  </div>
                  <div className="space-y-4 flex-1">
                    <div className="flex items-center gap-3">
                      <span className="px-2 py-0.5 bg-emerald-50 text-emerald-600 text-[8px] font-black uppercase tracking-widest rounded-md">
                        {status === 'LIVE' ? 'EN DIRECT' : 'PROCHAINEMENT'}
                      </span>
                      <h4 className="text-2xl font-black text-slate-900 group-hover:text-emerald-600 transition-colors">{title}</h4>
                    </div>
                    <div className="flex flex-wrap items-center gap-6">
                      <div className="flex items-center gap-2 text-slate-400">
                        <Users className="w-4 h-4" />
                        <span className="text-xs font-bold uppercase tracking-tighter">{audience}</span>
                      </div>
                      <div className="flex items-center gap-2 text-slate-400">
                        <Calendar className="w-4 h-4" />
                        <span className="text-xs font-bold uppercase tracking-tighter">{dateStr}</span>
                      </div>
                      <div className="flex items-center gap-2 text-slate-400">
                        <Clock className="w-4 h-4" />
                        <span className="text-xs font-bold uppercase tracking-tighter">{time} ({duration} min)</span>
                      </div>
                      <div className="flex items-center gap-2 text-slate-400">
                        <div className="w-5 h-5 rounded-full bg-slate-100" />
                        <span className="text-xs font-bold uppercase tracking-tighter">{presenter}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-3 min-w-[200px]">
                  <button
                    onClick={() => alert('Bientôt disponible')}
                    className="w-full py-3 bg-navy-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-navy-800 transition-all shadow-lg"
                  >
                    S'inscrire
                  </button>
                  <button
                    onClick={() => alert('Bientôt disponible')}
                    className="w-full py-3 bg-slate-50 text-slate-400 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-100 transition-all"
                  >
                    Détails
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
