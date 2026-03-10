import React, { useState, useEffect, useCallback } from 'react';
import { Settings, FolderOpen, Palette, Globe, Shield, Info, CheckCircle, AlertCircle, Cookie, FileText, X, RefreshCw, Download, Activity, Wrench, Key, Cloud, ExternalLink, Crown, Zap, Users, ShieldAlert, Timer, Shuffle } from 'lucide-react';
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

  const [cobaltEnabled, setCobaltEnabled] = useState(true);

  // License state
  const [licenseState, setLicenseState] = useState<{
    tier: string; key: string; activated: boolean; maxDevices: number; devicesUsed: number;
  }>({ tier: 'free', key: '', activated: false, maxDevices: 0, devicesUsed: 0 });
  const [licenseKey, setLicenseKey] = useState('');
  const [licenseLoading, setLicenseLoading] = useState(false);
  const [licenseMessage, setLicenseMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [downloadStats, setDownloadStats] = useState<{
    tier: string; dailyCount: number; remaining: number;
    limits: { maxDownloadsPerDay: number; maxQuality: string; maxConcurrent: number; batchDownload: boolean; playlistDownload: boolean; cooldownSeconds: number };
  } | null>(null);

  // Load license + Cobalt status on mount
  useEffect(() => {
    const loadStatus = async () => {
      const cobalt = await api.getCobaltStatus();
      setCobaltEnabled(cobalt.enabled);
      const license = await api.getLicenseState();
      setLicenseState(license);
      const stats = await api.getDownloadStats();
      setDownloadStats(stats);
    };
    loadStatus();
  }, []);

  const handleActivateLicense = async () => {
    if (!licenseKey.trim()) return;
    setLicenseLoading(true);
    setLicenseMessage(null);
    try {
      const result = await api.activateLicense(licenseKey.trim());
      if (result.success) {
        setLicenseMessage({ type: 'success', text: `License activated! Tier: ${(result.tier || 'pro').toUpperCase()}` });
        const license = await api.getLicenseState();
        setLicenseState(license);
        const stats = await api.getDownloadStats();
        setDownloadStats(stats);
        setLicenseKey('');
      } else {
        setLicenseMessage({ type: 'error', text: result.error || 'Activation failed' });
      }
    } catch {
      setLicenseMessage({ type: 'error', text: 'Could not reach license server. Check your internet connection.' });
    }
    setLicenseLoading(false);
  };

  const handleDeactivateLicense = async () => {
    setLicenseLoading(true);
    setLicenseMessage(null);
    const result = await api.deactivateLicense();
    if (result.success) {
      setLicenseMessage({ type: 'success', text: 'License deactivated. Reverted to Free tier.' });
      const license = await api.getLicenseState();
      setLicenseState(license);
      const stats = await api.getDownloadStats();
      setDownloadStats(stats);
    } else {
      setLicenseMessage({ type: 'error', text: result.error || 'Deactivation failed' });
    }
    setLicenseLoading(false);
  };

  const handleChangeLicense = async () => {
    if (!licenseKey.trim()) return;
    setLicenseLoading(true);
    setLicenseMessage(null);
    try {
      // First deactivate the current key
      await api.deactivateLicense();
      // Then activate the new key
      const result = await api.activateLicense(licenseKey.trim());
      if (result.success) {
        setLicenseMessage({ type: 'success', text: `License switched! New tier: ${(result.tier || 'pro').toUpperCase()}` });
        const license = await api.getLicenseState();
        setLicenseState(license);
        const stats = await api.getDownloadStats();
        setDownloadStats(stats);
        setLicenseKey('');
      } else {
        setLicenseMessage({ type: 'error', text: result.error || 'Activation of new key failed' });
        // Re-fetch state (now deactivated)
        const license = await api.getLicenseState();
        setLicenseState(license);
        const stats = await api.getDownloadStats();
        setDownloadStats(stats);
      }
    } catch {
      setLicenseMessage({ type: 'error', text: 'Could not reach license server. Check your internet connection.' });
    }
    setLicenseLoading(false);
  };

  const handleCobaltToggle = async (enabled: boolean) => {
    await api.setCobaltEnabled(enabled);
    setCobaltEnabled(enabled);
  };

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

  // Ban Prevention state
  const [banStatus, setBanStatus] = useState<{
    platforms: Record<string, {
      platform: string;
      downloadsThisHour: number;
      downloadsToday: number;
      riskLevel: 'safe' | 'warning' | 'danger';
      cookielessMode: boolean;
      cooldownUntil: number;
      totalDownloads: number;
    }>;
    globalRiskLevel: 'safe' | 'warning' | 'danger';
    activeCooldowns: number;
    cookielessPlatforms: string[];
  } | null>(null);
  const [banPreventionEnabled, setBanPreventionEnabled] = useState(true);
  const [randomDelayEnabled, setRandomDelayEnabled] = useState(true);

  const loadBanStatus = useCallback(async () => {
    const status = await api.getBanPreventionStatus();
    setBanStatus(status);
    const bpSettings = await api.getBanPreventionSettings();
    setBanPreventionEnabled(bpSettings.enabled);
    setRandomDelayEnabled(bpSettings.randomDelayEnabled);
  }, []);

  useEffect(() => {
    loadBanStatus();
    const interval = setInterval(loadBanStatus, 5000); // Refresh every 5 seconds
    return () => clearInterval(interval);
  }, [loadBanStatus]);

  // Listen for ban prevention warnings
  useEffect(() => {
    const cleanup = api.onBanPreventionWarning(() => {
      loadBanStatus(); // Refresh status on warning
    });
    return cleanup;
  }, [loadBanStatus]);

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-3xl mx-auto px-6 py-8">
        <div className="flex items-center gap-3 mb-6 animate-fade-in">
          <div className="w-9 h-9 bg-primary/10 rounded-lg flex items-center justify-center">
            <Settings size={20} className="text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground">Settings</h2>
            <p className="text-xs text-muted-foreground">Configure your preferences</p>
          </div>
        </div>

        <div className="space-y-6">
          {/* License & Tier */}
          <section className="bg-card border border-border rounded-xl p-5 hover-lift transition-all duration-200 animate-slide-in">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground mb-4">
              <Crown size={16} className="text-primary" />
              License & Plan
              <span className="relative group ml-auto">
                <Info size={14} className="text-muted-foreground cursor-help hover:text-primary transition-colors" />
                <span className="absolute right-0 top-6 z-50 w-64 p-2.5 bg-card border border-border rounded-lg shadow-xl text-xs text-muted-foreground opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 pointer-events-none">
                  Activate a license key to unlock Pro or Family features. No account or signup required — just paste your key.
                </span>
              </span>
            </h3>

            {/* Current tier badge */}
            <div className="flex items-center gap-3 mb-4">
              <div className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider border',
                licenseState.tier === 'free'
                  ? 'bg-secondary/50 border-border text-muted-foreground'
                  : licenseState.tier === 'pro'
                    ? 'bg-primary/10 border-primary text-primary'
                    : 'bg-yellow-500/10 border-yellow-500 text-yellow-500'
              )}>
                {licenseState.tier === 'free' && <Zap size={12} className="inline mr-1" />}
                {licenseState.tier === 'pro' && <Crown size={12} className="inline mr-1" />}
                {licenseState.tier === 'family' && <Users size={12} className="inline mr-1" />}
                {licenseState.tier} Plan
              </div>
              {licenseState.activated && (
                <span className="text-xs text-muted-foreground">
                  Key: {licenseState.key.substring(0, 7)}...{licenseState.key.slice(-4)} | Devices: {licenseState.devicesUsed}/{licenseState.maxDevices}
                </span>
              )}
            </div>

            {/* Tier limits display */}
            {downloadStats && (
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="bg-secondary/30 rounded-lg p-3 text-center">
                  <div className="text-lg font-bold text-foreground">
                    {downloadStats.limits.maxDownloadsPerDay === -1 ? '\u221E' : `${downloadStats.remaining}/${downloadStats.limits.maxDownloadsPerDay}`}
                  </div>
                  <div className="text-xs text-muted-foreground">Downloads Today</div>
                </div>
                <div className="bg-secondary/30 rounded-lg p-3 text-center">
                  <div className="text-lg font-bold text-foreground">
                    {downloadStats.limits.maxQuality === 'unlimited' ? '8K' : `${downloadStats.limits.maxQuality}p`}
                  </div>
                  <div className="text-xs text-muted-foreground">Max Quality</div>
                </div>
                <div className="bg-secondary/30 rounded-lg p-3 text-center">
                  <div className="text-lg font-bold text-foreground">
                    {downloadStats.limits.maxConcurrent}
                  </div>
                  <div className="text-xs text-muted-foreground">Concurrent</div>
                </div>
              </div>
            )}

            {/* License key input (for activation) */}
            {!licenseState.activated ? (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-muted-foreground mb-1.5">License Key</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="text"
                      value={licenseKey}
                      onChange={(e) => setLicenseKey(e.target.value.toUpperCase())}
                      placeholder="GT-XXXX-XXXX-XXXX-XXXX"
                      className="flex-1 px-4 py-2.5 bg-secondary/50 border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all font-mono tracking-wider"
                      maxLength={22}
                    />
                    <button
                      onClick={handleActivateLicense}
                      disabled={licenseLoading || !licenseKey.trim()}
                      className={cn(
                        'px-4 py-2.5 rounded-xl text-sm font-medium transition-all flex-shrink-0',
                        licenseLoading || !licenseKey.trim()
                          ? 'bg-secondary/50 text-muted-foreground cursor-not-allowed'
                          : 'bg-primary text-primary-foreground hover:bg-primary/90'
                      )}
                    >
                      {licenseLoading ? 'Activating...' : 'Activate'}
                    </button>
                  </div>
                </div>

                {/* Upgrade CTA */}
                <div className="p-3 bg-primary/5 border border-primary/20 rounded-xl">
                  <p className="text-xs text-muted-foreground">
                    <strong className="text-primary">Upgrade to Pro ($14.99)</strong> for unlimited downloads, 8K quality, batch/playlist support, and faster downloads.
                    <strong className="text-primary"> Family ($29.99)</strong> includes all Pro features for up to 3 devices.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleDeactivateLicense}
                    disabled={licenseLoading}
                    className="px-4 py-2 bg-destructive/10 text-destructive rounded-xl text-sm font-medium hover:bg-destructive/20 transition-all"
                  >
                    {licenseLoading ? 'Processing...' : 'Remove License'}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Remove your current license key to deactivate this device. You can then activate a new or different license key anytime.
                </p>

                {/* Change key section */}
                <div className="pt-3 border-t border-border">
                  <label className="block text-xs text-muted-foreground mb-1.5">Switch to a Different Key</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="text"
                      value={licenseKey}
                      onChange={(e) => setLicenseKey(e.target.value.toUpperCase())}
                      placeholder="GT-XXXX-XXXX-XXXX-XXXX"
                      className="flex-1 px-4 py-2.5 bg-secondary/50 border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all font-mono tracking-wider"
                      maxLength={22}
                    />
                    <button
                      onClick={handleChangeLicense}
                      disabled={licenseLoading || !licenseKey.trim()}
                      className={cn(
                        'px-4 py-2.5 rounded-xl text-sm font-medium transition-all flex-shrink-0',
                        licenseLoading || !licenseKey.trim()
                          ? 'bg-secondary/50 text-muted-foreground cursor-not-allowed'
                          : 'bg-primary text-primary-foreground hover:bg-primary/90'
                      )}
                    >
                      {licenseLoading ? 'Switching...' : 'Switch Key'}
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1.5">
                    This will deactivate your current key and activate the new one in one step.
                  </p>
                </div>
              </div>
            )}

            {/* License message */}
            {licenseMessage && (
              <div className={cn(
                'mt-3 p-3 rounded-xl text-xs flex items-center gap-2',
                licenseMessage.type === 'success'
                  ? 'bg-green-500/10 border border-green-500/20 text-green-500'
                  : 'bg-destructive/10 border border-destructive/20 text-destructive'
              )}>
                {licenseMessage.type === 'success' ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
                {licenseMessage.text}
              </div>
            )}
          </section>

          {/* Download Path */}
          <section className="bg-card border border-border rounded-xl p-5 hover-lift transition-all duration-200 animate-slide-in stagger-1">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground mb-4">
              <FolderOpen size={16} className="text-primary" />
              Download Location
              <span className="relative group ml-auto">
                <Info size={14} className="text-muted-foreground cursor-help hover:text-primary transition-colors" />
                <span className="absolute right-0 top-6 z-50 w-56 p-2.5 bg-card border border-border rounded-lg shadow-xl text-xs text-muted-foreground opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 pointer-events-none">
                  Choose where downloaded videos and audio files are saved on your computer.
                </span>
              </span>
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
          <section className="bg-card border border-border rounded-xl p-5 hover-lift transition-all duration-200 animate-slide-in stagger-2">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground mb-4">
              <Palette size={16} className="text-primary" />
              Appearance
              <span className="relative group ml-auto">
                <Info size={14} className="text-muted-foreground cursor-help hover:text-primary transition-colors" />
                <span className="absolute right-0 top-6 z-50 w-56 p-2.5 bg-card border border-border rounded-lg shadow-xl text-xs text-muted-foreground opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 pointer-events-none">
                  Switch between dark and light themes. Dark mode is easier on the eyes.
                </span>
              </span>
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
          <section className="bg-card border border-border rounded-xl p-5 hover-lift transition-all duration-200 animate-slide-in stagger-3">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground mb-4">
              <Globe size={16} className="text-primary" />
              Proxy Settings
              <span className="relative group ml-auto">
                <Info size={14} className="text-muted-foreground cursor-help hover:text-primary transition-colors" />
                <span className="absolute right-0 top-6 z-50 w-64 p-2.5 bg-card border border-border rounded-lg shadow-xl text-xs text-muted-foreground opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 pointer-events-none">
                  Route downloads through a proxy server. Use HTTP/HTTPS for web proxies or SOCKS5 for full tunneling. Only needed if downloads are blocked in your region.
                </span>
              </span>
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
          <section className="bg-card border border-border rounded-xl p-5 hover-lift transition-all duration-200 animate-slide-in stagger-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground mb-4">
              <Cookie size={16} className="text-primary" />
              Cookie Authentication
              <span className="relative group ml-auto">
                <Info size={14} className="text-muted-foreground cursor-help hover:text-primary transition-colors" />
                <span className="absolute right-0 top-6 z-50 w-64 p-2.5 bg-card border border-border rounded-lg shadow-xl text-xs text-muted-foreground opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 pointer-events-none">
                  Cookies let GrabTube access content requiring login (Instagram, Facebook, age-restricted YouTube). Auto-detect reads from your browser; manual import uses a cookies.txt file.
                </span>
              </span>
            </h3>
            <p className="text-xs text-muted-foreground mb-4">
              Some platforms (Instagram, Reddit, Facebook, Twitter) require login cookies to download videos.
              You can import a cookies.txt file or extract cookies from your browser.
            </p>

            {/* Guided Cookie Export Flow */}
            <div className="mb-4 p-3 bg-primary/5 border border-primary/20 rounded-xl">
              <h4 className="text-xs font-semibold text-primary mb-2 flex items-center gap-1.5">
                <ExternalLink size={12} />
                Recommended: Export Cookies (Most Reliable)
              </h4>
              <ol className="text-xs text-muted-foreground space-y-1.5 ml-4 list-decimal">
                <li>Install the <strong>&quot;Get cookies.txt LOCALLY&quot;</strong> browser extension
                  <span className="text-primary/70"> (Chrome Web Store / Firefox Add-ons)</span></li>
                <li>Go to <strong>youtube.com</strong> and make sure you are <strong>logged in</strong></li>
                <li>Click the extension icon and click <strong>&quot;Export&quot;</strong> to save <code className="bg-secondary/50 px-1 rounded">cookies.txt</code></li>
                <li>Click <strong>&quot;Import&quot;</strong> below and select the exported file</li>
              </ol>
              <p className="text-xs text-muted-foreground mt-2 italic">
                This method works 100% reliably even when Chrome/Edge lock their cookie database.
                The exported file works forever until you log out of YouTube.
              </p>
            </div>

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
                Extract Cookies from Browser (Auto-detect)
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
                Firefox is recommended. Chrome/Edge may fail with &quot;Could not copy cookie database&quot; while the browser is open.
                Use the cookies.txt export method above for 100% reliability.
              </p>
            </div>
          </section>

          {/* YouTube Authentication Notice */}
          <section className="bg-card border border-border rounded-xl p-5 hover-lift transition-all duration-200 animate-slide-in">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground mb-4">
              <Key size={16} className="text-primary" />
              YouTube Authentication
              <span className="relative group ml-auto">
                <Info size={14} className="text-muted-foreground cursor-help hover:text-primary transition-colors" />
                <span className="absolute right-0 top-6 z-50 w-64 p-2.5 bg-card border border-border rounded-lg shadow-xl text-xs text-muted-foreground opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 pointer-events-none">
                  YouTube no longer supports OAuth2 login. Use browser cookies or a cookies.txt file instead for authenticated access.
                </span>
              </span>
            </h3>
            <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-xl">
              <div className="flex items-start gap-2">
                <AlertCircle size={16} className="text-yellow-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-yellow-500 mb-1">OAuth2 Login Deprecated</p>
                  <p className="text-xs text-muted-foreground">
                    YouTube/yt-dlp no longer supports OAuth2 authentication. Use one of these methods instead:
                  </p>
                  <ul className="text-xs text-muted-foreground mt-2 space-y-1 ml-3 list-disc">
                    <li><strong>Browser Cookies (Recommended)</strong> — Select your browser above in the Cookie Authentication section. GrabTube will automatically use your logged-in YouTube session.</li>
                    <li><strong>Cookies.txt File</strong> — Export cookies using a browser extension and import the file above.</li>
                  </ul>
                  <p className="text-xs text-muted-foreground mt-2 italic">
                    GrabTube already auto-detects your browser cookies during the Setup Wizard, so most users don&apos;t need to do anything extra.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Cobalt API Fallback */}
          <section className="bg-card border border-border rounded-xl p-5 hover-lift transition-all duration-200 animate-slide-in">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground mb-4">
              <Cloud size={16} className="text-primary" />
              Cobalt API Fallback
              <span className="relative group ml-auto">
                <Info size={14} className="text-muted-foreground cursor-help hover:text-primary transition-colors" />
                <span className="absolute right-0 top-6 z-50 w-64 p-2.5 bg-card border border-border rounded-lg shadow-xl text-xs text-muted-foreground opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 pointer-events-none">
                  Cobalt is an open-source service used as a last resort when all local methods fail. Downloads route through Cobalt's clean server IPs to bypass blocks.
                </span>
              </span>
            </h3>
            <p className="text-xs text-muted-foreground mb-4">
              When all local download methods fail, GrabTube can try downloading via cobalt.tools as a last resort.
              Cobalt is an open-source media downloader that routes through clean server IPs.
            </p>
            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-sm text-foreground">Enable Cobalt fallback</span>
              <input
                type="checkbox"
                checked={cobaltEnabled}
                onChange={(e) => handleCobaltToggle(e.target.checked)}
                className="w-4 h-4 rounded accent-primary"
              />
            </label>
          </section>

          {/* Download Preferences */}
          <section className="bg-card border border-border rounded-xl p-5 hover-lift transition-all duration-200 animate-slide-in stagger-5">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground mb-4">
              <Shield size={16} className="text-primary" />
              Download Preferences
              <span className="relative group ml-auto">
                <Info size={14} className="text-muted-foreground cursor-help hover:text-primary transition-colors" />
                <span className="absolute right-0 top-6 z-50 w-64 p-2.5 bg-card border border-border rounded-lg shadow-xl text-xs text-muted-foreground opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 pointer-events-none">
                  Set concurrent download limits (higher = faster but uses more bandwidth), default audio format, and options to embed thumbnails/subtitles into downloaded files.
                </span>
              </span>
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
          <section className="bg-card border border-border rounded-xl p-5 hover-lift transition-all duration-200 animate-slide-in">
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

          {/* Auto Updates */}
          <section className="bg-card border border-border rounded-xl p-5 hover-lift transition-all duration-200 animate-slide-in">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground mb-4">
              <Download size={16} className="text-primary" />
              Auto Updates
              <span className="relative group ml-auto">
                <Info size={14} className="text-muted-foreground cursor-help hover:text-primary transition-colors" />
                <span className="absolute right-0 top-6 z-50 w-64 p-2.5 bg-card border border-border rounded-lg shadow-xl text-xs text-muted-foreground opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 pointer-events-none">
                  GrabTube automatically keeps everything up to date. App updates install on restart. yt-dlp updates daily to stay ahead of website changes. FFmpeg updates weekly.
                </span>
              </span>
            </h3>
            <p className="text-xs text-muted-foreground mb-4">
              GrabTube automatically checks for app and binary updates. App updates install on restart.
              yt-dlp is checked daily, FFmpeg and POT provider weekly.
            </p>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-foreground">App Update</span>
                <button
                  onClick={async () => {
                    const result = await api.checkForUpdates();
                    if (result?.available) {
                      alert(`Update available: v${result.version}. It will download automatically.`);
                    } else {
                      alert('App is up to date!');
                    }
                  }}
                  className="px-3 py-1.5 bg-secondary/50 border border-border rounded-lg text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5"
                >
                  <RefreshCw size={12} />
                  Check Now
                </button>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-foreground">Binary Updates (yt-dlp, FFmpeg, POT)</span>
                <button
                  onClick={async () => {
                    await api.checkBinaryUpdates();
                    alert('Binary update check started. Updates download in background.');
                  }}
                  className="px-3 py-1.5 bg-secondary/50 border border-border rounded-lg text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5"
                >
                  <RefreshCw size={12} />
                  Update All
                </button>
              </div>
            </div>
          </section>

          {/* Ban Prevention / Account Protection */}
          <section className="bg-card border border-border rounded-xl p-5 hover-lift transition-all duration-200 animate-slide-in">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground mb-4">
              <ShieldAlert size={16} className="text-primary" />
              Account Protection
              <span className="relative group ml-auto">
                <Info size={14} className="text-muted-foreground cursor-help hover:text-primary transition-colors" />
                <span className="absolute right-0 top-6 z-50 w-72 p-2.5 bg-card border border-border rounded-lg shadow-xl text-xs text-muted-foreground opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 pointer-events-none">
                  Proactive ban prevention system. Tracks downloads per platform, warns before hitting risky thresholds, auto-switches to cookieless mode, adds random delays between requests, and enforces cooldowns to protect your accounts.
                </span>
              </span>
            </h3>

            {/* Toggle switches */}
            <div className="space-y-3 mb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Shield size={14} className="text-muted-foreground" />
                  <span className="text-sm text-foreground">Ban Prevention</span>
                </div>
                <button
                  onClick={async () => {
                    const newVal = !banPreventionEnabled;
                    await api.setBanPreventionEnabled(newVal);
                    setBanPreventionEnabled(newVal);
                  }}
                  className={cn(
                    'w-10 h-5 rounded-full transition-colors relative',
                    banPreventionEnabled ? 'bg-primary' : 'bg-secondary'
                  )}
                >
                  <div className={cn(
                    'w-4 h-4 bg-white rounded-full absolute top-0.5 transition-transform',
                    banPreventionEnabled ? 'translate-x-5' : 'translate-x-0.5'
                  )} />
                </button>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Shuffle size={14} className="text-muted-foreground" />
                  <span className="text-sm text-foreground">Random Delays</span>
                  <span className="text-xs text-muted-foreground">(human-like behavior)</span>
                </div>
                <button
                  onClick={async () => {
                    const newVal = !randomDelayEnabled;
                    await api.setRandomDelayEnabled(newVal);
                    setRandomDelayEnabled(newVal);
                  }}
                  className={cn(
                    'w-10 h-5 rounded-full transition-colors relative',
                    randomDelayEnabled ? 'bg-primary' : 'bg-secondary'
                  )}
                >
                  <div className={cn(
                    'w-4 h-4 bg-white rounded-full absolute top-0.5 transition-transform',
                    randomDelayEnabled ? 'translate-x-5' : 'translate-x-0.5'
                  )} />
                </button>
              </div>
            </div>

            {/* Global risk indicator */}
            {banStatus && (
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className={cn(
                    'w-2.5 h-2.5 rounded-full',
                    banStatus.globalRiskLevel === 'safe' ? 'bg-green-500' :
                    banStatus.globalRiskLevel === 'warning' ? 'bg-yellow-500 animate-pulse' :
                    'bg-red-500 animate-pulse'
                  )} />
                  <span className={cn(
                    'text-xs font-medium uppercase tracking-wider',
                    banStatus.globalRiskLevel === 'safe' ? 'text-green-500' :
                    banStatus.globalRiskLevel === 'warning' ? 'text-yellow-500' :
                    'text-red-500'
                  )}>
                    {banStatus.globalRiskLevel === 'safe' ? 'All Clear' :
                     banStatus.globalRiskLevel === 'warning' ? 'Approaching Limits' :
                     'High Risk - Cookieless Mode Active'}
                  </span>
                  {banStatus.activeCooldowns > 0 && (
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Timer size={10} /> {banStatus.activeCooldowns} cooldown(s)
                    </span>
                  )}
                </div>

                {/* Per-platform stats */}
                {Object.keys(banStatus.platforms).length > 0 ? (
                  <div className="space-y-2">
                    {Object.entries(banStatus.platforms).map(([name, stats]) => (
                      <div key={name} className="flex items-center gap-3 p-2.5 bg-secondary/30 rounded-lg">
                        <div className={cn(
                          'w-2 h-2 rounded-full flex-shrink-0',
                          stats.riskLevel === 'safe' ? 'bg-green-500' :
                          stats.riskLevel === 'warning' ? 'bg-yellow-500' :
                          'bg-red-500'
                        )} />
                        <span className="text-sm text-foreground capitalize w-20 flex-shrink-0">{name}</span>
                        <div className="flex-1">
                          {/* Progress bar */}
                          <div className="w-full h-1.5 bg-secondary rounded-full overflow-hidden">
                            <div
                              className={cn(
                                'h-full rounded-full transition-all duration-500',
                                stats.riskLevel === 'safe' ? 'bg-green-500' :
                                stats.riskLevel === 'warning' ? 'bg-yellow-500' :
                                'bg-red-500'
                              )}
                              style={{ width: `${Math.min((stats.downloadsThisHour / 80) * 100, 100)}%` }}
                            />
                          </div>
                        </div>
                        <span className="text-xs text-muted-foreground w-16 text-right">{stats.downloadsThisHour}/hr</span>
                        <span className="text-xs text-muted-foreground w-16 text-right">{stats.downloadsToday} today</span>
                        {stats.cookielessMode && (
                          <span className="text-xs text-yellow-500 bg-yellow-500/10 px-1.5 py-0.5 rounded">cookieless</span>
                        )}
                        <button
                          onClick={async () => {
                            await api.resetBanPreventionPlatform(name);
                            loadBanStatus();
                          }}
                          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                          title="Reset counters"
                        >
                          <RefreshCw size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">No downloads tracked yet. Stats will appear as you download.</p>
                )}
              </div>
            )}

            {/* Reset all button */}
            <div className="flex items-center justify-between pt-3 border-t border-border">
              <span className="text-xs text-muted-foreground">Reset all platform counters and cookieless modes</span>
              <button
                onClick={async () => {
                  await api.resetBanPreventionAll();
                  loadBanStatus();
                }}
                className="px-3 py-1.5 bg-secondary/50 border border-border rounded-lg text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5"
              >
                <RefreshCw size={12} />
                Reset All
              </button>
            </div>
          </section>

          {/* Health Monitor */}
          <section className="bg-card border border-border rounded-xl p-5 hover-lift transition-all duration-200 animate-slide-in">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground mb-4">
              <Activity size={16} className="text-primary" />
              Health Monitor
              <span className="relative group ml-auto">
                <Info size={14} className="text-muted-foreground cursor-help hover:text-primary transition-colors" />
                <span className="absolute right-0 top-6 z-50 w-64 p-2.5 bg-card border border-border rounded-lg shadow-xl text-xs text-muted-foreground opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 pointer-events-none">
                  Monitors all system components and auto-heals issues. Re-downloads corrupted binaries, updates failed extractors, and restarts the POT provider if needed.
                </span>
              </span>
            </h3>
            <p className="text-xs text-muted-foreground mb-4">
              Self-healing system monitors for failures and auto-fixes common issues.
              Corrupted binaries are re-downloaded, failed extractors trigger yt-dlp updates,
              and POT token failures restart the provider.
            </p>
            <div className="flex items-center justify-between">
              <span className="text-sm text-foreground">Run Health Check</span>
              <button
                onClick={async () => {
                  const statuses = await api.runHealthCheck();
                  const summary = statuses.map((s: { component: string; status: string; message: string }) =>
                    `${s.component}: ${s.status} - ${s.message}`
                  ).join('\n');
                  alert(summary || 'Health check complete. All systems healthy.');
                }}
                className="px-3 py-1.5 bg-secondary/50 border border-border rounded-lg text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5"
              >
                <Wrench size={12} />
                Check Now
              </button>
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
