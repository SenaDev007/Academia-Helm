/**
 * ATLAS API Client
 *
 * Pedagogical AI assistant endpoints including chat, document generation,
 * workflow execution, notification dispatch, and report generation.
 * Uses the shared apiClient from ./client.ts.
 */

import { apiClient } from './client';
import { AtlasMessage } from '@/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AtlasDocumentResponse {
  documentId: string;
  documentType: string;
  entityId: string;
  status: 'GENERATED' | 'PENDING_REVIEW' | 'FAILED';
  downloadUrl?: string;
  createdAt: string;
}

export interface AtlasWorkflowResponse {
  workflowId: string;
  workflowType: string;
  status: 'STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
  steps?: Array<{
    name: string;
    status: 'PENDING' | 'RUNNING' | 'DONE' | 'FAILED';
    completedAt?: string;
  }>;
  startedAt: string;
}

export interface AtlasNotificationResponse {
  notificationId: string;
  type: string;
  recipients: string[];
  channel: string;
  status: 'QUEUED' | 'SENT' | 'FAILED';
  sentAt?: string;
}

export interface AtlasReportResponse {
  reportId: string;
  reportType: string;
  period?: string;
  status: 'GENERATED' | 'PENDING' | 'FAILED';
  downloadUrl?: string;
  summary?: string;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// API methods
// ---------------------------------------------------------------------------

export const atlasApi = {
  /**
   * Send a chat message to ATLAS.
   *
   * POST /atlas/chat
   */
  sendMessage: async (message: string): Promise<AtlasMessage> => {
    const response = await apiClient.post<AtlasMessage>('/atlas/chat', { message });
    return response.data;
  },

  /**
   * Retrieve ATLAS chat history.
   *
   * GET /atlas/history
   */
  getHistory: async (): Promise<AtlasMessage[]> => {
    const response = await apiClient.get<AtlasMessage[]>('/atlas/history');
    return response.data;
  },

  /**
   * Generate a document via ATLAS.
   *
   * POST /atlas/documents/generate
   */
  generateDocument: async (
    documentType: string,
    entityId: string,
    parameters?: Record<string, unknown>,
  ): Promise<AtlasDocumentResponse> => {
    const response = await apiClient.post<AtlasDocumentResponse>(
      '/atlas/documents/generate',
      { documentType, entityId, parameters },
    );
    return response.data;
  },

  /**
   * Execute a workflow via ATLAS.
   *
   * POST /atlas/workflows/execute
   */
  executeWorkflow: async (
    workflowType: string,
    parameters?: Record<string, unknown>,
  ): Promise<AtlasWorkflowResponse> => {
    const response = await apiClient.post<AtlasWorkflowResponse>(
      '/atlas/workflows/execute',
      { workflowType, parameters },
    );
    return response.data;
  },

  /**
   * Send a notification via ATLAS.
   *
   * POST /atlas/notifications/send
   */
  sendNotification: async (
    type: string,
    recipients: string[],
    channel?: string,
    templateParameters?: Record<string, unknown>,
  ): Promise<AtlasNotificationResponse> => {
    const response = await apiClient.post<AtlasNotificationResponse>(
      '/atlas/notifications/send',
      { type, recipients, channel, templateParameters },
    );
    return response.data;
  },

  /**
   * Generate a report via ATLAS.
   *
   * POST /atlas/reports/generate
   */
  generateReport: async (
    reportType: string,
    period?: string,
  ): Promise<AtlasReportResponse> => {
    const response = await apiClient.post<AtlasReportResponse>(
      '/atlas/reports/generate',
      { reportType, period },
    );
    return response.data;
  },
};
