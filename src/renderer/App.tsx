import React, { useEffect, useState } from 'react';
import { Bell, LogIn } from 'lucide-react';
import { Sidebar } from './components/Sidebar';
import { ThemeToggle } from './components/ThemeToggle';
import { SetupWizard } from './components/SetupWizard';
import { CookieBlockModal } from './components/CookieBlockModal';
import { HomePage } from './pages/HomePage';
import { VideoPage } from './pages/VideoPage';
import { AudioPage } from './pages/AudioPage';
import { SettingsPage } from './pages/SettingsPage';
import { HelpPage } from './pages/HelpPage';
import { useDownloadStore } from './store/downloadStore';
import { useSettingsStore } from './store/settingsStore';
import { api } from './lib/ipc';

const App: React.FC = () => {
  const currentPage = useDownloadStore((s) => s.currentPage);
  const { loadSettings, theme } = useSettingsStore();
  const [showSetupWizard, setShowSetupWizard] = useState(false);
  const [showCookieBlock, setShowCookieBlock] = useState(false);
  const [setupChecked, setSetupChecked] = useState(false);

  // Check if first-run setup has been completed
  useEffect(() => {
    api.getSetupComplete().then((result) => {
      if (!result.complete) {
        setShowSetupWizard(true);
      }
      setSetupChecked(true);
    });
  }, []);

  // Listen for download errors that indicate cookie issues
  useEffect(() => {
    const cleanup = api.onDownloadComplete((result: unknown) => {
      const r = result as { success?: boolean; error?: string };
      if (!r.success && r.error) {
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
  }, []);

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
      default:
        return <HomePage />;
    }
  };

  // Show setup wizard on first run
  if (showSetupWizard && setupChecked) {
    return <SetupWizard onComplete={() => setShowSetupWizard(false)} />;
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

          {/* Right side: theme toggle, notification, sign in */}
          <div className="flex items-center gap-1.5">
            <ThemeToggle />
            <button
              className="relative p-2 text-muted-foreground hover:text-foreground transition-all duration-200 rounded-lg hover:bg-secondary/50 press-effect"
              title="Notifications"
            >
              <Bell size={18} />
              {/* Notification dot */}
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-primary rounded-full animate-pulse-download" />
            </button>
            <button
              className="ml-1 flex items-center gap-2 px-3 py-1.5 bg-destructive text-destructive-foreground rounded-lg text-sm font-medium hover:bg-destructive/90 transition-all duration-200 press-effect"
            >
              <LogIn size={14} />
              <span className="hidden sm:inline">Sign In</span>
            </button>
          </div>
        </div>

        {/* Page Content */}
        {renderPage()}
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
