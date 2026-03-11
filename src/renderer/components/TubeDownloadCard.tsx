import React from 'react';
import { X, Check, AlertCircle, Loader2, FolderOpen, RotateCcw, Download, Pause } from 'lucide-react';
import { PlatformBadge } from './PlatformBadge';
import { cn } from '../lib/utils';
import type { DownloadItem } from '../store/downloadStore';

interface TubeDownloadCardProps {
  item: DownloadItem;
  index: number;
  onCancel: (id: string) => void;
  onRetry?: (url: string) => void;
  onOpenFolder?: (path: string) => void;
}

export const TubeDownloadCard: React.FC<TubeDownloadCardProps> = ({
  item,
  index,
  onCancel,
  onRetry,
  onOpenFolder,
}) => {
  const isActive = item.status === 'downloading' || item.status === 'processing';
  const isCompleted = item.status === 'completed';
  const isError = item.status === 'error';
  const isQueued = item.status === 'queued';

  return (
    <div
      className={cn(
        'bg-card border border-border rounded-xl p-4 hover-lift transition-all duration-300',
        `animate-slide-in stagger-${Math.min(index + 1, 5)}`,
        isActive && 'border-primary/30',
        isCompleted && 'border-green-500/20',
        isError && 'border-destructive/20'
      )}
    >
      <div className="flex items-start gap-3">
        {/* Thumbnail with status overlay */}
        <div className="relative flex-shrink-0">
          {item.thumbnail ? (
            <img
              src={item.thumbnail}
              alt=""
              className="w-20 h-14 object-cover rounded-lg"
            />
          ) : (
            <div className="w-20 h-14 bg-secondary rounded-lg flex items-center justify-center">
              <Download size={16} className="text-muted-foreground" />
            </div>
          )}
          {/* Status overlay icon */}
          {isActive && (
            <div className="absolute inset-0 bg-black/40 rounded-lg flex items-center justify-center">
              <Loader2 size={18} className="text-white animate-spin" />
            </div>
          )}
          {isCompleted && (
            <div className="absolute inset-0 bg-green-500/30 rounded-lg flex items-center justify-center">
              <Check size={18} className="text-white" />
            </div>
          )}
          {isError && (
            <div className="absolute inset-0 bg-destructive/30 rounded-lg flex items-center justify-center">
              <AlertCircle size={18} className="text-white" />
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Title row */}
          <div className="flex items-center gap-2 mb-1">
            <h4 className="text-sm font-medium text-foreground truncate">{item.title}</h4>
            {item.platform && <PlatformBadge platform={item.platform} size="sm" />}
          </div>

          {/* Progress bar for active downloads */}
          {isActive && (
            <div className="mt-2">
              <div className="w-full bg-secondary rounded-full h-2 overflow-hidden progress-bar-container">
                <div
                  className={cn(
                    'h-full rounded-full transition-all duration-500 ease-out',
                    item.status === 'processing'
                      ? 'bg-yellow-500 animate-pulse-download'
                      : 'bg-primary animate-progress-shimmer'
                  )}
                  style={{ width: `${Math.min(item.progress, 100)}%` }}
                />
              </div>
              <div className="flex items-center justify-between mt-1.5 text-xs text-muted-foreground">
                <span className="font-mono text-primary font-medium">{item.progress.toFixed(1)}%</span>
                <div className="flex items-center gap-3">
                  {item.speed && <span>{item.speed}</span>}
                  {item.eta && item.eta !== '0:00' && <span>ETA: {item.eta}</span>}
                  {item.filesize && <span>{item.filesize}</span>}
                </div>
              </div>
            </div>
          )}

          {/* Status labels */}
          <div className={cn(
            'flex items-center gap-1.5 mt-1.5 text-xs font-medium',
            isQueued && 'text-muted-foreground',
            isActive && 'text-primary',
            isCompleted && 'text-green-500',
            isError && 'text-destructive',
            item.status === 'cancelled' && 'text-muted-foreground'
          )}>
            {isQueued && <Pause size={12} />}
            {isActive && item.status === 'downloading' && <Download size={12} />}
            {isActive && item.status === 'processing' && <Loader2 size={12} className="animate-spin" />}
            {isCompleted && <Check size={12} />}
            {isError && <AlertCircle size={12} />}
            {isQueued && 'Waiting in queue'}
            {item.status === 'downloading' && 'Downloading...'}
            {item.status === 'processing' && 'Processing...'}
            {isCompleted && 'Download Complete'}
            {isError && (item.error ? `Failed: ${item.error}` : 'Download Failed')}
            {item.status === 'cancelled' && 'Cancelled'}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {isCompleted && onOpenFolder && (
            <button
              onClick={() => onOpenFolder(item.outputPath)}
              className="p-2 text-muted-foreground hover:text-primary transition-all duration-200 rounded-lg hover:bg-primary/10 press-effect"
              title="Open folder"
            >
              <FolderOpen size={16} />
            </button>
          )}
          {isError && onRetry && (
            <button
              onClick={() => onRetry(item.url)}
              className="p-2 text-muted-foreground hover:text-primary transition-all duration-200 rounded-lg hover:bg-primary/10 press-effect"
              title="Retry download"
            >
              <RotateCcw size={16} />
            </button>
          )}
          {(isActive || isQueued) && (
            <button
              onClick={() => onCancel(item.id)}
              className="p-2 text-muted-foreground hover:text-destructive transition-all duration-200 rounded-lg hover:bg-destructive/10 press-effect"
              title="Cancel download"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
