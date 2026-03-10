import React from 'react';
import { Video, Trash2, Play, RefreshCw } from 'lucide-react';
import { TubeDownloadCard } from '../components/TubeDownloadCard';
import { useDownloadStore } from '../store/downloadStore';
import { api } from '../lib/ipc';

export const VideoPage: React.FC = () => {
  const { downloads, cancelDownload, clearCompleted, fetchVideoInfo, setCurrentPage, setUrl } = useDownloadStore();

  const handleOpenFolder = (filePath: string) => {
    api.openFileLocation(filePath);
  };

  const handleRetry = (url: string) => {
    setUrl(url);
    setCurrentPage('home');
    fetchVideoInfo(url);
  };

  // Only show video downloads (exclude audio-only)
  const videoOnly = downloads.filter((d) => !d.audioOnly);
  const videoDownloads = videoOnly.filter(
    (d) => d.status === 'downloading' || d.status === 'queued' || d.status === 'processing'
  );
  const completedDownloads = videoOnly.filter(
    (d) => d.status === 'completed' || d.status === 'error' || d.status === 'cancelled'
  );

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-3xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6 animate-fade-in">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-primary/10 rounded-lg flex items-center justify-center">
              <Video size={20} className="text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground">Video Downloads</h2>
              <p className="text-xs text-muted-foreground">Manage your video download queue</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage('player')}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-muted-foreground hover:text-primary transition-all duration-200 rounded-lg hover:bg-primary/10 press-effect"
              title="Open Player"
            >
              <Play size={14} />
              <span className="hidden sm:inline">Play</span>
            </button>
            <button
              onClick={() => setCurrentPage('convert')}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-muted-foreground hover:text-primary transition-all duration-200 rounded-lg hover:bg-primary/10 press-effect"
              title="Open Converter"
            >
              <RefreshCw size={14} />
              <span className="hidden sm:inline">Convert</span>
            </button>
            {completedDownloads.length > 0 && (
              <button
                onClick={clearCompleted}
                className="flex items-center gap-2 px-3 py-1.5 text-sm text-muted-foreground hover:text-destructive transition-all duration-200 rounded-lg hover:bg-destructive/10 press-effect"
              >
                <Trash2 size={14} />
                Clear Completed
              </button>
            )}
          </div>
        </div>

        {videoOnly.length === 0 ? (
          <div className="text-center py-16 animate-fade-in">
            <div className="w-16 h-16 bg-secondary/50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Video size={28} className="text-muted-foreground/40" />
            </div>
            <h3 className="text-lg font-medium text-muted-foreground mb-2">No video downloads</h3>
            <p className="text-sm text-muted-foreground/70">
              Paste a URL on the Home page to start downloading videos
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Active Downloads */}
            {videoDownloads.length > 0 && (
              <div className="animate-slide-in">
                <h3 className="text-sm font-semibold text-foreground mb-3">
                  Active ({videoDownloads.length})
                </h3>
                <div className="space-y-3">
                  {videoDownloads.map((item, index) => (
                    <TubeDownloadCard
                      key={item.id}
                      item={item}
                      index={index}
                      onCancel={cancelDownload}
                      onRetry={handleRetry}
                      onOpenFolder={handleOpenFolder}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Completed Downloads */}
            {completedDownloads.length > 0 && (
              <div className="animate-slide-in">
                <h3 className="text-sm font-semibold text-foreground mb-3">
                  Completed ({completedDownloads.length})
                </h3>
                <div className="space-y-3">
                  {completedDownloads.map((item, index) => (
                    <TubeDownloadCard
                      key={item.id}
                      item={item}
                      index={index}
                      onCancel={cancelDownload}
                      onRetry={handleRetry}
                      onOpenFolder={handleOpenFolder}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
