// Share Button Component (Mobile Optimization #44)
// Uses Web Share API with fallback

import { useState } from 'react';
import { Share2, Copy, Check, Twitter, Linkedin, Facebook, Mail } from 'lucide-react';
import { shareContent, canShare } from '@/lib/mobile';
import { cn } from '@/lib/utils';
import { Button } from './button';

interface ShareButtonProps {
  title: string;
  text?: string;
  url?: string;
  className?: string;
  variant?: 'default' | 'icon' | 'full';
}

export function ShareButton({
  title,
  text,
  url = window.location.href,
  className,
  variant = 'default',
}: ShareButtonProps) {
  const [copied, setCopied] = useState(false);
  const [showFallback, setShowFallback] = useState(false);

  const handleShare = async () => {
    if (canShare()) {
      const success = await shareContent({ title, text, url });
      if (!success) {
        setShowFallback(true);
      }
    } else {
      setShowFallback(true);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = url;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const shareLinks = [
    {
      name: 'X',
      icon: Twitter,
      url: `https://x.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`,
    },
    {
      name: 'LinkedIn',
      icon: Linkedin,
      url: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
    },
    {
      name: 'Facebook',
      icon: Facebook,
      url: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
    },
    {
      name: 'Email',
      icon: Mail,
      url: `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(text || '')}%0A%0A${encodeURIComponent(url)}`,
    },
  ];

  if (variant === 'icon') {
    return (
      <button
        onClick={handleShare}
        className={cn(
          'touch-target flex items-center justify-center text-gray-400 hover:text-white transition',
          className
        )}
        aria-label="Share"
      >
        <Share2 className="w-5 h-5" />
      </button>
    );
  }

  return (
    <div className={cn('relative', className)}>
      <Button
        onClick={handleShare}
        variant="outline"
        className="gap-2"
      >
        <Share2 className="w-4 h-4" />
        {variant === 'full' && 'Share'}
      </Button>

      {/* Fallback Share Menu */}
      {showFallback && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowFallback(false)}
          />
          <div className="absolute right-0 top-full mt-2 w-64 bg-[#1a1a1a] border border-white/10 rounded-xl shadow-xl z-50 overflow-hidden">
            <div className="p-3 border-b border-white/10">
              <p className="text-sm text-gray-400 mb-2">Share via</p>
              <div className="flex gap-2">
                {shareLinks.map((link) => (
                  <a
                    key={link.name}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="touch-target flex items-center justify-center w-10 h-10 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition"
                    aria-label={`Share on ${link.name}`}
                  >
                    <link.icon className="w-5 h-5" />
                  </a>
                ))}
              </div>
            </div>
            <div className="p-3">
              <p className="text-sm text-gray-400 mb-2">Or copy link</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={url}
                  readOnly
                  className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white truncate"
                />
                <button
                  onClick={handleCopy}
                  className="touch-target flex items-center justify-center px-3 bg-emerald-500 hover:bg-emerald-600 text-black rounded-lg transition"
                >
                  {copied ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default ShareButton;
