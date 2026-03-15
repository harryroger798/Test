/**
 * Download external tool binaries for bundling with ByteFix.
 * Run before `npm run package:win` to include recovery tools.
 *
 * Tools downloaded:
 *   - TestDisk + PhotoRec (GPL, CGSecurity) — data recovery
 *
 * Usage:  node scripts/download-tools.js
 */

const https = require('https')
const http = require('http')
const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

const TOOLS_DIR = path.join(__dirname, '..', 'tools')

const TESTDISK_URL = 'https://www.cgsecurity.org/testdisk-7.2.win64.zip'
const TESTDISK_ZIP = path.join(TOOLS_DIR, 'testdisk-7.2.win64.zip')

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest)
    const protocol = url.startsWith('https') ? https : http

    const request = protocol.get(url, { headers: { 'User-Agent': 'ByteFix-Builder/1.0' } }, (response) => {
      // Handle redirects
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        file.close()
        fs.unlinkSync(dest)
        return download(response.headers.location, dest).then(resolve).catch(reject)
      }

      if (response.statusCode !== 200) {
        file.close()
        fs.unlinkSync(dest)
        reject(new Error(`Download failed: HTTP ${response.statusCode} for ${url}`))
        return
      }

      const totalBytes = parseInt(response.headers['content-length'] || '0', 10)
      let downloaded = 0

      response.on('data', (chunk) => {
        downloaded += chunk.length
        if (totalBytes > 0) {
          const pct = ((downloaded / totalBytes) * 100).toFixed(1)
          process.stdout.write(`\r  Downloading: ${pct}% (${(downloaded / 1024 / 1024).toFixed(1)}MB)`)
        }
      })

      response.pipe(file)
      file.on('finish', () => {
        file.close()
        console.log('')
        resolve()
      })
    })

    request.on('error', (err) => {
      file.close()
      if (fs.existsSync(dest)) fs.unlinkSync(dest)
      reject(err)
    })
  })
}

async function main() {
  console.log('ByteFix Tool Downloader')
  console.log('=======================\n')

  // Create tools dir
  if (!fs.existsSync(TOOLS_DIR)) {
    fs.mkdirSync(TOOLS_DIR, { recursive: true })
  }

  // Check if tools already exist
  const photorec = path.join(TOOLS_DIR, 'photorec_win.exe')
  const testdisk = path.join(TOOLS_DIR, 'testdisk_win.exe')

  if (fs.existsSync(photorec) && fs.existsSync(testdisk)) {
    console.log('TestDisk/PhotoRec already present. Skipping download.')
    console.log('  Delete tools/ directory to force re-download.\n')
    return
  }

  // Download TestDisk (includes PhotoRec)
  console.log('1. Downloading TestDisk + PhotoRec (CGSecurity, GPL)...')
  try {
    await download(TESTDISK_URL, TESTDISK_ZIP)

    // Extract
    console.log('  Extracting...')
    execSync(`unzip -o "${TESTDISK_ZIP}" -d "${TOOLS_DIR}"`, { stdio: 'pipe' })

    // Copy needed files to tools root
    const extractDir = path.join(TOOLS_DIR, 'testdisk-7.2')
    const filesToCopy = fs.readdirSync(extractDir)
    for (const f of filesToCopy) {
      const src = path.join(extractDir, f)
      const dest = path.join(TOOLS_DIR, f)
      if (fs.statSync(src).isFile()) {
        fs.copyFileSync(src, dest)
      } else if (fs.statSync(src).isDirectory()) {
        // Copy subdirectories (platforms/, 63/)
        if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true })
        for (const sf of fs.readdirSync(src)) {
          fs.copyFileSync(path.join(src, sf), path.join(dest, sf))
        }
      }
    }

    // Cleanup
    fs.rmSync(extractDir, { recursive: true, force: true })
    fs.unlinkSync(TESTDISK_ZIP)

    console.log('  TestDisk + PhotoRec installed successfully.\n')
  } catch (err) {
    console.error(`  ERROR: Failed to download TestDisk: ${err.message}`)
    console.error('  Data recovery will work with Recycle Bin only (no deep scan).\n')
  }

  // Summary
  console.log('Tool Status:')
  console.log(`  photorec_win.exe: ${fs.existsSync(photorec) ? 'OK' : 'MISSING'}`)
  console.log(`  testdisk_win.exe: ${fs.existsSync(testdisk) ? 'OK' : 'MISSING'}`)
  console.log('')
  console.log('Note: Windows built-in tools (sfc, dism, chkdsk, PowerShell) do not need bundling.')
  console.log('Note: smartctl (smartmontools) should be installed separately by the technician.')
}

main().catch(console.error)
