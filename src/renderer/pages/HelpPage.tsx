import React, { useEffect, useState } from 'react';
import {
  HelpCircle,
  ExternalLink,
  BookOpen,
  Shield,
  Zap,
  Globe,
  Cookie,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  CheckCircle,
  Download,
  Settings,
  Video,
  Music,
  Search,
  Monitor,
  Smartphone,
  Key,
  FileText,
  RefreshCw,
  ArrowRight,
} from 'lucide-react';
import { api } from '../lib/ipc';
import { cn } from '../lib/utils';

interface PlatformGuide {
  name: string;
  icon: string;
  requiresCookies: boolean;
  difficulty: 'easy' | 'medium' | 'advanced';
  description: string;
  steps: string[];
  tips: string[];
  cookieInstructions?: string[];
  supportedContent: string[];
}

const platformGuides: PlatformGuide[] = [
  {
    name: 'YouTube',
    icon: 'YT',
    requiresCookies: true,
    difficulty: 'easy',
    description: 'YouTube works automatically using your browser cookies. GrabTube detects your login from Chrome, Firefox, or Edge.',
    steps: [
      'Paste any YouTube video URL into the Home page',
      'Select your desired format (Video or Audio) and quality',
      'Click Convert to start downloading',
    ],
    tips: [
      'Age-restricted videos require browser cookies (auto-detected)',
      'Private/unlisted videos need your Google account to be logged in',
      'Playlists: paste the playlist URL to see all videos',
      'Shorts work with the same URL format',
    ],
    supportedContent: ['Public videos', 'Unlisted videos', 'Age-restricted', 'Shorts', 'Playlists', 'Live streams (VOD)'],
  },
  {
    name: 'Instagram',
    icon: 'IG',
    requiresCookies: true,
    difficulty: 'medium',
    description: 'Instagram requires login cookies to download Reels, Stories, and posts from private accounts.',
    steps: [
      'Log in to Instagram in your browser (Chrome/Firefox/Edge)',
      'Export cookies using the "Get cookies.txt LOCALLY" browser extension',
      'Import the cookies.txt file in GrabTube Settings > Cookie Authentication',
      'Paste the Instagram post/reel URL and download',
    ],
    cookieInstructions: [
      'Install "Get cookies.txt LOCALLY" extension from Chrome Web Store or Firefox Add-ons',
      'Go to instagram.com and make sure you are logged in',
      'Click the extension icon, then click "Export" to save cookies.txt',
      'In GrabTube, go to Settings > Cookie Authentication > Import',
      'Select the exported cookies.txt file',
    ],
    tips: [
      'Public posts/reels may work without cookies',
      'Stories require cookies from the account following the target',
      'IGTV and Reels use the same standard post URL',
      'Refresh cookies if downloads start failing (re-export from browser)',
    ],
    supportedContent: ['Public posts', 'Reels', 'IGTV', 'Stories (with cookies)', 'Private posts (with cookies)'],
  },
  {
    name: 'TikTok',
    icon: 'TT',
    requiresCookies: false,
    difficulty: 'easy',
    description: 'TikTok videos download without any authentication. Just paste the video URL.',
    steps: [
      'Copy the TikTok video link (share button > Copy link)',
      'Paste the URL into GrabTube Home page',
      'Select format and click Convert',
    ],
    tips: [
      'TikTok videos are downloaded without watermark when possible',
      'Works with both mobile (vm.tiktok.com) and desktop URLs',
      'Audio extraction works great for TikTok sounds',
      'If blocked in your region, enable a proxy in Settings',
    ],
    supportedContent: ['Public videos', 'Sounds/audio', 'Slideshows'],
  },
  {
    name: 'Twitter / X',
    icon: 'X',
    requiresCookies: false,
    difficulty: 'easy',
    description: 'Twitter/X videos from public tweets download without authentication.',
    steps: [
      'Copy the tweet URL containing a video',
      'Paste into GrabTube and click Convert',
      'Select quality and download',
    ],
    cookieInstructions: [
      'Only needed for age-restricted or NSFW content',
      'Log in to twitter.com/x.com in your browser',
      'Export cookies.txt using the browser extension',
      'Import in GrabTube Settings',
    ],
    tips: [
      'NSFW/age-restricted content requires cookies',
      'Twitter Spaces recordings can also be downloaded',
      'GIFs are downloaded as MP4 videos',
      'Works with both twitter.com and x.com URLs',
    ],
    supportedContent: ['Public tweet videos', 'GIFs', 'Twitter Spaces', 'NSFW (with cookies)'],
  },
  {
    name: 'Reddit',
    icon: 'RD',
    requiresCookies: false,
    difficulty: 'easy',
    description: 'Reddit videos from public posts download without authentication. NSFW content needs cookies.',
    steps: [
      'Copy the Reddit post URL containing a video',
      'Paste into GrabTube and download',
    ],
    cookieInstructions: [
      'Required only for NSFW/quarantined subreddits',
      'Log in to reddit.com in your browser',
      'Export and import cookies.txt as described above',
    ],
    tips: [
      'Reddit videos often have separate audio/video streams — GrabTube merges them automatically',
      'Gallery posts with videos are supported',
      'Old Reddit and new Reddit URLs both work',
    ],
    supportedContent: ['Public post videos', 'NSFW (with cookies)', 'Gallery videos'],
  },
  {
    name: 'Facebook',
    icon: 'FB',
    requiresCookies: true,
    difficulty: 'medium',
    description: 'Facebook videos from public pages work without cookies. Private/group videos need authentication.',
    steps: [
      'Copy the Facebook video URL',
      'For private videos: export cookies from facebook.com',
      'Paste URL and download',
    ],
    cookieInstructions: [
      'Log in to facebook.com in your browser',
      'Export cookies.txt using the browser extension',
      'Import in GrabTube Settings > Cookie Authentication',
    ],
    tips: [
      'Public page videos often work without cookies',
      'Group and private videos always need cookies',
      'Facebook Reels are also supported',
      'Live video replays can be downloaded after the stream ends',
    ],
    supportedContent: ['Public page videos', 'Reels', 'Private videos (cookies)', 'Group videos (cookies)', 'Live replays'],
  },
  {
    name: 'Vimeo',
    icon: 'VM',
    requiresCookies: false,
    difficulty: 'easy',
    description: 'Vimeo public videos download without any setup. Password-protected videos need the password in the URL.',
    steps: [
      'Copy the Vimeo video URL',
      'Paste and download — no special setup needed',
    ],
    tips: [
      'For password-protected videos, add :password to the URL',
      'Vimeo often provides very high quality options (4K+)',
      'Private/unlisted videos may need cookies if accessible to your account',
    ],
    supportedContent: ['Public videos', 'Unlisted videos', 'Password-protected (with password)', 'Showcases'],
  },
  {
    name: 'Dailymotion',
    icon: 'DM',
    requiresCookies: false,
    difficulty: 'easy',
    description: 'Dailymotion videos download without any setup.',
    steps: [
      'Copy the Dailymotion video URL',
      'Paste and download',
    ],
    tips: [
      'Works with all public Dailymotion content',
      'Multiple quality options available',
    ],
    supportedContent: ['Public videos', 'Playlists'],
  },
  {
    name: 'Twitch',
    icon: 'TW',
    requiresCookies: false,
    difficulty: 'easy',
    description: 'Download Twitch VODs and clips without authentication.',
    steps: [
      'Copy the Twitch VOD or clip URL',
      'Paste and download',
    ],
    tips: [
      'Subscriber-only VODs require cookies from a subscribed account',
      'Clips download much faster than full VODs',
      'Long VODs may take a while to process',
    ],
    supportedContent: ['VODs', 'Clips', 'Highlights', 'Sub-only VODs (cookies)'],
  },
  {
    name: 'SoundCloud',
    icon: 'SC',
    requiresCookies: false,
    difficulty: 'easy',
    description: 'Download SoundCloud tracks and playlists as audio files.',
    steps: [
      'Copy the SoundCloud track or playlist URL',
      'Paste and download in audio mode',
    ],
    tips: [
      'Best for extracting audio in MP3 or FLAC',
      'Playlist URLs download all tracks',
      'Go+ tracks may have limitations',
    ],
    supportedContent: ['Public tracks', 'Playlists', 'Sets'],
  },
];

const cookieExtractionSteps = {
  chrome: {
    name: 'Google Chrome',
    steps: [
      'Install the "Get cookies.txt LOCALLY" extension from Chrome Web Store',
      'Navigate to the website you want cookies from (e.g., youtube.com, instagram.com)',
      'Make sure you are logged in to your account on that website',
      'Click the extension icon in the toolbar (puzzle piece icon > Get cookies.txt LOCALLY)',
      'Click "Export" to download the cookies.txt file',
      'In GrabTube, go to Settings > Cookie Authentication > Import',
      'Select the exported cookies.txt file',
    ],
    notes: [
      'If Chrome blocks the extension, try the Firefox method instead',
      'Cookies expire when you log out — re-export if downloads stop working',
      'The extension only reads cookies locally, nothing is sent to any server',
    ],
  },
  firefox: {
    name: 'Mozilla Firefox',
    steps: [
      'Install the "Get cookies.txt LOCALLY" add-on from Firefox Add-ons',
      'Navigate to the website you want cookies from',
      'Make sure you are logged in',
      'Click the extension icon in the toolbar',
      'Click "Export" to save the cookies.txt file',
      'In GrabTube, go to Settings > Cookie Authentication > Import',
      'Select the exported cookies.txt file',
    ],
    notes: [
      'Firefox is the most reliable for cookie extraction',
      'GrabTube can also auto-detect Firefox cookies without manual export',
      'Firefox cookies are unencrypted on most systems, making auto-detection more reliable',
    ],
  },
  edge: {
    name: 'Microsoft Edge',
    steps: [
      'Install the "Get cookies.txt LOCALLY" extension from Chrome Web Store (Edge supports Chrome extensions)',
      'Navigate to the target website and log in',
      'Click the extension icon and export cookies',
      'Import the cookies.txt file in GrabTube Settings',
    ],
    notes: [
      'Edge uses the same extension store as Chrome',
      'Edge cookies can also be auto-detected by GrabTube',
      'If auto-detection fails, use the manual export method',
    ],
  },
};

interface FAQ {
  question: string;
  answer: string;
}

const faqs: FAQ[] = [
  {
    question: 'Why does my first YouTube download fail?',
    answer: 'YouTube requires authentication (cookies) for most videos. GrabTube auto-detects your browser cookies on setup. If it fails, make sure you are logged into YouTube in at least one browser (Chrome, Firefox, or Edge), then go to Settings and verify your browser cookies.',
  },
  {
    question: 'What is the cookies.txt file?',
    answer: 'A cookies.txt file contains your browser login session data in a standardized format. It allows GrabTube to authenticate with websites like Instagram, Facebook, and Reddit as if it were your browser. The file is stored locally and never sent anywhere.',
  },
  {
    question: 'Why do I need a proxy?',
    answer: 'Some websites block downloads from certain regions or IP addresses. A proxy routes your download through a different server, bypassing these restrictions. GrabTube supports HTTP, HTTPS, and SOCKS5 proxies. You only need a proxy if downloads are blocked in your region.',
  },
  {
    question: 'How many videos can I download per day?',
    answer: 'There is no hard limit. However, downloading too many videos in a short time from YouTube may trigger rate limiting (temporary blocks). For normal usage (10-50 videos/day), you should have no issues. If you get blocked, wait a few hours or use a proxy.',
  },
  {
    question: 'Can I download entire playlists?',
    answer: 'Yes! Paste a playlist URL from YouTube, SoundCloud, or other supported platforms. GrabTube will detect the playlist and let you download individual videos or the entire playlist.',
  },
  {
    question: 'Why is the download quality lower than expected?',
    answer: 'Some platforms limit quality for non-authenticated users. Make sure your cookies are set up (especially for YouTube). Also, the "best" format option automatically selects the highest available quality. Some older videos may only be available in lower resolutions.',
  },
  {
    question: 'What formats are supported?',
    answer: 'Video: MP4 (H.264/H.265), MKV, WebM. Audio: MP3, M4A, OPUS, FLAC, WAV. You can also embed thumbnails and subtitles in the downloaded files via Settings.',
  },
  {
    question: 'How do auto-updates work?',
    answer: 'GrabTube checks for app updates on launch and installs them on restart. The download engine (yt-dlp) is updated nightly to stay ahead of website changes. FFmpeg and other binaries are checked weekly. All updates happen in the background.',
  },
  {
    question: 'Is GrabTube safe?',
    answer: 'Yes. All downloads happen locally on your machine. Cookies are read directly from your browser and stored locally. No data is sent to external servers. GrabTube is open-source and you can verify the code yourself.',
  },
  {
    question: 'What should I do if a website is not supported?',
    answer: 'GrabTube uses yt-dlp which supports 1800+ websites. If your website is not supported, check the yt-dlp supported sites list (link in Resources below). New sites are added regularly through auto-updates.',
  },
];

export const HelpPage: React.FC = () => {
  const [appVersion, setAppVersion] = useState('...');
  const [expandedPlatform, setExpandedPlatform] = useState<string | null>(null);
  const [expandedCookieBrowser, setExpandedCookieBrowser] = useState<string | null>(null);
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'quickstart' | 'platforms' | 'cookies' | 'faq'>('quickstart');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    api.getAppVersion().then((res) => setAppVersion(res.version)).catch(() => setAppVersion('1.0.14'));
  }, []);

  const filteredPlatforms = searchQuery
    ? platformGuides.filter(
        (p) =>
          p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.description.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : platformGuides;

  const filteredFaqs = searchQuery
    ? faqs.filter(
        (f) =>
          f.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
          f.answer.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : faqs;

  const difficultyColors = {
    easy: 'text-green-500 bg-green-500/10',
    medium: 'text-yellow-500 bg-yellow-500/10',
    advanced: 'text-red-500 bg-red-500/10',
  };

  const tabs = [
    { id: 'quickstart' as const, label: 'Quick Start', icon: Zap },
    { id: 'platforms' as const, label: 'Platforms', icon: Globe },
    { id: 'cookies' as const, label: 'Cookie Guide', icon: Cookie },
    { id: 'faq' as const, label: 'FAQ', icon: HelpCircle },
  ];

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-3xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6 animate-fade-in">
          <div className="w-9 h-9 bg-primary/10 rounded-lg flex items-center justify-center">
            <HelpCircle size={20} className="text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground">Help & Guides</h2>
            <p className="text-xs text-muted-foreground">Everything you need to know about GrabTube</p>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-5 animate-slide-in">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search guides, platforms, FAQs..."
            className="w-full pl-10 pr-4 py-2.5 bg-card border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
          />
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-secondary/30 rounded-xl p-1 animate-slide-in stagger-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                setSearchQuery('');
              }}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-200',
                activeTab === tab.id
                  ? 'bg-primary/10 text-primary border border-primary/20'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <tab.icon size={14} />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Quick Start Tab */}
        {activeTab === 'quickstart' && (
          <div className="space-y-4 animate-fade-in">
            {/* Getting Started */}
            <div className="bg-card border border-border rounded-xl p-5 hover-lift transition-all duration-200">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground mb-4">
                <BookOpen size={16} className="text-primary" />
                Getting Started in 3 Steps
              </h3>
              <div className="space-y-3">
                <div className="flex items-start gap-3 p-3 bg-secondary/30 rounded-lg">
                  <span className="w-7 h-7 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center flex-shrink-0">1</span>
                  <div>
                    <p className="text-sm font-medium text-foreground">Paste a URL</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Copy any video URL from YouTube, Instagram, TikTok, or 1800+ other websites and paste it into the Home page.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 bg-secondary/30 rounded-lg">
                  <span className="w-7 h-7 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center flex-shrink-0">2</span>
                  <div>
                    <p className="text-sm font-medium text-foreground">Choose Format & Quality</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Pick Video (MP4, MKV, WebM) or Audio (MP3, FLAC, WAV, M4A, OPUS). Select quality from Best to 480p.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 bg-secondary/30 rounded-lg">
                  <span className="w-7 h-7 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center flex-shrink-0">3</span>
                  <div>
                    <p className="text-sm font-medium text-foreground">Click Convert</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Hit the Convert button and track progress in real-time. Downloads appear in the Video or Audio page.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Understanding the Pages */}
            <div className="bg-card border border-border rounded-xl p-5 hover-lift transition-all duration-200">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground mb-4">
                <Monitor size={16} className="text-primary" />
                Understanding the App
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { icon: Download, name: 'Home', desc: 'Paste URLs, pick formats, start downloads' },
                  { icon: Video, name: 'Video', desc: 'View and manage video downloads' },
                  { icon: Music, name: 'Audio', desc: 'View and manage audio-only downloads' },
                  { icon: Settings, name: 'Settings', desc: 'Configure proxy, cookies, themes, preferences' },
                ].map((page) => (
                  <div key={page.name} className="flex items-start gap-3 p-3 bg-secondary/20 rounded-lg">
                    <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                      <page.icon size={16} className="text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">{page.name}</p>
                      <p className="text-xs text-muted-foreground">{page.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* When You Need Cookies */}
            <div className="bg-card border border-border rounded-xl p-5 hover-lift transition-all duration-200">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground mb-4">
                <Cookie size={16} className="text-primary" />
                When Do You Need Cookies?
              </h3>
              <div className="space-y-2">
                <div className="flex items-center gap-3 p-2 rounded-lg">
                  <CheckCircle size={14} className="text-green-500 flex-shrink-0" />
                  <p className="text-sm text-muted-foreground"><strong className="text-foreground">YouTube</strong> — Auto-detected from your browser (set up during onboarding)</p>
                </div>
                <div className="flex items-center gap-3 p-2 rounded-lg">
                  <AlertTriangle size={14} className="text-yellow-500 flex-shrink-0" />
                  <p className="text-sm text-muted-foreground"><strong className="text-foreground">Instagram</strong> — Requires cookies.txt export (see Cookie Guide tab)</p>
                </div>
                <div className="flex items-center gap-3 p-2 rounded-lg">
                  <AlertTriangle size={14} className="text-yellow-500 flex-shrink-0" />
                  <p className="text-sm text-muted-foreground"><strong className="text-foreground">Facebook</strong> — Required for private/group videos</p>
                </div>
                <div className="flex items-center gap-3 p-2 rounded-lg">
                  <CheckCircle size={14} className="text-green-500 flex-shrink-0" />
                  <p className="text-sm text-muted-foreground"><strong className="text-foreground">TikTok, Vimeo, Dailymotion</strong> — No cookies needed</p>
                </div>
                <div className="flex items-center gap-3 p-2 rounded-lg">
                  <CheckCircle size={14} className="text-green-500 flex-shrink-0" />
                  <p className="text-sm text-muted-foreground"><strong className="text-foreground">Twitter/X, Reddit</strong> — Only for NSFW/restricted content</p>
                </div>
              </div>
            </div>

            {/* Proxy Guide */}
            <div className="bg-card border border-border rounded-xl p-5 hover-lift transition-all duration-200">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground mb-4">
                <Globe size={16} className="text-primary" />
                Using a Proxy
              </h3>
              <p className="text-sm text-muted-foreground mb-3">
                A proxy is only needed if downloads are blocked in your region. Most users do not need one.
              </p>
              <div className="space-y-2 bg-secondary/30 rounded-xl p-4">
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">1</span>
                  <p className="text-sm text-muted-foreground">Go to <strong className="text-foreground">Settings &gt; Proxy Settings</strong></p>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">2</span>
                  <p className="text-sm text-muted-foreground">Enable proxy and select type: <strong className="text-foreground">HTTP, HTTPS, or SOCKS5</strong></p>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">3</span>
                  <p className="text-sm text-muted-foreground">Enter the proxy URL: <code className="bg-secondary/50 px-1.5 py-0.5 rounded text-xs">protocol://username:password@host:port</code></p>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">4</span>
                  <p className="text-sm text-muted-foreground">All downloads will now route through the proxy</p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground/60 mt-3 italic">
                Free proxy services are unreliable. Use a paid residential proxy for best results.
              </p>
            </div>

            {/* Auto Updates */}
            <div className="bg-card border border-border rounded-xl p-5 hover-lift transition-all duration-200">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground mb-4">
                <RefreshCw size={16} className="text-primary" />
                Auto Updates & Self-Healing
              </h3>
              <p className="text-sm text-muted-foreground mb-3">
                GrabTube maintains itself automatically. You never need to manually update anything.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { label: 'App Updates', desc: 'Checked on launch, installed on restart' },
                  { label: 'yt-dlp', desc: 'Updated nightly to stay ahead of website changes' },
                  { label: 'FFmpeg', desc: 'Checked weekly for new versions' },
                  { label: 'Self-Healing', desc: 'Auto-fixes corrupted binaries and failed extractors' },
                ].map((item) => (
                  <div key={item.label} className="p-3 bg-secondary/20 rounded-lg">
                    <p className="text-sm font-medium text-foreground">{item.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Platforms Tab */}
        {activeTab === 'platforms' && (
          <div className="space-y-3 animate-fade-in">
            <p className="text-sm text-muted-foreground mb-4">
              GrabTube supports <strong className="text-foreground">1800+ websites</strong> via yt-dlp. Here are step-by-step guides for the most popular platforms.
            </p>
            {filteredPlatforms.map((platform) => (
              <div
                key={platform.name}
                className="bg-card border border-border rounded-xl overflow-hidden hover-lift transition-all duration-200"
              >
                <button
                  onClick={() => setExpandedPlatform(expandedPlatform === platform.name ? null : platform.name)}
                  className="w-full px-5 py-4 flex items-center gap-3 text-left"
                >
                  <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-bold text-primary">{platform.icon}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-foreground">{platform.name}</h3>
                      <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', difficultyColors[platform.difficulty])}>
                        {platform.difficulty}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">{platform.description}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {platform.requiresCookies && (
                      <span className="text-xs text-yellow-500 bg-yellow-500/10 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <Cookie size={10} />
                        Cookies
                      </span>
                    )}
                    {expandedPlatform === platform.name ? (
                      <ChevronDown size={16} className="text-muted-foreground" />
                    ) : (
                      <ChevronRight size={16} className="text-muted-foreground" />
                    )}
                  </div>
                </button>

                {expandedPlatform === platform.name && (
                  <div className="px-5 pb-5 space-y-4 border-t border-border pt-4 animate-slide-in">
                    {/* Steps */}
                    <div>
                      <h4 className="text-xs font-semibold text-primary mb-2 flex items-center gap-1.5">
                        <ArrowRight size={12} />
                        How to Download
                      </h4>
                      <div className="space-y-2">
                        {platform.steps.map((pstep, i) => (
                          <div key={i} className="flex items-start gap-2.5">
                            <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                              {i + 1}
                            </span>
                            <p className="text-sm text-muted-foreground">{pstep}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Cookie Instructions */}
                    {platform.cookieInstructions && (
                      <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-xl p-4">
                        <h4 className="text-xs font-semibold text-yellow-500 mb-2 flex items-center gap-1.5">
                          <Cookie size={12} />
                          Cookie Setup for {platform.name}
                        </h4>
                        <div className="space-y-1.5">
                          {platform.cookieInstructions.map((instruction, i) => (
                            <div key={i} className="flex items-start gap-2">
                              <span className="text-xs text-yellow-500/70 font-mono mt-0.5">{i + 1}.</span>
                              <p className="text-xs text-muted-foreground">{instruction}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Supported Content */}
                    <div>
                      <h4 className="text-xs font-semibold text-foreground mb-2">Supported Content</h4>
                      <div className="flex flex-wrap gap-1.5">
                        {platform.supportedContent.map((content) => (
                          <span key={content} className="text-xs bg-secondary/50 text-muted-foreground px-2.5 py-1 rounded-lg">
                            {content}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Tips */}
                    <div>
                      <h4 className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1.5">
                        <Shield size={12} className="text-primary" />
                        Tips
                      </h4>
                      <ul className="space-y-1">
                        {platform.tips.map((tip, i) => (
                          <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                            <span className="text-primary mt-0.5">-</span>
                            {tip}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {filteredPlatforms.length === 0 && (
              <div className="text-center py-8 text-muted-foreground text-sm">
                No platforms match your search. GrabTube supports 1800+ sites — try downloading directly!
              </div>
            )}

            {/* More sites note */}
            <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 text-center">
              <p className="text-sm text-muted-foreground">
                <strong className="text-foreground">1800+ more sites supported!</strong> Just paste any video URL and GrabTube will auto-detect the platform.
              </p>
              <a
                href="https://github.com/yt-dlp/yt-dlp/blob/master/supportedsites.md"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-2"
              >
                View full supported sites list
                <ExternalLink size={10} />
              </a>
            </div>
          </div>
        )}

        {/* Cookie Guide Tab */}
        {activeTab === 'cookies' && (
          <div className="space-y-4 animate-fade-in">
            <div className="bg-card border border-border rounded-xl p-5">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground mb-3">
                <Cookie size={16} className="text-primary" />
                What Are Cookies & Why Are They Needed?
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed mb-3">
                Cookies are small data files that websites store in your browser when you log in. They prove to the website that you are a real, authenticated user. Some platforms (Instagram, Facebook, etc.) require cookies to allow video downloads.
              </p>
              <div className="bg-primary/5 border border-primary/20 rounded-lg p-3">
                <p className="text-xs text-primary font-medium flex items-center gap-1.5">
                  <Shield size={12} />
                  Privacy Note
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  GrabTube reads cookies directly from your browser or imported file. No cookie data is ever sent to external servers. Everything stays on your machine.
                </p>
              </div>
            </div>

            {/* Two Methods */}
            <div className="bg-card border border-border rounded-xl p-5">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground mb-4">
                <Key size={16} className="text-primary" />
                Two Ways to Provide Cookies
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-4 bg-primary/5 border border-primary/20 rounded-xl">
                  <h4 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                    <Smartphone size={14} className="text-primary" />
                    Auto-Detection (Recommended)
                  </h4>
                  <p className="text-xs text-muted-foreground mb-2">
                    GrabTube reads cookies directly from your installed browsers. This was set up during onboarding.
                  </p>
                  <ul className="text-xs text-muted-foreground space-y-1">
                    <li className="flex items-center gap-1.5">
                      <CheckCircle size={10} className="text-green-500" /> Works for YouTube
                    </li>
                    <li className="flex items-center gap-1.5">
                      <CheckCircle size={10} className="text-green-500" /> Zero manual steps
                    </li>
                    <li className="flex items-center gap-1.5">
                      <AlertTriangle size={10} className="text-yellow-500" /> May fail on Windows with Chrome locked DB
                    </li>
                  </ul>
                </div>
                <div className="p-4 bg-secondary/30 border border-border rounded-xl">
                  <h4 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                    <FileText size={14} className="text-primary" />
                    Manual Export (Most Reliable)
                  </h4>
                  <p className="text-xs text-muted-foreground mb-2">
                    Export a cookies.txt file from your browser and import it into GrabTube.
                  </p>
                  <ul className="text-xs text-muted-foreground space-y-1">
                    <li className="flex items-center gap-1.5">
                      <CheckCircle size={10} className="text-green-500" /> Works for ALL platforms
                    </li>
                    <li className="flex items-center gap-1.5">
                      <CheckCircle size={10} className="text-green-500" /> 100% reliable
                    </li>
                    <li className="flex items-center gap-1.5">
                      <AlertTriangle size={10} className="text-yellow-500" /> Need to re-export if you log out
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Browser-specific guides */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <FileText size={16} className="text-primary" />
                Step-by-Step Cookie Export Guide
              </h3>
              {Object.entries(cookieExtractionSteps).map(([browserId, browser]) => (
                <div
                  key={browserId}
                  className="bg-card border border-border rounded-xl overflow-hidden"
                >
                  <button
                    onClick={() =>
                      setExpandedCookieBrowser(expandedCookieBrowser === browserId ? null : browserId)
                    }
                    className="w-full px-5 py-3.5 flex items-center justify-between text-left"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
                        <Globe size={16} className="text-primary" />
                      </div>
                      <span className="text-sm font-medium text-foreground">{browser.name}</span>
                    </div>
                    {expandedCookieBrowser === browserId ? (
                      <ChevronDown size={16} className="text-muted-foreground" />
                    ) : (
                      <ChevronRight size={16} className="text-muted-foreground" />
                    )}
                  </button>
                  {expandedCookieBrowser === browserId && (
                    <div className="px-5 pb-5 border-t border-border pt-4 space-y-4 animate-slide-in">
                      <div className="space-y-2">
                        {browser.steps.map((bstep, i) => (
                          <div key={i} className="flex items-start gap-2.5">
                            <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                              {i + 1}
                            </span>
                            <p className="text-sm text-muted-foreground">{bstep}</p>
                          </div>
                        ))}
                      </div>
                      <div className="bg-secondary/30 rounded-lg p-3">
                        <h4 className="text-xs font-semibold text-foreground mb-1.5">Notes</h4>
                        <ul className="space-y-1">
                          {browser.notes.map((note, i) => (
                            <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                              <span className="text-primary mt-0.5">-</span>
                              {note}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Troubleshooting */}
            <div className="bg-card border border-border rounded-xl p-5">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground mb-3">
                <AlertTriangle size={16} className="text-yellow-500" />
                Cookie Troubleshooting
              </h3>
              <div className="space-y-2.5">
                {[
                  { problem: '"Could not copy Chrome cookie database"', solution: 'Close Chrome completely before downloading, or use Firefox/Edge instead. Alternatively, export cookies.txt manually.' },
                  { problem: 'Cookies expire / downloads stop working', solution: 'Re-export cookies.txt from your browser. Cookies expire when you log out or clear browser data.' },
                  { problem: '"Sign in to confirm you\'re not a bot"', solution: 'Make sure you are logged into YouTube in at least one browser. Try the manual cookie export method.' },
                  { problem: 'Instagram shows "login required"', solution: 'Instagram always needs cookies. Export cookies.txt from a browser where you are logged into Instagram.' },
                ].map((item, i) => (
                  <div key={i} className="p-3 bg-secondary/20 rounded-lg">
                    <p className="text-xs font-medium text-foreground">{item.problem}</p>
                    <p className="text-xs text-muted-foreground mt-1">{item.solution}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* FAQ Tab */}
        {activeTab === 'faq' && (
          <div className="space-y-2 animate-fade-in">
            {filteredFaqs.map((faq, index) => (
              <div
                key={index}
                className="bg-card border border-border rounded-xl overflow-hidden hover-lift transition-all duration-200"
              >
                <button
                  onClick={() => setExpandedFaq(expandedFaq === index ? null : index)}
                  className="w-full px-5 py-3.5 flex items-center justify-between text-left"
                >
                  <p className="text-sm font-medium text-foreground pr-4">{faq.question}</p>
                  {expandedFaq === index ? (
                    <ChevronDown size={16} className="text-muted-foreground flex-shrink-0" />
                  ) : (
                    <ChevronRight size={16} className="text-muted-foreground flex-shrink-0" />
                  )}
                </button>
                {expandedFaq === index && (
                  <div className="px-5 pb-4 border-t border-border pt-3 animate-slide-in">
                    <p className="text-sm text-muted-foreground leading-relaxed">{faq.answer}</p>
                  </div>
                )}
              </div>
            ))}

            {filteredFaqs.length === 0 && (
              <div className="text-center py-8 text-muted-foreground text-sm">
                No FAQs match your search.
              </div>
            )}
          </div>
        )}

        {/* External links */}
        <div className="mt-8 bg-card border border-border rounded-xl p-5 animate-slide-in">
          <h3 className="font-semibold text-foreground text-sm mb-4">Resources</h3>
          <div className="space-y-3">
            {[
              { label: 'yt-dlp Documentation', url: 'https://github.com/yt-dlp/yt-dlp' },
              { label: 'Supported Sites List (1800+)', url: 'https://github.com/yt-dlp/yt-dlp/blob/master/supportedsites.md' },
              { label: 'Report an Issue', url: 'https://github.com/harryroger798/Test/issues' },
            ].map((link) => (
              <a
                key={link.label}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between px-4 py-3 rounded-lg bg-secondary/30 hover:bg-primary/10 hover:text-primary transition-all duration-200 group press-effect"
              >
                <span className="text-sm text-foreground group-hover:text-primary transition-colors">{link.label}</span>
                <ExternalLink size={14} className="text-muted-foreground group-hover:text-primary transition-colors" />
              </a>
            ))}
          </div>
        </div>

        {/* Version info */}
        <div className="mt-6 text-center text-xs text-muted-foreground animate-fade-in">
          <p>GrabTube v{appVersion}</p>
          <p className="mt-1">Built with yt-dlp, Electron, and React</p>
        </div>
      </div>
    </div>
  );
};
