/**
 * AI Gateway API Client
 *
 * Unified API client for the new AI Gateway endpoints supporting
 * the three AI agents: ORION (direction), SARA (assistant), ATLAS (pedagogy).
 *
 * Uses the existing apiClient from src/lib/api/client.ts for authenticated requests.
 */

import { apiClient } from './client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AIAgent = 'ORION' | 'SARA' | 'ATLAS';

export interface AIChatRequest {
  agent: AIAgent;
  message: string;
  sessionId?: string;
  context?: Record<string, unknown>;
}

export interface AIChatResponse {
  agent: string;
  content: string;
  isPlaceholder: boolean;
  toolsUsed?: Array<{ toolName: string; executionMs: number }>;
  sessionId?: string;
  suggestedActions?: Array<{
    type: string;
    label: string;
    description: string;
    requiresConfirmation: boolean;
  }>;
  confidence?: number;
  model?: string;
  executionMs: number;
}

export interface OrionScore {
  schoolId: string;
  calculatedAt: string;
  globalScore: number;
  subScores: {
    academic: number;
    finance: number;
    hr: number;
    compliance: number;
    security: number;
  };
  trend: 'IMPROVING' | 'STABLE' | 'DECLINING';
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
}

// ---------------------------------------------------------------------------
// API Client
// ---------------------------------------------------------------------------

/**
 * Send a chat message to any AI agent via the unified gateway.
 *
 * POST /ai-gateway/chat
 */
export async function sendAIChatMessage(request: AIChatRequest): Promise<AIChatResponse> {
  const response = await apiClient.post<AIChatResponse>('/ai-gateway/chat', request);
  return response.data;
}

/**
 * Retrieve the current ORION score for the authenticated tenant.
 *
 * GET /ai-gateway/orion/score
 */
export async function getOrionScore(schoolId?: string): Promise<OrionScore> {
  const params = schoolId ? { schoolId } : {};
  const response = await apiClient.get<OrionScore>('/ai-gateway/orion/score', { params });
  return response.data;
}

/**
 * Retrieve the chat history for a given session.
 *
 * GET /ai-gateway/chat/history/:sessionId
 */
export async function getAIChatHistory(sessionId: string): Promise<AIChatResponse[]> {
  const response = await apiClient.get<AIChatResponse[]>(`/ai-gateway/chat/history/${sessionId}`);
  return response.data;
}

/**
 * Cancel / close an active chat session.
 *
 * POST /ai-gateway/chat/close
 */
export async function closeAIChatSession(sessionId: string): Promise<void> {
  await apiClient.post('/ai-gateway/chat/close', { sessionId });
}

// ---------------------------------------------------------------------------
// Facade object (mirrors the pattern used by saraApi / atlasApi)
// ---------------------------------------------------------------------------

export const aiGatewayApi = {
  chat: sendAIChatMessage,
  getOrionScore,
  getChatHistory: getAIChatHistory,
  closeSession: closeAIChatSession,
} as const;
