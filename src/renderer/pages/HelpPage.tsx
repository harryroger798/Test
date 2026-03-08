import React, { useEffect, useState } from 'react';
import { HelpCircle, MessageSquare, ExternalLink, BookOpen, Shield, Zap } from 'lucide-react';
import { api } from '../lib/ipc';

export const HelpPage: React.FC = () => {
  const [appVersion, setAppVersion] = useState('...');

  useEffect(() => {
    api.getAppVersion().then((res) => setAppVersion(res.version)).catch(() => setAppVersion('1.0.5'));
  }, []);

  const helpItems = [
    {
      icon: BookOpen,
      title: 'Getting Started',
      description: 'Paste any video URL from 1800+ supported websites and click Convert to download.',
    },
    {
      icon: Zap,
      title: 'Supported Formats',
      description: 'Download videos in MP4, MKV, WebM or extract audio as MP3, M4A, OPUS, FLAC, WAV.',
    },
    {
      icon: Shield,
      title: 'Privacy & Security',
      description: 'All downloads happen locally on your machine. No data is sent to external servers.',
    },
    {
      icon: MessageSquare,
      title: 'Cookie Authentication',
      description: 'Some platforms require login cookies. Go to Settings to import cookies for Instagram, Reddit, etc.',
    },
  ];

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-3xl mx-auto px-6 py-8">
        <div className="flex items-center gap-3 mb-6 animate-fade-in">
          <div className="w-9 h-9 bg-primary/10 rounded-lg flex items-center justify-center">
            <HelpCircle size={20} className="text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground">Help & Support</h2>
            <p className="text-xs text-muted-foreground">Learn how to use GrabTube</p>
          </div>
        </div>

        <div className="space-y-4">
          {helpItems.map((item, index) => (
            <div
              key={item.title}
              className={`bg-card border border-border rounded-xl p-5 hover-lift transition-all duration-200 animate-slide-in stagger-${Math.min(index + 1, 5)}`}
            >
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                  <item.icon size={20} className="text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground text-sm mb-1">{item.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{item.description}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* External links */}
        <div className="mt-8 bg-card border border-border rounded-xl p-5 animate-slide-in">
          <h3 className="font-semibold text-foreground text-sm mb-4">Resources</h3>
          <div className="space-y-3">
            {[
              { label: 'yt-dlp Documentation', url: 'https://github.com/yt-dlp/yt-dlp' },
              { label: 'Supported Sites List', url: 'https://github.com/yt-dlp/yt-dlp/blob/master/supportedsites.md' },
              { label: 'Report an Issue', url: 'https://github.com/harryroger798/Test/issues' },
            ].map((link) => (
              <a
                key={link.label}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between px-4 py-3 rounded-lg bg-secondary/30 hover:bg-primary/10 hover:text-primary transition-all duration-200 group press-effect"
              >
                <span className="text-sm text-foreground group-hover:text-primary transition-colors">{link.label}</span>
                <ExternalLink size={14} className="text-muted-foreground group-hover:text-primary transition-colors" />
              </a>
            ))}
          </div>
        </div>

        {/* Version info */}
        <div className="mt-6 text-center text-xs text-muted-foreground animate-fade-in">
          <p>GrabTube v{appVersion}</p>
          <p className="mt-1">Built with yt-dlp, Electron, and React</p>
        </div>
      </div>
    </div>
  );
};
