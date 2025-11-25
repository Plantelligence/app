import { create } from 'zustand';

const STORAGE_KEY = 'plantelligence-session';

const loadFromStorage = () => {
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }
    return JSON.parse(raw);
  } catch (error) {
    console.error('Failed to parse stored session', error);
    return null;
  }
};

const persistToStorage = (state) => {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
};

const initialState = loadFromStorage() ?? {
  user: null,
  tokens: null,
  requiresPasswordReset: false
};

export const useAuthStore = create((set, get) => ({
  ...initialState,
  setSession: ({ user, tokens, requiresPasswordReset }) => {
    const nextState = {
      user,
      tokens,
      requiresPasswordReset:
        requiresPasswordReset ?? get().requiresPasswordReset ?? false
    };
    set(nextState);
    persistToStorage(nextState);
  },
  updateUser: (user) => {
    const state = get();
    const nextState = { ...state, user };
    set(nextState);
    persistToStorage(nextState);
  },
  setRequiresPasswordReset: (flag) => {
    const state = get();
    const nextState = { ...state, requiresPasswordReset: flag };
    set(nextState);
    persistToStorage(nextState);
  },
  clearSession: () => {
    set({ user: null, tokens: null, requiresPasswordReset: false });
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }
}));
