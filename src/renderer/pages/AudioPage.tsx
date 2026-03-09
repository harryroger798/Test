import React from 'react';
import { Music, Trash2 } from 'lucide-react';
import { TubeDownloadCard } from '../components/TubeDownloadCard';
import { useDownloadStore } from '../store/downloadStore';
import { api } from '../lib/ipc';

export const AudioPage: React.FC = () => {
  const { downloads, cancelDownload, clearCompleted, history, clearHistory, fetchVideoInfo, setCurrentPage, setUrl } = useDownloadStore();

  const handleOpenFolder = (filePath: string) => {
    api.openFileLocation(filePath);
  };

  const handleRetry = (url: string) => {
    setUrl(url);
    setCurrentPage('home');
    fetchVideoInfo(url);
  };

  // Active audio downloads from the downloads queue
  const audioOnly = downloads.filter((d) => d.audioOnly);
  const activeAudio = audioOnly.filter(
    (d) => d.status === 'downloading' || d.status === 'queued' || d.status === 'processing'
  );
  const completedAudio = audioOnly.filter(
    (d) => d.status === 'completed' || d.status === 'error' || d.status === 'cancelled'
  );

  // Audio files from history (for older downloads before audioOnly flag was added)
  const audioHistory = history.filter((item) => {
    const ext = item.filename?.split('.').pop()?.toLowerCase() || '';
    return ['mp3', 'm4a', 'opus', 'flac', 'wav', 'aac', 'ogg'].includes(ext);
  });

  const hasContent = audioOnly.length > 0 || audioHistory.length > 0;

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-3xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6 animate-fade-in">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-primary/10 rounded-lg flex items-center justify-center">
              <Music size={20} className="text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground">Audio Downloads</h2>
              <p className="text-xs text-muted-foreground">Manage your audio download queue</p>
            </div>
          </div>
          {(completedAudio.length > 0 || audioHistory.length > 0) && (
            <button
              onClick={() => { clearCompleted(); clearHistory(); }}
              className="flex items-center gap-2 px-3 py-1.5 text-sm text-muted-foreground hover:text-destructive transition-all duration-200 rounded-lg hover:bg-destructive/10 press-effect"
            >
              <Trash2 size={14} />
              Clear All
            </button>
          )}
        </div>

        {!hasContent ? (
          <div className="text-center py-16 animate-fade-in">
            <div className="w-16 h-16 bg-secondary/50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Music size={28} className="text-muted-foreground/40" />
            </div>
            <h3 className="text-lg font-medium text-muted-foreground mb-2">No audio downloads yet</h3>
            <p className="text-sm text-muted-foreground/70">
              Download audio from the Home page by selecting &quot;Audio Only&quot; format
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Active Audio Downloads */}
            {activeAudio.length > 0 && (
              <div className="animate-slide-in">
                <h3 className="text-sm font-semibold text-foreground mb-3">
                  Active ({activeAudio.length})
                </h3>
                <div className="space-y-3">
                  {activeAudio.map((item, index) => (
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

            {/* Completed Audio Downloads */}
            {completedAudio.length > 0 && (
              <div className="animate-slide-in">
                <h3 className="text-sm font-semibold text-foreground mb-3">
                  Completed ({completedAudio.length})
                </h3>
                <div className="space-y-3">
                  {completedAudio.map((item, index) => (
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

            {/* Audio History (older downloads before audioOnly flag) */}
            {audioHistory.length > 0 && completedAudio.length === 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-foreground mb-3">
                  History ({audioHistory.length})
                </h3>
                {audioHistory.map((item, index) => (
                  <div
                    key={`${item.id}-${index}`}
                    className={`bg-card border border-border rounded-xl p-4 flex items-center gap-4 hover-lift transition-all duration-200 animate-slide-in stagger-${Math.min(index + 1, 5)}`}
                  >
                    <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center flex-shrink-0">
                      <Music size={20} className="text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-medium text-foreground truncate">{item.title}</h4>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        {item.filename && (
                          <span className="uppercase font-medium text-primary/70">
                            {item.filename.split('.').pop()}
                          </span>
                        )}
                        {item.filesize && <span>{item.filesize}</span>}
                        {item.completedAt && (
                          <span>
                            {new Date(item.completedAt).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
