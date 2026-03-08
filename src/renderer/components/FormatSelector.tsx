import React, { useMemo, useState } from 'react';
import { Video, Music, Download, FolderOpen, ChevronDown, Subtitles, Image } from 'lucide-react';
import { useDownloadStore } from '../store/downloadStore';
import { useSettingsStore } from '../store/settingsStore';
import { formatFileSize, cn } from '../lib/utils';

export const FormatSelector: React.FC = () => {
  const {
    videoInfo,
    audioOnly,
    setAudioOnly,
    selectedFormat,
    setSelectedFormat,
    audioFormat,
    setAudioFormat,
    embedSubs,
    setEmbedSubs,
    embedThumbnail,
    setEmbedThumbnail,
    startDownload,
    isLoading,
  } = useDownloadStore();

  const { downloadPath, setDownloadPath } = useSettingsStore();
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Get unique quality options from formats
  const videoQualities = useMemo(() => {
    if (!videoInfo) return [];
    const qualities = new Map<string, { formatId: string; quality: string; filesize: number | null; ext: string; fps: number | null }>();

    videoInfo.formats
      .filter((f) => f.hasVideo)
      .sort((a, b) => {
        const heightA = parseInt(a.resolution.split('x')[1] || '0');
        const heightB = parseInt(b.resolution.split('x')[1] || '0');
        return heightB - heightA;
      })
      .forEach((f) => {
        const key = f.quality || f.resolution;
        if (!qualities.has(key) && key !== 'audio') {
          qualities.set(key, {
            formatId: f.formatId,
            quality: f.quality,
            filesize: f.filesize,
            ext: f.ext,
            fps: f.fps,
          });
        }
      });

    return Array.from(qualities.values());
  }, [videoInfo]);

  const audioQualities = useMemo(() => {
    if (!videoInfo) return [];
    return videoInfo.formats
      .filter((f) => f.hasAudio && !f.hasVideo)
      .sort((a, b) => (b.tbr || 0) - (a.tbr || 0))
      .slice(0, 5);
  }, [videoInfo]);

  const hasSubtitles = videoInfo && Object.keys(videoInfo.subtitles).length > 0;

  const handleDownload = async () => {
    if (!downloadPath) {
      const result = await window.electronAPI?.selectFolder();
      if (result?.success && result.path) {
        setDownloadPath(result.path);
        startDownload(result.path);
      }
    } else {
      startDownload(downloadPath);
    }
  };

  const handleSelectFolder = async () => {
    const result = await window.electronAPI?.selectFolder();
    if (result?.success && result.path) {
      setDownloadPath(result.path);
    }
  };

  if (!videoInfo) return null;

  return (
    <div className="w-full max-w-3xl mx-auto mt-4 animate-slide-in">
      <div className="bg-card border border-border rounded-2xl p-5">
        {/* Video/Audio Toggle */}
        <div className="flex items-center gap-2 mb-5">
          <button
            onClick={() => setAudioOnly(false)}
            className={cn(
              'flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-all text-sm',
              !audioOnly
                ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/25'
                : 'bg-secondary text-muted-foreground hover:text-foreground'
            )}
          >
            <Video size={16} />
            Video
          </button>
          <button
            onClick={() => setAudioOnly(true)}
            className={cn(
              'flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-all text-sm',
              audioOnly
                ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/25'
                : 'bg-secondary text-muted-foreground hover:text-foreground'
            )}
          >
            <Music size={16} />
            Audio Only
          </button>
        </div>

        {/* Quality Selection */}
        {!audioOnly ? (
          <div className="mb-5">
            <label className="block text-sm font-medium text-muted-foreground mb-2">Video Quality</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <button
                onClick={() => setSelectedFormat('best')}
                className={cn(
                  'px-3 py-2.5 rounded-xl text-sm font-medium transition-all border',
                  selectedFormat === 'best'
                    ? 'bg-primary/10 border-primary text-primary'
                    : 'bg-secondary/50 border-border text-muted-foreground hover:text-foreground hover:border-primary/50'
                )}
              >
                Best Quality
              </button>
              {videoQualities.map((q) => (
                <button
                  key={q.formatId}
                  onClick={() => setSelectedFormat(q.formatId)}
                  className={cn(
                    'px-3 py-2.5 rounded-xl text-sm font-medium transition-all border',
                    selectedFormat === q.formatId
                      ? 'bg-primary/10 border-primary text-primary'
                      : 'bg-secondary/50 border-border text-muted-foreground hover:text-foreground hover:border-primary/50'
                  )}
                >
                  <div>{q.quality}</div>
                  {q.filesize && (
                    <div className="text-xs opacity-70 mt-0.5">{formatFileSize(q.filesize)}</div>
                  )}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="mb-5">
            <label className="block text-sm font-medium text-muted-foreground mb-2">Audio Format</label>
            <div className="flex flex-wrap gap-2">
              {['mp3', 'm4a', 'opus', 'flac', 'wav'].map((fmt) => (
                <button
                  key={fmt}
                  onClick={() => setAudioFormat(fmt)}
                  className={cn(
                    'px-4 py-2.5 rounded-xl text-sm font-medium transition-all border uppercase',
                    audioFormat === fmt
                      ? 'bg-primary/10 border-primary text-primary'
                      : 'bg-secondary/50 border-border text-muted-foreground hover:text-foreground hover:border-primary/50'
                  )}
                >
                  {fmt}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Advanced Options */}
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
        >
          <ChevronDown
            size={16}
            className={cn('transition-transform', showAdvanced && 'rotate-180')}
          />
          Advanced Options
        </button>

        {showAdvanced && (
          <div className="mb-5 space-y-3 pl-2 animate-slide-in">
            {hasSubtitles && (
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={embedSubs}
                  onChange={(e) => setEmbedSubs(e.target.checked)}
                  className="w-4 h-4 rounded border-border accent-primary"
                />
                <Subtitles size={16} className="text-muted-foreground" />
                <span className="text-sm text-foreground">Embed subtitles</span>
              </label>
            )}
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={embedThumbnail}
                onChange={(e) => setEmbedThumbnail(e.target.checked)}
                className="w-4 h-4 rounded border-border accent-primary"
              />
              <Image size={16} className="text-muted-foreground" />
              <span className="text-sm text-foreground">Embed thumbnail</span>
            </label>
          </div>
        )}

        {/* Download Path & Button */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleSelectFolder}
            className="flex items-center gap-2 px-4 py-3 bg-secondary/50 border border-border rounded-xl text-sm text-muted-foreground hover:text-foreground hover:border-primary/50 transition-all flex-shrink-0"
          >
            <FolderOpen size={16} />
            {downloadPath ? (
              <span className="max-w-[200px] truncate">{downloadPath.split('/').pop() || downloadPath.split('\\').pop()}</span>
            ) : (
              'Select Folder'
            )}
          </button>

          <button
            onClick={handleDownload}
            disabled={isLoading}
            className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-xl font-semibold hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-primary/25 hover:shadow-primary/40"
          >
            <Download size={18} />
            Download {audioOnly ? 'Audio' : 'Video'}
          </button>
        </div>
      </div>
    </div>
  );
};
