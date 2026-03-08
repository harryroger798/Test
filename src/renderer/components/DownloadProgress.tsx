import React from 'react';
import { X, Check, AlertCircle, Loader2, FolderOpen, RotateCcw } from 'lucide-react';
import { PlatformBadge } from './PlatformBadge';
import { cn } from '../lib/utils';
import type { DownloadItem } from '../store/downloadStore';

interface DownloadProgressProps {
  item: DownloadItem;
  onCancel: (id: string) => void;
  onRetry?: (url: string) => void;
  onOpenFolder?: (path: string) => void;
}

export const DownloadProgressCard: React.FC<DownloadProgressProps> = ({
  item,
  onCancel,
  onRetry,
  onOpenFolder,
}) => {
  const statusColors = {
    queued: 'text-muted-foreground',
    downloading: 'text-primary',
    processing: 'text-yellow-500',
    completed: 'text-green-500',
    error: 'text-destructive',
    cancelled: 'text-muted-foreground',
  };

  const statusLabels = {
    queued: 'Queued',
    downloading: 'Downloading',
    processing: 'Processing...',
    completed: 'Completed',
    error: 'Failed',
    cancelled: 'Cancelled',
  };

  return (
    <div className="bg-card border border-border rounded-xl p-4 animate-slide-in">
      <div className="flex items-start gap-3">
        {/* Thumbnail */}
        {item.thumbnail && (
          <img
            src={item.thumbnail}
            alt=""
            className="w-16 h-12 object-cover rounded-lg flex-shrink-0"
          />
        )}

        <div className="flex-1 min-w-0">
          {/* Title & Platform */}
          <div className="flex items-center gap-2 mb-1">
            <h4 className="text-sm font-medium text-foreground truncate">{item.title}</h4>
            {item.platform && <PlatformBadge platform={item.platform} size="sm" />}
          </div>

          {/* Progress Bar */}
          {(item.status === 'downloading' || item.status === 'processing') && (
            <div className="mt-2">
              <div className="w-full bg-secondary rounded-full h-2 overflow-hidden">
                <div
                  className={cn(
                    'h-full rounded-full transition-all duration-300',
                    item.status === 'processing'
                      ? 'bg-yellow-500 animate-pulse-download'
                      : 'bg-primary'
                  )}
                  style={{ width: `${Math.min(item.progress, 100)}%` }}
                />
              </div>
              <div className="flex items-center justify-between mt-1.5 text-xs text-muted-foreground">
                <span>{item.progress.toFixed(1)}%</span>
                <div className="flex items-center gap-3">
                  {item.speed && <span>{item.speed}</span>}
                  {item.eta && item.eta !== '0:00' && <span>ETA: {item.eta}</span>}
                  {item.filesize && <span>{item.filesize}</span>}
                </div>
              </div>
            </div>
          )}

          {/* Status */}
          <div className={cn('flex items-center gap-1.5 mt-1 text-xs', statusColors[item.status])}>
            {item.status === 'downloading' && <Loader2 size={12} className="animate-spin" />}
            {item.status === 'processing' && <Loader2 size={12} className="animate-spin" />}
            {item.status === 'completed' && <Check size={12} />}
            {item.status === 'error' && <AlertCircle size={12} />}
            {statusLabels[item.status]}
            {item.error && <span className="text-destructive ml-1">- {item.error}</span>}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {item.status === 'completed' && onOpenFolder && (
            <button
              onClick={() => onOpenFolder(item.outputPath)}
              className="p-1.5 text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-secondary"
              title="Open folder"
            >
              <FolderOpen size={16} />
            </button>
          )}
          {item.status === 'error' && onRetry && (
            <button
              onClick={() => onRetry(item.url)}
              className="p-1.5 text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-secondary"
              title="Retry"
            >
              <RotateCcw size={16} />
            </button>
          )}
          {(item.status === 'downloading' || item.status === 'queued') && (
            <button
              onClick={() => onCancel(item.id)}
              className="p-1.5 text-muted-foreground hover:text-destructive transition-colors rounded-lg hover:bg-secondary"
              title="Cancel"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
