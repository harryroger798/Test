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
    }
    // No fallback to window.open — in Electron context window.open can
    // bypass security restrictions. The electronAPI path is the only safe way.
  };

  return (
    <div className="w-full max-w-3xl mx-auto mt-6 animate-slide-in">
      <div className="bg-card border border-border rounded-2xl overflow-hidden hover-lift transition-all duration-300">
        <div className="flex flex-col sm:flex-row">
          {/* Thumbnail */}
          <div className="relative sm:w-72 flex-shrink-0 group">
            <img
              src={info.thumbnail}
              alt={info.title}
              className="w-full h-48 sm:h-full object-cover transition-transform duration-300 group-hover:scale-105"
              onError={(e) => {
                (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200" fill="%23334155"><rect width="300" height="200"/><text x="150" y="100" text-anchor="middle" fill="%2394a3b8" font-size="14">No Thumbnail</text></svg>';
              }}
            />
            {/* Duration overlay */}
            {info.durationString && (
              <div className="absolute bottom-2 right-2 bg-black/80 text-white text-xs px-2 py-1 rounded-md font-mono backdrop-blur-sm">
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
                className="flex-shrink-0 p-1.5 text-muted-foreground hover:text-primary transition-all duration-200 rounded-lg hover:bg-primary/10 press-effect"
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
                <span className="flex items-center gap-1.5 hover:text-foreground transition-colors">
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
              <span className="text-primary font-medium">{info.formats.filter((f) => f.hasVideo).length}</span> video formats,{' '}
              <span className="text-primary font-medium">{info.formats.filter((f) => f.hasAudio && !f.hasVideo).length}</span> audio formats available
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
