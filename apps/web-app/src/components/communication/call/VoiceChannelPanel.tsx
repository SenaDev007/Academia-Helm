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
 * La session média (LiveKit → Agora → Daily, fallback mesh) vit dans le
 * parent (WhatsAppChat) — ce composant est purement présentationnel.
 * ============================================================================
 */

import React from 'react';
import { Mic, MicOff, Video, VideoOff, Phone, Volume2, Users, Radio } from 'lucide-react';
import { cn } from '@/lib/utils';
import { providerLabel, type MediaProviderName } from '@/lib/chat/media-chain';

export interface VoiceChannelPanelProps {
  channelName: string;
  channelType?: string;          // VOICE | STAGE | GO_LIVE
  provider: MediaProviderName | 'mesh' | null;
  /** Utilisateurs connectés (état REST chat_voice_states, enrichi media). */
  users: Array<{ userId: string; name: string; muted?: boolean; speaking?: boolean; avatarUrl?: string | null }>;
  activeSpeakers: Set<string>;
  meMuted: boolean;
  videoMode: boolean;
  isStage: boolean;
  onToggleMute: () => void;
  onToggleVideo: () => void;
  onLeave: () => void;
}

export function VoiceChannelPanel(props: VoiceChannelPanelProps) {
  const {
    channelName, channelType, provider, users, activeSpeakers,
    meMuted, videoMode, isStage, onToggleMute, onToggleVideo, onLeave,
  } = props;

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
      </div>

      {/* Participants */}
      <div className="max-h-44 overflow-y-auto px-2 py-2 space-y-0.5">
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
                {(u.muted || (props.meMuted && false)) && <MicOff className="w-3 h-3 text-red-400" />}
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
            title="Caméra"
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
