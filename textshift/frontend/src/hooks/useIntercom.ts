import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';

const INTERCOM_APP_ID = 'l05shlaq';

declare global {
  interface Window {
    Intercom: (...args: unknown[]) => void;
  }
}

export function useIntercom() {
  const location = useLocation();
  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const bootedRef = useRef(false);
  const lastUserIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (typeof window.Intercom !== 'function') return;

    const authChanged = isAuthenticated
      ? lastUserIdRef.current !== user?.id
      : lastUserIdRef.current !== null;

    if (!bootedRef.current || authChanged) {
      if (isAuthenticated && user) {
        window.Intercom('boot', {
          api_base: 'https://api-iam.intercom.io',
          app_id: INTERCOM_APP_ID,
          user_id: String(user.id),
          name: user.full_name || undefined,
          email: user.email,
          created_at: Math.floor(new Date(user.created_at).getTime() / 1000),
        });
        lastUserIdRef.current = user.id;
      } else {
        window.Intercom('boot', {
          api_base: 'https://api-iam.intercom.io',
          app_id: INTERCOM_APP_ID,
        });
        lastUserIdRef.current = null;
      }
      bootedRef.current = true;
    }
  }, [isAuthenticated, user]);

  useEffect(() => {
    if (typeof window.Intercom !== 'function') return;
    if (bootedRef.current) {
      window.Intercom('update');
    }
  }, [location.pathname]);

  useEffect(() => {
    return () => {
      if (typeof window.Intercom === 'function') {
        window.Intercom('shutdown');
      }
    };
  }, []);
}
