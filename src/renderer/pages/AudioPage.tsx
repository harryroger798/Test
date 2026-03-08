import React from 'react';
import { Music, Trash2 } from 'lucide-react';
import { useDownloadStore } from '../store/downloadStore';

export const AudioPage: React.FC = () => {
  const { history, clearHistory } = useDownloadStore();

  // Filter audio downloads from history (items that were audio-only)
  const audioHistory = history.filter((item) => {
    const ext = item.filename?.split('.').pop()?.toLowerCase() || '';
    return ['mp3', 'm4a', 'opus', 'flac', 'wav', 'aac', 'ogg'].includes(ext);
  });

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-3xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6 animate-fade-in">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-primary/10 rounded-lg flex items-center justify-center">
              <Music size={20} className="text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground">Audio Library</h2>
              <p className="text-xs text-muted-foreground">Your downloaded audio files</p>
            </div>
          </div>
          {audioHistory.length > 0 && (
            <button
              onClick={clearHistory}
              className="flex items-center gap-2 px-3 py-1.5 text-sm text-muted-foreground hover:text-destructive transition-all duration-200 rounded-lg hover:bg-destructive/10 press-effect"
            >
              <Trash2 size={14} />
              Clear All
            </button>
          )}
        </div>

        {audioHistory.length === 0 ? (
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
          <div className="space-y-2">
            {audioHistory.map((item, index) => (
              <div
                key={`${item.id}-${index}`}
                className={`bg-card border border-border rounded-xl p-4 flex items-center gap-4 hover-lift transition-all duration-200 animate-slide-in stagger-${Math.min(index + 1, 5)}`}
              >
                {/* Audio icon */}
                <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Music size={20} className="text-primary" />
                </div>

                {/* Info */}
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
    </div>
  );
};
