/**
 * SARA API Client
 *
 * Public query endpoint + authenticated in-app chat endpoint.
 * Uses the shared apiClient from ./client.ts for non-streaming calls.
 * Uses native fetch for SSE streaming calls (longer timeout required).
 */

import { apiClient } from './client';
import { getApiBaseUrl } from '@/lib/utils/urls';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SaraChatResponse {
  content: string;
  sessionId?: string;
  suggestedActions?: Array<{
    type: string;
    label: string;
    description: string;
  }>;
  confidence?: number;
  executionMs?: number;
}

export interface SaraStreamChunk {
  type: 'delta' | 'reasoning' | 'status' | 'final' | 'error';
  text?: string;
  reasoningText?: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    reasoningTokens?: number;
  };
}

// ---------------------------------------------------------------------------
// Voice Types
// ---------------------------------------------------------------------------

export interface VoiceTranscribeResponse {
  text: string;
  language?: string;
  error?: string;
}

export interface VoiceSpeakResponse {
  audioBase64: string;
  format: string;
  durationMs?: number;
  error?: string;
}

export interface VoiceChatResponse {
  transcribedText: string;
  saraResponse: string;
  audioBase64: string;
  format: string;
  error?: string;
}

// ---------------------------------------------------------------------------
// API methods
// ---------------------------------------------------------------------------

export const saraApi = {
  /**
   * Public streaming query endpoint (landing page / marketing widget).
   * Uses SSE streaming for real-time response display.
   * Falls back to non-streaming if SSE fails.
   *
   * POST /sara/query/stream
   */
  queryStream: async function* (
    query: string,
    visitorId?: string,
    conversationHistory?: Array<{ role: string; content: string }>,
  ): AsyncGenerator<SaraStreamChunk> {
    const apiBaseUrl = getApiBaseUrl();
    const url = `${apiBaseUrl}/sara/query/stream`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          visitorId,
          messages: conversationHistory,
        }),
        signal: AbortSignal.timeout(60000), // 60s for AI streaming
      });

      if (!response.ok) {
        throw new Error(`SARA API error: ${response.status} ${response.statusText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body for streaming');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) continue;

          const jsonStr = trimmed.replace(/^data:\s*/, '');
          if (!jsonStr || jsonStr === '[DONE]') continue;

          try {
            const chunk: SaraStreamChunk = JSON.parse(jsonStr);
            yield chunk;
          } catch {
            // Ignore malformed SSE chunks
          }
        }
      }
    } catch (error: any) {
      console.error('[SARA Stream Error]', error?.message);
      // Fallback to non-streaming
      try {
        const result = await saraApi.query(query, visitorId, conversationHistory);
        // En fallback, on envoie le texte complet en un seul chunk 'final'
        // Pas de 'delta' pour éviter la duplication (le texte est déjà complet)
        yield {
          type: 'final',
          text: result.reply,
        };
      } catch (fallbackError: any) {
        yield {
          type: 'error',
          text: fallbackError?.message || 'Erreur de connexion',
        };
      }
    }
  },

  /**
   * Public query endpoint (landing page / marketing widget) — NON-STREAMING.
   * Supports conversation history for contextual responses.
   *
   * POST /sara/query
   */
  query: async (
    query: string,
    visitorId?: string,
    conversationHistory?: Array<{ role: string; content: string }>,
  ) => {
    // Use fetch directly with longer timeout instead of the 8s apiClient
    const apiBaseUrl = getApiBaseUrl();
    const url = `${apiBaseUrl}/sara/query`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query,
        visitorId,
        messages: conversationHistory,
      }),
      signal: AbortSignal.timeout(45000), // 45s timeout for AI calls
    });

    if (!response.ok) {
      throw new Error(`SARA API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  },

  /**
   * Authenticated in-app chat with SARA.
   *
   * POST /sara/chat
   */
  saraInAppChat: async (
    message: string,
    sessionId?: string,
  ): Promise<SaraChatResponse> => {
    const response = await apiClient.post<SaraChatResponse>('/sara/chat', {
      message,
      sessionId,
    });
    return response.data;
  },

  /**
   * Authenticated in-app chat with SARA (using /sara/inapp endpoint).
   * Supports user role and current module context.
   *
   * POST /sara/inapp
   */
  saraInAppGuide: async (
    query: string,
    userId: string,
    schoolId: string,
    userRole?: string,
    currentModule?: string,
    conversationHistory?: Array<{ role: string; content: string }>,
  ) => {
    const response = await apiClient.post('/sara/inapp', {
      query,
      userId,
      schoolId,
      userRole,
      currentModule,
      messages: conversationHistory,
    });
    return response.data;
  },

  /**
   * Get contextual suggestions based on user role and current module.
   *
   * POST /sara/suggestions
   */
  getSuggestions: async (
    userRole?: string,
    currentModule?: string,
  ) => {
    const response = await apiClient.post('/sara/suggestions', {
      userRole,
      currentModule,
    });
    return response.data;
  },

  // ═══════════════════════════════════════════════════════════════════════
  // VOICE API — Mode Vocal (ASR + TTS)
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Transcrire un audio en texte (ASR).
   * Utilisé pour convertir la voix de l'utilisateur en texte.
   *
   * POST /sara/voice/transcribe
   */
  voiceTranscribe: async (
    audioBase64: string,
  ): Promise<VoiceTranscribeResponse> => {
    const apiBaseUrl = getApiBaseUrl();
    const url = `${apiBaseUrl}/sara/voice/transcribe`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ audioBase64 }),
      signal: AbortSignal.timeout(30000), // 30s for ASR
    });

    if (!response.ok) {
      throw new Error(`ASR API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  },

  /**
   * Convertir du texte en audio (TTS).
   * Utilisé pour lire à voix haute la réponse de SARA.
   *
   * POST /sara/voice/speak
   */
  voiceSpeak: async (
    text: string,
    voice?: string,
    speed?: number,
  ): Promise<VoiceSpeakResponse> => {
    const apiBaseUrl = getApiBaseUrl();
    const url = `${apiBaseUrl}/sara/voice/speak`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, voice, speed }),
      signal: AbortSignal.timeout(30000), // 30s for TTS
    });

    if (!response.ok) {
      throw new Error(`TTS API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  },

  /**
   * Pipeline vocal complet : Audio → ASR → SARA → TTS → Audio.
   * Mode vocal immersif comme ChatGPT Voice.
   *
   * POST /sara/voice/chat
   */
  voiceChat: async (
    audioBase64: string,
    visitorId?: string,
    conversationHistory?: Array<{ role: string; content: string }>,
    voice?: string,
    speed?: number,
  ): Promise<VoiceChatResponse> => {
    const apiBaseUrl = getApiBaseUrl();
    const url = `${apiBaseUrl}/sara/voice/chat`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        audioBase64,
        visitorId,
        messages: conversationHistory,
        voice,
        speed,
      }),
      signal: AbortSignal.timeout(90000), // 90s for full pipeline
    });

    if (!response.ok) {
      throw new Error(`Voice Chat API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  },
};
