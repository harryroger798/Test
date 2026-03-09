import React, { useState, useEffect } from 'react';
import { Globe, CheckCircle, XCircle, Loader2, ArrowRight, Shield } from 'lucide-react';
import { api } from '../lib/ipc';

interface BrowserInfo {
  name: string;
  installed: boolean;
}

interface SetupWizardProps {
  onComplete: () => void;
}

export const SetupWizard: React.FC<SetupWizardProps> = ({ onComplete }) => {
  const [step, setStep] = useState<'welcome' | 'detect' | 'verify' | 'done'>('welcome');
  const [browsers, setBrowsers] = useState<BrowserInfo[]>([]);
  const [verifying, setVerifying] = useState(false);
  const [verifiedBrowser, setVerifiedBrowser] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (step === 'detect') {
      api.detectBrowsers().then((result) => {
        setBrowsers(result);
      });
    }
  }, [step]);

  const handleVerify = async () => {
    setVerifying(true);
    setError(null);
    try {
      const result = await api.verifyBrowserCookies();
      if (result.success && result.browser) {
        setVerifiedBrowser(result.browser);
        setStep('done');
      } else {
        setError(result.error || 'Could not verify browser cookies. Please log in to YouTube in your browser and try again.');
      }
    } catch {
      setError('Verification failed. Please ensure you are logged in to YouTube in at least one browser.');
    }
    setVerifying(false);
  };

  const handleSkip = async () => {
    await api.setSetupComplete();
    onComplete();
  };

  const handleFinish = async () => {
    await api.setSetupComplete();
    onComplete();
  };

  const browserDisplayNames: Record<string, string> = {
    firefox: 'Mozilla Firefox',
    chrome: 'Google Chrome',
    edge: 'Microsoft Edge',
    brave: 'Brave Browser',
    opera: 'Opera',
    vivaldi: 'Vivaldi',
  };

  return (
    <div className="fixed inset-0 bg-background z-50 flex items-center justify-center">
      <div className="max-w-lg w-full mx-4 animate-scale-in">
        {/* Welcome Step */}
        {step === 'welcome' && (
          <div className="text-center space-y-6">
            <div className="w-20 h-20 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto animate-bounce-subtle">
              <Shield size={40} className="text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-foreground mb-2">Welcome to GrabTube</h1>
              <p className="text-muted-foreground text-sm leading-relaxed max-w-md mx-auto">
                To download YouTube videos reliably, GrabTube needs access to your browser cookies.
                This is a one-time setup that takes less than a minute.
              </p>
            </div>
            <div className="bg-card border border-border rounded-xl p-4 text-left space-y-3">
              <h3 className="text-sm font-semibold text-foreground">What you need to do:</h3>
              <div className="space-y-2">
                <div className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">1</span>
                  <p className="text-sm text-muted-foreground">Open YouTube in any browser (Chrome, Firefox, Edge, etc.)</p>
                </div>
                <div className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">2</span>
                  <p className="text-sm text-muted-foreground">Sign in to your YouTube/Google account</p>
                </div>
                <div className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">3</span>
                  <p className="text-sm text-muted-foreground">Come back here and click &quot;Verify&quot; — GrabTube does the rest automatically</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3 justify-center">
              <button
                onClick={() => setStep('detect')}
                className="flex items-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:bg-primary/90 transition-all duration-200 hover-glow"
              >
                Get Started
                <ArrowRight size={16} />
              </button>
              <button
                onClick={handleSkip}
                className="px-4 py-2.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Skip for now
              </button>
            </div>
          </div>
        )}

        {/* Detect Browsers Step */}
        {step === 'detect' && (
          <div className="text-center space-y-6">
            <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto">
              <Globe size={32} className="text-primary" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-foreground mb-2">Detected Browsers</h2>
              <p className="text-muted-foreground text-sm">
                GrabTube found these browsers on your system. Make sure you&apos;re logged in to YouTube in at least one.
              </p>
            </div>

            <div className="space-y-2">
              {browsers.filter((b) => b.installed).map((browser) => (
                <div
                  key={browser.name}
                  className="bg-card border border-border rounded-xl p-3 flex items-center gap-3 animate-slide-in"
                >
                  <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
                    <CheckCircle size={18} className="text-primary" />
                  </div>
                  <span className="text-sm font-medium text-foreground">
                    {browserDisplayNames[browser.name] || browser.name}
                  </span>
                  <span className="ml-auto text-xs text-primary font-medium">Installed</span>
                </div>
              ))}
              {browsers.filter((b) => !b.installed).length > 0 && (
                <div className="text-xs text-muted-foreground mt-2">
                  Not found: {browsers.filter((b) => !b.installed).map((b) => browserDisplayNames[b.name] || b.name).join(', ')}
                </div>
              )}
            </div>

            {browsers.filter((b) => b.installed).length === 0 && browsers.length > 0 && (
              <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-3">
                <p className="text-sm text-destructive">
                  No supported browsers found. Please install Chrome, Firefox, or Edge and log in to YouTube.
                </p>
              </div>
            )}

            {error && (
              <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-3 flex items-start gap-2">
                <XCircle size={16} className="text-destructive flex-shrink-0 mt-0.5" />
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}

            <div className="flex items-center gap-3 justify-center">
              <button
                onClick={handleVerify}
                disabled={verifying || browsers.filter((b) => b.installed).length === 0}
                className="flex items-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:bg-primary/90 transition-all duration-200 hover-glow disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {verifying ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Verifying...
                  </>
                ) : (
                  <>
                    <CheckCircle size={16} />
                    Verify Cookies
                  </>
                )}
              </button>
              <button
                onClick={handleSkip}
                className="px-4 py-2.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Skip
              </button>
            </div>
          </div>
        )}

        {/* Done Step */}
        {step === 'done' && (
          <div className="text-center space-y-6 animate-scale-in">
            <div className="w-20 h-20 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto">
              <CheckCircle size={40} className="text-primary" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-foreground mb-2">You&apos;re All Set!</h2>
              <p className="text-muted-foreground text-sm">
                GrabTube verified your cookies from <span className="text-primary font-semibold">{browserDisplayNames[verifiedBrowser || ''] || verifiedBrowser}</span>.
                Downloads will now work reliably.
              </p>
            </div>
            <button
              onClick={handleFinish}
              className="flex items-center gap-2 px-8 py-3 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:bg-primary/90 transition-all duration-200 hover-glow mx-auto"
            >
              Start Using GrabTube
              <ArrowRight size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
