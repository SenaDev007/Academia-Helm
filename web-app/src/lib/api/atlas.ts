import { apiClient } from './client';
import { AtlasMessage } from '@/types';

export const atlasApi = {
  sendMessage: async (message: string): Promise<AtlasMessage> => {
    const response = await apiClient.post('/atlas/chat', { message });
    return response.data;
  },
  
  getHistory: async (): Promise<AtlasMessage[]> => {
    const response = await apiClient.get('/atlas/history');
    return response.data;
  },
};
