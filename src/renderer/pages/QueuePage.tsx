import React from 'react';
import { ListOrdered, Trash2 } from 'lucide-react';
import { DownloadProgressCard } from '../components/DownloadProgress';
import { useDownloadStore } from '../store/downloadStore';
import { api } from '../lib/ipc';

export const QueuePage: React.FC = () => {
  const { downloads, cancelDownload, clearCompleted, fetchVideoInfo, setCurrentPage, setUrl } = useDownloadStore();

  const handleOpenFolder = (filePath: string) => {
    api.openFileLocation(filePath);
  };

  const handleRetry = (url: string) => {
    setUrl(url);
    setCurrentPage('home');
    fetchVideoInfo(url);
  };

  const activeDownloads = downloads.filter(
    (d) => d.status === 'downloading' || d.status === 'queued' || d.status === 'processing'
  );
  const completedDownloads = downloads.filter(
    (d) => d.status === 'completed' || d.status === 'error' || d.status === 'cancelled'
  );

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-3xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <ListOrdered size={24} className="text-primary" />
            <h2 className="text-xl font-bold text-foreground">Download Queue</h2>
          </div>
          {completedDownloads.length > 0 && (
            <button
              onClick={clearCompleted}
              className="flex items-center gap-2 px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-secondary"
            >
              <Trash2 size={14} />
              Clear Completed
            </button>
          )}
        </div>

        {downloads.length === 0 ? (
          <div className="text-center py-16">
            <ListOrdered size={48} className="text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-muted-foreground mb-2">No downloads yet</h3>
            <p className="text-sm text-muted-foreground/70">
              Paste a URL on the Home page to start downloading
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Active Downloads */}
            {activeDownloads.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-3">
                  Active ({activeDownloads.length})
                </h3>
                <div className="space-y-3">
                  {activeDownloads.map((item) => (
                    <DownloadProgressCard
                      key={item.id}
                      item={item}
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
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-3">
                  Completed ({completedDownloads.length})
                </h3>
                <div className="space-y-3">
                  {completedDownloads.map((item) => (
                    <DownloadProgressCard
                      key={item.id}
                      item={item}
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
