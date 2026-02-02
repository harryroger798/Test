import { useEffect, useState, useCallback } from 'react';
import { useAuthStore } from '@/store/authStore';

declare global {
  interface Window {
    Intercom: (command: string, options?: Record<string, unknown>) => void;
    intercomSettings: Record<string, unknown>;
  }
}

const INTERCOM_APP_ID = import.meta.env.VITE_INTERCOM_APP_ID || 'l05shlaq';

interface IntercomUserData {
  app_id: string;
  user_hash: string;
  user_id: string;
  email: string;
  name: string;
  created_at: number;
  custom_attributes: Record<string, unknown>;
}

export function IntercomProvider({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const token = useAuthStore((state) => state.token);
  const [userHash, setUserHash] = useState<string | null>(null);

  const fetchIntercomUserData = useCallback(async () => {
    if (!token) return null;
    
    try {
      const response = await fetch('/api/intercom/user-data', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (response.ok) {
        const data: IntercomUserData = await response.json();
        return data;
      }
    } catch (error) {
      console.error('Failed to fetch Intercom user data:', error);
    }
    return null;
  }, [token]);

  useEffect(() => {
    const loadIntercom = () => {
      const w = window;
      const ic = w.Intercom;
      if (typeof ic === 'function') {
        ic('reattach_activator');
        ic('update', w.intercomSettings);
      } else {
        const d = document;
        const i = function (...args: unknown[]) {
          (i as unknown as { q: unknown[] }).q.push(args);
        };
        (i as unknown as { q: unknown[]; c: (...args: unknown[]) => void }).q = [];
        (i as unknown as { q: unknown[]; c: (...args: unknown[]) => void }).c = function (args: unknown) {
          (i as unknown as { q: unknown[] }).q.push(args);
        };
        w.Intercom = i as unknown as typeof w.Intercom;
        const l = function () {
          const s = d.createElement('script');
          s.type = 'text/javascript';
          s.async = true;
          s.src = `https://widget.intercom.io/widget/${INTERCOM_APP_ID}`;
          const x = d.getElementsByTagName('script')[0];
          x.parentNode?.insertBefore(s, x);
        };
        if (document.readyState === 'complete') {
          l();
        } else {
          w.addEventListener('load', l, false);
        }
      }
    };

    loadIntercom();
  }, []);

  useEffect(() => {
    const initIntercom = async () => {
      if (typeof window.Intercom !== 'function') return;

      if (isAuthenticated && user && token) {
        const intercomData = await fetchIntercomUserData();
        
        if (intercomData && intercomData.user_hash) {
          setUserHash(intercomData.user_hash);
          window.Intercom('boot', {
            api_base: 'https://api-iam.intercom.io',
            app_id: INTERCOM_APP_ID,
            user_id: String(user.id),
            user_hash: intercomData.user_hash,
            name: user.full_name || user.email.split('@')[0],
            email: user.email,
            created_at: Math.floor(new Date(user.created_at).getTime() / 1000),
            custom_attributes: {
              subscription_tier: user.subscription_tier,
              credits_balance: user.credits_balance,
              credits_used_total: user.credits_used_total,
              is_verified: user.is_verified,
              is_admin: user.is_admin,
            },
          });
        } else {
          window.Intercom('boot', {
            api_base: 'https://api-iam.intercom.io',
            app_id: INTERCOM_APP_ID,
            user_id: String(user.id),
            name: user.full_name || user.email.split('@')[0],
            email: user.email,
            created_at: Math.floor(new Date(user.created_at).getTime() / 1000),
            custom_attributes: {
              subscription_tier: user.subscription_tier,
              credits_balance: user.credits_balance,
              credits_used_total: user.credits_used_total,
              is_verified: user.is_verified,
              is_admin: user.is_admin,
            },
          });
        }
      } else {
        window.Intercom('boot', {
          api_base: 'https://api-iam.intercom.io',
          app_id: INTERCOM_APP_ID,
        });
      }
    };

    initIntercom();

    return () => {
      if (typeof window.Intercom === 'function') {
        window.Intercom('shutdown');
      }
    };
  }, [isAuthenticated, user, token, fetchIntercomUserData]);

  useEffect(() => {
    if (typeof window.Intercom !== 'function') return;
    if (!isAuthenticated || !user) return;

    const updateData: Record<string, unknown> = {
      custom_attributes: {
        subscription_tier: user.subscription_tier,
        credits_balance: user.credits_balance,
        credits_used_total: user.credits_used_total,
      },
    };

    if (userHash) {
      updateData.user_hash = userHash;
    }

    window.Intercom('update', updateData);
  }, [user?.subscription_tier, user?.credits_balance, user?.credits_used_total, isAuthenticated, user, userHash]);

  return <>{children}</>;
}

export function useIntercom() {
  const showMessenger = () => {
    if (typeof window.Intercom === 'function') {
      window.Intercom('show');
    }
  };

  const hideMessenger = () => {
    if (typeof window.Intercom === 'function') {
      window.Intercom('hide');
    }
  };

  const showNewMessage = (prePopulatedMessage?: string) => {
    if (typeof window.Intercom === 'function') {
      if (prePopulatedMessage) {
        window.Intercom('showNewMessage', { message: prePopulatedMessage });
      } else {
        window.Intercom('showNewMessage');
      }
    }
  };

  const trackEvent = (eventName: string, metadata?: Record<string, unknown>) => {
    if (typeof window.Intercom === 'function') {
      window.Intercom('trackEvent', { name: eventName, ...metadata });
    }
  };

  const updateUser = (attributes: Record<string, unknown>) => {
    if (typeof window.Intercom === 'function') {
      window.Intercom('update', attributes);
    }
  };

  return {
    showMessenger,
    hideMessenger,
    showNewMessage,
    trackEvent,
    updateUser,
  };
}

export default IntercomProvider;
