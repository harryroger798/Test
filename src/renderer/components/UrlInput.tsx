import React, { useState, useCallback } from 'react';
import { Link2, Clipboard, X, Loader2 } from 'lucide-react';
import { isValidUrl, detectPlatformFromUrl } from '../lib/utils';
import { PlatformBadge } from './PlatformBadge';
import { useDownloadStore } from '../store/downloadStore';

export const UrlInput: React.FC = () => {
  const { url, setUrl, fetchVideoInfo, isLoading, error, setError, reset } = useDownloadStore();
  const [detectedPlatform, setDetectedPlatform] = useState<string | null>(null);

  const handleUrlChange = useCallback(
    (value: string) => {
      setUrl(value);
      setError(null);
      if (value && isValidUrl(value)) {
        setDetectedPlatform(detectPlatformFromUrl(value));
      } else {
        setDetectedPlatform(null);
      }
    },
    [setUrl, setError]
  );

  const handlePaste = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text && isValidUrl(text)) {
        handleUrlChange(text);
        fetchVideoInfo(text);
      }
    } catch {
      // Clipboard access denied
    }
  }, [handleUrlChange, fetchVideoInfo]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!url) return;
      if (!isValidUrl(url)) {
        setError('Please enter a valid URL');
        return;
      }
      fetchVideoInfo(url);
    },
    [url, fetchVideoInfo, setError]
  );

  const handleClear = useCallback(() => {
    reset();
    setDetectedPlatform(null);
  }, [reset]);

  return (
    <div className="w-full max-w-3xl mx-auto animate-slide-in">
      <form onSubmit={handleSubmit} className="relative">
        <div className="relative flex items-center url-input-glow rounded-2xl">
          {/* Link icon */}
          <div className="absolute left-4 text-muted-foreground">
            <Link2 size={20} />
          </div>

          <input
            type="text"
            value={url}
            onChange={(e) => handleUrlChange(e.target.value)}
            placeholder="Paste a video URL here..."
            className="w-full pl-12 pr-40 py-4 bg-secondary/50 border border-border rounded-2xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 transition-all duration-200 text-base"
            disabled={isLoading}
          />

          <div className="absolute right-2 flex items-center gap-1.5">
            {url && (
              <button
                type="button"
                onClick={handleClear}
                className="p-2 text-muted-foreground hover:text-foreground transition-all duration-200 rounded-lg hover:bg-secondary press-effect"
              >
                <X size={18} />
              </button>
            )}
            <button
              type="button"
              onClick={handlePaste}
              className="p-2 text-muted-foreground hover:text-primary transition-all duration-200 rounded-lg hover:bg-primary/10 press-effect"
              title="Paste from clipboard"
            >
              <Clipboard size={18} />
            </button>
            <button
              type="submit"
              disabled={isLoading || !url}
              className="px-5 py-2 bg-primary text-primary-foreground rounded-xl font-semibold hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center gap-2 hover-glow"
            >
              {isLoading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Grabbing...
                </>
              ) : (
                'Grab'
              )}
            </button>
          </div>
        </div>
      </form>

      {/* Platform detection badge */}
      {detectedPlatform && detectedPlatform !== 'unknown' && (
        <div className="mt-3 flex items-center gap-2 animate-scale-in">
          <span className="text-sm text-muted-foreground">Detected:</span>
          <PlatformBadge platform={detectedPlatform} size="sm" />
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="mt-3 p-3 bg-destructive/10 border border-destructive/20 rounded-xl text-destructive text-sm animate-slide-in">
          {error}
        </div>
      )}
    </div>
  );
};
