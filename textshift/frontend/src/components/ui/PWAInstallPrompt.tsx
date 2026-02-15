// PWA Install Prompt Component (Mobile Optimization #46)
// Prompts users to install the app as a PWA

import { useState, useEffect } from 'react';
import { Download, X, Smartphone } from 'lucide-react';
import { usePWAInstallPrompt, useIsMobile } from '@/lib/mobile';
import { Button } from './button';
import { cn } from '@/lib/utils';

interface PWAInstallPromptProps {
  className?: string;
  delay?: number;
}

export function PWAInstallPrompt({ className, delay = 30000 }: PWAInstallPromptProps) {
  const { canInstall, promptInstall } = usePWAInstallPrompt();
  const isMobile = useIsMobile(1024);
  const [isVisible, setIsVisible] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    // Check if user has already dismissed
    const dismissed = localStorage.getItem('pwa-install-dismissed');
    if (dismissed) {
      const dismissedTime = parseInt(dismissed, 10);
      // Show again after 7 days
      if (Date.now() - dismissedTime < 7 * 24 * 60 * 60 * 1000) {
        setIsDismissed(true);
        return;
      }
    }

    // Show prompt after delay
    const timer = setTimeout(() => {
      if (canInstall && !isDismissed) {
        setIsVisible(true);
      }
    }, delay);

    return () => clearTimeout(timer);
  }, [canInstall, isDismissed, delay]);

  const handleInstall = async () => {
    const installed = await promptInstall();
    if (installed) {
      setIsVisible(false);
    }
  };

  const handleDismiss = () => {
    setIsVisible(false);
    setIsDismissed(true);
    localStorage.setItem('pwa-install-dismissed', Date.now().toString());
  };

  if (!canInstall || isDismissed || !isMobile) {
    return null;
  }

  return (
    <>
      {isVisible && (
        <div
          className={cn(
            'fixed top-20 left-4 right-4 md:right-auto md:left-4 md:w-96 bg-[#1a1a1a] border border-white/10 rounded-2xl shadow-xl z-50 overflow-hidden animate-fade-in-up',
            className
          )}
        >
          <div className="p-4">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-emerald-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
                <Smartphone className="w-6 h-6 text-emerald-400" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-white font-medium mb-1">Install TextShift</h3>
                <p className="text-gray-400 text-sm">
                  Add TextShift to your home screen for quick access and offline use.
                </p>
              </div>
              <button
                onClick={handleDismiss}
                className="text-gray-500 hover:text-white transition"
                aria-label="Dismiss"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex gap-3 mt-4">
              <Button
                onClick={handleInstall}
                className="flex-1 gap-2 bg-emerald-500 hover:bg-emerald-600 text-black"
              >
                <Download className="w-4 h-4" />
                Install
              </Button>
              <Button
                onClick={handleDismiss}
                variant="outline"
                className="flex-1"
              >
                Not Now
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default PWAInstallPrompt;
