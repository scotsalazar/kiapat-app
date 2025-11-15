import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

export interface User {
  id: number;
  name: string;
  username: string;
  role: string;
}

export interface AuthContextValue {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const ADMIN_CREDENTIALS = {
  username: 'admin',
  password: 'admin123',
};

const ADMIN_USER: User = {
  id: 1,
  name: 'Demo Admin',
  username: 'admin',
  role: 'admin',
};

const STORAGE_KEY = 'demo-auth-state';

const AuthContext = createContext<AuthContextValue | null>(null);

const getStoredState = (): { user: User | null; token: string | null } => {
  if (typeof window === 'undefined') {
    return { user: null, token: null };
  }

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return { user: null, token: null };
    }
    const parsed = JSON.parse(stored);
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
    await new Promise((resolve) => setTimeout(resolve, 400));

    const normalizedUsername = username.trim().toLowerCase();
    const isValid =
      normalizedUsername === ADMIN_CREDENTIALS.username && password === ADMIN_CREDENTIALS.password;

    if (!isValid) {
      setIsLoading(false);
      throw new Error('Invalid username or password');
    }

    const fakeToken = 'demo-token';
    setUser(ADMIN_USER);
    setToken(fakeToken);
    persistState(ADMIN_USER, fakeToken);
    setIsLoading(false);
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    setToken(null);
    persistState(null, null);
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
