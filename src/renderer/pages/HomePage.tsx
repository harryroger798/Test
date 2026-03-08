import React, { useEffect } from 'react';
import { Download, Globe, Zap, Shield } from 'lucide-react';
import { UrlInput } from '../components/UrlInput';
import { VideoCard } from '../components/VideoCard';
import { FormatSelector } from '../components/FormatSelector';
import { DownloadProgressCard } from '../components/DownloadProgress';
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
        {/* Hero */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Download from{' '}
            <span className="text-primary">Anywhere</span>
          </h1>
          <p className="text-muted-foreground text-base">
            Paste a video URL and download in your preferred format and quality
          </p>
        </div>

        {/* URL Input */}
        <UrlInput />

        {/* Video Info Card */}
        {videoInfo && <VideoCard info={videoInfo} />}

        {/* Format Selector */}
        {videoInfo && <FormatSelector />}

        {/* Active Downloads */}
        {activeDownloads.length > 0 && (
          <div className="mt-6 space-y-3">
            <h3 className="text-sm font-medium text-muted-foreground">Downloads</h3>
            {activeDownloads.map((item) => (
              <DownloadProgressCard
                key={item.id}
                item={item}
                onCancel={cancelDownload}
                onRetry={(url) => fetchVideoInfo(url)}
                onOpenFolder={handleOpenFolder}
              />
            ))}
          </div>
        )}

        {/* Supported Platforms (shown when no video info) */}
        {!videoInfo && (
          <div className="mt-12">
            {/* Features */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
              <div className="bg-card border border-border rounded-xl p-4 text-center">
                <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-3">
                  <Globe size={20} className="text-primary" />
                </div>
                <h3 className="font-medium text-foreground text-sm mb-1">1800+ Sites</h3>
                <p className="text-xs text-muted-foreground">YouTube, TikTok, Instagram, and many more</p>
              </div>
              <div className="bg-card border border-border rounded-xl p-4 text-center">
                <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-3">
                  <Zap size={20} className="text-primary" />
                </div>
                <h3 className="font-medium text-foreground text-sm mb-1">Fast Downloads</h3>
                <p className="text-xs text-muted-foreground">Multi-threaded with concurrent fragment support</p>
              </div>
              <div className="bg-card border border-border rounded-xl p-4 text-center">
                <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-3">
                  <Shield size={20} className="text-primary" />
                </div>
                <h3 className="font-medium text-foreground text-sm mb-1">Privacy First</h3>
                <p className="text-xs text-muted-foreground">Everything runs locally on your machine</p>
              </div>
            </div>

            {/* Platform Tags */}
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-3">Supported platforms</p>
              <div className="flex flex-wrap justify-center gap-2">
                {SUPPORTED_PLATFORMS.map((platform) => (
                  <span
                    key={platform}
                    className="px-3 py-1.5 bg-secondary/50 border border-border rounded-full text-xs text-muted-foreground"
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
