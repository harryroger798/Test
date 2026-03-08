import React, { useEffect } from 'react';
import { Globe, Zap, Shield } from 'lucide-react';
import { UrlInput } from '../components/UrlInput';
import { VideoCard } from '../components/VideoCard';
import { FormatSelector } from '../components/FormatSelector';
import { TubeDownloadCard } from '../components/TubeDownloadCard';
import { useDownloadStore } from '../store/downloadStore';
import { api } from '../lib/ipc';

const SUPPORTED_PLATFORMS = [
  'YouTube', 'TikTok', 'Instagram', 'Twitter/X', 'Facebook',
  'Reddit', 'Vimeo', 'Twitch', 'Dailymotion', 'SoundCloud',
  'Bilibili', 'Pinterest', 'LinkedIn', 'Rumble', '1800+ more',
];

export const HomePage: React.FC = () => {
  const {
    videoInfo,
    downloads,
    cancelDownload,
    updateDownload,
    addToHistory,
    fetchVideoInfo,
  } = useDownloadStore();

  // Listen for download progress & completion
  useEffect(() => {
    const unsubProgress = api.onDownloadProgress((progress: unknown) => {
      const p = progress as { downloadId: string; status: string; percent: number; speed: string; eta: string; filesize: string; filename: string };
      updateDownload(p.downloadId, {
        status: p.status as 'downloading' | 'processing',
        progress: p.percent,
        speed: p.speed,
        eta: p.eta,
        filesize: p.filesize,
        filename: p.filename || undefined,
      });
    });

    const unsubComplete = api.onDownloadComplete((result: unknown) => {
      const r = result as { id: string; status: string; error?: string; filePath?: string };
      updateDownload(r.id, {
        status: r.status as 'completed' | 'error',
        error: r.error,
        progress: r.status === 'completed' ? 100 : undefined,
        completedAt: new Date().toISOString(),
      });

      if (r.status === 'completed') {
        const download = downloads.find((d) => d.id === r.id);
        if (download) {
          addToHistory({ ...download, status: 'completed', completedAt: new Date().toISOString() });
        }
      }
    });

    return () => {
      unsubProgress();
      unsubComplete();
    };
  }, [updateDownload, addToHistory, downloads]);

  const activeDownloads = downloads.filter(
    (d) => d.status === 'downloading' || d.status === 'queued' || d.status === 'processing' || d.status === 'completed' || d.status === 'error'
  );

  const handleOpenFolder = (filePath: string) => {
    api.openFileLocation(filePath);
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Welcome Header */}
        <div className="mb-8 animate-fade-in">
          <h1 className="text-2xl font-bold text-foreground mb-1">
            Welcome Back!
          </h1>
          <p className="text-muted-foreground text-sm">
            Paste any video URL to download in your preferred format
          </p>
        </div>

        {/* URL Input */}
        <UrlInput />

        {/* Video Info Card */}
        {videoInfo && <VideoCard info={videoInfo} />}

        {/* Format Selector */}
        {videoInfo && <FormatSelector />}

        {/* Inline Download List (TubeMate style) */}
        {activeDownloads.length > 0 && (
          <div className="mt-6 space-y-3 animate-slide-in">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">Downloads</h3>
              <span className="text-xs text-muted-foreground">{activeDownloads.length} item{activeDownloads.length !== 1 ? 's' : ''}</span>
            </div>
            {activeDownloads.map((item, index) => (
              <TubeDownloadCard
                key={item.id}
                item={item}
                index={index}
                onCancel={cancelDownload}
                onRetry={(url) => fetchVideoInfo(url)}
                onOpenFolder={handleOpenFolder}
              />
            ))}
          </div>
        )}

        {/* Supported Platforms (shown when no video info and no downloads) */}
        {!videoInfo && activeDownloads.length === 0 && (
          <div className="mt-12 animate-fade-in">
            {/* Features */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
              {[
                { icon: Globe, title: '1800+ Sites', desc: 'YouTube, TikTok, Instagram, and many more' },
                { icon: Zap, title: 'Fast Downloads', desc: 'Multi-threaded with concurrent fragment support' },
                { icon: Shield, title: 'Privacy First', desc: 'Everything runs locally on your machine' },
              ].map((feature, i) => (
                <div
                  key={feature.title}
                  className={`bg-card border border-border rounded-xl p-4 text-center hover-lift animate-slide-in stagger-${i + 1}`}
                >
                  <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-3">
                    <feature.icon size={20} className="text-primary" />
                  </div>
                  <h3 className="font-medium text-foreground text-sm mb-1">{feature.title}</h3>
                  <p className="text-xs text-muted-foreground">{feature.desc}</p>
                </div>
              ))}
            </div>

            {/* Platform Tags */}
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-3">Supported platforms</p>
              <div className="flex flex-wrap justify-center gap-2">
                {SUPPORTED_PLATFORMS.map((platform, i) => (
                  <span
                    key={platform}
                    className={`px-3 py-1.5 bg-secondary/50 border border-border rounded-full text-xs text-muted-foreground hover:bg-primary/10 hover:text-primary hover:border-primary/30 transition-all duration-200 cursor-default animate-scale-in stagger-${Math.min(i % 5 + 1, 5)}`}
                  >
                    {platform}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
