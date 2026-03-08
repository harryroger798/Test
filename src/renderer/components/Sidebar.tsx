import React from 'react';
import { Home, Video, Music, Settings, HelpCircle, Download, type LucideIcon } from 'lucide-react';
import { cn } from '../lib/utils';
import { useDownloadStore } from '../store/downloadStore';

interface NavItem {
  id: 'home' | 'video' | 'audio' | 'settings' | 'help';
  label: string;
  icon: LucideIcon;
  badge?: number;
}

export const Sidebar: React.FC = () => {
  const { currentPage, setCurrentPage, downloads } = useDownloadStore();

  const activeDownloads = downloads.filter(
    (d) => d.status === 'downloading' || d.status === 'queued' || d.status === 'processing'
  ).length;

  const downloadItems: NavItem[] = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'video', label: 'Video', icon: Video, badge: activeDownloads },
    { id: 'audio', label: 'Audio', icon: Music },
  ];

  const systemItems: NavItem[] = [
    { id: 'settings', label: 'Settings', icon: Settings },
    { id: 'help', label: 'Help and Support', icon: HelpCircle },
  ];

  const renderNavItem = (item: NavItem, index: number) => (
    <button
      key={item.id}
      onClick={() => setCurrentPage(item.id)}
      className={cn(
        'nav-indicator w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 relative press-effect',
        `animate-slide-in-left stagger-${index + 1}`,
        currentPage === item.id
          ? 'active bg-primary/10 text-primary'
          : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
      )}
    >
      <item.icon size={20} className="flex-shrink-0 mx-auto lg:mx-0" />
      <span className="hidden lg:block text-sm font-medium">{item.label}</span>
      {item.badge !== undefined && item.badge > 0 && (
        <span className="absolute top-1 right-1 lg:relative lg:top-0 lg:right-0 lg:ml-auto bg-primary text-primary-foreground text-xs rounded-full w-5 h-5 flex items-center justify-center font-medium animate-scale-in">
          {item.badge}
        </span>
      )}
    </button>
  );

  return (
    <div className="w-16 lg:w-56 bg-card border-r border-border flex flex-col h-full">
      {/* Logo */}
      <div className="p-4 flex items-center gap-3 border-b border-border">
        <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center flex-shrink-0 hover-glow">
          <Download size={18} className="text-primary-foreground" />
        </div>
        <span className="font-bold text-foreground text-lg hidden lg:block">GrabTube</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-2 pt-4 space-y-1 overflow-y-auto">
        {/* Download section */}
        <p className="hidden lg:block text-[10px] uppercase tracking-wider text-muted-foreground/60 font-semibold px-3 mb-2">
          Download
        </p>
        {downloadItems.map((item, i) => renderNavItem(item, i))}

        {/* System section */}
        <div className="pt-4">
          <p className="hidden lg:block text-[10px] uppercase tracking-wider text-muted-foreground/60 font-semibold px-3 mb-2">
            System
          </p>
          {systemItems.map((item, i) => renderNavItem(item, i + 3))}
        </div>
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
