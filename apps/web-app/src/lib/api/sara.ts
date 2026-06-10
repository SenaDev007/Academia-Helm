import { apiClient } from './client';

export const saraApi = {
  query: async (query: string, visitorId?: string) => {
    const response = await apiClient.post('/sara/query', { query, visitorId });
    return response.data;
  },
};
