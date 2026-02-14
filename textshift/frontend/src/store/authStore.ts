import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User {
  id: number;
  email: string;
  full_name: string | null;
  subscription_tier: string;
  credits_balance: number;
  credits_used_total: number;
  is_active: boolean;
  is_admin: boolean;
  is_verified: boolean;
  created_at: string;
}

interface AuthState {
  token: string | null;
  user: User | null;
  isAuthenticated: boolean;
  _hasHydrated: boolean;
  setAuth: (token: string, user: User) => void;
  updateUser: (user: Partial<User>) => void;
  logout: () => void;
  setHasHydrated: (v: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      isAuthenticated: false,
      _hasHydrated: false,
      setAuth: (token, user) => {
        localStorage.setItem('token', token);
        set({ token, user, isAuthenticated: true });
      },
      updateUser: (userData) => {
        set((state) => ({
          user: state.user ? { ...state.user, ...userData } : null,
        }));
      },
      logout: () => {
        localStorage.removeItem('token');
        set({ token: null, user: null, isAuthenticated: false });
      },
      setHasHydrated: (v) => set({ _hasHydrated: v }),
    }),
    {
      name: 'textshift-auth',
      partialize: (state) => ({ token: state.token, user: state.user, isAuthenticated: state.isAuthenticated }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);
