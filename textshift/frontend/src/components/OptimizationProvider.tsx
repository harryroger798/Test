import { useEffect, useState, lazy, Suspense } from 'react';
import { useNetworkStatus } from '@/lib/mobile';
import { preloadRoute } from '@/lib/performance';

const PWAInstallPrompt = lazy(() => import('@/components/ui/PWAInstallPrompt'));
const OfflineIndicator = lazy(() => import('@/components/ui/OfflineIndicator'));

export default function OptimizationProvider({ children }: { children: React.ReactNode }) {
  const { isOnline } = useNetworkStatus();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const prefetchTimer = setTimeout(() => {
      preloadRoute('/pricing');
      preloadRoute('/features');
      preloadRoute('/login');
      preloadRoute('/register');
    }, 3000);

    return () => clearTimeout(prefetchTimer);
  }, [mounted]);

  useEffect(() => {
    document.documentElement.style.setProperty('--sat', 'env(safe-area-inset-top)');
    document.documentElement.style.setProperty('--sar', 'env(safe-area-inset-right)');
    document.documentElement.style.setProperty('--sab', 'env(safe-area-inset-bottom)');
    document.documentElement.style.setProperty('--sal', 'env(safe-area-inset-left)');
  }, []);

  useEffect(() => {
    if (!mounted) return;

    if (typeof PerformanceObserver === 'undefined') return;
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.entryType === 'longtask') {
          if (import.meta.env.DEV) {
            console.warn('[Perf] Long task detected:', entry.duration.toFixed(0), 'ms');
          }
        }
      }
    });

    try {
      observer.observe({ type: 'longtask', buffered: true });
    } catch {
      // longtask observer not supported
    }

    return () => observer.disconnect();
  }, [mounted]);

  useEffect(() => {
    if (!mounted) return;

    const handleConnection = () => {
      const conn = (navigator as Navigator & {
        connection?: { saveData?: boolean; effectiveType?: string };
      }).connection;
      if (conn?.saveData || conn?.effectiveType === 'slow-2g' || conn?.effectiveType === '2g') {
        document.documentElement.classList.add('reduce-data');
      } else {
        document.documentElement.classList.remove('reduce-data');
      }
    };

    handleConnection();

    const conn = (navigator as Navigator & {
      connection?: EventTarget;
    }).connection;
    if (conn) {
      conn.addEventListener('change', handleConnection);
      return () => conn.removeEventListener('change', handleConnection);
    }
  }, [mounted]);

  return (
    <>
      {children}
      {mounted && (
        <Suspense fallback={null}>
          {!isOnline && <OfflineIndicator />}
          <PWAInstallPrompt />
        </Suspense>
      )}
    </>
  );
}
