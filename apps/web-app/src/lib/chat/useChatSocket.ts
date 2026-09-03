/**
 * ============================================================================
 * USE CHAT SOCKET — Hook pour Socket.io (temps réel)
 * ============================================================================
 *
 * Connecte le frontend au ChatGateway (backend NestJS WebSocket /chat namespace).
 * Gère:
 *   - Connexion authentifiée (JWT dans le handshake)
 *   - Écoute des events 'message:new' (nouveaux messages en temps réel)
 *   - Écoute des events 'typing:start' / 'typing:stop'
 *   - Écoute des events 'user:online' / 'user:offline'
 *   - Reconnexion automatique
 *
 * ⭐ Remplace le polling (5s/15s) par des events push instantanés.
 * ============================================================================
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { io, Socket } from 'socket.io-client';

interface UseChatSocketOptions {
  /** JWT token pour authentifier la connexion Socket.io */
  token: string | null;
  /** UserId de l'utilisateur courant */
  userId: string | null;
  /** Callback quand un nouveau message arrive */
  onNewMessage?: (message: any) => void;
  /** Callback quand quelqu'un commence à taper */
  onTypingStart?: (conversationId: string, userId: string) => void;
  /** Callback quand quelqu'un arrête de taper */
  onTypingStop?: (conversationId: string, userId: string) => void;
  /** Callback quand un utilisateur passe en ligne */
  onUserOnline?: (userId: string) => void;
  /** Callback quand un utilisateur passe hors ligne */
  onUserOffline?: (userId: string) => void;
  /** ⭐ MENTIONS: Callback quand l'utilisateur courant est mentionné dans un message */
  onMention?: (data: { conversationId: string; messageId: string; senderId: string; content: string }) => void;
  /** ⭐ MESSAGE EDIT: Callback quand un message a été édité (pour rafraîchir l'affichage) */
  onMessageEdited?: (data: { messageId: string; content: string; editedAt: string }) => void;
  /** ⭐ MESSAGE DELETE: Callback quand un message a été supprimé */
  onMessageDeleted?: (data: { messageId: string }) => void;
  /** ⭐ REACTION: Callback quand une réaction a été ajoutée/supprimée */
  onReaction?: (data: { messageId: string; emoji: string; userId: string; action: 'added' | 'removed'; count: number }) => void;
}

export function useChatSocket(options: UseChatSocketOptions) {
  const { token, userId, onNewMessage, onTypingStart, onTypingStop, onUserOnline, onUserOffline, onMention, onMessageEdited, onMessageDeleted, onReaction } = options;
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  // ⭐ Pending listeners — queued when socket isn't ready yet, applied on connect
  const pendingListenersRef = useRef<Array<{ event: string; listener: any }>>([]);

  // ⭐ Stable refs for callbacks
  const callbacksRef = useRef({ onNewMessage, onTypingStart, onTypingStop, onUserOnline, onUserOffline, onMention, onMessageEdited, onMessageDeleted, onReaction });
  callbacksRef.current = { onNewMessage, onTypingStart, onTypingStop, onUserOnline, onUserOffline, onMention, onMessageEdited, onMessageDeleted, onReaction };

  useEffect(() => {
    if (!token || !userId) return;

    // ⭐ Determine the backend URL (same as the API server)
    // ⭐ V5.2 — CORRECTIF ROBUSTESSE `/api` : les gateways Socket.io vivent
    //    HORS du préfixe global `/api` (le namespace est /chat à la racine).
    //    NEXT_PUBLIC_API_URL accepte les DEUX formes — avec ou sans suffixe
    //    /api (cf. normalizeToNestApiRoot et la doc .env.example/README qui
    //    documentent `http://localhost:3000/api`). Sans strip, le handshake
    //    pointait vers `…/api/chat` → 404 → temps réel silencieusement mort.
    const stripApiSuffix = (u: string) => u.replace(/\/api\/?$/, '');
    const rawApiUrl = process.env.NEXT_PUBLIC_API_URL;
    // ⭐ V5 — CORRECTIF DEV : le web-app tourne sur 3001 mais la gateway
    //    Socket.io vit dans l'api-server NestJS (port 3000, namespace /chat).
    //    Avant, le client visait 3001 → connexion silencieusement impossible
    //    en dev → le polling 5 s faisait tout le travail temps réel.
    //    Override possible via NEXT_PUBLIC_API_URL (ex: Railway en test).
    const socketUrl = process.env.NODE_ENV === 'development'
      ? stripApiSuffix(rawApiUrl || 'http://localhost:3000')
      : stripApiSuffix(rawApiUrl || 'https://api.academiahelm.com');

    const socket = io(`${socketUrl}/chat`, {
      auth: { token },
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 3000,
      reconnectionAttempts: 10,
    });

    socketRef.current = socket;

    // ⭐ Process any pending listeners that were registered before socket connected
    pendingListenersRef.current.forEach(({ event, listener }) => {
      socket.on(event, listener);
    });
    pendingListenersRef.current = [];

    socket.on('connect', () => {
      setIsConnected(true);
      console.log('[Socket.io] Connected to /chat namespace');
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
      console.log('[Socket.io] Disconnected');
    });

    socket.on('message:new', (data: any) => {
      callbacksRef.current.onNewMessage?.(data);
    });

    socket.on('typing:start', (data: { conversationId: string; userId: string }) => {
      callbacksRef.current.onTypingStart?.(data.conversationId, data.userId);
    });

    socket.on('typing:stop', (data: { conversationId: string; userId: string }) => {
      callbacksRef.current.onTypingStop?.(data.conversationId, data.userId);
    });

    socket.on('user:online', (data: { userId: string }) => {
      callbacksRef.current.onUserOnline?.(data.userId);
    });

    socket.on('user:offline', (data: { userId: string }) => {
      callbacksRef.current.onUserOffline?.(data.userId);
    });

    // ⭐ MENTIONS: notified when the current user is @mentioned in a message
    socket.on('mention:new', (data: { conversationId: string; messageId: string; senderId: string; content: string }) => {
      callbacksRef.current.onMention?.(data);
    });

    // ⭐ MESSAGE EDIT: a message was edited — refresh the UI
    socket.on('message:edited', (data: { messageId: string; content: string; editedAt: string }) => {
      callbacksRef.current.onMessageEdited?.(data);
    });

    // ⭐ MESSAGE DELETE: a message was deleted — remove from UI
    socket.on('message:deleted', (data: { messageId: string }) => {
      callbacksRef.current.onMessageDeleted?.(data);
    });

    // ⭐ REACTION: a reaction was added/removed — update the UI
    socket.on('reaction:toggle', (data: { messageId: string; emoji: string; userId: string; action: 'added' | 'removed'; count: number }) => {
      callbacksRef.current.onReaction?.(data);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
      setIsConnected(false);
    };
  }, [token, userId]);

  /** Rejoindre une room de conversation (pour recevoir les events de cette conv) */
  const joinConversation = useCallback((conversationId: string) => {
    socketRef.current?.emit('conversation:join', { conversationId });
  }, []);

  /** Quitter une room de conversation */
  const leaveConversation = useCallback((conversationId: string) => {
    socketRef.current?.emit('conversation:leave', { conversationId });
  }, []);

  /** Notifier qu'on commence à taper */
  const startTyping = useCallback((conversationId: string) => {
    socketRef.current?.emit('typing:start', { conversationId });
  }, []);

  /** Notifier qu'on arrête de taper */
  const stopTyping = useCallback((conversationId: string) => {
    socketRef.current?.emit('typing:stop', { conversationId });
  }, []);

  // ⭐ V2.5: Expose raw socket methods for WebRTC call signaling
  //    The hook previously only returned wrapper functions (joinConversation, etc.)
  //    but the WebRTC call UI needs direct access to socket.on() / socket.off()
  //    for call:offer, call:answer, call:ice-candidate, call:reject, call:hangup.
  //    These wrappers delegate to socketRef.current, with a pending-queue fallback
  //    for listeners registered before the socket connects.
  const on = useCallback((event: string, listener: any) => {
    if (socketRef.current) {
      socketRef.current.on(event, listener);
    } else {
      // Socket not ready — queue for when it connects
      pendingListenersRef.current.push({ event, listener });
    }
  }, []);

  const off = useCallback((event: string, listener: any) => {
    socketRef.current?.off(event, listener);
    // Also remove from pending if it was queued
    pendingListenersRef.current = pendingListenersRef.current.filter(
      p => !(p.event === event && p.listener === listener)
    );
  }, []);

  const emit = useCallback((event: string, ...args: any[]) => {
    socketRef.current?.emit(event, ...args);
  }, []);

  return {
    isConnected,
    on,
    off,
    emit,
    joinConversation,
    leaveConversation,
    startTyping,
    stopTyping,
  };
}
