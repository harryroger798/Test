import React, { useEffect } from 'react';
import { Bell, LogIn } from 'lucide-react';
import { Sidebar } from './components/Sidebar';
import { ThemeToggle } from './components/ThemeToggle';
import { HomePage } from './pages/HomePage';
import { VideoPage } from './pages/VideoPage';
import { AudioPage } from './pages/AudioPage';
import { SettingsPage } from './pages/SettingsPage';
import { HelpPage } from './pages/HelpPage';
import { useDownloadStore } from './store/downloadStore';
import { useSettingsStore } from './store/settingsStore';

const App: React.FC = () => {
  const currentPage = useDownloadStore((s) => s.currentPage);
  const { loadSettings, theme } = useSettingsStore();

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
    </div>
  );
};

export default App;
