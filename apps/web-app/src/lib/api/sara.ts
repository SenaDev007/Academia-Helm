/**
 * SARA API Client
 *
 * Public query endpoint + authenticated in-app chat endpoint.
 * Uses the shared apiClient from ./client.ts for non-streaming calls.
 * Uses native fetch for SSE streaming calls (longer timeout required).
 */

import { apiClient } from './client';
import { getApiBaseUrl } from '@/lib/utils/urls';
import { getClientToken } from '@/lib/auth/session-client';

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
      // Fallback to non-streaming — yield both delta AND final like in the working commit 1f7fbfa
      // The delta gives immediate feedback, the final signals completion
      try {
        const result = await saraApi.query(query, visitorId, conversationHistory);
        yield {
          type: 'delta',
          text: result.reply,
        };
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

  /**
   * Sarah Guide In-App — Navigation & Onboarding assistant (GLOBAL, no tenant data).
   *
   * ⚠️ DIFFÉRENCE avec saraInAppGuide :
   *   - Sarah Guide est GLOBALE (pas multi-tenant strict)
   *   - Elle n'accède à AUCUNE donnée de l'école
   *   - Elle aide UNIQUEMENT à la navigation, l'onboarding, l'explication des modules
   *   - Elle redirige vers ORION/ATLAS/modules pour les données et actions
   *
   * POST /sara/guide/stream
   */
  guideStream: async function* (
    query: string,
    userRole?: string,
    currentModule?: string,
    conversationHistory?: Array<{ role: string; content: string }>,
  ): AsyncGenerator<SaraStreamChunk> {
    const apiBaseUrl = getApiBaseUrl();
    const url = `${apiBaseUrl}/sara/guide/stream`;

    try {
      // Récupérer le token JWT et le tenant ID comme le fait apiClient
      const token = getClientToken();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      if (typeof window !== 'undefined') {
        const tenantId = document.cookie
          .split('; ')
          .find(row => row.startsWith('x-tenant-id='))
          ?.split('=')[1];
        if (tenantId) {
          headers['X-Tenant-ID'] = tenantId;
        }
      }

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          query,
          userRole,
          currentModule,
          messages: conversationHistory,
        }),
        signal: AbortSignal.timeout(60000),
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`Sarah Guide API error: ${response.status} ${response.statusText}`);
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
      console.error('[Sarah Guide Stream Error]', error?.message);
      yield {
        type: 'error',
        text: error?.message || 'Erreur de connexion à Sarah Guide',
      };
    }
  },

  /**
   * Sarah Guide In-App — Non-streaming version.
   *
   * POST /sara/guide
   */
  guide: async (
    query: string,
    userRole?: string,
    currentModule?: string,
    conversationHistory?: Array<{ role: string; content: string }>,
  ) => {
    const response = await apiClient.post('/sara/guide', {
      query,
      userRole,
      currentModule,
      messages: conversationHistory,
    });
    return response.data;
  },

};
