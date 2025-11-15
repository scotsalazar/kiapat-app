import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { isAxiosError } from 'axios';
import apiClient, { setAuthToken } from '../api/axios';
import { isDemoMode } from '../utils/env';

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

const DEMO_MODE = isDemoMode();
const STORAGE_KEY = 'kiapat-auth-state';

const DEMO_ACCOUNTS: Array<{ username: string; password: string; user: User }> = [
  {
    username: 'admin',
    password: 'admin123',
    user: {
      id: 1,
      name: 'Demo Admin',
      username: 'admin',
      role: 'admin',
      email: 'admin@demo.local',
    },
  },
  {
    username: 'driver',
    password: 'pass123',
    user: {
      id: 2,
      name: 'Demo Driver',
      username: 'driver',
      role: 'driver',
      email: 'driver@demo.local',
    },
  },
];

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

const resolveDemoAccount = (username: string, password: string): User | null => {
  const normalizedUsername = username.trim().toLowerCase();
  const match = DEMO_ACCOUNTS.find(
    (account) =>
      account.username.toLowerCase() === normalizedUsername && account.password === password,
  );
  return match ? match.user : null;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => getStoredState().user);
  const [token, setToken] = useState<string | null>(() => getStoredState().token);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (DEMO_MODE) {
      setAuthToken(null);
      return;
    }
    setAuthToken(token);
  }, [token]);

  const login = useCallback(async (username: string, password: string) => {
    setIsLoading(true);
    try {
      if (DEMO_MODE) {
        await new Promise((resolve) => setTimeout(resolve, 350));
        const demoUser = resolveDemoAccount(username, password);
        if (!demoUser) {
          throw new Error('Invalid username or password');
        }
        const demoToken = 'demo-token';
        setUser(demoUser);
        setToken(demoToken);
        persistState(demoUser, demoToken);
        return demoUser;
      }

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
