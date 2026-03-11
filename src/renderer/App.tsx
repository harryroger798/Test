import React, { useEffect, useState, useRef, useCallback, lazy, Suspense } from 'react';
import { Bell, Key, Crown, CheckCircle, AlertCircle, X, Download } from 'lucide-react';
import { Sidebar } from './components/Sidebar';
import { ThemeToggle } from './components/ThemeToggle';
import { SetupWizard } from './components/SetupWizard';
import { CookieBlockModal } from './components/CookieBlockModal';
import { FeatureTour } from './components/FeatureTour';
import { useDownloadStore, DownloadItem } from './store/downloadStore';
import { useSettingsStore } from './store/settingsStore';
import { cn } from './lib/utils';
import { api } from './lib/ipc';

// Lazy-load pages for faster initial render and code splitting
const HomePage = lazy(() => import('./pages/HomePage').then(m => ({ default: m.HomePage })));
const VideoPage = lazy(() => import('./pages/VideoPage').then(m => ({ default: m.VideoPage })));
const AudioPage = lazy(() => import('./pages/AudioPage').then(m => ({ default: m.AudioPage })));
const SettingsPage = lazy(() => import('./pages/SettingsPage').then(m => ({ default: m.SettingsPage })));
const HelpPage = lazy(() => import('./pages/HelpPage').then(m => ({ default: m.HelpPage })));
const PlayerPage = lazy(() => import('./pages/PlayerPage').then(m => ({ default: m.PlayerPage })));
const ConvertPage = lazy(() => import('./pages/ConvertPage').then(m => ({ default: m.ConvertPage })));

// Loading fallback for lazy-loaded pages
const PageLoader: React.FC = () => (
  <div className="flex-1 flex items-center justify-center">
    <div className="text-muted-foreground text-sm animate-pulse">Loading...</div>
  </div>
);

interface AppNotification {
  id: string;
  type: 'success' | 'error' | 'info';
  title: string;
  message: string;
  timestamp: number;
  read: boolean;
}

const App: React.FC = () => {
  const currentPage = useDownloadStore((s) => s.currentPage);
  const { loadSettings, theme } = useSettingsStore();
  const [showSetupWizard, setShowSetupWizard] = useState(false);
  const [showCookieBlock, setShowCookieBlock] = useState(false);
  const [showFeatureTour, setShowFeatureTour] = useState(false);
  const [setupChecked, setSetupChecked] = useState(false);
  const [licenseTier, setLicenseTier] = useState<string>('free');
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  const addNotification = useCallback((type: AppNotification['type'], title: string, message: string) => {
    const notif: AppNotification = {
      id: Date.now().toString(),
      type,
      title,
      message,
      timestamp: Date.now(),
      read: false,
    };
    setNotifications((prev) => [notif, ...prev].slice(0, 50));
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAllRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const clearNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  // Close notification panel when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Check if first-run setup and feature tour have been completed
  useEffect(() => {
    api.getSetupComplete().then((result) => {
      if (!result.complete) {
        setShowSetupWizard(true);
      } else {
        // Setup is done — check if feature tour needs to show
        api.getFeatureTourComplete().then((tourResult) => {
          if (!tourResult.complete) {
            setShowFeatureTour(true);
          }
        });
      }
      setSetupChecked(true);
    });
    // Load license tier for the top bar badge
    api.getLicenseState().then((state) => {
      setLicenseTier(state.tier);
    }).catch(() => {});
  }, []);

  // Listen for license tier changes (from activation/deactivation in Settings)
  useEffect(() => {
    const cleanup = api.onLicenseTierChanged((data: unknown) => {
      const d = data as { tier?: string; activated?: boolean };
      if (d.tier) {
        setLicenseTier(d.tier);
      }
    });
    return cleanup;
  }, []);

  // Listen for ban prevention warnings — feed into notifications
  useEffect(() => {
    const cleanup = api.onBanPreventionWarning((data: unknown) => {
      const d = data as { platform?: string; level?: string; message?: string; cookielessActivated?: boolean };
      if (d.level === 'danger') {
        addNotification('error', 'Account Protection Alert',
          d.message || `High download rate on ${d.platform || 'unknown'}. Auto-switching to cookieless mode to protect your account.`);
      } else if (d.level === 'warning') {
        addNotification('info', 'Download Rate Warning',
          d.message || `Approaching safe download limit on ${d.platform || 'unknown'}. Consider slowing down.`);
      }
    });
    return cleanup;
  }, [addNotification]);

  // Listen for download progress — update download cards in real-time
  useEffect(() => {
    const cleanup = api.onDownloadProgress((progress: unknown) => {
      const p = progress as {
        downloadId?: string;
        status?: string;
        percent?: number;
        speed?: string;
        eta?: string;
        filesize?: string;
        filename?: string;
        error?: string;
      };
      if (!p.downloadId) return;
      const { updateDownload } = useDownloadStore.getState();
      const update: Partial<DownloadItem> = {};
      if (p.percent !== undefined) update.progress = p.percent;
      if (p.speed) update.speed = p.speed;
      if (p.eta) update.eta = p.eta;
      if (p.filesize) update.filesize = p.filesize;
      if (p.filename) update.filename = p.filename;
      // Map status: only update to error if it's a real error (has error text)
      if (p.status === 'processing') update.status = 'processing';
      else if (p.status === 'error' && p.error) update.status = 'error';
      else if (p.status === 'downloading') update.status = 'downloading';
      if (p.error) update.error = p.error;
      updateDownload(p.downloadId, update);
    });
    return cleanup;
  }, []);

  // Listen for download completions and errors — update store + notifications + cookie block
  useEffect(() => {
    const cleanup = api.onDownloadComplete((result: unknown) => {
      const r = result as {
        id?: string;
        status?: string;
        error?: string;
        title?: string;
        filename?: string;
        resolvedFilePath?: string;
      };
      // Update the download item in the store
      if (r.id) {
        const { updateDownload, addToHistory, downloads } = useDownloadStore.getState();
        if (r.status === 'completed') {
          // Update outputPath to the actual resolved file path so "Open Folder" opens the correct location.
          // Without this, outputPath stays as the download DIRECTORY and shell.showItemInFolder
          // opens the parent folder instead of highlighting the downloaded file.
          const completedUpdate: Partial<DownloadItem> = { status: 'completed', progress: 100 };
          if (r.resolvedFilePath) {
            completedUpdate.outputPath = r.resolvedFilePath;
          }
          updateDownload(r.id, completedUpdate);
          // Add to renderer-side history
          const item = downloads.find(d => d.id === r.id);
          if (item) {
            addToHistory({ ...item, status: 'completed', progress: 100, completedAt: new Date().toISOString() });
          }
        } else if (r.status === 'error') {
          updateDownload(r.id, { status: 'error', error: r.error });
        } else if (r.status === 'cancelled') {
          updateDownload(r.id, { status: 'cancelled' });
        }
      }
      // Notifications
      if (r.status === 'completed') {
        addNotification('success', 'Download Complete', r.title || r.filename || 'File downloaded successfully');
      } else if (r.status === 'error' && r.error) {
        addNotification('error', 'Download Failed', r.error);
        const errorLower = r.error.toLowerCase();
        if (
          errorLower.includes('sign in') ||
          errorLower.includes('not a bot') ||
          errorLower.includes('browser cookies') ||
          errorLower.includes('youtube is blocking') ||
          errorLower.includes('cookies')
        ) {
          setShowCookieBlock(true);
        }
      }
    });
    return cleanup;
  }, [addNotification]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  useEffect(() => {
    if (theme === 'light') {
      document.documentElement.classList.add('light');
    } else {
      document.documentElement.classList.remove('light');
    }
  }, [theme]);

  const renderPage = () => {
    switch (currentPage) {
      case 'home':
        return <HomePage />;
      case 'video':
        return <VideoPage />;
      case 'audio':
        return <AudioPage />;
      case 'settings':
        return <SettingsPage />;
      case 'help':
        return <HelpPage />;
      case 'player':
        return <PlayerPage />;
      case 'convert':
        return <ConvertPage />;
      default:
        return <HomePage />;
    }
  };

  // Show setup wizard on first run
  if (showSetupWizard && setupChecked) {
    return (
      <SetupWizard
        onComplete={() => {
          setShowSetupWizard(false);
          setShowFeatureTour(true);
        }}
      />
    );
  }

  // Show feature tour after setup wizard completes
  if (showFeatureTour && setupChecked) {
    return (
      <FeatureTour
        onComplete={() => {
          setShowFeatureTour(false);
          api.setFeatureTourComplete();
        }}
      />
    );
  }

  // Don't render until setup check is done
  if (!setupChecked) {
    return (
      <div className="flex h-screen bg-background items-center justify-center">
        <div className="text-muted-foreground text-sm">Loading...</div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar */}
        <div className="h-12 border-b border-border flex items-center justify-between px-4 flex-shrink-0 animate-fade-in">
          {/* macOS traffic lights */}
          <div className="flex items-center gap-2">
            <span className="traffic-light traffic-light-red" />
            <span className="traffic-light traffic-light-yellow" />
            <span className="traffic-light traffic-light-green" />
          </div>

          {/* Right side: theme toggle, notifications, license badge */}
          <div className="flex items-center gap-1.5">
            <ThemeToggle />
            <div className="relative" ref={notifRef}>
              <button
                onClick={() => {
                  setShowNotifications(!showNotifications);
                  if (!showNotifications) markAllRead();
                }}
                className="relative p-2 text-muted-foreground hover:text-foreground transition-all duration-200 rounded-lg hover:bg-secondary/50 press-effect"
                title="Notifications"
              >
                <Bell size={18} />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 min-w-[16px] h-4 bg-primary text-primary-foreground text-[10px] font-bold rounded-full flex items-center justify-center px-1 animate-scale-in">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {/* Notification dropdown */}
              {showNotifications && (
                <div className="absolute right-0 top-full mt-2 w-80 max-h-96 bg-card border border-border rounded-xl shadow-2xl overflow-hidden z-50 animate-slide-in">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                    <h3 className="text-sm font-semibold text-foreground">Notifications</h3>
                    <div className="flex items-center gap-2">
                      {notifications.length > 0 && (
                        <button
                          onClick={clearNotifications}
                          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                        >
                          Clear all
                        </button>
                      )}
                      <button
                        onClick={() => setShowNotifications(false)}
                        className="text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                  <div className="overflow-y-auto max-h-80">
                    {notifications.length === 0 ? (
                      <div className="px-4 py-8 text-center">
                        <Download size={24} className="mx-auto text-muted-foreground/40 mb-2" />
                        <p className="text-sm text-muted-foreground">No notifications yet</p>
                        <p className="text-xs text-muted-foreground/60 mt-1">Download completions and errors will appear here</p>
                      </div>
                    ) : (
                      notifications.map((notif) => (
                        <div
                          key={notif.id}
                          className={cn(
                            'px-4 py-3 border-b border-border/50 hover:bg-secondary/30 transition-colors',
                            !notif.read && 'bg-primary/5'
                          )}
                        >
                          <div className="flex items-start gap-2">
                            {notif.type === 'success' ? (
                              <CheckCircle size={14} className="text-green-500 mt-0.5 flex-shrink-0" />
                            ) : notif.type === 'error' ? (
                              <AlertCircle size={14} className="text-destructive mt-0.5 flex-shrink-0" />
                            ) : (
                              <Bell size={14} className="text-primary mt-0.5 flex-shrink-0" />
                            )}
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-medium text-foreground">{notif.title}</p>
                              <p className="text-xs text-muted-foreground truncate mt-0.5">{notif.message}</p>
                              <p className="text-[10px] text-muted-foreground/50 mt-1">
                                {new Date(notif.timestamp).toLocaleTimeString()}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
            <button
              onClick={() => useDownloadStore.getState().setCurrentPage('settings')}
              className={cn(
                'ml-1 flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 press-effect',
                licenseTier === 'free'
                  ? 'bg-secondary/50 border border-border text-muted-foreground hover:text-foreground hover:border-primary/50'
                  : 'bg-primary/10 border border-primary text-primary hover:bg-primary/20'
              )}
              title={licenseTier === 'free' ? 'Activate License' : `${licenseTier.toUpperCase()} Plan`}
            >
              {licenseTier === 'free' ? <Key size={14} /> : <Crown size={14} />}
              <span className="hidden sm:inline">
                {licenseTier === 'free' ? 'Activate' : licenseTier.toUpperCase()}
              </span>
            </button>
          </div>
        </div>

        {/* Page Content — Lazy loaded with Suspense */}
        <Suspense fallback={<PageLoader />}>
          {renderPage()}
        </Suspense>
      </div>

      {/* Cookie Block Modal — shown when YouTube blocks a download */}
      {showCookieBlock && (
        <CookieBlockModal
          onDismiss={() => setShowCookieBlock(false)}
          onVerified={() => setShowCookieBlock(false)}
        />
      )}
    </div>
  );
};

export default App;
