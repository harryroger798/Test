#!/usr/bin/env node

/**
 * Download ALL required binaries for GrabTube:
 *   1. yt-dlp      — video downloader (standalone, includes Python + curl_cffi)
 *   2. FFmpeg       — media processing (static build)
 *   3. bgutil-pot   — POT provider for YouTube bypass (Rust binary, no dependencies)
 *   4. POT plugin   — yt-dlp plugin files (Python, loaded by yt-dlp at runtime)
 *
 * Run: node scripts/download-binaries.js [--platform win|mac|linux]
 *
 * Binaries are placed in resources/bin/{platform}/ for development,
 * and electron-builder copies them to the app's resources via extraResources.
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Parse --platform flag or use current OS
const args = process.argv.slice(2);
const platformIdx = args.indexOf('--platform');
const targetPlatform = process.env.GRABTUBE_PLATFORM || (platformIdx >= 0 ? args[platformIdx + 1] : (
  process.platform === 'win32' ? 'win' : process.platform === 'darwin' ? 'mac' : 'linux'
));

// ── Binary URLs ──────────────────────────────────────────────────────

const YTDLP_URLS = {
  win:   'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe',
  mac:   'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_macos',
  linux: 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux',
};

const FFMPEG_URLS = {
  win:   'https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip',
  mac:   'https://evermeet.cx/ffmpeg/getrelease/zip',
  linux: 'https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz',
};

// Rust POT provider from jim60105/bgutil-ytdlp-pot-provider-rs
const POT_PROVIDER_VERSION = '0.7.2';
const POT_PROVIDER_URLS = {
  win:   `https://github.com/jim60105/bgutil-ytdlp-pot-provider-rs/releases/download/v${POT_PROVIDER_VERSION}/bgutil-pot-windows-x86_64.exe`,
  mac:   `https://github.com/jim60105/bgutil-ytdlp-pot-provider-rs/releases/download/v${POT_PROVIDER_VERSION}/bgutil-pot-macos-x86_64`,
  linux: `https://github.com/jim60105/bgutil-ytdlp-pot-provider-rs/releases/download/v${POT_PROVIDER_VERSION}/bgutil-pot-linux-x86_64`,
};

// POT provider yt-dlp plugin (Python files from Rust fork's GitHub releases)
const POT_PLUGIN_URL = `https://github.com/jim60105/bgutil-ytdlp-pot-provider-rs/releases/download/v${POT_PROVIDER_VERSION}/bgutil-ytdlp-pot-provider-rs.zip`;

// Deno runtime (required by yt-dlp 2026+ for YouTube JS extraction)
const DENO_VERSION = '2.7.4';
const DENO_URLS = {
  win:   `https://github.com/denoland/deno/releases/download/v${DENO_VERSION}/deno-x86_64-pc-windows-msvc.zip`,
  mac:   `https://github.com/denoland/deno/releases/download/v${DENO_VERSION}/deno-x86_64-apple-darwin.zip`,
  linux: `https://github.com/denoland/deno/releases/download/v${DENO_VERSION}/deno-x86_64-unknown-linux-gnu.zip`,
};

// ── Helpers ──────────────────────────────────────────────────────────

const binDir = path.join(__dirname, '..', 'resources', 'bin', targetPlatform);

function downloadFile(url, dest, maxRedirects) {
  maxRedirects = maxRedirects || 10;
  return new Promise((resolve, reject) => {
    if (maxRedirects <= 0) {
      reject(new Error('Too many redirects'));
      return;
    }

    console.log('  Downloading: ' + url);
    const proto = url.startsWith('https') ? https : http;

    proto.get(url, { headers: { 'User-Agent': 'GrabTube-Downloader/1.0' } }, (response) => {
      if (response.statusCode === 302 || response.statusCode === 301) {
        downloadFile(response.headers.location, dest, maxRedirects - 1).then(resolve).catch(reject);
        return;
      }

      if (response.statusCode !== 200) {
        reject(new Error('Download failed with status ' + response.statusCode + ' for ' + url));
        return;
      }

      const file = fs.createWriteStream(dest);
      const totalSize = parseInt(response.headers['content-length'], 10);
      let downloadedSize = 0;

      response.on('data', (chunk) => {
        downloadedSize += chunk.length;
        if (totalSize) {
          const percent = ((downloadedSize / totalSize) * 100).toFixed(1);
          process.stdout.write('\r  Progress: ' + percent + '% (' + (downloadedSize / 1048576).toFixed(1) + ' MB)');
        }
      });

      response.pipe(file);
      file.on('finish', () => {
        file.close();
        console.log('\n  Saved: ' + dest);
        resolve();
      });
      file.on('error', reject);
    }).on('error', reject);
  });
}

function makeExecutable(filePath) {
  if (process.platform !== 'win32') {
    try {
      fs.chmodSync(filePath, '755');
    } catch (e) {
      // ignore
    }
  }
}

// ── Download Functions ───────────────────────────────────────────────

async function downloadYtdlp() {
  console.log('\n[1/5] Downloading yt-dlp...');
  const url = YTDLP_URLS[targetPlatform];
  if (!url) { console.log('  Skipped: unsupported platform'); return; }
  const ext = targetPlatform === 'win' ? '.exe' : '';
  const dest = path.join(binDir, 'yt-dlp' + ext);
  await downloadFile(url, dest);
  makeExecutable(dest);
  console.log('  yt-dlp downloaded successfully.');
}

async function downloadFfmpeg() {
  console.log('\n[2/5] Downloading FFmpeg...');
  console.log('  Note: FFmpeg is large (~80MB). For faster setup, install via package manager:');
  console.log('    Linux:   sudo apt install ffmpeg');
  console.log('    macOS:   brew install ffmpeg');
  console.log('    Windows: choco install ffmpeg');
  console.log('  GrabTube will auto-detect system-installed FFmpeg if bundled version is missing.');

  const url = FFMPEG_URLS[targetPlatform];
  if (!url) { console.log('  Skipped: unsupported platform'); return; }

  if (targetPlatform === 'linux') {
    const archiveDest = path.join(binDir, 'ffmpeg.tar.xz');
    try {
      await downloadFile(url, archiveDest);
      console.log('  Extracting ffmpeg from archive...');
      execSync('cd "' + binDir + '" && tar -xf ffmpeg.tar.xz', { stdio: 'pipe' });
      // Find the ffmpeg binary in extracted directories
      const entries = fs.readdirSync(binDir);
      for (const entry of entries) {
        const ffmpegBin = path.join(binDir, entry, 'ffmpeg');
        if (fs.existsSync(ffmpegBin)) {
          fs.renameSync(ffmpegBin, path.join(binDir, 'ffmpeg'));
          // Also grab ffprobe if available
          const ffprobeBin = path.join(binDir, entry, 'ffprobe');
          if (fs.existsSync(ffprobeBin)) {
            fs.renameSync(ffprobeBin, path.join(binDir, 'ffprobe'));
          }
          break;
        }
      }
      makeExecutable(path.join(binDir, 'ffmpeg'));
      try { fs.unlinkSync(archiveDest); } catch (e) { /* ignore */ }
      console.log('  FFmpeg extracted successfully.');
    } catch (err) {
      console.log('  FFmpeg download/extract failed: ' + err.message);
      console.log('  Install via: sudo apt install ffmpeg');
    }
  } else if (targetPlatform === 'mac') {
    const zipDest = path.join(binDir, 'ffmpeg.zip');
    try {
      await downloadFile(url, zipDest);
      execSync('cd "' + binDir + '" && unzip -o ffmpeg.zip', { stdio: 'pipe' });
      makeExecutable(path.join(binDir, 'ffmpeg'));
      try { fs.unlinkSync(zipDest); } catch (e) { /* ignore */ }
      console.log('  FFmpeg extracted successfully.');
    } catch (err) {
      console.log('  FFmpeg download/extract failed: ' + err.message);
      console.log('  Install via: brew install ffmpeg');
    }
  } else {
    // Windows
    const zipDest = path.join(binDir, 'ffmpeg.zip');
    try {
      await downloadFile(url, zipDest);
      console.log('  Extracting ffmpeg from archive...');
      if (process.platform === 'win32') {
        execSync('powershell -command "Expand-Archive -Path \'' + zipDest + '\' -DestinationPath \'' + binDir + '\' -Force"', { stdio: 'pipe' });
      } else {
        execSync('cd "' + binDir + '" && unzip -o ffmpeg.zip', { stdio: 'pipe' });
      }
      // Find ffmpeg.exe in extracted directories
      const entries = fs.readdirSync(binDir);
      for (const entry of entries) {
        const binSubDir = path.join(binDir, entry, 'bin');
        if (fs.existsSync(binSubDir)) {
          const ffmpegExe = path.join(binSubDir, 'ffmpeg.exe');
          if (fs.existsSync(ffmpegExe)) {
            fs.renameSync(ffmpegExe, path.join(binDir, 'ffmpeg.exe'));
            const ffprobeExe = path.join(binSubDir, 'ffprobe.exe');
            if (fs.existsSync(ffprobeExe)) {
              fs.renameSync(ffprobeExe, path.join(binDir, 'ffprobe.exe'));
            }
            break;
          }
        }
      }
      try { fs.unlinkSync(zipDest); } catch (e) { /* ignore */ }
      console.log('  FFmpeg extracted successfully.');
    } catch (err) {
      console.log('  FFmpeg download/extract failed: ' + err.message);
      console.log('  Install via: choco install ffmpeg');
    }
  }
}

async function downloadPotProvider() {
  console.log('\n[3/5] Downloading POT Provider (YouTube bypass)...');
  const url = POT_PROVIDER_URLS[targetPlatform];
  if (!url) { console.log('  Skipped: unsupported platform'); return; }

  const ext = targetPlatform === 'win' ? '.exe' : '';
  const dest = path.join(binDir, 'bgutil-pot' + ext);

  try {
    await downloadFile(url, dest);
    makeExecutable(dest);
    console.log('  POT provider binary downloaded successfully.');
  } catch (err) {
    console.log('  POT provider download failed: ' + err.message);
    console.log('  YouTube downloads will still work with proxy or from home IPs.');
  }
}

async function downloadPotPlugin() {
  console.log('\n[4/5] Downloading POT Provider Plugin (yt-dlp integration)...');
  const pluginDir = path.join(binDir, 'plugins');
  fs.mkdirSync(pluginDir, { recursive: true });

  try {
    const zipDest = path.join(pluginDir, 'pot-plugin.zip');
    await downloadFile(POT_PLUGIN_URL, zipDest);

    try {
      if (process.platform === 'win32') {
        execSync('powershell -command "Expand-Archive -Path \'' + zipDest + '\' -DestinationPath \'' + pluginDir + '\' -Force"', { stdio: 'pipe' });
      } else {
        execSync('cd "' + pluginDir + '" && unzip -o pot-plugin.zip', { stdio: 'pipe' });
      }
      try { fs.unlinkSync(zipDest); } catch (e) { /* ignore */ }
      console.log('  POT plugin extracted successfully.');
    } catch (e) {
      console.log('  Could not extract plugin zip. Extract manually into: ' + pluginDir);
    }
  } catch (err) {
    console.log('  POT plugin download failed: ' + err.message);
    console.log('  Install manually: pip install bgutil-ytdlp-pot-provider');
  }
}

async function downloadDeno() {
  console.log('\n[5/5] Downloading Deno runtime (for YouTube JS extraction)...');
  const url = DENO_URLS[targetPlatform];
  if (!url) { console.log('  Skipped: unsupported platform'); return; }

  const zipDest = path.join(binDir, 'deno.zip');
  try {
    await downloadFile(url, zipDest);
    console.log('  Extracting deno from archive...');
    if (process.platform === 'win32') {
      execSync('powershell -command "Expand-Archive -Path \'' + zipDest + '\' -DestinationPath \'' + binDir + '\' -Force"', { stdio: 'pipe' });
    } else {
      execSync('cd "' + binDir + '" && unzip -o deno.zip', { stdio: 'pipe' });
    }
    const ext = targetPlatform === 'win' ? '.exe' : '';
    makeExecutable(path.join(binDir, 'deno' + ext));
    try { fs.unlinkSync(zipDest); } catch (e) { /* ignore */ }
    console.log('  Deno runtime extracted successfully.');
  } catch (err) {
    console.log('  Deno download/extract failed: ' + err.message);
    console.log('  Install via: curl -fsSL https://deno.land/install.sh | sh');
  }
}

// ── Main ─────────────────────────────────────────────────────────────

async function main() {
  console.log('=== GrabTube Binary Downloader ===');
  console.log('Platform: ' + targetPlatform);
  console.log('Binary directory: ' + binDir + '\n');

  fs.mkdirSync(binDir, { recursive: true });

  await downloadYtdlp();
  await downloadFfmpeg();
  await downloadPotProvider();
  await downloadPotPlugin();
  await downloadDeno();

  console.log('\n=== Summary ===');
  const ext = targetPlatform === 'win' ? '.exe' : '';
  const files = [
    'yt-dlp' + ext,
    targetPlatform === 'win' ? 'ffmpeg.exe' : 'ffmpeg',
    'bgutil-pot' + ext,
    'plugins',
    targetPlatform === 'win' ? 'deno.exe' : 'deno',
  ];

  for (const file of files) {
    const fullPath = path.join(binDir, file);
    const exists = fs.existsSync(fullPath);
    console.log('  ' + (exists ? 'OK' : 'MISSING') + ': ' + file);
  }

  console.log('');
  console.log('All binaries are ready! Run "npm run dev" to start GrabTube.');
  console.log('The app will automatically use bundled binaries when available.');
  console.log('If any binary is missing, the app falls back to system-installed versions.');
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
