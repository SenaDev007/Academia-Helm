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
   * Supports conversation history for contextual responses.
   *
   * POST /sara/query
   */
  query: async (
    query: string,
    visitorId?: string,
    conversationHistory?: Array<{ role: string; content: string }>,
  ) => {
    const response = await apiClient.post('/sara/query', {
      query,
      visitorId,
      messages: conversationHistory,
    });
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
};
