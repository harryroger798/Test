import { createLogger } from '../logger'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { existsSync, statSync, readdirSync } from 'fs'
import { join, basename } from 'path'
import { homedir, platform, tmpdir } from 'os'

const execFileAsync = promisify(execFile)
const logger = createLogger('backup-wizard')

// ============================================================
// Backup & Data Migration Wizard
// Pre-repair safety: backup user data before risky operations
// Browser data migration: bookmarks, passwords, history
// PC-to-PC migration guidance
// ============================================================

export interface BackupTarget {
  name: string
  path: string
  sizeBytes: number
  sizeDisplay: string
  exists: boolean
  type: 'directory' | 'file'
}

export interface BackupPlan {
  targets: BackupTarget[]
  totalSizeBytes: number
  totalSizeDisplay: string
  estimatedTimeMinutes: number
  destinationPath: string
}

export interface BackupResult {
  success: boolean
  targetsCopied: number
  targetsFailed: number
  totalBytesCopied: number
  errors: string[]
  backupPath: string
  duration: number
}

export interface BrowserProfile {
  browser: string
  profilePath: string
  exists: boolean
  hasBookmarks: boolean
  hasHistory: boolean
  hasPasswords: boolean
  hasExtensions: boolean
}

export interface MigrationGuide {
  title: string
  steps: string[]
  tools: string[]
  estimatedTime: string
  difficulty: 'easy' | 'medium' | 'advanced'
}

// ============================================================
// Size formatting helper
// ============================================================
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

function getDirSize(dirPath: string): number {
  let totalSize = 0
  try {
    const entries = readdirSync(dirPath, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = join(dirPath, entry.name)
      try {
        if (entry.isFile()) {
          totalSize += statSync(fullPath).size
        } else if (entry.isDirectory()) {
          totalSize += getDirSize(fullPath)
        }
      } catch {
        // Skip inaccessible files
      }
    }
  } catch {
    // Skip inaccessible directories
  }
  return totalSize
}

// ============================================================
// Discover Backup Targets
// ============================================================

export async function discoverBackupTargets(): Promise<BackupTarget[]> {
  logger.info('Discovering backup targets')
  const home = homedir()
  const os = platform()
  const targets: BackupTarget[] = []

  // Common user data directories
  const commonDirs = [
    { name: 'Desktop', path: join(home, 'Desktop') },
    { name: 'Documents', path: join(home, 'Documents') },
    { name: 'Pictures', path: join(home, 'Pictures') },
    { name: 'Downloads', path: join(home, 'Downloads') },
    { name: 'Videos', path: join(home, 'Videos') },
    { name: 'Music', path: join(home, 'Music') }
  ]

  // OS-specific locations
  if (os === 'win32') {
    commonDirs.push(
      { name: 'Outlook Data', path: join(home, 'AppData', 'Local', 'Microsoft', 'Outlook') },
      { name: 'Sticky Notes', path: join(home, 'AppData', 'Local', 'Packages', 'Microsoft.MicrosoftStickyNotes_8wekyb3d8bbwe', 'LocalState') },
      { name: 'Contacts', path: join(home, 'Contacts') },
      { name: 'Favorites', path: join(home, 'Favorites') }
    )
  } else if (os === 'darwin') {
    commonDirs.push(
      { name: 'Notes (Apple)', path: join(home, 'Library', 'Group Containers', 'group.com.apple.notes') },
      { name: 'Contacts', path: join(home, 'Library', 'Application Support', 'AddressBook') }
    )
  }

  for (const dir of commonDirs) {
    const exists = existsSync(dir.path)
    let sizeBytes = 0
    if (exists) {
      try {
        const stat = statSync(dir.path)
        if (stat.isDirectory()) {
          sizeBytes = getDirSize(dir.path)
        } else {
          sizeBytes = stat.size
        }
      } catch {
        // Skip inaccessible paths
      }
    }

    targets.push({
      name: dir.name,
      path: dir.path,
      sizeBytes,
      sizeDisplay: formatSize(sizeBytes),
      exists,
      type: 'directory'
    })
  }

  return targets.filter(t => t.exists && t.sizeBytes > 0)
}

// ============================================================
// Create Backup Plan
// ============================================================

export async function createBackupPlan(
  targetPaths?: string[],
  destinationPath?: string
): Promise<BackupPlan> {
  logger.info('Creating backup plan')

  const allTargets = await discoverBackupTargets()
  const targets = targetPaths
    ? allTargets.filter(t => targetPaths.includes(t.path))
    : allTargets

  const totalSizeBytes = targets.reduce((sum, t) => sum + t.sizeBytes, 0)
  // Estimate ~50MB/s copy speed for USB drives
  const estimatedTimeMinutes = Math.max(1, Math.ceil(totalSizeBytes / (50 * 1024 * 1024) / 60))

  const dest = destinationPath || join(tmpdir(), `bytefix-backup-${Date.now()}`)

  return {
    targets,
    totalSizeBytes,
    totalSizeDisplay: formatSize(totalSizeBytes),
    estimatedTimeMinutes,
    destinationPath: dest
  }
}

// ============================================================
// Execute Backup
// ============================================================

export async function executeBackup(
  targetPaths: string[],
  destinationPath: string
): Promise<BackupResult> {
  logger.info('Executing backup', { targets: targetPaths.length, destination: destinationPath })

  const startTime = Date.now()
  const errors: string[] = []
  let targetsCopied = 0
  let targetsFailed = 0
  let totalBytesCopied = 0

  const os = platform()

  for (const targetPath of targetPaths) {
    if (!existsSync(targetPath)) {
      errors.push(`Target not found: ${targetPath}`)
      targetsFailed++
      continue
    }

    const dirName = basename(targetPath)
    const destDir = join(destinationPath, dirName)

    try {
      if (os === 'win32') {
        await execFileAsync('robocopy', [
          targetPath, destDir, '/E', '/R:1', '/W:1', '/MT:4', '/NFL', '/NDL', '/NJH', '/NJS'
        ], { timeout: 300000 })
      } else {
        await execFileAsync('rsync', [
          '-a', '--info=progress2', targetPath + '/', destDir + '/'
        ], { timeout: 300000 })
      }

      const copiedSize = getDirSize(destDir)
      totalBytesCopied += copiedSize
      targetsCopied++
      logger.info(`Backed up: ${dirName}`, { size: formatSize(copiedSize) })
    } catch (err) {
      // Robocopy returns non-zero for partial success, check exit code
      const execErr = err as { code?: number; message?: string }
      if (os === 'win32' && execErr.code !== undefined && execErr.code < 8) {
        // Robocopy codes 0-7 are success/partial
        targetsCopied++
      } else {
        errors.push(`Failed to backup ${dirName}: ${execErr.message || 'Unknown error'}`)
        targetsFailed++
      }
    }
  }

  const duration = Date.now() - startTime

  return {
    success: targetsFailed === 0,
    targetsCopied,
    targetsFailed,
    totalBytesCopied,
    errors,
    backupPath: destinationPath,
    duration
  }
}

// ============================================================
// Browser Profile Discovery
// ============================================================

export async function discoverBrowserProfiles(): Promise<BrowserProfile[]> {
  logger.info('Discovering browser profiles')
  const home = homedir()
  const os = platform()
  const profiles: BrowserProfile[] = []

  interface BrowserDef {
    name: string
    paths: Record<string, string>
    bookmarks: string
    history: string
    passwords: string
    extensions: string
  }

  const browsers: BrowserDef[] = [
    {
      name: 'Google Chrome',
      paths: {
        win32: join(home, 'AppData', 'Local', 'Google', 'Chrome', 'User Data', 'Default'),
        darwin: join(home, 'Library', 'Application Support', 'Google', 'Chrome', 'Default'),
        linux: join(home, '.config', 'google-chrome', 'Default')
      },
      bookmarks: 'Bookmarks',
      history: 'History',
      passwords: 'Login Data',
      extensions: 'Extensions'
    },
    {
      name: 'Microsoft Edge',
      paths: {
        win32: join(home, 'AppData', 'Local', 'Microsoft', 'Edge', 'User Data', 'Default'),
        darwin: join(home, 'Library', 'Application Support', 'Microsoft Edge', 'Default'),
        linux: join(home, '.config', 'microsoft-edge', 'Default')
      },
      bookmarks: 'Bookmarks',
      history: 'History',
      passwords: 'Login Data',
      extensions: 'Extensions'
    },
    {
      name: 'Mozilla Firefox',
      paths: {
        win32: join(home, 'AppData', 'Roaming', 'Mozilla', 'Firefox', 'Profiles'),
        darwin: join(home, 'Library', 'Application Support', 'Firefox', 'Profiles'),
        linux: join(home, '.mozilla', 'firefox')
      },
      bookmarks: 'places.sqlite',
      history: 'places.sqlite',
      passwords: 'logins.json',
      extensions: 'extensions'
    },
    {
      name: 'Brave Browser',
      paths: {
        win32: join(home, 'AppData', 'Local', 'BraveSoftware', 'Brave-Browser', 'User Data', 'Default'),
        darwin: join(home, 'Library', 'Application Support', 'BraveSoftware', 'Brave-Browser', 'Default'),
        linux: join(home, '.config', 'BraveSoftware', 'Brave-Browser', 'Default')
      },
      bookmarks: 'Bookmarks',
      history: 'History',
      passwords: 'Login Data',
      extensions: 'Extensions'
    }
  ]

  for (const browser of browsers) {
    let profilePath = browser.paths[os] || ''

    // Firefox uses profile directories with random names
    if (browser.name === 'Mozilla Firefox' && existsSync(profilePath)) {
      try {
        const entries = readdirSync(profilePath, { withFileTypes: true })
        const defaultProfile = entries.find(e =>
          e.isDirectory() && (e.name.endsWith('.default') || e.name.endsWith('.default-release'))
        )
        if (defaultProfile) {
          profilePath = join(profilePath, defaultProfile.name)
        }
      } catch {
        // Skip
      }
    }

    const exists = existsSync(profilePath)
    profiles.push({
      browser: browser.name,
      profilePath,
      exists,
      hasBookmarks: exists && existsSync(join(profilePath, browser.bookmarks)),
      hasHistory: exists && existsSync(join(profilePath, browser.history)),
      hasPasswords: exists && existsSync(join(profilePath, browser.passwords)),
      hasExtensions: exists && existsSync(join(profilePath, browser.extensions))
    })
  }

  return profiles
}

// ============================================================
// Browser Data Backup
// ============================================================

export async function backupBrowserData(
  browserName: string,
  destinationPath: string
): Promise<{ success: boolean; backedUp: string[]; errors: string[] }> {
  logger.info('Backing up browser data', { browser: browserName })

  const profiles = await discoverBrowserProfiles()
  const profile = profiles.find(p => p.browser === browserName)

  if (!profile || !profile.exists) {
    return { success: false, backedUp: [], errors: [`Browser not found: ${browserName}`] }
  }

  const backedUp: string[] = []
  const errors: string[] = []
  const os = platform()
  const destDir = join(destinationPath, browserName.replace(/\s+/g, '_'))

  const filesToBackup = [
    { name: 'Bookmarks', file: profile.hasBookmarks ? 'Bookmarks' : null },
    { name: 'History', file: profile.hasHistory ? 'History' : null },
    { name: 'Login Data', file: profile.hasPasswords ? 'Login Data' : null }
  ]

  // For Firefox, use different file names
  if (browserName === 'Mozilla Firefox') {
    filesToBackup.length = 0
    filesToBackup.push(
      { name: 'Bookmarks & History', file: profile.hasBookmarks ? 'places.sqlite' : null },
      { name: 'Passwords', file: profile.hasPasswords ? 'logins.json' : null },
      { name: 'Password Key', file: existsSync(join(profile.profilePath, 'key4.db')) ? 'key4.db' : null }
    )
  }

  for (const item of filesToBackup) {
    if (!item.file) continue
    const src = join(profile.profilePath, item.file)
    const dest = join(destDir, item.file)

    try {
      if (os === 'win32') {
        await execFileAsync('cmd', ['/c', 'xcopy', '/Y', '/I', src, dest])
      } else {
        await execFileAsync('mkdir', ['-p', destDir])
        await execFileAsync('cp', ['-f', src, dest])
      }
      backedUp.push(item.name)
    } catch (err) {
      errors.push(`Failed to backup ${item.name}: ${(err as Error).message}`)
    }
  }

  return {
    success: errors.length === 0,
    backedUp,
    errors
  }
}

// ============================================================
// Migration Guides
// ============================================================

export function getPCToPCMigrationGuide(): MigrationGuide {
  return {
    title: 'PC to PC Data Migration',
    steps: [
      '1. Connect both PCs to the same network (WiFi or LAN)',
      '2. On the OLD PC: Enable file sharing (Control Panel > Network > Turn on file sharing)',
      '3. On the OLD PC: Share the folders you want to transfer (right-click > Share)',
      '4. On the NEW PC: Open File Explorer > Network > Find the old PC',
      '5. Copy files from shared folders to the new PC',
      '',
      'Alternative: Use an external USB drive',
      '1. Connect USB drive to OLD PC',
      '2. Copy Desktop, Documents, Pictures, Downloads to USB',
      '3. Connect USB drive to NEW PC',
      '4. Copy files from USB to appropriate folders',
      '',
      'For large transfers (>50GB): Use a USB 3.0 drive or network cable (direct connection)'
    ],
    tools: ['USB Drive (32GB+)', 'Network Cable (optional)', 'File Explorer'],
    estimatedTime: '30 minutes to 2 hours (depends on data size)',
    difficulty: 'easy'
  }
}

export function getWindowsReinstallGuide(): MigrationGuide {
  return {
    title: 'Windows Reinstall - Data Preservation Guide',
    steps: [
      '1. BEFORE reinstall: Backup all user data using ByteFix Backup Wizard',
      '2. Note down installed programs (ByteFix generates this list automatically)',
      '3. Export browser bookmarks and passwords',
      '4. Backup WiFi passwords: netsh wlan export profile folder=C:\\wifi-backup',
      '5. Backup product keys: Check Windows activation, Office key',
      '6. Create Windows installation media (USB)',
      '7. During install: Choose "Custom" and format only the C: drive',
      '8. After install: Restore data from backup',
      '9. Reinstall programs from the generated list',
      '10. Import browser data and WiFi profiles'
    ],
    tools: ['ByteFix Backup Wizard', '8GB+ USB Drive', 'Windows ISO (from Microsoft)'],
    estimatedTime: '2-4 hours',
    difficulty: 'medium'
  }
}

export function getHDDToSSDGuide(): MigrationGuide {
  return {
    title: 'HDD to SSD Migration Guide',
    steps: [
      '1. Connect the new SSD (via USB adapter or directly to SATA)',
      '2. Download free cloning software (Macrium Reflect Free / Clonezilla)',
      '3. Open the cloning software',
      '4. Select source disk (old HDD) and target (new SSD)',
      '5. Start the clone process (this will take 30-90 minutes)',
      '6. After cloning: Power off, replace HDD with SSD',
      '7. Boot from SSD - verify everything works',
      '8. Run TRIM optimization: defrag C: /O /U /V',
      '',
      'If SSD is smaller than HDD:',
      '1. First, clean up the HDD (delete unnecessary files)',
      '2. Shrink the partition to fit within SSD size',
      '3. Then clone only the shrunken partition'
    ],
    tools: ['USB-to-SATA adapter', 'Macrium Reflect Free / Clonezilla', 'Screwdriver set'],
    estimatedTime: '1-2 hours',
    difficulty: 'medium'
  }
}

export async function getBackupStatus(): Promise<{
  targets: BackupTarget[]
  browsers: BrowserProfile[]
  migrationGuides: MigrationGuide[]
}> {
  const [targets, browsers] = await Promise.all([
    discoverBackupTargets(),
    discoverBrowserProfiles()
  ])

  return {
    targets,
    browsers: browsers.filter(b => b.exists),
    migrationGuides: [
      getPCToPCMigrationGuide(),
      getWindowsReinstallGuide(),
      getHDDToSSDGuide()
    ]
  }
}
