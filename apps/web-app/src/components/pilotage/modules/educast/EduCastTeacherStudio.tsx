/**
 * ============================================================================
 * EDUCAST TEACHER STUDIO
 * ============================================================================
 */

'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { MonitorPlay, Users, Plus, Settings, Camera, Edit3, Image as ImageIcon, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { useModuleContext } from '@/hooks/useModuleContext';
import { modulesApi, buildModulesApiOptions } from '@/lib/modules-complementaires/client';

interface TeacherChannel {
  id?: string | number;
  name?: string;
  title?: string;
  slogan?: string;
  tagline?: string;
  subs?: number;
  subscribers?: number;
  subscriberCount?: number;
  status?: string;
  isMonetized?: boolean;
  monetizationEnabled?: boolean;
  avatar?: string | null;
  avatarUrl?: string | null;
  banner?: string | null;
  bannerUrl?: string | null;
  balance?: string | number;
  availableBalance?: string | number;
}

export default function EduCastTeacherStudio() {
  const { academicYear } = useModuleContext();
  const [channel, setChannel] = useState<TeacherChannel | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!academicYear?.id) return;
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const result = await modulesApi.get<TeacherChannel>('educast/teacher-channel', buildModulesApiOptions(academicYear.id));
        // Le backend peut retourner { data: {...} } ou directement l'objet, ou un tableau (on prend le 1er)
        const resolved: TeacherChannel = Array.isArray(result)
          ? result[0] ?? {}
          : ((result as any)?.data ?? result ?? {});
        if (!cancelled) setChannel(resolved);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Erreur de chargement');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [academicYear?.id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        <span className="ml-2 text-slate-600">Chargement de votre chaîne enseignant...</span>
      </div>
    );
  }

  const name = channel?.name || channel?.title || 'Ma Chaîne Enseignant';
  const slogan = channel?.slogan || channel?.tagline || '';
  const subs = channel?.subs ?? channel?.subscribers ?? channel?.subscriberCount ?? 0;
  const status = channel?.status || 'ACTIVE';
  const isMonetized = channel?.isMonetized ?? channel?.monetizationEnabled ?? false;
  const balance = channel?.balance ?? channel?.availableBalance ?? '0';

  return (
    <div className="space-y-10">
      {error && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          ⚠ Impossible de charger votre chaîne enseignant. {error}
        </div>
      )}

      {/* Banner Preview */}
      <div className="relative h-64 bg-navy-900 rounded-[2.5rem] overflow-hidden group">
        <div className="absolute inset-0 bg-gradient-to-r from-navy-900 via-navy-900/40 to-transparent z-10" />
        <div className="absolute inset-0 flex items-center px-12 z-20">
          <div className="flex items-center gap-8">
            <div className="relative">
              <div className="w-32 h-32 bg-slate-200 rounded-full border-4 border-white overflow-hidden flex items-center justify-center text-slate-400">
                {channel?.avatar || channel?.avatarUrl ? (
                  <img src={channel.avatar || channel.avatarUrl || ''} alt={name} className="w-full h-full object-cover" />
                ) : (
                  <Camera className="w-8 h-8" />
                )}
              </div>
              <button className="absolute bottom-0 right-0 p-2 bg-[#C9A84C] rounded-full text-navy-900 shadow-lg border-2 border-white">
                <Edit3 className="w-4 h-4" />
              </button>
            </div>
            <div className="text-white space-y-2">
              <h2 className="text-3xl font-black tracking-tighter">{name}</h2>
              {slogan && <p className="text-white/60 font-medium italic">"{slogan}"</p>}
              <div className="flex items-center gap-4 pt-2">
                <span className="px-3 py-1 bg-white/10 backdrop-blur-md rounded-full text-[10px] font-black uppercase tracking-widest">{subs} Abonnés</span>
                <span className={`px-3 py-1 backdrop-blur-md rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 ${
                  status === 'ACTIVE' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
                }`}>
                  <CheckCircle2 className="w-3 h-3" />
                  {status === 'ACTIVE' ? 'Chaîne Active' : status}
                </span>
              </div>
            </div>
          </div>
        </div>
        <button className="absolute top-6 right-12 z-20 flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-md text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-white/20 transition-all">
          <ImageIcon className="w-4 h-4" />
          Modifier Bannière
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Management */}
        <div className="lg:col-span-2 space-y-8">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter">Gestion de ma Chaîne</h3>
            <button className="flex items-center gap-2 px-6 py-3 bg-navy-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-navy-900/10 hover:bg-navy-800 transition-all">
              <Plus className="w-4 h-4 text-[#C9A84C]" />
              Nouvelle Vidéo
            </button>
          </div>

          <div className="bg-white rounded-3xl border border-slate-200 p-8 space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Nom de la Chaîne</label>
                <input type="text" defaultValue={name} className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl text-slate-900 font-black outline-none focus:ring-2 focus:ring-blue-500/20 transition-all" />
              </div>
              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Slogan</label>
                <input type="text" defaultValue={slogan} className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl text-slate-900 font-black outline-none focus:ring-2 focus:ring-blue-500/20 transition-all" />
              </div>
            </div>
            <div className="space-y-3">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Description Longue</label>
              <textarea rows={4} className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl text-slate-900 font-black outline-none focus:ring-2 focus:ring-blue-500/20 transition-all resize-none" placeholder="Décrivez votre vision pédagogique..."></textarea>
            </div>
            <div className="flex justify-end">
              <button className="px-8 py-3 bg-[#C9A84C] text-navy-900 rounded-2xl font-black text-xs uppercase tracking-widest hover:scale-105 transition-all shadow-lg">Enregistrer les modifications</button>
            </div>
          </div>
        </div>

        {/* Right Column: Monetization Status */}
        <div className="space-y-8">
          <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter">Monétisation</h3>
          
          <div className={`rounded-3xl p-8 space-y-6 shadow-xl ${isMonetized ? 'bg-navy-900 text-white shadow-navy-900/20' : 'bg-slate-50 text-slate-400 border border-slate-200 shadow-none'}`}>
            <div className="flex items-center justify-between">
              <div className={`p-3 rounded-2xl ${isMonetized ? 'bg-[#C9A84C] text-navy-900' : 'bg-slate-200 text-slate-400'}`}>
                <ZapIcon className="w-6 h-6" />
              </div>
              {isMonetized && <span className="text-[10px] font-black uppercase tracking-widest text-[#C9A84C] animate-pulse">Activé</span>}
            </div>
            
            <div className="space-y-2">
              <h4 className="text-xl font-black">Programme Partenaire</h4>
              <p className={`text-xs leading-relaxed font-medium ${isMonetized ? 'text-white/60' : 'text-slate-400'}`}>
                Vendez vos cours et générez des revenus basés sur votre impact pédagogique.
              </p>
            </div>

            {isMonetized ? (
              <div className="pt-6 border-t border-white/10 space-y-4">
                <div className="flex justify-between items-end">
                  <div>
                    <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Solde Disponible</p>
                    <p className="text-3xl font-black text-[#C9A84C]">{balance} <span className="text-xs">F CFA</span></p>
                  </div>
                  <button className="text-[10px] font-black text-white uppercase tracking-widest hover:underline">Détails</button>
                </div>
                <button className="w-full py-4 bg-white/10 hover:bg-white/20 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all">Demander un paiement</button>
              </div>
            ) : (
              <button className="w-full py-4 bg-navy-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all">Demander l'éligibilité</button>
            )}
          </div>

          <div className="bg-amber-50 border border-amber-100 rounded-3xl p-6 flex items-start gap-4">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-1" />
            <div>
              <p className="text-sm font-black text-amber-900 uppercase tracking-tight">Conseil Sarah AI</p>
              <p className="text-xs text-amber-800/70 font-medium leading-relaxed">Vos capsules sur les "Fonctions Dérivées" génèrent 40% plus d'intérêt que la moyenne. Pensez à créer un pack premium.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ZapIcon({ className }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  );
}
