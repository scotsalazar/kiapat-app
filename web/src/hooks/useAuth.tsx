import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import apiClient from '../api/axios';
import { isDemoMode } from '../utils/env';

interface User {
  id: number;
  name: string;
  username: string;
  role: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const DEMO_MODE_ENABLED = isDemoMode();
const DEMO_TOKEN = 'demo-token';
const DEMO_FLAG_KEY = 'demo-auth-active';
const DEMO_USER: User = {
  id: 0,
  name: 'Demo Admin',
  username: 'demo-admin',
  role: 'admin',
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => (DEMO_MODE_ENABLED ? DEMO_USER : null));
  const [token, setToken] = useState<string | null>(() => {
    if (DEMO_MODE_ENABLED) {
      localStorage.setItem('token', DEMO_TOKEN);
      localStorage.setItem(DEMO_FLAG_KEY, 'true');
      return DEMO_TOKEN;
    }
    return localStorage.getItem('token');
  });
  const [isLoading, setIsLoading] = useState<boolean>(() => {
    if (DEMO_MODE_ENABLED) {
      return false;
    }
    return !!localStorage.getItem('token');
  });

  const seedDemoSession = useCallback(() => {
    setUser(DEMO_USER);
    setToken(DEMO_TOKEN);
    localStorage.setItem('token', DEMO_TOKEN);
    localStorage.setItem(DEMO_FLAG_KEY, 'true');
  }, []);

  useEffect(() => {
    if (DEMO_MODE_ENABLED) {
      seedDemoSession();
      setIsLoading(false);
      return;
    }

    localStorage.removeItem(DEMO_FLAG_KEY);

    if (token) {
      setIsLoading(true);
      // fetch current user
      apiClient
        .get('/api/auth/me')
        .then((res) => setUser(res.data))
        .catch(() => {
          setUser(null);
          setToken(null);
          localStorage.removeItem('token');
        })
        .finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, [seedDemoSession, token]);

  const login = async (username: string, password: string) => {
    if (DEMO_MODE_ENABLED) {
      seedDemoSession();
      return;
    }

    const params = new URLSearchParams();
    params.append('username', username);
    params.append('password', password);
    const res = await apiClient.post('/api/auth/login', params, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    const token = res.data.access_token;
    setToken(token);
    localStorage.setItem('token', token);
    // fetch user
    const userRes = await apiClient.get('/api/auth/me');
    setUser(userRes.data);
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    setIsLoading(false);
    localStorage.removeItem('token');
    localStorage.removeItem(DEMO_FLAG_KEY);
  };

  const value: AuthContextType = { user, token, isLoading, login, logout };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};