import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatFileSize(bytes: number | null): string {
  if (!bytes) return 'Unknown';
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  return `${size.toFixed(1)} ${units[unitIndex]}`;
}

export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${minutes}:${String(secs).padStart(2, '0')}`;
}

export function formatViews(count: number): string {
  if (!count) return '';
  if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M views`;
  if (count >= 1000) return `${(count / 1000).toFixed(1)}K views`;
  return `${count} views`;
}

export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

export function detectPlatformFromUrl(url: string): string {
  const lowered = url.toLowerCase();
  if (lowered.includes('youtube.com') || lowered.includes('youtu.be')) return 'youtube';
  if (lowered.includes('tiktok.com')) return 'tiktok';
  if (lowered.includes('instagram.com')) return 'instagram';
  if (lowered.includes('twitter.com') || lowered.includes('x.com')) return 'twitter';
  if (lowered.includes('facebook.com') || lowered.includes('fb.watch')) return 'facebook';
  if (lowered.includes('reddit.com')) return 'reddit';
  if (lowered.includes('vimeo.com')) return 'vimeo';
  if (lowered.includes('twitch.tv')) return 'twitch';
  if (lowered.includes('dailymotion.com')) return 'dailymotion';
  if (lowered.includes('soundcloud.com')) return 'soundcloud';
  if (lowered.includes('bilibili.com')) return 'bilibili';
  if (lowered.includes('pinterest.com')) return 'pinterest';
  if (lowered.includes('linkedin.com')) return 'linkedin';
  if (lowered.includes('rumble.com')) return 'rumble';
  return 'unknown';
}

export const PLATFORM_COLORS: Record<string, string> = {
  youtube: '#FF0000',
  tiktok: '#000000',
  instagram: '#E4405F',
  twitter: '#1DA1F2',
  facebook: '#1877F2',
  reddit: '#FF4500',
  vimeo: '#1AB7EA',
  twitch: '#9146FF',
  dailymotion: '#0066DC',
  soundcloud: '#FF3300',
  bilibili: '#00A1D6',
  pinterest: '#E60023',
  linkedin: '#0A66C2',
  rumble: '#85C742',
  unknown: '#6366F1',
};

export const PLATFORM_NAMES: Record<string, string> = {
  youtube: 'YouTube',
  tiktok: 'TikTok',
  instagram: 'Instagram',
  twitter: 'Twitter/X',
  facebook: 'Facebook',
  reddit: 'Reddit',
  vimeo: 'Vimeo',
  twitch: 'Twitch',
  dailymotion: 'Dailymotion',
  soundcloud: 'SoundCloud',
  bilibili: 'Bilibili',
  pinterest: 'Pinterest',
  linkedin: 'LinkedIn',
  rumble: 'Rumble',
  unknown: 'Website',
};
