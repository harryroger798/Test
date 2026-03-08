import React from 'react';
import { Clock, Trash2, ExternalLink, RotateCcw } from 'lucide-react';
import { PlatformBadge } from '../components/PlatformBadge';
import { useDownloadStore } from '../store/downloadStore';

export const HistoryPage: React.FC = () => {
  const { history, clearHistory, setUrl, setCurrentPage, fetchVideoInfo } = useDownloadStore();

  const handleRedownload = (url: string) => {
    setUrl(url);
    setCurrentPage('home');
    fetchVideoInfo(url);
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-3xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Clock size={24} className="text-primary" />
            <h2 className="text-xl font-bold text-foreground">Download History</h2>
          </div>
          {history.length > 0 && (
            <button
              onClick={clearHistory}
              className="flex items-center gap-2 px-3 py-1.5 text-sm text-muted-foreground hover:text-destructive transition-colors rounded-lg hover:bg-secondary"
            >
              <Trash2 size={14} />
              Clear All
            </button>
          )}
        </div>

        {history.length === 0 ? (
          <div className="text-center py-16">
            <Clock size={48} className="text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-muted-foreground mb-2">No history yet</h3>
            <p className="text-sm text-muted-foreground/70">
              Your download history will appear here
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {history.map((item, index) => (
              <div
                key={`${item.id}-${index}`}
                className="bg-card border border-border rounded-xl p-4 flex items-center gap-4"
              >
                {/* Thumbnail */}
                {item.thumbnail && (
                  <img
                    src={item.thumbnail}
                    alt=""
                    className="w-20 h-14 object-cover rounded-lg flex-shrink-0"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                )}

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-medium text-foreground truncate">{item.title}</h4>
                  <div className="flex items-center gap-2 mt-1">
                    {item.platform && <PlatformBadge platform={item.platform} size="sm" />}
                    {item.completedAt && (
                      <span className="text-xs text-muted-foreground">
                        {new Date(item.completedAt).toLocaleDateString()} at{' '}
                        {new Date(item.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => handleRedownload(item.url)}
                    className="p-2 text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-secondary"
                    title="Download again"
                  >
                    <RotateCcw size={16} />
                  </button>
                  <button
                    onClick={() => {
                      if (window.electronAPI) {
                        window.electronAPI.openExternal(item.url);
                      } else {
                        window.open(item.url, '_blank');
                      }
                    }}
                    className="p-2 text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-secondary"
                    title="Open original URL"
                  >
                    <ExternalLink size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
