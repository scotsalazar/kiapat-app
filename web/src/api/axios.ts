import axios from 'axios';
import { isDemoMode } from '../utils/env';

const demoMode = isDemoMode();

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
});

if (!demoMode) {
  apiClient.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers = config.headers ?? {};
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  });
}

export default apiClient;
