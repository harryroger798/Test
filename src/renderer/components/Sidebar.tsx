import React from 'react';
import { Home, ListOrdered, Clock, Settings, Download } from 'lucide-react';
import { cn } from '../lib/utils';
import { useDownloadStore } from '../store/downloadStore';

export const Sidebar: React.FC = () => {
  const { currentPage, setCurrentPage, downloads } = useDownloadStore();

  const activeDownloads = downloads.filter(
    (d) => d.status === 'downloading' || d.status === 'queued' || d.status === 'processing'
  ).length;

  const navItems = [
    { id: 'home' as const, label: 'Home', icon: Home },
    { id: 'queue' as const, label: 'Queue', icon: ListOrdered, badge: activeDownloads },
    { id: 'history' as const, label: 'History', icon: Clock },
    { id: 'settings' as const, label: 'Settings', icon: Settings },
  ];

  return (
    <div className="w-16 lg:w-56 bg-card border-r border-border flex flex-col h-full">
      {/* Logo */}
      <div className="p-4 flex items-center gap-3 border-b border-border">
        <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center flex-shrink-0">
          <Download size={18} className="text-primary-foreground" />
        </div>
        <span className="font-bold text-foreground text-lg hidden lg:block">GrabTube</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-2 space-y-1">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setCurrentPage(item.id)}
            className={cn(
              'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all relative',
              currentPage === item.id
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
            )}
          >
            <item.icon size={20} className="flex-shrink-0 mx-auto lg:mx-0" />
            <span className="hidden lg:block text-sm font-medium">{item.label}</span>
            {item.badge !== undefined && item.badge > 0 && (
              <span className="absolute top-1 right-1 lg:relative lg:top-0 lg:right-0 lg:ml-auto bg-primary text-primary-foreground text-xs rounded-full w-5 h-5 flex items-center justify-center font-medium">
                {item.badge}
              </span>
            )}
          </button>
        ))}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-border hidden lg:block">
        <p className="text-xs text-muted-foreground text-center">
          GrabTube v1.0.0
        </p>
      </div>
    </div>
  );
};
