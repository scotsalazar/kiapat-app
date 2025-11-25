import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { isAxiosError } from 'axios';
import apiClient, { setAuthToken, setUnauthorizedHandler } from '../api/axios';

export type UserRole = 'admin' | 'driver';

export interface User {
  id: number;
  name: string;
  username: string;
  role: UserRole;
  email?: string | null;
  created_at?: string;
}

interface LoginResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface AuthContextValue {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<User>;
  logout: () => void;
}

interface StoredAuthState {
  user: User | null;
  token: string | null;
}

const STORAGE_KEY = 'kiapat-auth-state';

const AuthContext = createContext<AuthContextValue | null>(null);

const getStoredState = (): StoredAuthState => {
  if (typeof window === 'undefined') {
    return { user: null, token: null };
  }

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return { user: null, token: null };
    }
    const parsed = JSON.parse(stored) as StoredAuthState;
    return {
      user: parsed.user ?? null,
      token: parsed.token ?? null,
    };
  } catch (error) {
    console.warn('Failed to read auth state from storage', error);
    return { user: null, token: null };
  }
};

const persistState = (user: User | null, token: string | null) => {
  if (typeof window === 'undefined') {
    return;
  }

  if (!user || !token) {
    window.localStorage.removeItem(STORAGE_KEY);
    return;
  }

  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ user, token }),
  );
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => getStoredState().user);
  const [token, setToken] = useState<string | null>(() => getStoredState().token);
  const [isLoading, setIsLoading] = useState(false);

  const login = useCallback(async (username: string, password: string) => {
    setIsLoading(true);
    try {
      const formData = new URLSearchParams();
      formData.set('username', username.trim());
      formData.set('password', password);
      const response = await apiClient.post<LoginResponse>('/api/auth/login', formData);
      const nextUser = response.data.user;
      const accessToken = response.data.access_token;
      setUser(nextUser);
      setToken(accessToken);
      persistState(nextUser, accessToken);
      return nextUser;
    } catch (error) {
      let message = 'Unable to login';
      if (error instanceof Error) {
        message = error.message;
      }
      if (isAxiosError(error)) {
        const detail = (error.response?.data as { detail?: string; message?: string } | undefined)?.detail;
        const generic = (error.response?.data as { message?: string } | undefined)?.message;
        message = detail || generic || 'Invalid username or password';
      }
      throw new Error(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    setToken(null);
    persistState(null, null);
    setAuthToken(null);
  }, []);

  useEffect(() => {
    setAuthToken(token);
    setUnauthorizedHandler(token ? () => logout() : null);
    return () => setUnauthorizedHandler(null);
  }, [token, logout]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token,
      isLoading,
      login,
      logout,
    }),
    [user, token, isLoading, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
