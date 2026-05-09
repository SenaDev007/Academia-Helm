import { apiClient } from './client';

export const patronatApi = {
  getProfile: async () => {
    const response = await apiClient.get('/patronat/profile');
    return response.data;
  },
  
  getSchools: async () => {
    const response = await apiClient.get('/patronat/schools');
    return response.data;
  },
  
  getConsolidatedStats: async () => {
    const response = await apiClient.get('/patronat/stats/consolidated');
    return response.data;
  },
};
