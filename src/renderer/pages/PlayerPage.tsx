import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Play, Pause, SkipBack, SkipForward, Volume2, VolumeX,
  Maximize, Minimize, PictureInPicture, Subtitles,
  RotateCcw, RotateCw, List, FileText, ChevronDown
} from 'lucide-react';
import { cn } from '../lib/utils';
import { api } from '../lib/ipc';

interface SubtitleTrack {
  label: string;
  src: string;
  language: string;
}

interface PlaylistItem {
  path: string;
  name: string;
  type: 'video' | 'audio';
}

export const PlayerPage: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);

  const [mediaSource, setMediaSource] = useState<string>('');
  const [mediaType, setMediaType] = useState<'video' | 'audio' | ''>('');
  const [mediaName, setMediaName] = useState<string>('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [subtitleTracks, setSubtitleTracks] = useState<SubtitleTrack[]>([]);
  const [activeSubtitle, setActiveSubtitle] = useState<number>(-1);
  const [showSubtitleMenu, setShowSubtitleMenu] = useState(false);
  const [playlist, setPlaylist] = useState<PlaylistItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [showPlaylist, setShowPlaylist] = useState(false);
  const [resumePosition, setResumePosition] = useState<number>(0);
  const controlsTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const speeds = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 3, 4];

  // IMPORTANT: Read refs lazily via a getter function, NOT at render time.
  // At render time, refs from newly-mounted elements are still null (assigned after DOM commit).
  // If we read videoRef.current during render, event handlers capture a stale null reference
  // and togglePlay / handleTimeUpdate / handleLoadedMetadata all silently no-op.
  const getActiveMedia = useCallback(
    () => (mediaType === 'audio' ? audioRef.current : videoRef.current),
    [mediaType]
  );

  // Load saved playback position
  useEffect(() => {
    if (mediaSource) {
      api.getPlaybackPosition(mediaSource).then((pos) => {
        if (pos > 0) setResumePosition(pos);
      }).catch(() => {});
    }
  }, [mediaSource]);

  // Save playback position periodically
  useEffect(() => {
    if (!mediaSource) return;
    const interval = setInterval(() => {
      const media = getActiveMedia();
      if (media && media.currentTime > 0 && !media.paused) {
        api.savePlaybackPosition(mediaSource, media.currentTime).catch(() => {});
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [mediaSource, getActiveMedia]);

  // Auto-hide controls
  const resetControlsTimer = useCallback(() => {
    setShowControls(true);
    if (controlsTimeout.current) clearTimeout(controlsTimeout.current);
    if (isPlaying && mediaType === 'video') {
      controlsTimeout.current = setTimeout(() => setShowControls(false), 3000);
    }
  }, [isPlaying, mediaType]);

  useEffect(() => {
    resetControlsTimer();
    return () => {
      if (controlsTimeout.current) clearTimeout(controlsTimeout.current);
    };
  }, [isPlaying, resetControlsTimer]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const media = getActiveMedia();
      if (!media) return;
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      switch (e.key) {
        case ' ':
        case 'k':
          e.preventDefault();
          togglePlay();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          seek(media.currentTime - 10);
          break;
        case 'ArrowRight':
          e.preventDefault();
          seek(media.currentTime + 10);
          break;
        case 'ArrowUp':
          e.preventDefault();
          changeVolume(Math.min(1, volume + 0.1));
          break;
        case 'ArrowDown':
          e.preventDefault();
          changeVolume(Math.max(0, volume - 0.1));
          break;
        case 'm':
          toggleMute();
          break;
        case 'f':
          toggleFullscreen();
          break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  // Fullscreen change listener
  useEffect(() => {
    const handleFSChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFSChange);
    return () => document.removeEventListener('fullscreenchange', handleFSChange);
  }, []);

  const openFile = async () => {
    const result = await api.selectMediaFile();
    if (result.success && result.path) {
      loadMedia(result.path, result.name || 'Unknown', result.type || 'video');
    }
  };

  // Convert a local file path to a properly encoded grabtube-media:// URL
  // Handles special chars like #, ?, &, spaces that break URLs
  const toMediaUrl = (fp: string): string => {
    const normalized = fp.replace(/\\/g, '/');
    const encoded = normalized.split('/').map(s => encodeURIComponent(s)).join('/');
    return `grabtube-media:///${encoded}`;
  };

  const loadMedia = async (filePath: string, name: string, type: 'video' | 'audio') => {
    setMediaSource(toMediaUrl(filePath));
    setMediaName(name);
    setMediaType(type);
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setSubtitleTracks([]);
    setActiveSubtitle(-1);

    // Detect subtitle files
    const subs = await api.detectSubtitles(filePath);
    if (subs && subs.length > 0) {
      setSubtitleTracks(subs.map((s: { path: string; label: string; lang: string }) => ({
        label: s.label,
        src: toMediaUrl(s.path),
        language: s.lang,
      })));
    }

    // Extract embedded subtitles
    const embedded = await api.extractEmbeddedSubtitles(filePath);
    if (embedded && embedded.length > 0) {
      setSubtitleTracks((prev) => [
        ...prev,
        ...embedded.map((s: { path: string; label: string; lang: string }) => ({
          label: `[Embedded] ${s.label}`,
          src: toMediaUrl(s.path),
          language: s.lang,
        })),
      ]);
    }

    // Load saved position
    const pos = await api.getPlaybackPosition(filePath).catch(() => 0);
    if (pos > 0) setResumePosition(pos);
  };

  const loadFromPlaylist = (index: number) => {
    if (index >= 0 && index < playlist.length) {
      setCurrentIndex(index);
      loadMedia(playlist[index].path, playlist[index].name, playlist[index].type);
    }
  };

  const togglePlay = () => {
    const media = getActiveMedia();
    if (!media) return;
    if (media.paused) {
      media.play().catch(() => {});
      setIsPlaying(true);
    } else {
      media.pause();
      setIsPlaying(false);
    }
  };

  const seek = (time: number) => {
    const media = getActiveMedia();
    if (!media) return;
    media.currentTime = Math.max(0, Math.min(time, duration));
  };

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressRef.current || !getActiveMedia()) return;
    const rect = progressRef.current.getBoundingClientRect();
    const pos = (e.clientX - rect.left) / rect.width;
    seek(pos * duration);
  };

  const changeVolume = (val: number) => {
    setVolume(val);
    setIsMuted(val === 0);
    const media = getActiveMedia();
    if (media) {
      media.volume = val;
      media.muted = val === 0;
    }
  };

  const toggleMute = () => {
    const media = getActiveMedia();
    if (!media) return;
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    media.muted = newMuted;
  };

  const changeSpeed = (rate: number) => {
    setPlaybackRate(rate);
    const media = getActiveMedia();
    if (media) media.playbackRate = rate;
    setShowSpeedMenu(false);
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      containerRef.current.requestFullscreen();
    }
  };

  const togglePiP = async () => {
    if (!videoRef.current) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else {
        await videoRef.current.requestPictureInPicture();
      }
    } catch {
      // PiP not supported
    }
  };

  const handleTimeUpdate = () => {
    const media = getActiveMedia();
    if (media) {
      setCurrentTime(media.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    const media = getActiveMedia();
    if (media) {
      setDuration(media.duration);
      if (resumePosition > 0 && resumePosition < media.duration - 5) {
        media.currentTime = resumePosition;
        setResumePosition(0);
      }
    }
  };

  const handleEnded = () => {
    setIsPlaying(false);
    // Auto-play next in playlist
    if (currentIndex >= 0 && currentIndex < playlist.length - 1) {
      loadFromPlaylist(currentIndex + 1);
    }
  };

  const formatTime = (seconds: number): string => {
    if (!isFinite(seconds) || seconds < 0) return '0:00';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // Load playlist from download history
  useEffect(() => {
    api.getPlayerPlaylist().then((items) => {
      if (items && items.length > 0) {
        setPlaylist(items);
      }
    }).catch(() => {});
  }, []);

  // No media loaded — empty state
  if (!mediaSource) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 animate-fade-in">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
            <Play size={36} className="text-primary ml-1" />
          </div>
          <h2 className="text-2xl font-bold text-foreground mb-3">Media Player</h2>
          <p className="text-muted-foreground mb-6">
            Play your downloaded videos and audio files with subtitle support, playback speed control, and more.
          </p>
          <button
            onClick={openFile}
            className="px-6 py-3 bg-primary text-primary-foreground rounded-xl font-medium hover:bg-primary/90 transition-all press-effect"
          >
            Open File
          </button>

          {playlist.length > 0 && (
            <div className="mt-8 w-full">
              <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                <List size={16} />
                Recent Downloads
              </h3>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {playlist.slice(0, 10).map((item, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setCurrentIndex(i);
                      loadMedia(item.path, item.name, item.type);
                    }}
                    className="w-full text-left px-4 py-2.5 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors flex items-center gap-3"
                  >
                    {item.type === 'video' ? (
                      <Play size={14} className="text-primary flex-shrink-0" />
                    ) : (
                      <Volume2 size={14} className="text-primary flex-shrink-0" />
                    )}
                    <span className="text-sm text-foreground truncate">{item.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-4 text-center text-xs text-muted-foreground">
          <div className="p-3 rounded-lg bg-secondary/20">
            <Subtitles size={16} className="mx-auto mb-1 text-primary" />
            SRT/VTT/ASS
          </div>
          <div className="p-3 rounded-lg bg-secondary/20">
            <RotateCw size={16} className="mx-auto mb-1 text-primary" />
            0.25x — 4x Speed
          </div>
          <div className="p-3 rounded-lg bg-secondary/20">
            <PictureInPicture size={16} className="mx-auto mb-1 text-primary" />
            Picture-in-Picture
          </div>
          <div className="p-3 rounded-lg bg-secondary/20">
            <List size={16} className="mx-auto mb-1 text-primary" />
            Playlist Support
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={cn(
        'flex-1 flex flex-col bg-black relative select-none',
        isFullscreen && 'fixed inset-0 z-50'
      )}
      onMouseMove={resetControlsTimer}
      onClick={(e) => {
        // Close menus on click
        if (showSpeedMenu) setShowSpeedMenu(false);
        if (showSubtitleMenu) setShowSubtitleMenu(false);
        if (showPlaylist && !(e.target as HTMLElement).closest('.playlist-panel')) setShowPlaylist(false);
      }}
    >
      {/* Media Element */}
      <div className="flex-1 flex items-center justify-center overflow-hidden relative">
        {mediaType === 'video' ? (
          <video
            ref={videoRef}
            src={mediaSource}
            className="max-w-full max-h-full"
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleLoadedMetadata}
            onEnded={handleEnded}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onClick={togglePlay}
            onDoubleClick={toggleFullscreen}
          >
            {subtitleTracks.map((track, i) => (
              <track
                key={i}
                kind="subtitles"
                label={track.label}
                srcLang={track.language}
                src={track.src}
                default={i === activeSubtitle}
              />
            ))}
          </video>
        ) : (
          <div className="flex flex-col items-center gap-6">
            <div className="w-40 h-40 rounded-full bg-primary/10 flex items-center justify-center animate-pulse-slow">
              <Volume2 size={64} className="text-primary" />
            </div>
            <p className="text-white text-lg font-medium text-center px-4">{mediaName}</p>
            <audio
              ref={audioRef}
              src={mediaSource}
              onTimeUpdate={handleTimeUpdate}
              onLoadedMetadata={handleLoadedMetadata}
              onEnded={handleEnded}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
            />
          </div>
        )}

        {/* Center play button overlay for video */}
        {mediaType === 'video' && !isPlaying && showControls && (
          <button
            onClick={togglePlay}
            className="absolute inset-0 flex items-center justify-center bg-black/20 transition-opacity"
          >
            <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <Play size={32} className="text-white ml-1" />
            </div>
          </button>
        )}
      </div>

      {/* Controls Bar */}
      <div
        className={cn(
          'transition-opacity duration-300 bg-gradient-to-t from-black/90 via-black/50 to-transparent px-4 pb-4 pt-8',
          showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
        )}
      >
        {/* Title */}
        <div className="flex items-center justify-between mb-2">
          <p className="text-white text-sm font-medium truncate max-w-[60%]">{mediaName}</p>
          <div className="flex items-center gap-2">
            <button
              onClick={openFile}
              className="text-white/60 hover:text-white text-xs px-2 py-1 rounded hover:bg-white/10 transition-colors"
            >
              Open File
            </button>
          </div>
        </div>

        {/* Progress Bar */}
        <div
          ref={progressRef}
          className="w-full h-1.5 bg-white/20 rounded-full cursor-pointer mb-3 group hover:h-2.5 transition-all"
          onClick={handleProgressClick}
        >
          <div
            className="h-full bg-primary rounded-full relative transition-all"
            style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
          >
            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-primary rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </div>

        {/* Control Buttons */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {/* Play/Pause */}
            <button onClick={togglePlay} className="text-white hover:text-primary transition-colors p-1.5">
              {isPlaying ? <Pause size={22} /> : <Play size={22} className="ml-0.5" />}
            </button>

            {/* Skip backward/forward */}
            <button onClick={() => seek(currentTime - 10)} className="text-white/70 hover:text-white transition-colors p-1.5" title="Back 10s">
              <SkipBack size={18} />
            </button>
            <button onClick={() => seek(currentTime + 10)} className="text-white/70 hover:text-white transition-colors p-1.5" title="Forward 10s">
              <SkipForward size={18} />
            </button>

            {/* Time */}
            <span className="text-white/70 text-xs ml-2 tabular-nums">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>

          <div className="flex items-center gap-1">
            {/* Volume */}
            <button onClick={toggleMute} className="text-white/70 hover:text-white transition-colors p-1.5">
              {isMuted || volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={isMuted ? 0 : volume}
              onChange={(e) => changeVolume(parseFloat(e.target.value))}
              className="w-20 h-1 accent-primary cursor-pointer"
            />

            {/* Speed */}
            <div className="relative">
              <button
                onClick={(e) => { e.stopPropagation(); setShowSpeedMenu(!showSpeedMenu); }}
                className="text-white/70 hover:text-white transition-colors px-2 py-1 text-xs rounded hover:bg-white/10 flex items-center gap-1"
              >
                {playbackRate}x <ChevronDown size={12} />
              </button>
              {showSpeedMenu && (
                <div className="absolute bottom-full right-0 mb-2 bg-card border border-border rounded-lg shadow-xl py-1 min-w-[80px] z-50" onClick={(e) => e.stopPropagation()}>
                  {speeds.map((s) => (
                    <button
                      key={s}
                      onClick={() => changeSpeed(s)}
                      className={cn(
                        'w-full text-left px-3 py-1.5 text-xs hover:bg-secondary/50 transition-colors',
                        s === playbackRate ? 'text-primary font-medium' : 'text-foreground'
                      )}
                    >
                      {s}x
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Subtitles */}
            {subtitleTracks.length > 0 && (
              <div className="relative">
                <button
                  onClick={(e) => { e.stopPropagation(); setShowSubtitleMenu(!showSubtitleMenu); }}
                  className={cn(
                    'transition-colors p-1.5',
                    activeSubtitle >= 0 ? 'text-primary' : 'text-white/70 hover:text-white'
                  )}
                >
                  <Subtitles size={18} />
                </button>
                {showSubtitleMenu && (
                  <div className="absolute bottom-full right-0 mb-2 bg-card border border-border rounded-lg shadow-xl py-1 min-w-[140px] z-50" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => { setActiveSubtitle(-1); setShowSubtitleMenu(false); }}
                      className={cn(
                        'w-full text-left px-3 py-1.5 text-xs hover:bg-secondary/50 transition-colors',
                        activeSubtitle === -1 ? 'text-primary font-medium' : 'text-foreground'
                      )}
                    >
                      Off
                    </button>
                    {subtitleTracks.map((track, i) => (
                      <button
                        key={i}
                        onClick={() => { setActiveSubtitle(i); setShowSubtitleMenu(false); }}
                        className={cn(
                          'w-full text-left px-3 py-1.5 text-xs hover:bg-secondary/50 transition-colors',
                          i === activeSubtitle ? 'text-primary font-medium' : 'text-foreground'
                        )}
                      >
                        {track.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Playlist */}
            {playlist.length > 0 && (
              <button
                onClick={(e) => { e.stopPropagation(); setShowPlaylist(!showPlaylist); }}
                className="text-white/70 hover:text-white transition-colors p-1.5"
              >
                <List size={18} />
              </button>
            )}

            {/* PiP (video only) */}
            {mediaType === 'video' && (
              <button onClick={togglePiP} className="text-white/70 hover:text-white transition-colors p-1.5" title="Picture-in-Picture">
                <PictureInPicture size={18} />
              </button>
            )}

            {/* Fullscreen */}
            <button onClick={toggleFullscreen} className="text-white/70 hover:text-white transition-colors p-1.5">
              {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
            </button>
          </div>
        </div>
      </div>

      {/* Playlist Panel */}
      {showPlaylist && (
        <div className="playlist-panel absolute right-0 top-0 bottom-0 w-72 bg-card/95 backdrop-blur-sm border-l border-border overflow-y-auto z-40">
          <div className="p-3 border-b border-border flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">Playlist</h3>
            <span className="text-xs text-muted-foreground">{playlist.length} items</span>
          </div>
          <div className="py-1">
            {playlist.map((item, i) => (
              <button
                key={i}
                onClick={() => loadFromPlaylist(i)}
                className={cn(
                  'w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-secondary/50 transition-colors',
                  i === currentIndex && 'bg-primary/10 border-l-2 border-primary'
                )}
              >
                {item.type === 'video' ? <Play size={14} className="text-primary flex-shrink-0" /> : <Volume2 size={14} className="text-primary flex-shrink-0" />}
                <span className="text-xs text-foreground truncate">{item.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
