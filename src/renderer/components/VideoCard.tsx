import React from 'react';
import { Clock, Eye, ThumbsUp, User, ExternalLink } from 'lucide-react';
import { PlatformBadge } from './PlatformBadge';
import { formatViews } from '../lib/utils';
import type { VideoInfo } from '../store/downloadStore';

interface VideoCardProps {
  info: VideoInfo;
}

export const VideoCard: React.FC<VideoCardProps> = ({ info }) => {
  const handleOpenOriginal = () => {
    if (window.electronAPI) {
      window.electronAPI.openExternal(info.webpage_url);
    } else {
      window.open(info.webpage_url, '_blank');
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto mt-6 animate-slide-in">
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="flex flex-col sm:flex-row">
          {/* Thumbnail */}
          <div className="relative sm:w-72 flex-shrink-0">
            <img
              src={info.thumbnail}
              alt={info.title}
              className="w-full h-48 sm:h-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200" fill="%23334155"><rect width="300" height="200"/><text x="150" y="100" text-anchor="middle" fill="%2394a3b8" font-size="14">No Thumbnail</text></svg>';
              }}
            />
            {/* Duration overlay */}
            {info.durationString && (
              <div className="absolute bottom-2 right-2 bg-black/80 text-white text-xs px-2 py-1 rounded-md font-mono">
                {info.durationString}
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 p-4">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-semibold text-foreground text-base line-clamp-2 leading-snug">
                {info.title}
              </h3>
              <button
                onClick={handleOpenOriginal}
                className="flex-shrink-0 p-1.5 text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-secondary"
                title="Open original"
              >
                <ExternalLink size={16} />
              </button>
            </div>

            <div className="mt-2 flex items-center gap-2">
              <PlatformBadge platform={info.platform} size="sm" />
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              {info.uploader && (
                <span className="flex items-center gap-1.5">
                  <User size={14} />
                  {info.uploader}
                </span>
              )}
              {info.duration > 0 && (
                <span className="flex items-center gap-1.5">
                  <Clock size={14} />
                  {info.durationString}
                </span>
              )}
              {info.viewCount > 0 && (
                <span className="flex items-center gap-1.5">
                  <Eye size={14} />
                  {formatViews(info.viewCount)}
                </span>
              )}
              {info.likeCount > 0 && (
                <span className="flex items-center gap-1.5">
                  <ThumbsUp size={14} />
                  {info.likeCount.toLocaleString()}
                </span>
              )}
            </div>

            {/* Available formats summary */}
            <div className="mt-3 text-xs text-muted-foreground">
              {info.formats.filter((f) => f.hasVideo).length} video formats,{' '}
              {info.formats.filter((f) => f.hasAudio && !f.hasVideo).length} audio formats available
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
