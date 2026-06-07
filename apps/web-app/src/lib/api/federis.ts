import { apiClient } from './client';

export const federisApi = {
  getProfile: async () => {
    const response = await apiClient.get('/federis/profile');
    return response.data;
  },
  
  getSchools: async () => {
    const response = await apiClient.get('/federis/schools');
    return response.data;
  },
  
  getConsolidatedStats: async () => {
    const response = await apiClient.get('/federis/stats/consolidated');
    return response.data;
  },

  getBureau: async () => {
    const response = await apiClient.get('/federis/bureau');
    return response.data;
  },

  getCompositionsSummary: async () => {
    const response = await apiClient.get('/federis/exams/compositions-summary');
    return response.data;
  },

  getDeliberationsSummary: async () => {
    const response = await apiClient.get('/federis/exams/deliberations-summary');
    return response.data;
  },

  getIncidents: async () => {
    const response = await apiClient.get('/federis/incidents');
    return response.data;
  },

  getManualSchools: async () => {
    const response = await apiClient.get('/federis/manual-schools');
    return response.data;
  },

  getInvoices: async () => {
    const response = await apiClient.get('/federis/invoices');
    return response.data;
  },
};

export const federisConnectApi = {
  getFeed: async () => {
    const response = await apiClient.get('/federis/connect/feed');
    return response.data;
  },
  getConversations: async () => {
    const response = await apiClient.get('/federis/connect/conversations');
    return response.data;
  },
  getMessages: async (conversationId: string) => {
    const response = await apiClient.get(`/federis/connect/conversations/${conversationId}/messages`);
    return response.data;
  },
  getNotices: async () => {
    const response = await apiClient.get('/federis/connect/notices');
    return response.data;
  },
  acknowledgeNotice: async (noticeId: string) => {
    const response = await apiClient.post(`/federis/connect/notices/${noticeId}/acknowledge`);
    return response.data;
  },
  sendMessage: async (conversationId: string, content: string) => {
    const response = await apiClient.post(`/federis/connect/conversations/${conversationId}/messages`, { content });
    return response.data;
  },
  getGroups: async () => {
    const response = await apiClient.get('/federis/connect/groups');
    return response.data;
  },
  getCommunities: async () => {
    const response = await apiClient.get('/federis/connect/communities');
    return response.data;
  },
  createPost: async (data: { content: string, groupId?: string, communityId?: string }) => {
    const response = await apiClient.post('/federis/connect/posts', data);
    return response.data;
  },
  getEvents: async () => {
    const response = await apiClient.get('/federis/connect/events');
    return response.data;
  },
};
