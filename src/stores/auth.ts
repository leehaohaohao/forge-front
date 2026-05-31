import { create } from 'zustand';
import { loginApi, registerApi } from '@/services/auth';

interface User {
  id: number;
  username: string;
  status: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isLoggedIn: boolean;
  login: (phone: string, password: string) => Promise<void>;
  register: (phone: string, password: string, username: string) => Promise<void>;
  logout: () => void;
  initAuth: () => void;
}

const TOKEN_KEY = 'forge_token';
const TOKEN_TIME_KEY = 'forge_token_time';
const USER_KEY = 'forge_user';
const TOKEN_TTL = 72 * 60 * 60 * 1000; // 72 hours

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isLoggedIn: false,

  login: async (phone, password) => {
    const res = await loginApi(phone, password);
    localStorage.setItem(TOKEN_KEY, res.token);
    localStorage.setItem(TOKEN_TIME_KEY, String(Date.now()));
    localStorage.setItem(USER_KEY, JSON.stringify(res.user));
    set({ token: res.token, user: res.user, isLoggedIn: true });
  },

  register: async (phone, password, username) => {
    await registerApi(phone, password, username);
  },

  logout: () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(TOKEN_TIME_KEY);
    localStorage.removeItem(USER_KEY);
    set({ token: null, user: null, isLoggedIn: false });
  },

  initAuth: () => {
    const token = localStorage.getItem(TOKEN_KEY);
    const timeStr = localStorage.getItem(TOKEN_TIME_KEY);
    const userStr = localStorage.getItem(USER_KEY);

    if (!token || !timeStr) return;

    const loginTime = Number(timeStr);
    if (Date.now() - loginTime > TOKEN_TTL) {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(TOKEN_TIME_KEY);
      localStorage.removeItem(USER_KEY);
      return;
    }

    let user: User | null = null;
    try {
      user = userStr ? JSON.parse(userStr) : null;
    } catch {
      // ignore
    }

    set({ token, user, isLoggedIn: true });
  },
}));
