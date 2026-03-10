import React, { useState, useRef, useCallback } from 'react';
import {
  FileVideo, FileAudio, Image, FileText, ArrowRight, FolderOpen,
  X, Loader2, CheckCircle, AlertCircle, Zap, ChevronDown, Info
} from 'lucide-react';
import { cn } from '../lib/utils';
import { api } from '../lib/ipc';

interface ConversionJob {
  id: string;
  inputPath: string;
  inputName: string;
  outputFormat: string;
  status: 'queued' | 'converting' | 'completed' | 'error';
  progress: number;
  error?: string;
  outputPath?: string;
}

interface ConversionPreset {
  id: string;
  label: string;
  description: string;
  outputFormat: string;
  options: Record<string, string | number | boolean>;
}

type MediaCategory = 'video' | 'audio' | 'image' | 'subtitle';

const VIDEO_FORMATS = ['mp4', 'mkv', 'webm', 'avi', 'mov', 'gif', 'mp3', 'flac', 'wav', 'ogg', 'aac'];
const AUDIO_FORMATS = ['mp3', 'flac', 'wav', 'ogg', 'aac', 'm4a', 'wma', 'opus'];
const IMAGE_FORMATS = ['png', 'jpg', 'jpeg', 'webp', 'avif', 'gif', 'bmp', 'tiff', 'ico'];
const SUBTITLE_FORMATS = ['srt', 'vtt', 'ass', 'ssa', 'sbv', 'sub'];

const PRESETS: ConversionPreset[] = [
  { id: 'whatsapp', label: 'WhatsApp', description: 'MP4, 720p, small size', outputFormat: 'mp4', options: { maxHeight: 720, videoBitrate: '1M', audioBitrate: '128k' } },
  { id: 'instagram', label: 'Instagram', description: 'MP4, 1080p, H.264', outputFormat: 'mp4', options: { maxHeight: 1080, videoBitrate: '3.5M', audioBitrate: '128k' } },
  { id: 'youtube', label: 'YouTube', description: 'MP4, best quality', outputFormat: 'mp4', options: { videoBitrate: '8M', audioBitrate: '320k' } },
  { id: 'small', label: 'Small File', description: 'Compressed, 480p', outputFormat: 'mp4', options: { maxHeight: 480, videoBitrate: '500k', audioBitrate: '96k' } },
  { id: 'best', label: 'Best Quality', description: 'Lossless settings', outputFormat: 'mkv', options: { videoBitrate: '20M', audioBitrate: '320k' } },
  { id: 'gif', label: 'GIF', description: 'Animated GIF from video', outputFormat: 'gif', options: { maxHeight: 480, fps: 15 } },
  { id: 'audio-only', label: 'Audio Only', description: 'Extract audio as MP3', outputFormat: 'mp3', options: { audioBitrate: '320k' } },
  { id: 'ringtone', label: 'Ringtone', description: 'M4A, 30s max', outputFormat: 'm4a', options: { audioBitrate: '256k', maxDuration: 30 } },
];

const getCategory = (ext: string): MediaCategory => {
  const lower = ext.toLowerCase();
  if (['mp4', 'mkv', 'webm', 'avi', 'mov', 'flv', 'wmv', 'mpg', 'mpeg', 'm4v', 'ts'].includes(lower)) return 'video';
  if (['mp3', 'flac', 'wav', 'ogg', 'aac', 'm4a', 'wma', 'opus', 'alac'].includes(lower)) return 'audio';
  if (['png', 'jpg', 'jpeg', 'webp', 'avif', 'gif', 'bmp', 'tiff', 'tif', 'ico', 'svg'].includes(lower)) return 'image';
  if (['srt', 'vtt', 'ass', 'ssa', 'sbv', 'sub', 'idx'].includes(lower)) return 'subtitle';
  return 'video';
};

const getCategoryIcon = (cat: MediaCategory) => {
  switch (cat) {
    case 'video': return FileVideo;
    case 'audio': return FileAudio;
    case 'image': return Image;
    case 'subtitle': return FileText;
  }
};

const getOutputFormats = (cat: MediaCategory): string[] => {
  switch (cat) {
    case 'video': return VIDEO_FORMATS;
    case 'audio': return AUDIO_FORMATS;
    case 'image': return IMAGE_FORMATS;
    case 'subtitle': return SUBTITLE_FORMATS;
  }
};

export const ConvertPage: React.FC = () => {
  const dropRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [inputFile, setInputFile] = useState<{ path: string; name: string; ext: string; size: number } | null>(null);
  const [outputFormat, setOutputFormat] = useState('');
  const [outputDir, setOutputDir] = useState('');
  const [selectedPreset, setSelectedPreset] = useState<string>('');
  const [showPresets, setShowPresets] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [customOptions, setCustomOptions] = useState<Record<string, string>>({});
  const [jobs, setJobs] = useState<ConversionJob[]>([]);
  const [tierInfo, setTierInfo] = useState<{ tier: string; remaining: number; maxSize: number } | null>(null);

  // Check tier limits on mount
  React.useEffect(() => {
    api.checkConversionAllowed().then((result) => {
      setTierInfo({
        tier: result.tier || 'free',
        remaining: result.remaining ?? 3,
        maxSize: result.maxSizeMB ?? 500,
      });
    }).catch(() => {});
  }, []);

  // Listen for conversion progress
  React.useEffect(() => {
    const removeProgress = api.onConversionProgress((data: { conversionId: string; progress: number }) => {
      setJobs((prev) =>
        prev.map((j) =>
          j.id === data.conversionId ? { ...j, progress: data.progress, status: 'converting' } : j
        )
      );
    });

    const removeComplete = api.onConversionComplete((data: { conversionId: string; success: boolean; outputPath?: string; error?: string }) => {
      setJobs((prev) =>
        prev.map((j) =>
          j.id === data.conversionId
            ? {
                ...j,
                status: data.success ? 'completed' : 'error',
                progress: data.success ? 100 : j.progress,
                outputPath: data.outputPath,
                error: data.error,
              }
            : j
        )
      );
      // Refresh tier info after conversion
      api.checkConversionAllowed().then((result) => {
        setTierInfo({
          tier: result.tier || 'free',
          remaining: result.remaining ?? 3,
          maxSize: result.maxSizeMB ?? 500,
        });
      }).catch(() => {});
    });

    return () => {
      removeProgress();
      removeComplete();
    };
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      const ext = file.name.split('.').pop() || '';
      setInputFile({ path: (file as File & { path: string }).path, name: file.name, ext, size: file.size });
      const cat = getCategory(ext);
      const formats = getOutputFormats(cat);
      setOutputFormat(formats[0] || 'mp4');
      setSelectedPreset('');
    }
  }, []);

  const selectFile = async () => {
    const result = await api.selectConvertFile();
    if (result.success && result.path) {
      const ext = result.name?.split('.').pop() || '';
      setInputFile({ path: result.path, name: result.name || 'file', ext, size: result.size || 0 });
      const cat = getCategory(ext);
      const formats = getOutputFormats(cat);
      setOutputFormat(formats[0] || 'mp4');
      setSelectedPreset('');
    }
  };

  const selectOutputDir = async () => {
    const result = await api.selectOutputDirectory();
    if (result.success && result.path) {
      setOutputDir(result.path);
    }
  };

  const applyPreset = (preset: ConversionPreset) => {
    setOutputFormat(preset.outputFormat);
    setSelectedPreset(preset.id);
    setShowPresets(false);
    const opts: Record<string, string> = {};
    for (const [k, v] of Object.entries(preset.options)) {
      opts[k] = String(v);
    }
    setCustomOptions(opts);
  };

  const startConversion = async () => {
    if (!inputFile) return;

    // Check tier limits
    const check = await api.checkConversionAllowed();
    if (!check.allowed) {
      setJobs((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          inputPath: inputFile.path,
          inputName: inputFile.name,
          outputFormat,
          status: 'error',
          progress: 0,
          error: check.reason || 'Conversion not allowed',
        },
      ]);
      return;
    }

    // Check file size limit (skip if unlimited: maxSize === -1)
    if (tierInfo && tierInfo.maxSize !== -1 && inputFile.size > tierInfo.maxSize * 1024 * 1024) {
      setJobs((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          inputPath: inputFile.path,
          inputName: inputFile.name,
          outputFormat,
          status: 'error',
          progress: 0,
          error: `File too large (${Math.round(inputFile.size / 1024 / 1024)}MB). Max ${tierInfo.maxSize}MB for ${tierInfo.tier} tier. Upgrade for more.`,
        },
      ]);
      return;
    }

    const result = await api.startConversion({
      inputPath: inputFile.path,
      outputFormat,
      outputDir: outputDir || undefined,
      options: customOptions,
    });

    if (result.success && result.conversionId) {
      setJobs((prev) => [
        ...prev,
        {
          id: result.conversionId!,
          inputPath: inputFile.path,
          inputName: inputFile.name,
          outputFormat,
          status: 'converting',
          progress: 0,
        },
      ]);
    } else {
      setJobs((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          inputPath: inputFile.path,
          inputName: inputFile.name,
          outputFormat,
          status: 'error',
          progress: 0,
          error: result.error || 'Failed to start conversion',
        },
      ]);
    }
  };

  const cancelConversion = async (jobId: string) => {
    await api.cancelConversion(jobId);
    setJobs((prev) =>
      prev.map((j) => (j.id === jobId ? { ...j, status: 'error', error: 'Cancelled' } : j))
    );
  };

  const removeJob = (jobId: string) => {
    setJobs((prev) => prev.filter((j) => j.id !== jobId));
  };

  const openOutputFile = async (filePath: string) => {
    await api.openFileInFolder(filePath);
  };

  const category = inputFile ? getCategory(inputFile.ext) : null;
  const CategoryIcon = category ? getCategoryIcon(category) : FileVideo;
  const availableFormats = category ? getOutputFormats(category) : [];

  return (
    <div className="flex-1 flex flex-col p-6 animate-fade-in overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Convert</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Convert video, audio, images, and subtitles to any format
          </p>
        </div>
        {tierInfo && (
          <div className="flex items-center gap-2 text-xs">
            <span className={cn(
              'px-2.5 py-1 rounded-full font-medium',
              tierInfo.tier === 'free' ? 'bg-secondary text-secondary-foreground' : 'bg-primary/10 text-primary'
            )}>
              {tierInfo.tier.toUpperCase()}
            </span>
            {tierInfo.tier === 'free' && (
              <span className="text-muted-foreground">
                {tierInfo.remaining} conversions left today
              </span>
            )}
          </div>
        )}
      </div>

      {/* Drop Zone */}
      <div
        ref={dropRef}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={!inputFile ? selectFile : undefined}
        className={cn(
          'border-2 border-dashed rounded-2xl p-8 transition-all cursor-pointer mb-6',
          isDragging ? 'border-primary bg-primary/5 scale-[1.02]' : 'border-border hover:border-primary/50 hover:bg-secondary/10',
          inputFile && 'cursor-default'
        )}
      >
        {!inputFile ? (
          <div className="text-center">
            <div className="w-16 h-16 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <FileVideo size={28} className="text-primary" />
            </div>
            <p className="text-foreground font-medium mb-1">Drop a file here or click to browse</p>
            <p className="text-xs text-muted-foreground">
              Supports video, audio, images, and subtitle files
            </p>
          </div>
        ) : (
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
              <CategoryIcon size={24} className="text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-foreground font-medium truncate">{inputFile.name}</p>
              <p className="text-xs text-muted-foreground">
                {category?.toUpperCase()} &middot; {(inputFile.size / 1024 / 1024).toFixed(1)} MB &middot; .{inputFile.ext}
              </p>
            </div>
            <div className="flex items-center gap-3 flex-shrink-0">
              <ArrowRight size={20} className="text-muted-foreground" />
              <select
                value={outputFormat}
                onChange={(e) => { setOutputFormat(e.target.value); setSelectedPreset(''); }}
                className="bg-secondary/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                {availableFormats.map((fmt) => (
                  <option key={fmt} value={fmt}>.{fmt.toUpperCase()}</option>
                ))}
              </select>
              <button
                onClick={(e) => { e.stopPropagation(); setInputFile(null); setSelectedPreset(''); }}
                className="text-muted-foreground hover:text-destructive transition-colors p-1"
              >
                <X size={18} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Options Row */}
      {inputFile && (
        <div className="flex flex-wrap gap-3 mb-6">
          {/* Presets */}
          {category === 'video' && (
            <div className="relative">
              <button
                onClick={() => setShowPresets(!showPresets)}
                className={cn(
                  'px-4 py-2 rounded-xl text-sm font-medium border transition-all flex items-center gap-2',
                  selectedPreset ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-secondary/30 text-foreground hover:bg-secondary/50'
                )}
              >
                <Zap size={14} />
                {selectedPreset ? PRESETS.find((p) => p.id === selectedPreset)?.label : 'Presets'}
                <ChevronDown size={14} />
              </button>
              {showPresets && (
                <div className="absolute top-full left-0 mt-2 bg-card border border-border rounded-xl shadow-xl py-2 min-w-[240px] z-50">
                  {PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      onClick={() => applyPreset(preset)}
                      className={cn(
                        'w-full text-left px-4 py-2.5 hover:bg-secondary/50 transition-colors',
                        preset.id === selectedPreset && 'bg-primary/5'
                      )}
                    >
                      <p className="text-sm font-medium text-foreground">{preset.label}</p>
                      <p className="text-xs text-muted-foreground">{preset.description}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Output Directory */}
          <button
            onClick={selectOutputDir}
            className="px-4 py-2 rounded-xl text-sm font-medium border border-border bg-secondary/30 text-foreground hover:bg-secondary/50 transition-all flex items-center gap-2"
          >
            <FolderOpen size={14} />
            {outputDir ? outputDir.split(/[/\\]/).pop() : 'Output Folder'}
          </button>

          {/* Advanced Options */}
          {(category === 'video' || category === 'audio') && (
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className={cn(
                'px-4 py-2 rounded-xl text-sm font-medium border transition-all flex items-center gap-2',
                showAdvanced ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-secondary/30 text-foreground hover:bg-secondary/50'
              )}
            >
              <Info size={14} />
              Advanced
              <ChevronDown size={14} className={cn('transition-transform', showAdvanced && 'rotate-180')} />
            </button>
          )}

          {/* Convert Button */}
          <button
            onClick={startConversion}
            className="px-6 py-2 rounded-xl text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-all press-effect ml-auto flex items-center gap-2"
          >
            <Zap size={14} />
            Convert
          </button>
        </div>
      )}

      {/* Advanced Options Panel */}
      {showAdvanced && inputFile && (category === 'video' || category === 'audio') && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6 p-4 bg-secondary/10 rounded-xl border border-border">
          {category === 'video' && (
            <>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Video Bitrate</label>
                <input
                  type="text"
                  placeholder="e.g. 5M"
                  value={customOptions.videoBitrate || ''}
                  onChange={(e) => setCustomOptions({ ...customOptions, videoBitrate: e.target.value })}
                  className="w-full bg-background border border-border rounded-lg px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Max Height</label>
                <input
                  type="text"
                  placeholder="e.g. 1080"
                  value={customOptions.maxHeight || ''}
                  onChange={(e) => setCustomOptions({ ...customOptions, maxHeight: e.target.value })}
                  className="w-full bg-background border border-border rounded-lg px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">FPS</label>
                <input
                  type="text"
                  placeholder="e.g. 30"
                  value={customOptions.fps || ''}
                  onChange={(e) => setCustomOptions({ ...customOptions, fps: e.target.value })}
                  className="w-full bg-background border border-border rounded-lg px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
            </>
          )}
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Audio Bitrate</label>
            <input
              type="text"
              placeholder="e.g. 320k"
              value={customOptions.audioBitrate || ''}
              onChange={(e) => setCustomOptions({ ...customOptions, audioBitrate: e.target.value })}
              className="w-full bg-background border border-border rounded-lg px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
          {category === 'video' && (
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Max Duration (sec)</label>
              <input
                type="text"
                placeholder="e.g. 30"
                value={customOptions.maxDuration || ''}
                onChange={(e) => setCustomOptions({ ...customOptions, maxDuration: e.target.value })}
                className="w-full bg-background border border-border rounded-lg px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
          )}
        </div>
      )}

      {/* Conversion Jobs */}
      {jobs.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-foreground">Conversions</h3>
          {jobs.map((job) => (
            <div
              key={job.id}
              className={cn(
                'flex items-center gap-3 p-3 rounded-xl border transition-all',
                job.status === 'completed' ? 'border-green-500/30 bg-green-500/5' :
                job.status === 'error' ? 'border-red-500/30 bg-red-500/5' :
                'border-border bg-secondary/10'
              )}
            >
              <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0">
                {job.status === 'converting' && <Loader2 size={20} className="text-primary animate-spin" />}
                {job.status === 'completed' && <CheckCircle size={20} className="text-green-500" />}
                {job.status === 'error' && <AlertCircle size={20} className="text-red-500" />}
                {job.status === 'queued' && <Loader2 size={20} className="text-muted-foreground" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {job.inputName} <ArrowRight size={12} className="inline mx-1 text-muted-foreground" /> .{job.outputFormat}
                </p>
                {job.status === 'converting' && (
                  <div className="mt-1.5 w-full h-1.5 bg-secondary rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all duration-300"
                      style={{ width: `${job.progress}%` }}
                    />
                  </div>
                )}
                {job.status === 'converting' && (
                  <p className="text-xs text-muted-foreground mt-1">{Math.round(job.progress)}%</p>
                )}
                {job.error && <p className="text-xs text-red-500 mt-1">{job.error}</p>}
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                {job.status === 'completed' && job.outputPath && (
                  <button
                    onClick={() => openOutputFile(job.outputPath!)}
                    className="text-xs px-2.5 py-1 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                  >
                    Open
                  </button>
                )}
                {job.status === 'converting' && (
                  <button
                    onClick={() => cancelConversion(job.id)}
                    className="text-xs px-2.5 py-1 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors"
                  >
                    Cancel
                  </button>
                )}
                {(job.status === 'completed' || job.status === 'error') && (
                  <button
                    onClick={() => removeJob(job.id)}
                    className="text-muted-foreground hover:text-foreground transition-colors p-1"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Feature Cards (when no file & no jobs) */}
      {!inputFile && jobs.length === 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4">
          <div className="p-4 rounded-xl bg-secondary/20 border border-border/50 text-center">
            <FileVideo size={24} className="mx-auto mb-2 text-primary" />
            <p className="text-sm font-medium text-foreground">Video</p>
            <p className="text-xs text-muted-foreground mt-1">MP4, MKV, WebM, AVI, MOV, GIF</p>
          </div>
          <div className="p-4 rounded-xl bg-secondary/20 border border-border/50 text-center">
            <FileAudio size={24} className="mx-auto mb-2 text-primary" />
            <p className="text-sm font-medium text-foreground">Audio</p>
            <p className="text-xs text-muted-foreground mt-1">MP3, FLAC, WAV, OGG, AAC</p>
          </div>
          <div className="p-4 rounded-xl bg-secondary/20 border border-border/50 text-center">
            <Image size={24} className="mx-auto mb-2 text-primary" />
            <p className="text-sm font-medium text-foreground">Image</p>
            <p className="text-xs text-muted-foreground mt-1">PNG, JPG, WebP, AVIF, TIFF</p>
          </div>
          <div className="p-4 rounded-xl bg-secondary/20 border border-border/50 text-center">
            <FileText size={24} className="mx-auto mb-2 text-primary" />
            <p className="text-sm font-medium text-foreground">Subtitle</p>
            <p className="text-xs text-muted-foreground mt-1">SRT, VTT, ASS, SSA, SBV</p>
          </div>
        </div>
      )}
    </div>
  );
};
