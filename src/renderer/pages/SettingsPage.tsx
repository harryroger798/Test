import React, { useState } from 'react';
import { Settings, FolderOpen, Palette, Globe, Shield, Info, CheckCircle, AlertCircle, Cookie, FileText, X } from 'lucide-react';
import { useSettingsStore } from '../store/settingsStore';
import { cn } from '../lib/utils';
import { api } from '../lib/ipc';

export const SettingsPage: React.FC = () => {
  const {
    downloadPath,
    setDownloadPath,
    theme,
    setTheme,
    proxy,
    setProxy,
    maxConcurrentDownloads,
    embedThumbnail,
    embedSubtitles,
    defaultAudioFormat,
    notifications,
    updateSettings,
    cookiesPath,
    setCookiesPath,
    browserCookies,
    setBrowserCookies,
  } = useSettingsStore();

  const [ytdlpStatus, setYtdlpStatus] = useState<{ checked: boolean; available: boolean; version: string | null }>({
    checked: false,
    available: false,
    version: null,
  });

  const handleSelectFolder = async () => {
    const result = await api.selectFolder();
    if (result?.success && result.path) {
      setDownloadPath(result.path);
    }
  };

  const handleCheckYtdlp = async () => {
    const result = await api.checkYtdlp();
    setYtdlpStatus({ checked: true, available: result.available, version: result.version });
  };

  const handleSelectCookiesFile = async () => {
    const result = await api.selectCookiesFile();
    if (result?.success && result.path) {
      setCookiesPath(result.path);
    }
  };

  const handleClearCookies = async () => {
    await api.clearCookiesPath();
    setCookiesPath('');
  };

  const handleBrowserCookiesChange = async (browser: string) => {
    await api.setBrowserCookies(browser);
    setBrowserCookies(browser);
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-3xl mx-auto px-6 py-8">
        <div className="flex items-center gap-3 mb-6">
          <Settings size={24} className="text-primary" />
          <h2 className="text-xl font-bold text-foreground">Settings</h2>
        </div>

        <div className="space-y-6">
          {/* Download Path */}
          <section className="bg-card border border-border rounded-xl p-5">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground mb-4">
              <FolderOpen size={16} className="text-primary" />
              Download Location
            </h3>
            <div className="flex items-center gap-3">
              <div className="flex-1 px-4 py-2.5 bg-secondary/50 border border-border rounded-xl text-sm text-muted-foreground truncate">
                {downloadPath || 'Not set'}
              </div>
              <button
                onClick={handleSelectFolder}
                className="px-4 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary/90 transition-all flex-shrink-0"
              >
                Browse
              </button>
            </div>
          </section>

          {/* Theme */}
          <section className="bg-card border border-border rounded-xl p-5">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground mb-4">
              <Palette size={16} className="text-primary" />
              Appearance
            </h3>
            <div className="flex gap-2">
              {(['dark', 'light'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTheme(t)}
                  className={cn(
                    'px-4 py-2.5 rounded-xl text-sm font-medium transition-all border capitalize',
                    theme === t
                      ? 'bg-primary/10 border-primary text-primary'
                      : 'bg-secondary/50 border-border text-muted-foreground hover:text-foreground'
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
          </section>

          {/* Proxy */}
          <section className="bg-card border border-border rounded-xl p-5">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground mb-4">
              <Globe size={16} className="text-primary" />
              Proxy Settings
            </h3>

            <label className="flex items-center gap-3 mb-4 cursor-pointer">
              <input
                type="checkbox"
                checked={proxy.enabled}
                onChange={(e) => setProxy({ ...proxy, enabled: e.target.checked })}
                className="w-4 h-4 rounded accent-primary"
              />
              <span className="text-sm text-foreground">Enable proxy</span>
            </label>

            {proxy.enabled && (
              <div className="space-y-3 animate-slide-in">
                <div>
                  <label className="block text-xs text-muted-foreground mb-1.5">Proxy Type</label>
                  <div className="flex gap-2">
                    {(['http', 'https', 'socks5'] as const).map((type) => (
                      <button
                        key={type}
                        onClick={() => setProxy({ ...proxy, type })}
                        className={cn(
                          'px-3 py-1.5 rounded-lg text-xs font-medium transition-all border uppercase',
                          proxy.type === type
                            ? 'bg-primary/10 border-primary text-primary'
                            : 'bg-secondary/50 border-border text-muted-foreground'
                        )}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1.5">Proxy URL</label>
                  <input
                    type="text"
                    value={proxy.url}
                    onChange={(e) => setProxy({ ...proxy, url: e.target.value })}
                    placeholder={`${proxy.type}://username:password@host:port`}
                    className="w-full px-4 py-2.5 bg-secondary/50 border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                  />
                </div>
              </div>
            )}
          </section>

          {/* Cookie Authentication (P2/P3) */}
          <section className="bg-card border border-border rounded-xl p-5">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground mb-4">
              <Cookie size={16} className="text-primary" />
              Cookie Authentication
            </h3>
            <p className="text-xs text-muted-foreground mb-4">
              Some platforms (Instagram, Reddit, Facebook, Twitter) require login cookies to download videos.
              You can import a cookies.txt file or extract cookies from your browser.
            </p>

            {/* Import cookies.txt file */}
            <div className="mb-4">
              <label className="block text-xs text-muted-foreground mb-1.5">
                <FileText size={12} className="inline mr-1" />
                Cookies File (cookies.txt)
              </label>
              <div className="flex items-center gap-3">
                <div className="flex-1 px-4 py-2.5 bg-secondary/50 border border-border rounded-xl text-sm text-muted-foreground truncate">
                  {cookiesPath || 'No cookies file selected'}
                </div>
                {cookiesPath ? (
                  <button
                    onClick={handleClearCookies}
                    className="px-3 py-2.5 bg-destructive/10 text-destructive rounded-xl text-sm font-medium hover:bg-destructive/20 transition-all flex-shrink-0 flex items-center gap-1"
                  >
                    <X size={14} />
                    Clear
                  </button>
                ) : null}
                <button
                  onClick={handleSelectCookiesFile}
                  className="px-4 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary/90 transition-all flex-shrink-0"
                >
                  Import
                </button>
              </div>
            </div>

            {/* Browser cookies extraction */}
            <div>
              <label className="block text-xs text-muted-foreground mb-1.5">
                Extract Cookies from Browser
              </label>
              <div className="flex gap-2 flex-wrap">
                {[{ value: '', label: 'None' }, { value: 'firefox', label: 'Firefox' }, { value: 'chrome', label: 'Chrome' }, { value: 'edge', label: 'Edge' }, { value: 'safari', label: 'Safari' }].map((browser) => (
                  <button
                    key={browser.value}
                    onClick={() => handleBrowserCookiesChange(browser.value)}
                    className={cn(
                      'px-3 py-1.5 rounded-lg text-xs font-medium transition-all border',
                      browserCookies === browser.value
                        ? 'bg-primary/10 border-primary text-primary'
                        : 'bg-secondary/50 border-border text-muted-foreground'
                    )}
                  >
                    {browser.label}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Firefox is recommended (Chrome encrypts cookies since July 2024).
                The browser must be installed on this computer.
              </p>
            </div>
          </section>

          {/* Download Preferences */}
          <section className="bg-card border border-border rounded-xl p-5">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground mb-4">
              <Shield size={16} className="text-primary" />
              Download Preferences
            </h3>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-foreground">Max concurrent downloads</span>
                <select
                  value={maxConcurrentDownloads}
                  onChange={(e) => updateSettings({ maxConcurrentDownloads: parseInt(e.target.value) })}
                  className="px-3 py-1.5 bg-secondary/50 border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                >
                  {[1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-foreground">Default audio format</span>
                <select
                  value={defaultAudioFormat}
                  onChange={(e) => updateSettings({ defaultAudioFormat: e.target.value })}
                  className="px-3 py-1.5 bg-secondary/50 border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                >
                  {['mp3', 'm4a', 'opus', 'flac', 'wav'].map((f) => (
                    <option key={f} value={f}>{f.toUpperCase()}</option>
                  ))}
                </select>
              </div>

              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-sm text-foreground">Embed thumbnail by default</span>
                <input
                  type="checkbox"
                  checked={embedThumbnail}
                  onChange={(e) => updateSettings({ embedThumbnail: e.target.checked })}
                  className="w-4 h-4 rounded accent-primary"
                />
              </label>

              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-sm text-foreground">Embed subtitles by default</span>
                <input
                  type="checkbox"
                  checked={embedSubtitles}
                  onChange={(e) => updateSettings({ embedSubtitles: e.target.checked })}
                  className="w-4 h-4 rounded accent-primary"
                />
              </label>

              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-sm text-foreground">Show notifications</span>
                <input
                  type="checkbox"
                  checked={notifications}
                  onChange={(e) => updateSettings({ notifications: e.target.checked })}
                  className="w-4 h-4 rounded accent-primary"
                />
              </label>
            </div>
          </section>

          {/* System Info */}
          <section className="bg-card border border-border rounded-xl p-5">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground mb-4">
              <Info size={16} className="text-primary" />
              System
            </h3>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-foreground">yt-dlp Status</span>
                <div className="flex items-center gap-2">
                  {ytdlpStatus.checked ? (
                    ytdlpStatus.available ? (
                      <span className="flex items-center gap-1.5 text-sm text-green-500">
                        <CheckCircle size={14} />
                        v{ytdlpStatus.version}
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5 text-sm text-destructive">
                        <AlertCircle size={14} />
                        Not found
                      </span>
                    )
                  ) : (
                    <button
                      onClick={handleCheckYtdlp}
                      className="px-3 py-1.5 bg-secondary/50 border border-border rounded-lg text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Check
                    </button>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-foreground">App Version</span>
                <span className="text-sm text-muted-foreground">1.0.0</span>
              </div>
            </div>
          </section>

          {/* Disclaimer */}
          <div className="text-xs text-muted-foreground text-center py-4">
            <p>
              GrabTube is for personal use only. Users are responsible for ensuring compliance with applicable laws and platform terms of service.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
