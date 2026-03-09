import React, { useState } from 'react';
import { AlertTriangle, Loader2, CheckCircle, X, Globe } from 'lucide-react';
import { api } from '../lib/ipc';

interface CookieBlockModalProps {
  onDismiss: () => void;
  onVerified: () => void;
}

export const CookieBlockModal: React.FC<CookieBlockModalProps> = ({ onDismiss, onVerified }) => {
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleVerify = async () => {
    setVerifying(true);
    setError(null);
    try {
      const result = await api.verifyBrowserCookies();
      if (result.success) {
        onVerified();
      } else {
        setError(result.error || 'Browser cookies not found. Please log in to YouTube in your browser first.');
      }
    } catch {
      setError('Verification failed. Please try again.');
    }
    setVerifying(false);
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center animate-fade-in">
      <div className="max-w-md w-full mx-4 bg-card border border-border rounded-2xl p-6 animate-scale-in shadow-2xl">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-destructive/10 rounded-xl flex items-center justify-center">
              <AlertTriangle size={22} className="text-destructive" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-foreground">Browser Login Required</h3>
              <p className="text-xs text-muted-foreground">YouTube requires authentication</p>
            </div>
          </div>
          <button
            onClick={onDismiss}
            className="p-1 text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-secondary/50"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground leading-relaxed">
            YouTube is blocking this download because no browser cookies were found.
            To fix this:
          </p>

          <div className="bg-secondary/30 rounded-xl p-4 space-y-2.5">
            <div className="flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">1</span>
              <p className="text-sm text-foreground">Open <span className="font-medium text-primary">youtube.com</span> in Chrome, Firefox, or Edge</p>
            </div>
            <div className="flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">2</span>
              <p className="text-sm text-foreground">Sign in to your Google account</p>
            </div>
            <div className="flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">3</span>
              <p className="text-sm text-foreground">Click <span className="font-medium text-primary">&quot;I&apos;ve Logged In&quot;</span> below</p>
            </div>
          </div>

          {error && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-3 flex items-start gap-2">
              <AlertTriangle size={14} className="text-destructive flex-shrink-0 mt-0.5" />
              <p className="text-xs text-destructive">{error}</p>
            </div>
          )}

          <div className="flex items-center gap-3">
            <button
              onClick={handleVerify}
              disabled={verifying}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:bg-primary/90 transition-all duration-200 hover-glow disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {verifying ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Checking...
                </>
              ) : (
                <>
                  <Globe size={16} />
                  I&apos;ve Logged In
                </>
              )}
            </button>
            <button
              onClick={onDismiss}
              className="px-4 py-2.5 text-sm text-muted-foreground hover:text-foreground transition-colors rounded-xl hover:bg-secondary/50"
            >
              Cancel
            </button>
          </div>

          <p className="text-xs text-muted-foreground/60 text-center">
            GrabTube reads cookies directly from your browser — no data is sent anywhere.
          </p>
        </div>
      </div>
    </div>
  );
};
