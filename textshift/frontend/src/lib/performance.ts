// Performance Optimization Utilities
// Speed Optimizations #19-35

import { useCallback, useMemo, useRef, useEffect, useState } from 'react';

// Debounce hook for user inputs (Speed Optimization #21)
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

// Debounced callback (Speed Optimization #21)
export function useDebouncedCallback<T extends (...args: unknown[]) => unknown>(
  callback: T,
  delay: number
): T {
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

  return useCallback(
    ((...args: unknown[]) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => {
        callback(...args);
      }, delay);
    }) as T,
    [callback, delay]
  );
}

// Throttle hook (Speed Optimization #21)
export function useThrottle<T>(value: T, interval: number): T {
  const [throttledValue, setThrottledValue] = useState<T>(value);
  const lastUpdated = useRef<number>(Date.now());

  useEffect(() => {
    const now = Date.now();
    if (now >= lastUpdated.current + interval) {
      lastUpdated.current = now;
      setThrottledValue(value);
    } else {
      const timeoutId = setTimeout(() => {
        lastUpdated.current = Date.now();
        setThrottledValue(value);
      }, interval - (now - lastUpdated.current));
      return () => clearTimeout(timeoutId);
    }
  }, [value, interval]);

  return throttledValue;
}

// Intersection Observer hook for lazy loading (Speed Optimization #32)
export function useIntersectionObserver(
  options: IntersectionObserverInit = {}
): [React.RefObject<HTMLDivElement>, boolean] {
  const ref = useRef<HTMLDivElement>(null);
  const [isIntersecting, setIsIntersecting] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(([entry]) => {
      setIsIntersecting(entry.isIntersecting);
    }, {
      threshold: 0.1,
      rootMargin: '50px',
      ...options,
    });

    observer.observe(element);
    return () => observer.disconnect();
  }, [options]);

  return [ref, isIntersecting];
}

// Lazy load component wrapper (Speed Optimization #26)
export function useLazyLoad(): [React.RefObject<HTMLDivElement>, boolean] {
  const [ref, isVisible] = useIntersectionObserver({ threshold: 0 });
  const [hasLoaded, setHasLoaded] = useState(false);

  useEffect(() => {
    if (isVisible && !hasLoaded) {
      setHasLoaded(true);
    }
  }, [isVisible, hasLoaded]);

  return [ref, hasLoaded];
}

// Memoized selector hook (Speed Optimization #34)
export function useMemoizedSelector<T, R>(
  data: T,
  selector: (data: T) => R,
  deps: React.DependencyList = []
): R {
  return useMemo(() => selector(data), [data, ...deps]);
}

// Preload critical resources (Speed Optimization #22)
export function preloadResource(href: string, as: 'script' | 'style' | 'image' | 'font' | 'fetch'): void {
  const link = document.createElement('link');
  link.rel = 'preload';
  link.href = href;
  link.as = as;
  if (as === 'font') {
    link.crossOrigin = 'anonymous';
  }
  document.head.appendChild(link);
}

// Preload route (Speed Optimization #22)
export function preloadRoute(routePath: string): void {
  const link = document.createElement('link');
  link.rel = 'prefetch';
  link.href = routePath;
  document.head.appendChild(link);
}

// Performance measurement (Speed Optimization #15)
export function measurePerformance(name: string): () => void {
  const start = performance.now();
  return () => {
    const duration = performance.now() - start;
    if (import.meta.env.DEV) {
      console.log(`[Performance] ${name}: ${duration.toFixed(2)}ms`);
    }
  };
}

// Request idle callback wrapper (Speed Optimization #23)
export function requestIdleCallbackPolyfill(
  callback: IdleRequestCallback,
  options?: IdleRequestOptions
): number {
  if ('requestIdleCallback' in window) {
    return (window as Window & { requestIdleCallback: (cb: IdleRequestCallback, opts?: IdleRequestOptions) => number }).requestIdleCallback(callback, options);
  }
  return setTimeout(() => callback({
    didTimeout: false,
    timeRemaining: () => 50,
  }), 1) as unknown as number;
}

// Cancel idle callback wrapper
export function cancelIdleCallbackPolyfill(handle: number): void {
  if ('cancelIdleCallback' in window) {
    (window as Window & { cancelIdleCallback: (handle: number) => void }).cancelIdleCallback(handle);
  } else {
    clearTimeout(handle);
  }
}

// Batch DOM updates (Speed Optimization #7)
export function batchDOMUpdates(updates: (() => void)[]): void {
  requestAnimationFrame(() => {
    updates.forEach(update => update());
  });
}

// Virtual list hook for large lists (Speed Optimization #19)
export function useVirtualList<T>(
  items: T[],
  itemHeight: number,
  containerHeight: number,
  overscan: number = 3
): {
  virtualItems: { item: T; index: number; style: React.CSSProperties }[];
  totalHeight: number;
  scrollTop: number;
  setScrollTop: (scrollTop: number) => void;
} {
  const [scrollTop, setScrollTop] = useState(0);

  const virtualItems = useMemo(() => {
    const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
    const endIndex = Math.min(
      items.length - 1,
      Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan
    );

    const result: { item: T; index: number; style: React.CSSProperties }[] = [];
    for (let i = startIndex; i <= endIndex; i++) {
      result.push({
        item: items[i],
        index: i,
        style: {
          position: 'absolute',
          top: i * itemHeight,
          height: itemHeight,
          width: '100%',
        },
      });
    }
    return result;
  }, [items, itemHeight, containerHeight, scrollTop, overscan]);

  return {
    virtualItems,
    totalHeight: items.length * itemHeight,
    scrollTop,
    setScrollTop,
  };
}

// Image lazy loading with blur placeholder (Speed Optimization #18)
export function useImageLazyLoad(src: string): {
  isLoaded: boolean;
  imageSrc: string | undefined;
} {
  const [isLoaded, setIsLoaded] = useState(false);
  const [imageSrc, setImageSrc] = useState<string | undefined>(undefined);

  useEffect(() => {
    const img = new Image();
    img.src = src;
    img.onload = () => {
      setImageSrc(src);
      setIsLoaded(true);
    };
  }, [src]);

  return { isLoaded, imageSrc };
}

// Send metric to GA4 if gtag is available
function sendToGA4(name: string, value: number): void {
  const w = window as Window & { gtag?: (...args: unknown[]) => void };
  if (w.gtag) {
    w.gtag('event', name, {
      value: Math.round(name === 'CLS' ? value * 1000 : value),
      event_category: 'Web Vitals',
      non_interaction: true,
    });
  }
}

// Web Vitals reporting (Speed Optimization #46-50)
export function reportWebVitals(): void {
  if ('web-vital' in window) return;
  (window as Window & { 'web-vital'?: boolean })['web-vital'] = true;

  // LCP (Largest Contentful Paint)
  new PerformanceObserver((entryList) => {
    const entries = entryList.getEntries();
    const lastEntry = entries[entries.length - 1];
    if (import.meta.env.DEV) {
      console.log('[Web Vitals] LCP:', lastEntry.startTime);
    }
    sendToGA4('LCP', lastEntry.startTime);
  }).observe({ type: 'largest-contentful-paint', buffered: true });

  // FID (First Input Delay)
  new PerformanceObserver((entryList) => {
    const entries = entryList.getEntries();
    entries.forEach((entry) => {
      const fidValue = (entry as PerformanceEventTiming).processingStart - entry.startTime;
      if (import.meta.env.DEV) {
        console.log('[Web Vitals] FID:', fidValue);
      }
      sendToGA4('FID', fidValue);
    });
  }).observe({ type: 'first-input', buffered: true });

  // CLS (Cumulative Layout Shift)
  let clsValue = 0;
  new PerformanceObserver((entryList) => {
    const entries = entryList.getEntries();
    entries.forEach((entry) => {
      if (!(entry as LayoutShift).hadRecentInput) {
        clsValue += (entry as LayoutShift).value;
        if (import.meta.env.DEV) {
          console.log('[Web Vitals] CLS:', clsValue);
        }
        sendToGA4('CLS', clsValue);
      }
    });
  }).observe({ type: 'layout-shift', buffered: true });
}

// Type definitions for Web Vitals
interface LayoutShift extends PerformanceEntry {
  value: number;
  hadRecentInput: boolean;
}

interface PerformanceEventTiming extends PerformanceEntry {
  processingStart: number;
}
