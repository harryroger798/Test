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
  // Tier 1: Major platforms
  if (lowered.includes('youtube.com') || lowered.includes('youtu.be')) return 'youtube';
  if (lowered.includes('tiktok.com')) return 'tiktok';
  if (lowered.includes('instagram.com')) return 'instagram';
  if (lowered.includes('twitter.com') || lowered.includes('x.com')) return 'twitter';
  if (lowered.includes('facebook.com') || lowered.includes('fb.watch')) return 'facebook';
  // Tier 2: Popular platforms
  if (lowered.includes('reddit.com')) return 'reddit';
  if (lowered.includes('vimeo.com')) return 'vimeo';
  if (lowered.includes('twitch.tv')) return 'twitch';
  if (lowered.includes('dailymotion.com')) return 'dailymotion';
  if (lowered.includes('soundcloud.com')) return 'soundcloud';
  if (lowered.includes('bilibili.com')) return 'bilibili';
  if (lowered.includes('pinterest.com') || lowered.includes('pin.it')) return 'pinterest';
  if (lowered.includes('linkedin.com')) return 'linkedin';
  // Tier 3: Niche but popular
  if (lowered.includes('rumble.com')) return 'rumble';
  if (lowered.includes('bandcamp.com')) return 'bandcamp';
  if (lowered.includes('bitchute.com')) return 'bitchute';
  if (lowered.includes('archive.org')) return 'archive';
  if (lowered.includes('ok.ru') || lowered.includes('odnoklassniki.ru')) return 'odnoklassniki';
  if (lowered.includes('rutube.ru')) return 'rutube';
  if (lowered.includes('nicovideo.jp') || lowered.includes('nico.ms')) return 'nicovideo';
  if (lowered.includes('pornhub.com')) return 'pornhub';
  if (lowered.includes('naver.com') || lowered.includes('tv.naver.com')) return 'naver';
  if (lowered.includes('vlive.tv')) return 'vlive';
  if (lowered.includes('weibo.com')) return 'weibo';
  if (lowered.includes('iqiyi.com')) return 'iqiyi';
  if (lowered.includes('youku.com')) return 'youku';
  if (lowered.includes('lbry.tv') || lowered.includes('odysee.com')) return 'lbry';
  if (lowered.includes('peertube')) return 'peertube';
  if (lowered.includes('dropbox.com')) return 'dropbox';
  if (lowered.includes('mixcloud.com')) return 'mixcloud';
  if (lowered.includes('streamable.com')) return 'streamable';
  if (lowered.includes('ted.com')) return 'ted';
  if (lowered.includes('imdb.com')) return 'imdb';
  if (lowered.includes('crunchyroll.com')) return 'crunchyroll';
  if (lowered.includes('tumblr.com')) return 'tumblr';
  if (lowered.includes('flickr.com')) return 'flickr';
  if (lowered.includes('9gag.com')) return '9gag';
  if (lowered.includes('spotify.com')) return 'spotify';
  if (lowered.includes('vk.com') || lowered.includes('vk.video')) return 'vk';
  // For any other URL that yt-dlp supports, extract the domain as a readable name
  return 'unknown';
}

export const PLATFORM_COLORS: Record<string, string> = {
  // Tier 1
  youtube: '#FF0000',
  tiktok: '#000000',
  instagram: '#E4405F',
  twitter: '#1DA1F2',
  facebook: '#1877F2',
  // Tier 2
  reddit: '#FF4500',
  vimeo: '#1AB7EA',
  twitch: '#9146FF',
  dailymotion: '#0066DC',
  soundcloud: '#FF3300',
  bilibili: '#00A1D6',
  pinterest: '#E60023',
  linkedin: '#0A66C2',
  // Tier 3
  rumble: '#85C742',
  bandcamp: '#629AA9',
  bitchute: '#EF4444',
  archive: '#428BCA',
  odnoklassniki: '#EE8208',
  rutube: '#1D1D1D',
  nicovideo: '#252525',
  pornhub: '#FFA31A',
  naver: '#03CF5D',
  vlive: '#1ECFB6',
  weibo: '#E6162D',
  iqiyi: '#00BE06',
  youku: '#1E88E5',
  lbry: '#2F9176',
  peertube: '#F1680D',
  dropbox: '#0061FF',
  mixcloud: '#52AAD8',
  streamable: '#0091FF',
  ted: '#E62B1E',
  imdb: '#F5C518',
  crunchyroll: '#F47521',
  tumblr: '#36465D',
  flickr: '#FF0084',
  '9gag': '#000000',
  spotify: '#1DB954',
  vk: '#4C75A3',
  unknown: '#6366F1',
};

export const PLATFORM_NAMES: Record<string, string> = {
  // Tier 1
  youtube: 'YouTube',
  tiktok: 'TikTok',
  instagram: 'Instagram',
  twitter: 'Twitter/X',
  facebook: 'Facebook',
  // Tier 2
  reddit: 'Reddit',
  vimeo: 'Vimeo',
  twitch: 'Twitch',
  dailymotion: 'Dailymotion',
  soundcloud: 'SoundCloud',
  bilibili: 'Bilibili',
  pinterest: 'Pinterest',
  linkedin: 'LinkedIn',
  // Tier 3
  rumble: 'Rumble',
  bandcamp: 'Bandcamp',
  bitchute: 'BitChute',
  archive: 'Archive.org',
  odnoklassniki: 'OK.ru',
  rutube: 'Rutube',
  nicovideo: 'Niconico',
  pornhub: 'Pornhub',
  naver: 'Naver',
  vlive: 'V LIVE',
  weibo: 'Weibo',
  iqiyi: 'iQIYI',
  youku: 'Youku',
  lbry: 'Odysee/LBRY',
  peertube: 'PeerTube',
  dropbox: 'Dropbox',
  mixcloud: 'Mixcloud',
  streamable: 'Streamable',
  ted: 'TED',
  imdb: 'IMDb',
  crunchyroll: 'Crunchyroll',
  tumblr: 'Tumblr',
  flickr: 'Flickr',
  '9gag': '9GAG',
  spotify: 'Spotify',
  vk: 'VK',
  unknown: 'Website',
};
