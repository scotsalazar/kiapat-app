interface User {
  id: number;
  name: string;
  username: string;
  role: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const DEFAULT_USER: User = {
  id: 0,
  name: 'Demo Admin',
  username: 'demo.admin',
  role: 'admin',
};

const authState: AuthState = {
  user: DEFAULT_USER,
  token: null,
  isLoading: false,
  login: async () => {},
  logout: () => {},
};

export const useAuth = () => authState;
