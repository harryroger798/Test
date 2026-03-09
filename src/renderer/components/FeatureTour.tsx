import React, { useState } from 'react';
import {
  Home,
  Video,
  Music,
  Settings,
  HelpCircle,
  ArrowRight,
  ArrowLeft,
  Globe,
  Cookie,
  Download,
  Zap,
  Shield,
  Sparkles,
  X,
} from 'lucide-react';

interface FeatureTourProps {
  onComplete: () => void;
}

interface TourStep {
  title: string;
  description: string;
  icon: React.ElementType;
  tips: string[];
  highlight: string;
}

const tourSteps: TourStep[] = [
  {
    title: 'Paste & Download',
    description:
      'The Home page is your starting point. Paste any video URL from 1800+ supported websites, pick your format, and hit Convert.',
    icon: Home,
    tips: [
      'Supports YouTube, Instagram, TikTok, Twitter, Reddit, Vimeo, Dailymotion, and 1800+ more',
      'Toggle between Video and Audio mode before downloading',
      'Choose quality: Best, 1080p, 720p, 480p, or audio-only formats like MP3, FLAC, WAV',
    ],
    highlight: 'home',
  },
  {
    title: 'Video Downloads',
    description:
      'All your video downloads appear here. Track progress in real-time, open completed files, or retry failed ones.',
    icon: Video,
    tips: [
      'Downloads show real-time progress with speed and ETA',
      'Click the folder icon to open the file location',
      'Failed downloads can be retried automatically',
    ],
    highlight: 'video',
  },
  {
    title: 'Audio Downloads',
    description:
      'Audio-only downloads are separated here. Perfect for music, podcasts, and audio extraction from videos.',
    icon: Music,
    tips: [
      'Supports MP3, M4A, OPUS, FLAC, and WAV formats',
      'Audio is extracted at the highest quality available',
      'Thumbnails can be embedded in audio files via Settings',
    ],
    highlight: 'audio',
  },
  {
    title: 'Proxy & Cookies',
    description:
      'Some platforms need authentication. GrabTube can use your browser cookies or a proxy to access restricted content.',
    icon: Globe,
    tips: [
      'YouTube cookies are auto-detected from your browser (set up during onboarding)',
      'For Instagram/Facebook/Reddit: export cookies.txt from your browser',
      'Proxy supports HTTP, HTTPS, and SOCKS5 protocols',
      'Use a proxy if downloads are blocked in your region',
    ],
    highlight: 'proxy',
  },
  {
    title: 'Platform-Specific Guides',
    description:
      'Each platform has different requirements. Visit the Help page for step-by-step guides on downloading from Instagram, TikTok, Twitter, and more.',
    icon: HelpCircle,
    tips: [
      'YouTube: Works automatically with browser cookies',
      'Instagram: Requires login cookies (guide in Help page)',
      'TikTok & Twitter: Usually work without cookies for public content',
      'Some platforms may need a proxy in certain regions',
    ],
    highlight: 'help',
  },
  {
    title: 'Auto Updates & Self-Healing',
    description:
      'GrabTube keeps itself up to date automatically. yt-dlp updates daily, FFmpeg weekly, and the app checks for new versions on launch.',
    icon: Zap,
    tips: [
      'yt-dlp is updated nightly to stay ahead of platform changes',
      'If a download fails, GrabTube automatically tries alternative methods',
      'The Health Monitor can diagnose and fix common issues',
      'App updates install automatically on restart',
    ],
    highlight: 'settings',
  },
];

export const FeatureTour: React.FC<FeatureTourProps> = ({ onComplete }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const step = tourSteps[currentStep];
  const isLastStep = currentStep === tourSteps.length - 1;
  const isFirstStep = currentStep === 0;

  const handleNext = () => {
    if (isLastStep) {
      onComplete();
    } else {
      setCurrentStep((s) => s + 1);
    }
  };

  const handlePrev = () => {
    if (!isFirstStep) {
      setCurrentStep((s) => s - 1);
    }
  };

  const handleSkip = () => {
    onComplete();
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center animate-fade-in">
      <div className="max-w-lg w-full mx-4 bg-card border border-border rounded-2xl shadow-2xl overflow-hidden animate-scale-in">
        {/* Header with step indicator */}
        <div className="px-6 pt-5 pb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-primary" />
            <span className="text-xs font-semibold text-primary uppercase tracking-wider">
              Feature Tour
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {currentStep + 1} / {tourSteps.length}
            </span>
            <button
              onClick={handleSkip}
              className="p-1 text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-secondary/50"
              title="Skip tour"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Progress bar */}
        <div className="px-6 mb-4">
          <div className="h-1 bg-secondary/50 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-500 ease-out"
              style={{ width: `${((currentStep + 1) / tourSteps.length) * 100}%` }}
            />
          </div>
        </div>

        {/* Content */}
        <div className="px-6 pb-6">
          <div className="text-center mb-5">
            <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4 animate-bounce-subtle">
              <step.icon size={28} className="text-primary" />
            </div>
            <h2 className="text-xl font-bold text-foreground mb-2">{step.title}</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">{step.description}</p>
          </div>

          {/* Tips */}
          <div className="bg-secondary/30 rounded-xl p-4 space-y-2.5 mb-6">
            <h4 className="text-xs font-semibold text-primary flex items-center gap-1.5">
              <Shield size={12} />
              Tips
            </h4>
            {step.tips.map((tip, i) => (
              <div key={i} className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                  {i + 1}
                </span>
                <p className="text-sm text-muted-foreground">{tip}</p>
              </div>
            ))}
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between">
            <button
              onClick={handlePrev}
              disabled={isFirstStep}
              className="flex items-center gap-1.5 px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors rounded-xl hover:bg-secondary/50 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ArrowLeft size={14} />
              Back
            </button>

            <div className="flex items-center gap-1.5">
              {tourSteps.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentStep(i)}
                  className={`w-2 h-2 rounded-full transition-all duration-300 ${
                    i === currentStep
                      ? 'bg-primary w-5'
                      : i < currentStep
                        ? 'bg-primary/40'
                        : 'bg-secondary'
                  }`}
                />
              ))}
            </div>

            <button
              onClick={handleNext}
              className="flex items-center gap-1.5 px-5 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:bg-primary/90 transition-all duration-200 hover-glow"
            >
              {isLastStep ? (
                <>
                  <Download size={14} />
                  Start Downloading
                </>
              ) : (
                <>
                  Next
                  <ArrowRight size={14} />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
