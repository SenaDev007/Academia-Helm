/**
 * SARA API Client
 *
 * Public query endpoint + authenticated in-app chat endpoint.
 * Uses the shared apiClient from ./client.ts.
 */

import { apiClient } from './client';

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

// ---------------------------------------------------------------------------
// API methods
// ---------------------------------------------------------------------------

export const saraApi = {
  /**
   * Public query endpoint (landing page / marketing widget).
   *
   * POST /sara/query
   */
  query: async (query: string, visitorId?: string) => {
    const response = await apiClient.post('/sara/query', { query, visitorId });
    return response.data;
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
};
