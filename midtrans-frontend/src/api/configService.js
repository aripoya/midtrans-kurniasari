import apiClient from './api';

// Configuration service functions
export const configService = {
  // Get application configuration
  async getConfig() {
    try {
      const response = await apiClient.get('/api/config');
      return response.data;
    } catch (error) {
      console.error('Error fetching application config:', error);
      throw error;
    }
  }
};
