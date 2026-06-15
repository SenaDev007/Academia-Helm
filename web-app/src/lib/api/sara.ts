import { apiClient } from './client';

export interface SaraQueryOptions {
  /** Conversation history for context */
  messages?: Array<{ role: 'user' | 'assistant'; content: string }>;
  /** Visitor ID for tracking */
  visitorId?: string;
  /** Mode: landing (closing) or inapp (guide) */
  mode?: 'landing' | 'inapp';
  /** User role for contextual responses */
  userRole?: string;
  /** Current module for in-app guide mode */
  currentModule?: string;
}

export const saraApi = {
  /**
   * Query SARA with a simple text message (non-streaming)
   */
  query: async (query: string, visitorId?: string, messages?: Array<{ role: string; content: string }>) => {
    const response = await apiClient.post('/sara/query', {
      query,
      visitorId,
      messages,
    });
    return response.data;
  },

  /**
   * Query SARA with full options (non-streaming)
   */
  queryWithOptions: async (options: SaraQueryOptions) => {
    const { query, ...rest } = options as any;
    const response = await apiClient.post('/sara/query', rest);
    return response.data;
  },

  /**
   * Query SARA in-app mode (guide + module context)
   */
  queryInApp: async (query: string, options?: { userRole?: string; currentModule?: string; messages?: Array<{ role: string; content: string }> }) => {
    const response = await apiClient.post('/sara/inapp', {
      query,
      userRole: options?.userRole,
      currentModule: options?.currentModule,
      messages: options?.messages,
    });
    return response.data;
  },

  /**
   * Get SARA conversation suggestions based on user role and context
   */
  getSuggestions: async (context: { userRole?: string; currentModule?: string }) => {
    const response = await apiClient.post('/sara/suggestions', context);
    return response.data;
  },
};
