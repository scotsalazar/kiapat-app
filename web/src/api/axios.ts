import axios from 'axios';

const baseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

let authToken: string | null = null;

export const setAuthToken = (token: string | null) => {
  authToken = token;
};

const apiClient = axios.create({
  baseURL,
});

apiClient.interceptors.request.use((config) => {
  const headers = {
    ...(config.headers || {}),
  } as Record<string, string>;
  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  }
  const apiKey = import.meta.env.VITE_API_KEY;
  if (apiKey) {
    headers['X-API-Key'] = apiKey;
  }
  config.headers = headers;
  return config;
});

export default apiClient;
