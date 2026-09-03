"use client";

/**
 * ============================================================================
 * VOICE CHANNEL PANEL — Panneau flottant des canaux vocaux (V4 Phase 1b/2)
 * ============================================================================
 *
 * ⭐ Porté de « Yeshua Connect » (VoiceChannelView) adapté au panneau latéral
 * Helm : quand l'utilisateur a rejoint un canal vocal, ce panneau flottant
 * (coin bas-gauche) affiche les participants connectés, les locuteurs actifs
 * (anneau doré), les contrôles micro/vidéo et le bouton Quitter.
 *
 * ⭐ V5 (parité Yeshua VoiceChannelView) :
 *   - GRILLE VIDÉO en mode vidéo (tuiles distantes + PiP locale « Vous »)
 *   - switch Audio↔Vidéo ADMIN (bascule collective du canal, propagée par
 *     le serveur à tous les membres via l'événement voice:video-mode)
 *   - bandeau « Le son est coupé par votre navigateur — cliquez ici »
 *     (autoplay bloqué) qui débloque la lecture audio distante
 *
 * La session média (LiveKit → Agora → Daily, fallback mesh) vit dans le
 * parent (WhatsAppChat) — ce composant est purement présentationnel.
 * ============================================================================
 */

import React, { useEffect, useRef } from 'react';
import { Mic, MicOff, Video, Phone, Volume2, Users, Radio, VolumeX, Zap, ZapOff, Play } from 'lucide-react';
import { cn } from '@/lib/utils';
import { providerLabel, type MediaProviderName, type HcRemoteParticipant } from '@/lib/chat/media-chain';

export interface VoiceChannelPanelProps {
  channelName: string;
  channelType?: string;          // VOICE | STAGE | GO_LIVE
  provider: MediaProviderName | 'mesh' | 'jitsi' | null;
  /** Utilisateurs connectés (état REST chat_voice_states, enrichi media). */
  users: Array<{ userId: string; name: string; muted?: boolean; speaking?: boolean; avatarUrl?: string | null }>;
  /** ⭐ V5 — participants média normalisés (grille vidéo en mode vidéo). */
  participants: HcRemoteParticipant[];
  activeSpeakers: Set<string>;
  meMuted: boolean;
  videoMode: boolean;
  isStage: boolean;
  /** ⭐ V5 — l'utilisateur est-il admin du canal (switch Audio↔Vidéo). */
  isAdmin?: boolean;
  /** ⭐ V5 — autoplay audio bloqué par le navigateur (bandeau de déblocage). */
  autoplayBlocked?: boolean;
  /** ⭐ V6 (parité Yeshua — Direct du canal / Go Live) : direct EN COURS sur
   *    CE canal (venant de GET /chat/live-streams), null sinon. */
  liveInfo?: { by: string; startedAt?: string } | null;
  /** ⭐ V6 — l'utilisateur courant EST le diffuseur du direct ? */
  iAmLiveHost?: boolean;
  /** ⭐ V6 — l'utilisateur a-t-il rejoint le canal vocal (pour « Rejoindre »). */
  joined?: boolean;
  /** ⭐ V6 — lancer le direct (admin — POST /chat/live-streams). */
  onStartLive?: () => void;
  /** ⭐ V6 — arrêter le direct (diffuseur — DELETE /chat/live-streams/:id). */
  onStopLive?: () => void;
  /** ⭐ V6 — rejoindre le canal pour écouter/regarder le direct. */
  onJoinLive?: () => void;
  /** ⭐ V6 — chaîne en cours de bascule (lancement direct). */
  liveSwitching?: boolean;
  onToggleMute: () => void;
  onToggleVideo: () => void;
  /** ⭐ V5 — bascule COLLECTIVE audio↔vidéo du canal (admin). */
  onToggleVideoMode: () => void;
  /** ⭐ V5 — débloquer la lecture audio (bandeau autoplay). */
  onUnlockAudio: () => void;
  resolveName?: (identity: string) => string | undefined;
  localVideoAttacher?: (el: HTMLVideoElement) => boolean;
  onLeave: () => void;
}

/** ⭐ V5 — Tuile vidéo d'un participant distant du canal vocal. */
function VoiceVideoTile({ p, isSpeaking, name, avatarUrl }: {
  p: HcRemoteParticipant; isSpeaking: boolean; name: string; avatarUrl?: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hasVideo = p.isCameraEnabled;
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    if (hasVideo) p.attachVideo(el);
    else p.detachVideo(el);
    return () => { if (el) { try { p.detachVideo(el); } catch {} } };
  }, [p, hasVideo]);
  return (
    <div className={cn(
      'relative aspect-video rounded-xl overflow-hidden bg-black/40 flex items-center justify-center',
      isSpeaking ? 'ring-2 ring-[#FFE08A]' : 'ring-1 ring-white/10',
    )}>
      {hasVideo ? (
        <video ref={videoRef} autoPlay playsInline className="w-full h-full object-contain" />
      ) : (
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#114FC4] to-[#1C6FE8] flex items-center justify-center text-white text-xs font-bold overflow-hidden">
          {avatarUrl ? <img src={avatarUrl} alt={name} className="w-full h-full object-cover" /> : (name || '?').slice(0, 2).toUpperCase()}
        </div>
      )}
      <span className="absolute bottom-1 left-1.5 px-1.5 py-px rounded bg-black/60 text-white text-[9px] font-medium max-w-[85%] truncate">{name}</span>
      {!p.isMicrophoneEnabled && <MicOff className="absolute top-1 right-1 w-3 h-3 text-red-400" />}
    </div>
  );
}

export function VoiceChannelPanel(props: VoiceChannelPanelProps) {
  const {
    channelName, channelType, provider, users, participants, activeSpeakers,
    meMuted, videoMode, isStage, isAdmin, autoplayBlocked,
    liveInfo, iAmLiveHost, joined, onStartLive, onStopLive, onJoinLive, liveSwitching,
    onToggleMute, onToggleVideo, onToggleVideoMode, onUnlockAudio, resolveName, localVideoAttacher, onLeave,
  } = props;

  const localVideoRef = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (localVideoRef.current && localVideoAttacher) {
      localVideoAttacher(localVideoRef.current);
    }
  }, [localVideoAttacher, videoMode, participants.length]);

  return (
    <div className="fixed bottom-4 left-4 z-40 w-64 rounded-2xl border border-[#FFE08A]/25 bg-[#0A2A5E]/95 backdrop-blur-md shadow-2xl text-white overflow-hidden">
      {/* Header */}
      <div className="px-3 py-2.5 flex items-center justify-between gap-2 border-b border-white/10">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-7 h-7 rounded-lg bg-[#FFE08A] flex items-center justify-center flex-shrink-0">
            <Radio className="w-3.5 h-3.5 text-[#0A2A5E]" />
          </span>
          <div className="min-w-0">
            <div className="text-xs font-bold truncate flex items-center gap-1.5">
              {channelName}
              {isStage && <span className="text-[8px] px-1 py-px rounded bg-[#FFE08A] text-[#0A2A5E] font-bold uppercase">Scène</span>}
            </div>
            <div className="text-[9px] text-white/60 flex items-center gap-1">
              <Users className="w-2.5 h-2.5" /> {users.length} en ligne · {providerLabel(provider)}
            </div>
          </div>
        </div>
        {/* ⭐ V5 — switch Audio↔Vidéo COLLECTIF (admin du canal uniquement) */}
        {isAdmin && (
          <button
            onClick={onToggleVideoMode}
            className={cn(
              'px-2 py-1 rounded-lg text-[9px] font-bold uppercase tracking-wide flex items-center gap-1 flex-shrink-0 transition',
              videoMode ? 'bg-[#FFE08A] text-[#0A2A5E]' : 'bg-white/15 text-white hover:bg-white/25',
            )}
            title={videoMode ? 'Repasser le canal en audio' : 'Passer le canal en vidéo (tous les participants)'}
          >
            <Video className="w-3 h-3" />
            {videoMode ? 'Vidéo' : 'Audio'}
          </button>
        )}
      </div>

      {/* ⭐ V5 — bandeau autoplay bloqué : « Le son est coupé par votre
          navigateur — cliquez ici pour l'activer » (parité Yeshua). */}
      {autoplayBlocked && (
        <button
          onClick={onUnlockAudio}
          className="w-full px-3 py-2 bg-amber-500/90 hover:bg-amber-500 text-[#0A2A5E] text-[10px] font-bold flex items-center justify-center gap-1.5 transition"
          title="Le navigateur a bloqué la lecture automatique de l'audio"
        >
          <VolumeX className="w-3.5 h-3.5" />
          Le son est coupé par votre navigateur — cliquez ici
        </button>
      )}

      {/* ⭐ V6 (parité Yeshua — bandeau DIRECT) : pastille verte pulsante +
          diffuseur + « Rejoindre » pour les non-connectés / « Arrêter » pour
          le diffuseur. Backend : GET/POST/DELETE /chat/live-streams. */}
      {liveInfo && (
        <div className="px-3 py-2 bg-emerald-500/20 border-b border-emerald-400/30 flex items-center gap-2">
          <span className="relative flex w-2 h-2 flex-shrink-0">
            <span className="absolute inline-flex w-full h-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
            <span className="relative inline-flex rounded-full w-2 h-2 bg-emerald-500" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-bold text-emerald-300 uppercase tracking-wide">En direct</div>
            <div className="text-[10px] text-white/80 truncate">{liveInfo.by} diffuse</div>
          </div>
          {iAmLiveHost ? (
            <button
              onClick={onStopLive}
              disabled={liveSwitching}
              className="px-2 py-1 rounded-lg text-[9px] font-bold bg-red-500 text-white hover:bg-red-600 flex-shrink-0 flex items-center gap-1 disabled:opacity-50"
            >
              <ZapOff className="w-3 h-3" /> Arrêter
            </button>
          ) : !joined ? (
            <button
              onClick={onJoinLive}
              className="px-2 py-1 rounded-lg text-[9px] font-bold bg-emerald-500 text-white hover:bg-emerald-600 flex-shrink-0 flex items-center gap-1"
            >
              <Play className="w-3 h-3" /> Rejoindre
            </button>
          ) : null}
        </div>
      )}
      {/* ⭐ V6 — bouton « Lancer un direct » (admin, canal non en direct) */}
      {!liveInfo && isAdmin && onStartLive && (
        <button
          onClick={onStartLive}
          disabled={liveSwitching}
          className="w-full px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white text-[9px] font-bold uppercase tracking-wide flex items-center justify-center gap-1.5 border-b border-white/10 disabled:opacity-50"
          title="Diffuser en direct dans ce canal (tous les abonnés sont alertés)"
        >
          <Zap className="w-3 h-3 text-[#FFE08A]" />
          {liveSwitching ? 'Lancement…' : 'Lancer un direct'}
        </button>
      )}

      {/* ⭐ V5 — GRILLE VIDÉO en mode vidéo (tuiles distantes + PiP locale) */}
      {videoMode && (
        <div className="p-2 space-y-2 border-b border-white/10 max-h-56 overflow-y-auto">
          {participants.length > 0 ? (
            <div className="grid grid-cols-2 gap-1.5">
              {participants.map((p) => {
                const user = users.find(u => u.userId === p.identity);
                const name = p.name || resolveName?.(p.identity) || user?.name || 'Participant';
                return (
                  <VoiceVideoTile
                    key={p.identity}
                    p={p}
                    isSpeaking={activeSpeakers.has(p.identity) || !!user?.speaking}
                    name={name}
                    avatarUrl={user?.avatarUrl || undefined}
                  />
                );
              })}
              {/* PiP locale « Vous » (miroir) */}
              <div className="relative aspect-video rounded-xl overflow-hidden bg-black/40 ring-1 ring-white/10 flex items-center justify-center">
                <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-contain" style={{ transform: 'scaleX(-1)' }} />
                <span className="absolute bottom-1 left-1.5 px-1.5 py-px rounded bg-black/60 text-white text-[9px] font-medium">Vous</span>
              </div>
            </div>
          ) : (
            <div className="px-1 py-2 text-center text-[10px] text-white/50">
              Mode vidéo activé — en attente d'autres participants…
            </div>
          )}
        </div>
      )}

      {/* Participants (liste audio) */}
      <div className={cn('overflow-y-auto px-2 py-2 space-y-0.5', !videoMode && 'max-h-44')}>
        {users.map((u) => {
          const speaking = activeSpeakers.has(u.userId) || u.speaking;
          return (
            <div
              key={u.userId}
              className={cn(
                'flex items-center gap-2 px-2 py-1.5 rounded-lg transition-colors',
                speaking ? 'bg-[#FFE08A]/15' : 'hover:bg-white/5',
              )}
            >
              <div className={cn(
                'relative w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-bold overflow-hidden bg-gradient-to-br from-[#114FC4] to-[#1C6FE8] ring-2',
                speaking ? 'ring-[#FFE08A]' : 'ring-transparent',
              )}>
                {u.avatarUrl
                  ? <img src={u.avatarUrl} alt={u.name} className="w-full h-full object-cover" />
                  : (u.name || '?').split(/\s+/).slice(0, 2).map((s: string) => s[0]?.toUpperCase()).join('')}
              </div>
              <span className="text-xs font-medium truncate flex-1">{u.name}</span>
              {/* Icônes d'état */}
              <span className="flex items-center gap-1 flex-shrink-0">
                {speaking && <Volume2 className="w-3 h-3 text-[#FFE08A]" />}
                {u.muted && <MicOff className="w-3 h-3 text-red-400" />}
              </span>
            </div>
          );
        })}
        {users.length === 0 && (
          <div className="px-2 py-3 text-center text-[10px] text-white/50">
            Personne d'autre pour le moment — invitez vos collègues !
          </div>
        )}
      </div>

      {/* Contrôles */}
      <div className="px-3 py-2.5 border-t border-white/10 flex items-center justify-center gap-2">
        <button
          onClick={onToggleMute}
          className={cn(
            'w-9 h-9 rounded-full flex items-center justify-center transition-colors',
            meMuted ? 'bg-[#FFE08A] text-[#0A2A5E]' : 'bg-white/15 text-white hover:bg-white/25',
          )}
          title={meMuted ? 'Activer le micro' : 'Couper le micro'}
        >
          {meMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
        </button>
        {(videoMode || channelType === 'GO_LIVE') && (
          <button
            onClick={onToggleVideo}
            className="w-9 h-9 rounded-full bg-white/15 text-white hover:bg-white/25 flex items-center justify-center"
            title="Caméra (personnelle)"
          >
            <Video className="w-4 h-4" />
          </button>
        )}
        <button
          onClick={onLeave}
          className="w-11 h-9 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center transition-transform hover:scale-105"
          title="Quitter le canal vocal"
        >
          <Phone className="w-4 h-4 rotate-[135deg]" />
        </button>
      </div>
    </div>
  );
}

export default VoiceChannelPanel;
