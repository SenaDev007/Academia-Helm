"use client";

/**
 * ============================================================================
 * MEDIA CHAIN — Adaptateurs multimédia client : LiveKit → Agora → Daily
 * ============================================================================
 *
 * ⭐ V4 (porté de « Yeshua Connect » / Christ Libère) :
 *
 * Directive : « LiveKit est la source de vérité ; si LiveKit a des
 * problèmes, Agora prend immédiatement le relais ; et si Agora a des
 * problèmes, Daily prend automatiquement le relais. »
 *
 * Ce module NORMALISE les trois SDK derrière une interface unique :
 *
 *   HcRemoteParticipant — ce que le rendu consomme (nom, photo, micro,
 *   caméra, parole active, attachement vidéo) — peu importe le réseau.
 *
 *   MediaSessionHandle  — ce que les contrôles appellent (couper micro /
 *   caméra, haut-parleur, raccrocher, partager l'écran).
 *
 * Les SDK Agora et Daily sont importés DYNAMIQUEMENT (bundle séparé) — la
 * page de messagerie ne paie leur poids QUE si un repli est réellement
 * nécessaire.
 *
 * L'orchestration de la chaîne (join → échec → failover serveur →
 * prochain fournisseur → …) vit dans le composant d'appel, qui possède
 * l'état React ; ce module reste pur et testable.
 *
 * ⚠️ Repli ultime : si la chaîne est ÉPUISÉE (aucun fournisseur configuré
 * ou tous en échec), le composant d'appel retombe sur le mesh WebRTC
 * existant (call:offer / group-call:invite via Socket.io, ≤5 participants)
 * — exactement le « Plan C » de Yeshua Connect.
 * ============================================================================
 */

// ⭐ PERF (chantier GTMetrix — spéc. §3/§4) : livekit-client (~160 Ko gz)
//    est chargé À LA DEMANDE au premier appel média — exactement le même
//    pattern que Agora (l. ~427) et Daily (l. ~568) plus bas dans ce fichier.
//    AVANT : import statique → le SDK LiveKit était dans le chunk des 3
//    routes Helm Connect (/app/communication/messages, /app/parent/messages,
//    /app/teacher/communication) même sans jamais lancer d'appel.
import type { RemoteParticipant, RemoteAudioTrack } from "livekit-client";

type LiveKitModule = typeof import("livekit-client");

let liveKitModulePromise: Promise<LiveKitModule> | null = null;

/** Charge (une seule fois) le SDK LiveKit — partagé entre tous les appels. */
function loadLiveKit(): Promise<LiveKitModule> {
  if (!liveKitModulePromise) {
    liveKitModulePromise = import("livekit-client");
  }
  return liveKitModulePromise;
}

// ═══════════════════════════════════════════════════════════════════════
//  Types partagés
// ═══════════════════════════════════════════════════════════════════════

export type MediaProviderName = "livekit" | "agora" | "daily";

/** Participant normalisé — SEULE forme que le rendu consomme. */
export interface HcRemoteParticipant {
  /** Chez LiveKit : userId Helm. Chez Agora : uid numérique. Chez Daily :
   *  session_id (userName transporté par Daily). */
  identity: string;
  name?: string;
  avatarUrl?: string;
  isMicrophoneEnabled: boolean;
  isCameraEnabled: boolean;
  isSpeaking: boolean;
  /** Attache la piste caméra à un <video> ; false si pas de vidéo. */
  attachVideo(el: HTMLVideoElement): boolean;
  /** Détache proprement la piste caméra de l'élément. */
  detachVideo(el: HTMLVideoElement): void;
}

/** Contrôles d'une session média connectée, quel que soit le fournisseur. */
export interface MediaSessionHandle {
  readonly provider: MediaProviderName;
  setMicEnabled(enabled: boolean): Promise<void>;
  setCameraEnabled(enabled: boolean): Promise<void>;
  setScreenShareEnabled(enabled: boolean): Promise<void>;
  setSpeakerEnabled(enabled: boolean): void;
  /** Attache la piste caméra LOCALE (PiP) ; false si pas de vidéo locale. */
  attachLocalVideo(el: HTMLVideoElement): boolean;
  disconnect(): void;
}

/** Bundle renvoyé par POST /api/chat/calls/media (arbitrage serveur). */
export interface MediaJoinBundle {
  provider: MediaProviderName;
  roomName: string;
  chain: MediaProviderName[];
  providersHealth?: Record<string, { configured: boolean; coolingDown: boolean }>;
  livekit?: { url: string; token: string };
  agora?: { appId: string; token: string; channel: string; uid: number };
  daily?: { url: string; token: string };
  exhausted?: boolean;
  reason?: string;
}

export interface MediaSessionEvents {
  /** Liste normalisée des participants distants (re-créée à chaque event —
   *  corrige au passage la mutabilité des objets LiveKit). */
  onParticipants(participants: HcRemoteParticipant[]): void;
  /** IDs des locuteurs actifs (pastille dorée Helm). */
  onActiveSpeakers(ids: Set<string>): void;
  /** Déconnexion/défaillance en cours d'appel → le composant déclenche le
   *  failover serveur (l'appel avance au fournisseur suivant). */
  onDisconnected(reason: string): void;
}

export interface MediaSessionOptions {
  video: boolean;
  participantName: string;
  /** Lookup applicatif identité → {nom, photo} (membres du canal/parti-
   *  cipants de la conversation) — utilisé par Agora (uid sans nom) et Daily. */
  resolveUser?(identity: string): { name?: string; avatarUrl?: string } | undefined;
  /** Lookup inverse pour Agora : uid numérique → profil. */
  resolveUserByUid?(uid: number): { name?: string; avatarUrl?: string } | undefined;
}

// ═══════════════════════════════════════════════════════════════════════
//  Appels API de la chaîne (arbitrage serveur) — via le BFF Next.js
// ═══════════════════════════════════════════════════════════════════════

/** POST /api/chat/calls/media { action: join } — bundle du fournisseur de l'appel. */
export async function fetchMediaJoin(
  kind: "call" | "voice",
  conversationId: string,
  callId?: string,
): Promise<MediaJoinBundle> {
  const res = await fetch("/api/chat/calls/media", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(
      kind === "call"
        ? { action: "join", callId }
        : { action: "join-voice", conversationId },
    ),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any).error || (err as any).backendError?.error || `Média: HTTP ${res.status}`);
  }
  return res.json();
}

/** POST /api/chat/calls/media { action: failover } — le fournisseur `from` a échoué. */
export async function fetchMediaFailover(
  kind: "call" | "voice",
  conversationId: string,
  callId: string | undefined,
  from: MediaProviderName,
  reason: string,
): Promise<MediaJoinBundle> {
  const res = await fetch("/api/chat/calls/media", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(
      kind === "call"
        ? { action: "failover", callId, from, reason }
        : { action: "failover-voice", conversationId, from, reason },
    ),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any).error || (err as any).backendError?.error || `Failover: HTTP ${res.status}`);
  }
  return res.json();
}

// ═══════════════════════════════════════════════════════════════════════
//  Fabrique de session — 1 seul point d'entrée pour les 3 SDK
// ═══════════════════════════════════════════════════════════════════════

export async function createMediaSession(
  bundle: MediaJoinBundle,
  opts: MediaSessionOptions,
  events: MediaSessionEvents,
): Promise<MediaSessionHandle> {
  switch (bundle.provider) {
    case "livekit":
      if (!bundle.livekit) throw new Error("Identifiants LiveKit manquants");
      return createLiveKitSession(bundle.livekit, opts, events);
    case "agora":
      if (!bundle.agora) throw new Error("Identifiants Agora manquants");
      return createAgoraSession(bundle.agora, opts, events);
    case "daily":
      if (!bundle.daily) throw new Error("Identifiants Daily manquants");
      return createDailySession(bundle.daily, opts, events);
  }
}

// ─────────────────────────────────────────────────────────────────────
//  Conteneur DOM caché pour l'audio distant (autoplay géré par adaptateur)
// ─────────────────────────────────────────────────────────────────────
let hiddenAudioContainer: HTMLDivElement | null = null;
function ensureHiddenAudioContainer(): HTMLDivElement | null {
  if (typeof document === "undefined") return null;
  if (!hiddenAudioContainer) {
    hiddenAudioContainer = document.createElement("div");
    hiddenAudioContainer.style.display = "none";
    document.body.appendChild(hiddenAudioContainer);
  }
  return hiddenAudioContainer;
}

function ensureAudioEl(key: string): HTMLAudioElement | null {
  const container = ensureHiddenAudioContainer();
  if (!container) return null;
  let el = container.querySelector<HTMLAudioElement>(`audio[data-hc="${key}"]`);
  if (!el) {
    el = document.createElement("audio");
    el.autoplay = true;
    try { el.setAttribute("playsinline", "true"); } catch {}
    el.setAttribute("data-hc", key);
    container.appendChild(el);
  }
  return el;
}
function removeAudioEl(key: string): void {
  const container = hiddenAudioContainer;
  if (!container) return;
  const el = container.querySelector<HTMLAudioElement>(`audio[data-hc="${key}"]`);
  if (el) {
    try { el.pause(); el.remove(); } catch {}
  }
}

// ═══════════════════════════════════════════════════════════════════════
//  1. LIVEKIT (source de vérité)
// ═══════════════════════════════════════════════════════════════════════

/** Wrapper immuable-consommable d'un RemoteParticipant LiveKit. */
class LiveKitParticipant implements HcRemoteParticipant {
  constructor(
    private readonly p: RemoteParticipant,
    private readonly lk: LiveKitModule,
    private readonly fallbackName?: string,
  ) {}
  get identity(): string { return this.p.identity; }
  get name(): string | undefined { return this.p.name || this.fallbackName; }
  get avatarUrl(): string | undefined {
    try {
      const meta = this.p.metadata ? JSON.parse(this.p.metadata) : null;
      const url = meta?.avatarUrl;
      return typeof url === "string" && url ? url : undefined;
    } catch {
      return undefined;
    }
  }
  get isMicrophoneEnabled(): boolean { return this.p.isMicrophoneEnabled; }
  get isCameraEnabled(): boolean { return this.p.isCameraEnabled; }
  get isSpeaking(): boolean { return this.p.isSpeaking; }
  attachVideo(el: HTMLVideoElement): boolean {
    const pub = this.p.getTrackPublication(this.lk.Track.Source.Camera);
    if (pub?.track && pub.isSubscribed) {
      try { pub.track.attach(el); return true; } catch { return false; }
    }
    return false;
  }
  detachVideo(el: HTMLVideoElement): void {
    try {
      const pub = this.p.getTrackPublication(this.lk.Track.Source.Camera);
      if (pub?.track) pub.track.detach(el);
    } catch {}
  }
}

async function createLiveKitSession(
  creds: { url: string; token: string },
  opts: MediaSessionOptions,
  events: MediaSessionEvents,
): Promise<MediaSessionHandle> {
  // ⭐ PERF : SDK chargé à la demande (voir commentaire d'import en tête de fichier)
  const lk = await loadLiveKit();
  const room = new lk.Room({
    adaptiveStream: true,
    dynacast: true,
    videoCaptureDefaults: { resolution: { width: 1280, height: 720 } },
  });
  let ended = false;
  let screenShareTrack: MediaStreamTrack | null = null;

  const emit = () => {
    events.onParticipants(
      Array.from(room.remoteParticipants.values()).map(
        (p) => new LiveKitParticipant(p, lk, opts.resolveUser?.(p.identity)?.name),
      ),
    );
  };

  room.on(lk.RoomEvent.TrackSubscribed, (track, publication, participant) => {
    // Audio distant → <audio> caché (autoplay) — sans attachement, on ne
    // s'entend pas. Vidéo → re-rendu (participant ré-émis).
    void publication;
    if (track.kind === "audio") {
      const el = ensureAudioEl(`lk-${participant.identity}`);
      if (el) {
        try { (track as RemoteAudioTrack).attach(el); } catch {}
        if (el.paused) el.play().catch(() => {});
      }
    }
    emit();
  });
  room.on(lk.RoomEvent.TrackUnsubscribed, (track, publication, participant) => {
    void publication;
    if (track.kind === "audio") removeAudioEl(`lk-${participant.identity}`);
    emit();
  });
  room.on(lk.RoomEvent.ParticipantConnected, emit);
  room.on(lk.RoomEvent.ParticipantDisconnected, emit);
  room.on(lk.RoomEvent.TrackMuted, emit);
  room.on(lk.RoomEvent.TrackUnmuted, emit);
  room.on(lk.RoomEvent.ActiveSpeakersChanged, (speakers) => {
    events.onActiveSpeakers(new Set(speakers.map((s) => s.identity)));
    emit();
  });
  room.on(lk.RoomEvent.Disconnected, (reason) => {
    if (ended) return;
    for (const p of room.remoteParticipants.keys()) removeAudioEl(`lk-${p}`);
    events.onDisconnected(`livekit: ${reason || "déconnecté"}`);
  });

  await room.connect(creds.url, creds.token);
  await room.localParticipant.setMicrophoneEnabled(true);
  await room.localParticipant.setCameraEnabled(opts.video);

  return {
    provider: "livekit",
    async setMicEnabled(enabled: boolean) {
      await room.localParticipant.setMicrophoneEnabled(enabled);
    },
    async setCameraEnabled(enabled: boolean) {
      await room.localParticipant.setCameraEnabled(enabled);
    },
    async setScreenShareEnabled(enabled: boolean) {
      if (enabled) {
        const displayStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
        screenShareTrack = displayStream.getVideoTracks()[0] || null;
        if (screenShareTrack) {
          await room.localParticipant.publishTrack(screenShareTrack);
          screenShareTrack.onended = () => { void room.localParticipant.unpublishTrack(screenShareTrack!); };
        }
      } else {
        if (screenShareTrack) {
          try { room.localParticipant.unpublishTrack(screenShareTrack); } catch {}
          screenShareTrack.stop();
          screenShareTrack = null;
        }
      }
    },
    setSpeakerEnabled(enabled: boolean) {
      const container = hiddenAudioContainer;
      if (!container) return;
      container.querySelectorAll<HTMLAudioElement>("audio[data-hc^='lk-']").forEach((el) => {
        el.muted = !enabled;
      });
    },
    attachLocalVideo(el: HTMLVideoElement): boolean {
      try {
        const pub = room.localParticipant.getTrackPublication(lk.Track.Source.Camera);
        if (pub?.track) { pub.track.attach(el); return true; }
        const screenPub = room.localParticipant.getTrackPublication(lk.Track.Source.ScreenShare);
        if (screenPub?.track) { screenPub.track.attach(el); return true; }
      } catch {}
      return false;
    },
    disconnect() {
      ended = true;
      try { screenShareTrack?.stop(); } catch {}
      try { room.disconnect(true); } catch {}
      const container = hiddenAudioContainer;
      container?.querySelectorAll<HTMLAudioElement>("audio[data-hc^='lk-']").forEach((el) => {
        try { el.pause(); el.remove(); } catch {}
      });
      events.onParticipants([]);
      events.onActiveSpeakers(new Set());
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════
//  2. AGORA (repli n°1) — SDK web chargé dynamiquement
// ═══════════════════════════════════════════════════════════════════════

interface AgoraRemoteUserLike {
  uid: number;
  hasAudio: boolean;
  hasVideo: boolean;
  audioTrack?: { play(): void; stop(): void } | null;
  videoTrack?: { getMediaStreamTrack?(): MediaStreamTrack | null; play(el: HTMLElement): void; stop(): void } | null;
}
interface AgoraClientLike {
  join(appId: string, channel: string, token: string, uid: number): Promise<number>;
  publish(tracks: Array<{ kind: string; setEnabled(b: boolean): void; stop(): void; close(): void }>): Promise<void>;
  unpublish(tracks: Array<{ kind: string; setEnabled(b: boolean): void; stop(): void; close(): void }>): Promise<void>;
  subscribe(user: AgoraRemoteUserLike, mediaType: "audio" | "video"): Promise<void>;
  on(evt: string, cb: (...args: unknown[]) => void): void;
  leave(): Promise<void>;
  remoteUsers: AgoraRemoteUserLike[];
}

/** Wrapper d'un utilisateur Agora distant (uid numérique sans nom — le nom
 *  vient du lookup applicatif resolveUserByUid). */
class AgoraParticipant implements HcRemoteParticipant {
  constructor(
    private readonly user: AgoraRemoteUserLike,
    private readonly profile?: { name?: string; avatarUrl?: string },
  ) {}
  get identity(): string { return String(this.user.uid); }
  get name(): string | undefined { return this.profile?.name; }
  get avatarUrl(): string | undefined { return this.profile?.avatarUrl; }
  get isMicrophoneEnabled(): boolean { return this.user.hasAudio; }
  get isCameraEnabled(): boolean { return this.user.hasVideo; }
  get isSpeaking(): boolean { return false; /* pas d'info fiable SDK web */ }
  attachVideo(el: HTMLVideoElement): boolean {
    const t = this.user.videoTrack;
    if (!t) return false;
    try {
      const raw = t.getMediaStreamTrack?.();
      if (raw) {
        el.srcObject = new MediaStream([raw]);
        el.play().catch(() => {});
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }
  detachVideo(el: HTMLVideoElement): void {
    try { el.srcObject = null; } catch {}
  }
}

async function createAgoraSession(
  creds: { appId: string; token: string; channel: string; uid: number },
  opts: MediaSessionOptions,
  events: MediaSessionEvents,
): Promise<MediaSessionHandle> {
  // Import dynamique : le SDK Agora (≈ 300 ko) ne charge qu'au repli.
  const AgoraRTC = (await import("agora-rtc-sdk-ng")) as unknown as {
    createClient(cfg: { mode: string; codec: string }): AgoraClientLike;
    createMicrophoneAudioTrack(): Promise<{ kind: string; setEnabled(b: boolean): void; stop(): void; close(): void }>;
    createCameraVideoTrack(): Promise<{ kind: string; setEnabled(b: boolean): void; stop(): void; close(): void }>;
  };
  const client = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
  let ended = false;
  let micTrack: { kind: string; setEnabled(b: boolean): void; stop(): void; close(): void } | null = null;
  let camTrack: { kind: string; setEnabled(b: boolean): void; stop(): void; close(): void } | null = null;

  const emit = () => {
    events.onParticipants(
      client.remoteUsers.map(
        (u) => new AgoraParticipant(u, opts.resolveUserByUid?.(u.uid)),
      ),
    );
  };

  client.on("user-published", async (...args: unknown[]) => {
    const user = args[0] as AgoraRemoteUserLike;
    const mediaType = args[1] as "audio" | "video";
    try {
      await client.subscribe(user, mediaType);
      if (mediaType === "audio") user.audioTrack?.play();
    } catch { /* best effort */ }
    emit();
  });
  client.on("user-unpublished", emit);
  client.on("user-left", emit);
  client.on("connection-state-change", (...args: unknown[]) => {
    const state = args[1] as string;
    if (!ended && (state === "DISCONNECTED" || state === "FAILED")) {
      events.onDisconnected(`agora: ${state}`);
    }
  });

  await client.join(creds.appId, creds.channel, creds.token, creds.uid);
  micTrack = await AgoraRTC.createMicrophoneAudioTrack();
  await client.publish([micTrack]);
  if (opts.video) {
    camTrack = await AgoraRTC.createCameraVideoTrack();
    await client.publish([camTrack]);
  }

  return {
    provider: "agora",
    async setMicEnabled(enabled: boolean) {
      micTrack?.setEnabled(enabled);
    },
    async setCameraEnabled(enabled: boolean) {
      camTrack?.setEnabled(enabled);
    },
    async setScreenShareEnabled(enabled: boolean) {
      // Agora repli : pas de partage d'écran dans ce mode dégradé —
      // la bascule caméra sert de repli visuel.
      void enabled;
      if (camTrack) await camTrack.setEnabled(enabled);
    },
    setSpeakerEnabled(enabled: boolean) {
      // Agora joue l'audio distant via ses propres éléments.
      const els = document.querySelectorAll<HTMLAudioElement>("audio");
      els.forEach((el) => { el.muted = !enabled; });
    },
    attachLocalVideo(el: HTMLVideoElement): boolean {
      if (!camTrack) return false;
      try {
        (camTrack as any).play?.(el);
        return true;
      } catch {
        return false;
      }
    },
    disconnect() {
      ended = true;
      try { micTrack?.stop(); micTrack?.close(); } catch {}
      try { camTrack?.stop(); camTrack?.close(); } catch {}
      client.leave().catch(() => {});
      events.onParticipants([]);
      events.onActiveSpeakers(new Set());
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════
//  3. DAILY (repli n°2) — callObject, chargé dynamiquement
// ═══════════════════════════════════════════════════════════════════════

interface DailyParticipantLike {
  session_id: string;
  user_name?: string;
  local?: boolean;
  audio?: boolean;
  video?: boolean;
  tracks?: Record<
    string,
    { state: string; persistentTrack?: MediaStreamTrack | null; track?: MediaStreamTrack | null }
  >;
}
interface DailyCallObjectLike {
  join(opts: { url: string; token?: string; userName?: string }): Promise<void>;
  leave(): Promise<void>;
  participants(): Record<string, DailyParticipantLike>;
  on(evt: string, cb: (ev: { participant?: DailyParticipantLike; activeSpeaker?: { session_id?: string }[] }) => void): void;
  setLocalAudio(b: boolean): Promise<boolean>;
  setLocalVideo(b: boolean): Promise<boolean>;
}

/** Wrapper d'un participant Daily. */
class DailyParticipant implements HcRemoteParticipant {
  constructor(
    private readonly p: DailyParticipantLike,
    private readonly fallbackName?: string,
  ) {}
  get identity(): string { return this.p.session_id; }
  get name(): string | undefined { return this.p.user_name || this.fallbackName; }
  get avatarUrl(): string | undefined { return undefined; }
  get isMicrophoneEnabled(): boolean { return !!this.p.audio; }
  get isCameraEnabled(): boolean { return !!this.p.video; }
  get isSpeaking(): boolean { return false; }
  attachVideo(el: HTMLVideoElement): boolean {
    const t = this.p.tracks?.["video"];
    const raw = t?.persistentTrack ?? t?.track ?? null;
    if (!raw || t?.state !== "playable") return false;
    try {
      el.srcObject = new MediaStream([raw]);
      el.play().catch(() => {});
      return true;
    } catch {
      return false;
    }
  }
  detachVideo(el: HTMLVideoElement): void {
    try { el.srcObject = null; } catch {}
  }
}

async function createDailySession(
  creds: { url: string; token: string },
  opts: MediaSessionOptions,
  events: MediaSessionEvents,
): Promise<MediaSessionHandle> {
  const Daily = (await import("@daily-co/daily-js")) as unknown as {
    createCallObject(): DailyCallObjectLike;
  };
  const call = Daily.createCallObject();
  let ended = false;
  const speakerIds = new Set<string>();

  const refreshAudio = () => {
    for (const p of Object.values(call.participants())) {
      if (p.local) continue;
      const t = p.tracks?.["audio"];
      const raw = t?.persistentTrack ?? t?.track ?? null;
      if (raw && t?.state === "playable") {
        const el = ensureAudioEl(`dly-${p.session_id}`);
        if (el) {
          if (!el.srcObject) {
            el.srcObject = new MediaStream([raw]);
          }
          el.play().catch(() => {});
        }
      } else {
        removeAudioEl(`dly-${p.session_id}`);
      }
    }
  };

  const emit = () => {
    events.onParticipants(
      Object.values(call.participants())
        .filter((p) => !p.local)
        .map((p) => new DailyParticipant(p, opts.resolveUser?.(p.session_id)?.name)),
    );
    events.onActiveSpeakers(new Set(speakerIds));
  };

  call.on("participant-joined", emit);
  call.on("participant-left", (ev) => {
    if (ev.participant) removeAudioEl(`dly-${ev.participant.session_id}`);
    emit();
  });
  call.on("participant-updated", () => {
    refreshAudio();
    emit();
  });
  call.on("track-started", refreshAudio);
  call.on("track-stopped", refreshAudio);
  call.on("active-speaker-change", (ev) => {
    speakerIds.clear();
    for (const s of ev.activeSpeaker ?? []) {
      if (s.session_id) speakerIds.add(s.session_id);
    }
    emit();
  });
  call.on("left-meeting", () => {
    if (!ended) events.onDisconnected("daily: a quitté la réunion");
  });
  call.on("error", () => {
    if (!ended) events.onDisconnected("daily: erreur réseau");
  });

  await call.join({ url: creds.url, token: creds.token, userName: opts.participantName });
  await call.setLocalAudio(true);
  await call.setLocalVideo(opts.video);

  return {
    provider: "daily",
    async setMicEnabled(enabled: boolean) {
      await call.setLocalAudio(enabled);
    },
    async setCameraEnabled(enabled: boolean) {
      await call.setLocalVideo(enabled);
    },
    async setScreenShareEnabled(enabled: boolean) {
      // Daily gère le partage d'écran via son propre UI (enable_screenshare)
      void enabled;
    },
    async setSpeakerEnabled(enabled: boolean) {
      const container = hiddenAudioContainer;
      container?.querySelectorAll<HTMLAudioElement>("audio[data-hc^='dly-']").forEach((el) => {
        el.muted = !enabled;
      });
    },
    attachLocalVideo(el: HTMLVideoElement): boolean {
      try {
        const local = call.participants()?.local;
        const t = local?.tracks?.["video"];
        const raw = t?.persistentTrack ?? t?.track ?? null;
        if (raw && t?.state === "playable") {
          el.srcObject = new MediaStream([raw]);
          el.play().catch(() => {});
          return true;
        }
      } catch {}
      return false;
    },
    disconnect() {
      ended = true;
      call.leave().catch(() => {});
      const container = hiddenAudioContainer;
      container?.querySelectorAll<HTMLAudioElement>("audio[data-hc^='dly-']").forEach((el) => {
        try { el.pause(); el.remove(); } catch {}
      });
      events.onParticipants([]);
      events.onActiveSpeakers(new Set());
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════
//  Utilitaires UI
// ═══════════════════════════════════════════════════════════════════════

/** Libellé francophone d'un fournisseur (badges UI « Réseau : … »). */
export function providerLabel(provider: MediaProviderName | 'mesh' | 'jitsi' | null | undefined): string {
  switch (provider) {
    case "livekit": return "LiveKit";
    case "agora": return "Agora";
    case "daily": return "Daily";
    case "jitsi": return "Jitsi (secours)";
    case "mesh": return "Mesh WebRTC";
    default: return "Mesh WebRTC";
  }
}

/** Erreur dédiée : la chaîne LiveKit → Agora → Daily est ÉPUISÉE (le
 *  module appelant retombe alors sur le mesh WebRTC existant). */
export class ChainExhaustedError extends Error {
  constructor(message = "Chaîne multimédia épuisée (LiveKit → Agora → Daily)") {
    super(message);
    this.name = "ChainExhaustedError";
  }
}

/** Timeout borné pour la création de session (12 s — porté de Yeshua
 *  `withTimeout`) : un fournisseur qui ne répond pas est considéré en
 *  échec et déclenche le failover. */
export function withTimeout<T>(promise: Promise<T>, ms: number, label = "session"): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label}: timeout ${ms} ms`)), ms);
    promise.then(
      (value) => { clearTimeout(timer); resolve(value); },
      (err) => { clearTimeout(timer); reject(err); },
    );
  });
}
