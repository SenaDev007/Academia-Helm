"use client";

/**
 * ============================================================================
 * CALL SESSION OVERLAY — Écran d'appel unifié Helm Connect (V4)
 * ============================================================================
 *
 * ⭐ Porté de « Yeshua Connect » (CallOverlay + IncomingCallOverlay +
 * VoiceChannelView), palette Academia Helm conservée (bleu royal + or).
 *
 * Un seul composant pour TOUS les états :
 *   - incoming  : sonnerie + Accepter/Refuser (1-1 ET appels de groupe —
 *                 fin de l'auto-accept V3-6)
 *   - outgoing  : « Appel en cours… » + sonnerie d'appel
 *   - active    : grille de participants (vidéo/audio), locuteurs actifs
 *                 (anneau doré), minuteur, contrôles
 *
 * ⭐ Caractéristiques du port Yeshua :
 *   - badge « Réseau : LiveKit/Agora/Daily/Mesh WebRTC » (diagnostic, aucun secret)
 *   - bandeau « Bascule automatique vers le réseau de secours… » pendant le failover
 *   - grille adaptative 1/2/3/4 colonnes selon le nombre de participants
 *   - pastille rouge micro-coupé par tuile, anneau doré locuteur actif
 *   - PiP vidéo locale (coin bas-droit)
 *   - vibration mobile sur appel entrant (400 ms) + halo pulsant or/azur
 * ============================================================================
 */

import React, { useEffect, useRef } from 'react';
import { Phone, Video, MicOff, Mic, VideoOff, Monitor, Volume2, Loader2, Signal, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { HcRemoteParticipant, MediaProviderName } from '@/lib/chat/media-chain';
import { providerLabel } from '@/lib/chat/media-chain';

export interface CallSessionInfo {
  callId: string;
  callType: 'AUDIO' | 'VIDEO';
  /** Titre affiché (nom de l'appelant en 1-1, nom du groupe/canal sinon). */
  title: string;
  /** Sous-titre (nom du groupe pour un 1-1, « N participants » sinon). */
  subtitle?: string;
  avatarUrl?: string | null;
  isGroup: boolean;
  isInitiator: boolean;
  conversationId: string;
}

export interface CallSessionOverlayProps {
  state: 'incoming' | 'outgoing' | 'active';
  info: CallSessionInfo;
  /** Participants distants normalisés (media session) — [] en mesh. */
  participants: HcRemoteParticipant[];
  /** IDs des locuteurs actifs (anneau doré). */
  activeSpeakers: Set<string>;
  duration: number;
  provider: MediaProviderName | 'mesh' | null;
  mediaSwitching: boolean;
  muted: boolean;
  videoOff: boolean;
  isSharingScreen: boolean;
  speakerOn: boolean;
  myName: string;
  currentUserId: string;
  onAccept: () => void;
  onDecline: () => void;
  onHangup: () => void;
  onToggleMute: () => void;
  onToggleVideo: () => void;
  onToggleScreenShare: () => void;
  onToggleSpeaker: () => void;
  /** Lookup nom/avatar d'un participant distant. */
  resolveName?: (identity: string) => string | undefined;
  resolveAvatar?: (identity: string) => string | undefined;
  /** Attache la vidéo locale (PiP) au <video> fourni — via le handle de
   *  session média du parent (aucun état local dupliqué). */
  localVideoAttacher?: (el: HTMLVideoElement) => boolean;
}

/** Halo pulsant or (extérieur) + azur (milieu) — identité Helm. */
function PulsingAvatar({ name, avatarUrl, size = 128, initials }: {
  name: string; avatarUrl?: string | null; size?: number; initials: string;
}) {
  return (
    <div className="relative mx-auto mb-5" style={{ width: size, height: size }}>
      <div className="absolute -inset-3 rounded-full bg-[#CFA63A] opacity-30 animate-ping" style={{ animationDuration: '1.8s' }} />
      <div className="absolute -inset-1 rounded-full bg-[#FFE08A] opacity-50 animate-pulse" style={{ animationDuration: '1.2s' }} />
      <div className={cn(
        'relative rounded-full flex items-center justify-center text-white font-bold ring-4 ring-[#FFE08A]/80 shadow-2xl overflow-hidden bg-gradient-to-br from-[#114FC4] to-[#1C6FE8]',
        size > 100 ? 'text-4xl' : 'text-xl',
      )} style={{ width: size, height: size }}>
        {avatarUrl
          ? <img src={avatarUrl} alt={name} className="w-full h-full object-cover" />
          : initials}
      </div>
    </div>
  );
}

function initialsOf(name: string | undefined): string {
  if (!name) return '?';
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('') || '?';
}

/** Une tuile de la grille de participants. */
function ParticipantTile({ p, isSpeaking, isMe, name, avatarUrl }: {
  p?: HcRemoteParticipant; isSpeaking: boolean; isMe: boolean; name: string; avatarUrl?: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hasVideo = p ? p.isCameraEnabled : false;

  useEffect(() => {
    const el = videoRef.current;
    if (!el || !p) return;
    if (hasVideo) {
      p.attachVideo(el);
    } else {
      p.detachVideo(el);
    }
    return () => { if (el) { try { p.detachVideo(el); } catch {} } };
  }, [p, hasVideo]);

  return (
    <div className={cn(
      'relative aspect-video rounded-2xl overflow-hidden flex items-center justify-center transition-all duration-300',
      isSpeaking
        ? 'border-2 border-[#FFE08A] shadow-[0_0_24px_rgba(255,224,138,0.35)] bg-[#0A2A5E]/70'
        : 'border border-white/10 bg-[#0A2A5E]/50',
    )}>
      {hasVideo ? (
        <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
      ) : (
        <div className="flex flex-col items-center gap-2">
          <div className={cn(
            'w-20 h-20 rounded-full flex items-center justify-center text-white text-2xl font-bold ring-4 overflow-hidden',
            isSpeaking ? 'ring-[#FFE08A]/60' : 'ring-white/10',
            'bg-gradient-to-br from-[#114FC4] to-[#1C6FE8]',
          )}>
            {avatarUrl ? <img src={avatarUrl} alt={name} className="w-full h-full object-cover" /> : initialsOf(name)}
          </div>
          <span className="text-white text-sm font-medium">{isMe ? 'Vous' : name}</span>
        </div>
      )}
      {/* Badge nom + micro */}
      <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between gap-2 px-2 py-0.5">
        <span className="px-2 py-0.5 rounded bg-black/50 text-white text-xs font-medium truncate">
          {isMe ? 'Vous' : name}
        </span>
        {p && !p.isMicrophoneEnabled && (
          <span className="w-5 h-5 rounded-full bg-red-500/90 flex items-center justify-center flex-shrink-0">
            <MicOff className="w-3 h-3 text-white" />
          </span>
        )}
      </div>
      {/* Pastille locuteur actif */}
      {isSpeaking && (
        <span className="absolute top-2 right-2 w-3 h-3 rounded-full bg-[#FFE08A] animate-pulse" />
      )}
    </div>
  );
}

/** Barre de contrôles partagée (pill Helm). */
function ControlBar(props: {
  state: 'outgoing' | 'active';
  isVideo: boolean;
  muted: boolean; videoOff: boolean; isSharingScreen: boolean; speakerOn: boolean;
  onToggleMute: () => void; onToggleVideo: () => void;
  onToggleScreenShare: () => void; onToggleSpeaker: () => void; onHangup: () => void;
}) {
  const { state, isVideo, muted, videoOff, isSharingScreen, speakerOn,
    onToggleMute, onToggleVideo, onToggleScreenShare, onToggleSpeaker, onHangup } = props;
  return (
    <div className="w-full pb-10 flex justify-center z-30">
      <div className="flex items-center gap-2 px-6 py-4 rounded-full bg-[#0A2A5E]/70 backdrop-blur-md border border-[#FFE08A]/20 flex-wrap justify-center">
        {state === 'active' && (
          <button onClick={onToggleMute} className="flex flex-col items-center gap-1 px-3">
            <div className={cn('w-12 h-12 rounded-full flex items-center justify-center text-white transition-colors', muted ? 'bg-[#FFE08A]' : 'bg-white/20')}>
              {muted ? <MicOff className="w-5 h-5 text-[#0A2A5E]" /> : <Mic className="w-5 h-5" />}
            </div>
            <span className="text-[10px] text-white/80">{muted ? 'Activer' : 'Micro'}</span>
          </button>
        )}
        {state === 'active' && isVideo && (
          <button onClick={onToggleVideo} className="flex flex-col items-center gap-1 px-3">
            <div className={cn('w-12 h-12 rounded-full flex items-center justify-center text-white transition-colors', videoOff ? 'bg-[#FFE08A]' : 'bg-white/20')}>
              {videoOff ? <VideoOff className="w-5 h-5 text-[#0A2A5E]" /> : <Video className="w-5 h-5" />}
            </div>
            <span className="text-[10px] text-white/80">{videoOff ? 'Caméra' : 'Vidéo'}</span>
          </button>
        )}
        {state === 'active' && (
          <button onClick={onToggleScreenShare} className="flex flex-col items-center gap-1 px-3" title={isSharingScreen ? 'Arrêter le partage' : 'Partager votre écran'}>
            <div className={cn('w-12 h-12 rounded-full flex items-center justify-center text-white transition-colors', isSharingScreen ? 'bg-[#FFE08A]' : 'bg-white/20')}>
              <Monitor className="w-5 h-5" />
            </div>
            <span className="text-[10px] text-white/80">{isSharingScreen ? 'Arrêter' : 'Écran'}</span>
          </button>
        )}
        {state === 'active' && (
          <button onClick={onToggleSpeaker} className="flex flex-col items-center gap-1 px-3">
            <div className={cn('w-12 h-12 rounded-full flex items-center justify-center text-white transition-colors', speakerOn ? 'bg-white/20' : 'bg-[#FFE08A]')}>
              <Volume2 className={cn('w-5 h-5', !speakerOn && 'text-[#0A2A5E] opacity-70')} />
            </div>
            <span className="text-[10px] text-white/80">{speakerOn ? 'Haut-parleur' : 'Muet'}</span>
          </button>
        )}
        <button onClick={onHangup} className="flex flex-col items-center gap-1 px-3">
          <div className="w-14 h-14 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center text-white shadow-lg transition-transform hover:scale-110">
            <Phone className="w-6 h-6 rotate-[135deg]" />
          </div>
          <span className="text-[10px] text-white/80">{state === 'active' ? 'Terminer' : 'Annuler'}</span>
        </button>
      </div>
    </div>
  );
}

export function CallSessionOverlay(props: CallSessionOverlayProps) {
  const {
    state, info, participants, activeSpeakers, duration, provider, mediaSwitching,
    muted, videoOff, isSharingScreen, speakerOn, myName,
    onAccept, onDecline, onHangup, onToggleMute, onToggleVideo, onToggleScreenShare, onToggleSpeaker,
    resolveName, resolveAvatar, localVideoAttacher,
  } = props;

  // Vibration mobile sur appel entrant (porté de Yeshua — 400 ms)
  useEffect(() => {
    if (state === 'incoming' && typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try { navigator.vibrate?.(400); } catch {}
    }
  }, [state]);

  const isVideo = info.callType === 'VIDEO';
  const remoteCount = participants.length;
  const totalParticipants = remoteCount + 1; // + moi

  const gridCols = totalParticipants <= 1 ? 'grid-cols-1'
    : totalParticipants === 2 ? 'grid-cols-1 sm:grid-cols-2'
    : totalParticipants <= 4 ? 'grid-cols-2'
    : totalParticipants <= 9 ? 'grid-cols-2 sm:grid-cols-3'
    : 'grid-cols-3 sm:grid-cols-4';

  // ═════════════════════════════════════════════════════════════════
  //  ÉTAT ENTRANT — sonnerie + Accepter / Refuser (1-1 ET groupe)
  // ═════════════════════════════════════════════════════════════════
  if (state === 'incoming') {
    return (
      <div className="fixed inset-0 bg-gradient-to-br from-[#0A2A5E] via-[#114FC4] to-[#1C6FE8] z-[60] flex flex-col items-center justify-between p-8">
        <div className="pt-8 text-center">
          <p className="text-sm text-[#FFE08A] font-medium tracking-wider uppercase">
            Appel {info.isGroup ? 'de groupe ' : ''}entrant Helm Connect
          </p>
        </div>
        <div className="text-center">
          <PulsingAvatar name={info.title} avatarUrl={info.avatarUrl} initials={initialsOf(info.title)} />
          <h2 className="text-2xl font-bold text-white mb-1">{info.title}</h2>
          {info.subtitle && (
            <p className="text-sm text-white/70 mb-3 flex items-center justify-center gap-1">
              <Users className="w-3.5 h-3.5" /> {info.subtitle}
            </p>
          )}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur-sm border border-[#FFE08A]/30">
            <span className="relative flex h-7 w-7">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#FFE08A] opacity-50" />
              <span className="relative inline-flex rounded-full h-7 w-7 bg-[#FFE08A] items-center justify-center">
                {isVideo ? <Video className="w-4 h-4 text-[#0A2A5E]" /> : <Phone className="w-4 h-4 text-[#0A2A5E]" />}
              </span>
            </span>
            <span className="text-sm font-semibold text-white">{isVideo ? 'Appel vidéo' : 'Appel audio'}</span>
          </div>
        </div>
        <div className="flex justify-center gap-16 pb-10">
          <button onClick={onDecline} className="flex flex-col items-center gap-2">
            <div className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center text-white shadow-lg transition-transform hover:scale-110">
              <Phone className="w-7 h-7 rotate-[135deg]" />
            </div>
            <span className="text-xs text-white/80">Refuser</span>
          </button>
          <button onClick={onAccept} className="flex flex-col items-center gap-2">
            <div className="w-16 h-16 rounded-full bg-[#FFE08A] hover:bg-[#CFA63A] flex items-center justify-center text-[#0A2A5E] shadow-lg animate-pulse">
              <Phone className="w-7 h-7" />
            </div>
            <span className="text-xs text-white/80">Accepter</span>
          </button>
        </div>
      </div>
    );
  }

  // ═════════════════════════════════════════════════════════════════
  //  ÉTATS SORTANT + ACTIF — grille de participants + contrôles
  // ═════════════════════════════════════════════════════════════════
  return (
    <div className="fixed inset-0 bg-gradient-to-br from-[#0A2A5E] via-[#114FC4] to-[#1C6FE8] z-[60] flex flex-col items-center justify-between">
      {/* ⭐ Bandeau failover (porté de Yeshua) : bascule automatique réseau */}
      {mediaSwitching && (
        <div className="absolute top-0 left-0 right-0 z-30 bg-[#CFA63A]/95 text-[#0A2A5E] text-center py-1.5 px-3 flex items-center justify-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-xs font-semibold">Bascule automatique vers le réseau de secours…</span>
        </div>
      )}

      {/* Top bar : titre + minuteur + badge réseau */}
      <div className="absolute top-0 left-0 right-0 p-4 pt-6 flex items-center justify-center gap-2 z-10 flex-wrap">
        <span className="text-white font-bold text-lg">{info.title}</span>
        {state === 'active' && (
          <span className="text-[#FFE08A] font-mono text-sm">
            {Math.floor(duration / 60)}:{(duration % 60).toString().padStart(2, '0')}
          </span>
        )}
        {/* ⭐ Badge réseau (diagnostic — aucun secret) */}
        <span className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/10 border border-white/20 text-white/90 text-[10px] font-medium">
          <Signal className="w-3 h-3 text-[#FFE08A]" />
          Réseau : {providerLabel(provider)}
        </span>
        {state === 'active' && totalParticipants > 1 && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/10 border border-white/20 text-white/90 text-[10px] font-medium">
            <Users className="w-3 h-3 text-[#FFE08A]" /> {totalParticipants}
          </span>
        )}
      </div>

      {/* Grille de participants (active) ou avatar (outgoing) */}
      {state === 'active' ? (
        <div className="flex-1 flex items-center justify-center p-4 pt-16 w-full max-w-5xl overflow-y-auto">
          <div className={cn('grid gap-3 w-full', gridCols)}>
            {/* Participants distants (media session normalisée) */}
            {participants.map((p) => (
              <ParticipantTile
                key={p.identity}
                p={p}
                isSpeaking={activeSpeakers.has(p.identity) || p.isSpeaking}
                isMe={false}
                name={p.name || resolveName?.(p.identity) || 'Participant'}
                avatarUrl={p.avatarUrl || resolveAvatar?.(p.identity)}
              />
            ))}
          </div>
        </div>
      ) : (
        /* Outgoing : avatar + sonnerie */
        <div className="text-center z-10 pt-20">
          <PulsingAvatar name={info.title} avatarUrl={info.avatarUrl} size={128} initials={initialsOf(info.title)} />
          <h2 className="text-2xl font-bold text-white mb-1">{info.title}</h2>
          <p className="text-[#FFE08A]/90 mb-2">Appel en cours…</p>
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur-sm border border-[#FFE08A]/30">
            <span className="relative flex h-7 w-7">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#FFE08A] opacity-50" />
              <span className="relative inline-flex rounded-full h-7 w-7 bg-[#FFE08A] items-center justify-center">
                {isVideo ? <Video className="w-4 h-4 text-[#0A2A5E]" /> : <Phone className="w-4 h-4 text-[#0A2A5E]" />}
              </span>
            </span>
            <span className="text-sm font-semibold text-white">{isVideo ? 'Appel vidéo' : 'Appel audio'}</span>
            <span className="text-xs text-[#FFE08A]/70 ml-1">— Helm Connect</span>
          </div>
        </div>
      )}

      {/* PiP vidéo locale (appels vidéo actifs) */}
      {isVideo && state === 'active' && (
        <video
          ref={(el) => { if (el) localVideoAttacher?.(el); }}
          autoPlay playsInline muted
          className={cn(
            'absolute bottom-32 right-4 w-32 h-48 rounded-2xl object-cover border-2 border-[#FFE08A]/40 z-20 bg-black/40',
            (videoOff || isSharingScreen) && 'opacity-60',
          )}
        />
      )}

      <ControlBar
        state={state}
        isVideo={isVideo}
        muted={muted}
        videoOff={videoOff}
        isSharingScreen={isSharingScreen}
        speakerOn={speakerOn}
        onToggleMute={onToggleMute}
        onToggleVideo={onToggleVideo}
        onToggleScreenShare={onToggleScreenShare}
        onToggleSpeaker={onToggleSpeaker}
        onHangup={onHangup}
      />
    </div>
  );
}

export default CallSessionOverlay;
