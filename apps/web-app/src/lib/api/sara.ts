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
   *
   * ⚠️ ROUTE PRIORITAIRE : /api/public/sara/chat/stream (route Next.js, même origine)
   * Cette route utilise NVIDIA_API_KEY configurée côté Vercel — plus fiable que
   * d'appeler le backend NestJS qui peut être sur un autre domaine (CORS, latence).
   *
   * Fallback : si la route Next.js échoue, on essaie le backend NestJS /sara/query/stream
   * puis le mode non-streaming /sara/query.
   */
  queryStream: async function* (
    query: string,
    visitorId?: string,
    conversationHistory?: Array<{ role: string; content: string }>,
  ): AsyncGenerator<SaraStreamChunk> {
    // ⭐ ROUTE NEXT.JS (même origine, plus fiable, utilise NVIDIA_API_KEY côté Vercel)
    const nextjsUrl = '/api/public/sara/chat/stream';

    try {
      const response = await fetch(nextjsUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            ...(conversationHistory || []),
            { role: 'user', content: query },
          ],
        }),
        signal: AbortSignal.timeout(45000), // 45s for AI streaming
      });

      if (!response.ok) {
        throw new Error(`Next.js SARA API error: ${response.status} ${response.statusText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body for streaming');
      }

      const decoder = new TextDecoder();
      let buffer = '';
      let receivedAnyDelta = false;

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
            if (chunk.type === 'delta' || chunk.type === 'final') {
              receivedAnyDelta = true;
            }
            yield chunk;
          } catch {
            // Ignore malformed SSE chunks
          }
        }
      }

      // Si on a reçu au moins un delta ou final, c'est un succès
      if (receivedAnyDelta) return;
      // Sinon, on fallback vers le backend NestJS
      throw new Error('No delta received from Next.js route');
    } catch (error: any) {
      console.warn('[SARA Next.js route failed, trying backend NestJS]', error?.message);

      // ⭐ FALLBACK : backend NestJS /sara/query/stream
      try {
        const apiBaseUrl = getApiBaseUrl();
        const url = `${apiBaseUrl}/sara/query/stream`;

        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query,
            visitorId,
            messages: conversationHistory,
          }),
          signal: AbortSignal.timeout(45000),
        });

        if (!response.ok) {
          throw new Error(`SARA backend API error: ${response.status} ${response.statusText}`);
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
      } catch (backendError: any) {
        console.error('[SARA Stream Error — all routes failed]', backendError?.message);
        // Fallback final : non-streaming
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
   *   - Elle adapte son discours selon l'UI (admin, teacher, parent, promoter, platform)
   *
   * POST /sara/guide/stream
   */
  guideStream: async function* (
    query: string,
    userRole?: string,
    currentModule?: string,
    conversationHistory?: Array<{ role: string; content: string }>,
    uiType?: 'admin' | 'teacher' | 'parent' | 'promoter' | 'platform',
  ): AsyncGenerator<SaraStreamChunk> {
    // ⭐ ROUTE NEXT.JS (même origine, plus fiable, utilise NVIDIA_API_KEY côté Vercel)
    // Sarah Guide utilise la route Next.js /api/public/sara/chat/stream avec le system_prompt.txt
    // Cette route ne nécessite pas d'authentification — parfaite pour le guide de navigation
    const nextjsUrl = '/api/public/sara/chat/stream';

    try {
      const response = await fetch(nextjsUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            ...(conversationHistory || []),
            { role: 'user', content: query },
          ],
          mode: 'inapp',
          userRole,
          currentModule,
          uiType,
        }),
        signal: AbortSignal.timeout(45000),
      });

      if (!response.ok) {
        throw new Error(`Sarah Guide Next.js API error: ${response.status} ${response.statusText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body for streaming');
      }

      const decoder = new TextDecoder();
      let buffer = '';
      let receivedAnyDelta = false;

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
            if (chunk.type === 'delta' || chunk.type === 'final') {
              receivedAnyDelta = true;
            }
            yield chunk;
          } catch {
            // Ignore malformed SSE chunks
          }
        }
      }

      if (receivedAnyDelta) return;
      throw new Error('No delta received from Next.js route');
    } catch (nextjsError: any) {
      console.warn('[Sarah Guide Next.js route failed, trying backend NestJS]', nextjsError?.message);

      // ⭐ FALLBACK : backend NestJS /sara/guide/stream (authentifié JWT)
      try {
        const apiBaseUrl = getApiBaseUrl();
        const url = `${apiBaseUrl}/sara/guide/stream`;

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
            uiType,
            messages: conversationHistory,
          }),
          signal: AbortSignal.timeout(45000),
          credentials: 'include',
        });

        if (!response.ok) {
          throw new Error(`Sarah Guide backend API error: ${response.status} ${response.statusText}`);
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
      } catch (backendError: any) {
        console.error('[Sarah Guide Stream Error — all routes failed]', backendError?.message);
        yield {
          type: 'error',
          text: backendError?.message || 'Erreur de connexion à Sarah Guide',
        };
      }
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
