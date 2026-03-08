import React, { useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { ThemeToggle } from './components/ThemeToggle';
import { HomePage } from './pages/HomePage';
import { QueuePage } from './pages/QueuePage';
import { HistoryPage } from './pages/HistoryPage';
import { SettingsPage } from './pages/SettingsPage';
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
      case 'queue':
        return <QueuePage />;
      case 'history':
        return <HistoryPage />;
      case 'settings':
        return <SettingsPage />;
      default:
        return <HomePage />;
    }
  };

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar */}
        <div className="h-12 border-b border-border flex items-center justify-end px-4 flex-shrink-0">
          <ThemeToggle />
        </div>

        {/* Page Content */}
        {renderPage()}
      </div>
    </div>
  );
};

export default App;
