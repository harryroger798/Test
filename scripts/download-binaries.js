#!/usr/bin/env node

/**
 * Download yt-dlp and FFmpeg binaries for the current platform.
 * Run: node scripts/download-binaries.js
 *
 * This script downloads the appropriate binaries for your OS
 * and places them in resources/bin/{platform}/
 */

const https = require('https');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const YTDLP_VERSION = 'latest';
const platform = process.platform; // 'win32', 'darwin', 'linux'

const YTDLP_URLS = {
  win32: 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe',
  darwin: 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_macos',
  linux: 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp',
};

const binDir = path.join(__dirname, '..', 'resources', 'bin', platform === 'win32' ? 'win' : platform === 'darwin' ? 'mac' : 'linux');

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    console.log(`Downloading: ${url}`);
    console.log(`To: ${dest}`);

    const file = fs.createWriteStream(dest);

    const request = (url) => {
      https.get(url, (response) => {
        if (response.statusCode === 302 || response.statusCode === 301) {
          request(response.headers.location);
          return;
        }

        if (response.statusCode !== 200) {
          reject(new Error(`Download failed with status ${response.statusCode}`));
          return;
        }

        const totalSize = parseInt(response.headers['content-length'], 10);
        let downloadedSize = 0;

        response.on('data', (chunk) => {
          downloadedSize += chunk.length;
          if (totalSize) {
            const percent = ((downloadedSize / totalSize) * 100).toFixed(1);
            process.stdout.write(`\r  Progress: ${percent}%`);
          }
        });

        response.pipe(file);
        file.on('finish', () => {
          file.close();
          console.log('\n  Done!');
          resolve();
        });
      }).on('error', reject);
    };

    request(url);
  });
}

async function main() {
  console.log(`\nPlatform: ${platform}`);
  console.log(`Binary directory: ${binDir}\n`);

  // Create directory
  fs.mkdirSync(binDir, { recursive: true });

  // Download yt-dlp
  const ytdlpUrl = YTDLP_URLS[platform];
  if (!ytdlpUrl) {
    console.error(`Unsupported platform: ${platform}`);
    process.exit(1);
  }

  const ytdlpDest = path.join(binDir, platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp');
  await downloadFile(ytdlpUrl, ytdlpDest);

  // Make executable on Unix
  if (platform !== 'win32') {
    fs.chmodSync(ytdlpDest, '755');
  }

  console.log('\nyt-dlp binary downloaded successfully!');
  console.log('\nNote: FFmpeg needs to be installed separately:');
  console.log('  - Windows: choco install ffmpeg  OR  winget install ffmpeg');
  console.log('  - macOS:   brew install ffmpeg');
  console.log('  - Linux:   sudo apt install ffmpeg  OR  sudo dnf install ffmpeg');
  console.log('\nAlternatively, download FFmpeg from https://ffmpeg.org/download.html');
  console.log(`and place the binary in: ${binDir}/`);
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
