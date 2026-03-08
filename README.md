# GrabTube - Multi-Platform Video Downloader

A cross-platform desktop application for downloading videos and audio from YouTube, TikTok, Instagram, Twitter/X, Reddit, and 1800+ other websites.

Built with Electron + React + TypeScript + Tailwind CSS, powered by yt-dlp.

## Features

- **Universal URL Support** - Paste any video URL and auto-detect the platform
- **Video & Audio Downloads** - Download in MP4, MKV, WebM, or extract audio as MP3, M4A, OPUS, FLAC, WAV
- **Quality Selection** - Choose from available qualities: 360p to 8K
- **Proxy Support** - HTTP/HTTPS/SOCKS5 proxy configuration
- **Download Queue** - Queue multiple downloads, process concurrently
- **Download History** - Track all your downloads with re-download support
- **Subtitle Support** - Download and embed subtitles
- **Thumbnail Embedding** - Embed thumbnails into audio files
- **Dark/Light Mode** - Beautiful UI with theme toggle
- **Cross-Platform** - Windows (.exe), macOS (.dmg), Linux (.AppImage)
- **Privacy First** - Everything runs locally, no data sent to external servers

## Supported Platforms

YouTube, TikTok, Instagram, Twitter/X, Facebook, Reddit, Vimeo, Twitch, Dailymotion, SoundCloud, Bilibili, Pinterest, LinkedIn, Rumble, and 1800+ more.

## Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [yt-dlp](https://github.com/yt-dlp/yt-dlp) installed and available in PATH
- [FFmpeg](https://ffmpeg.org/) installed and available in PATH

### Installing Prerequisites

**macOS:**
```bash
brew install yt-dlp ffmpeg
```

**Linux (Ubuntu/Debian):**
```bash
sudo apt install ffmpeg
pip install yt-dlp
# or
sudo curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp
sudo chmod a+rx /usr/local/bin/yt-dlp
```

**Windows:**
```powershell
choco install yt-dlp ffmpeg
# or
winget install yt-dlp.yt-dlp
winget install ffmpeg
```

## Development Setup

```bash
# Install dependencies
npm install

# Run in development mode (Vite dev server + Electron)
npm run dev

# Or just the frontend (for UI development)
npm run dev:renderer
```

## Building

```bash
# Build for all platforms
npm run build:all

# Build for specific platform
npm run build:win    # Windows .exe
npm run build:mac    # macOS .dmg
npm run build:linux  # Linux .AppImage

# Download yt-dlp binary to bundle with the app
npm run download-binaries
```

Build outputs are in the `release/` directory.

## Project Structure

```
grabtube/
├── src/
│   ├── main/           # Electron Main Process
│   │   ├── index.ts            # App entry, window creation, IPC
│   │   ├── ytdlp-manager.ts    # yt-dlp binary management
│   │   ├── download-manager.ts # Download queue & progress
│   │   └── settings-store.ts   # Persistent settings
│   ├── preload/        # Electron Preload (secure IPC bridge)
│   │   └── index.ts
│   └── renderer/       # React Frontend
│       ├── components/ # Reusable UI components
│       ├── pages/      # App pages (Home, Queue, History, Settings)
│       ├── store/      # Zustand state management
│       └── lib/        # Utilities, IPC helpers
├── resources/          # App icons, bundled binaries
├── scripts/            # Build & setup scripts
└── package.json
```

## Proxy Support

GrabTube supports HTTP, HTTPS, and SOCKS5 proxies. Configure in Settings > Proxy Settings.

Proxy format examples:
- `http://host:port`
- `https://host:port`
- `socks5://username:password@host:port`

## Disclaimer

GrabTube is intended for personal use only. Users are responsible for ensuring compliance with applicable laws and the terms of service of the platforms they download from. Do not use this tool to download copyrighted content without proper authorization.

## License

MIT
