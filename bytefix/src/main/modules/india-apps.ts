// ============================================================
// ByteFix Phase 2 — India Apps Module
// Office repair, Outlook PST, Tally ERP, Java banking, Chrome profile,
// GST portal, Aadhaar enrollment fixes
// ============================================================

import { execSync } from 'child_process'
import { existsSync, readdirSync, statSync, lstatSync } from 'fs'
import { join, resolve, normalize } from 'path'
import { platform, homedir } from 'os'
import { createLogger } from '../logger'
import type { DiagnosticResult, FixResult, FixChange } from '../../shared/types'

const logger = createLogger('india-apps')

const isWin = platform() === 'win32'

// ---- Office Detection & Repair ----

function detectOfficeInstallation(): { installed: boolean; version: string; path: string; type: string } {
  const result = { installed: false, version: 'Not found', path: '', type: 'None' }
  if (!isWin) return result

  try {
    // Check Click-to-Run Office
    const c2rOutput = execSync(
      'powershell -NoProfile -Command "(Get-ItemProperty \'HKLM:\\SOFTWARE\\Microsoft\\Office\\ClickToRun\\Configuration\' -ErrorAction SilentlyContinue).VersionToReport"',
      { encoding: 'utf8', timeout: 10000, stdio: 'pipe' }
    ).trim()
    if (c2rOutput) {
      result.installed = true
      result.version = c2rOutput
      result.type = 'Click-to-Run'
      result.path = 'C:\\Program Files\\Microsoft Office\\root\\Office16'
      return result
    }
  } catch { /* not C2R */ }

  try {
    // Check MSI Office
    const msiOutput = execSync(
      'powershell -NoProfile -Command "Get-ItemProperty \'HKLM:\\SOFTWARE\\Microsoft\\Office\\16.0\\Common\\InstallRoot\' -ErrorAction SilentlyContinue | Select-Object Path | ConvertTo-Json"',
      { encoding: 'utf8', timeout: 10000, stdio: 'pipe' }
    ).trim()
    if (msiOutput) {
      const parsed = JSON.parse(msiOutput)
      if (parsed.Path) {
        result.installed = true
        result.version = '16.0 (MSI)'
        result.type = 'MSI'
        result.path = String(parsed.Path)
      }
    }
  } catch { /* not MSI */ }

  return result
}

// ---- Tally ERP Detection ----

function detectTally(): { installed: boolean; version: string; path: string; dataPath: string } {
  const result = { installed: false, version: '', path: '', dataPath: '' }
  if (!isWin) return result

  const tallyPaths = [
    'C:\\Tally.ERP9',
    'C:\\Program Files\\Tally.ERP9',
    'C:\\Program Files (x86)\\Tally.ERP9',
    'C:\\TallyPrime',
    'C:\\Program Files\\TallyPrime',
    'C:\\Program Files (x86)\\TallyPrime',
  ]

  for (const p of tallyPaths) {
    if (existsSync(p)) {
      const isTallyPrime = p.toLowerCase().includes('tallyprime')
      result.installed = true
      result.version = isTallyPrime ? 'TallyPrime' : 'Tally.ERP 9'
      result.path = p
      // Check for data directory
      const dataDir = join(p, 'Data')
      if (existsSync(dataDir)) result.dataPath = dataDir
      break
    }
  }

  // Check registry for Tally
  if (!result.installed) {
    try {
      const regOutput = execSync(
        'powershell -NoProfile -Command "(Get-ItemProperty \'HKLM:\\SOFTWARE\\Tally Solutions*\\*\' -ErrorAction SilentlyContinue).InstallPath"',
        { encoding: 'utf8', timeout: 10000, stdio: 'pipe' }
      ).trim()
      if (regOutput && existsSync(regOutput)) {
        result.installed = true
        result.path = regOutput
        result.version = 'Tally (from registry)'
      }
    } catch { /* not in registry */ }
  }

  return result
}

// ---- Java Detection (for banking apps) ----

function detectJava(): { installed: boolean; versions: string[]; paths: string[] } {
  const result = { installed: false, versions: [] as string[], paths: [] as string[] }

  try {
    if (isWin) {
      const output = execSync(
        'powershell -NoProfile -Command "Get-ChildItem \'HKLM:\\SOFTWARE\\JavaSoft\\Java Runtime Environment\' -ErrorAction SilentlyContinue | ForEach-Object { $_.PSChildName }"',
        { encoding: 'utf8', timeout: 10000, stdio: 'pipe' }
      ).trim()
      if (output) {
        result.installed = true
        result.versions = output.split('\n').map(v => v.trim()).filter(Boolean)
      }

      // Check common Java paths
      const javaPaths = [
        'C:\\Program Files\\Java',
        'C:\\Program Files (x86)\\Java',
      ]
      for (const jp of javaPaths) {
        if (existsSync(jp)) {
          try {
            const dirs = readdirSync(jp)
            for (const dir of dirs) {
              const fullPath = join(jp, dir)
              const stat = lstatSync(fullPath)
              if (stat.isDirectory() && !stat.isSymbolicLink()) {
                result.paths.push(fullPath)
              }
            }
          } catch { /* permission */ }
        }
      }
    } else {
      try {
        const output = execSync('java -version 2>&1', { encoding: 'utf8', timeout: 5000, stdio: 'pipe' })
        result.installed = true
        const versionMatch = output.match(/version "(.+?)"/)
        if (versionMatch) result.versions.push(versionMatch[1])
      } catch { /* java not installed */ }
    }
  } catch { /* detection failed */ }
  return result
}

// ---- Chrome Profile Detection ----

function detectChromeProfiles(): { profileCount: number; totalCacheSize: number; extensions: number } {
  const result = { profileCount: 0, totalCacheSize: 0, extensions: 0 }

  try {
    let chromeUserDataDir = ''
    if (isWin) {
      chromeUserDataDir = join(homedir(), 'AppData', 'Local', 'Google', 'Chrome', 'User Data')
    } else if (platform() === 'darwin') {
      chromeUserDataDir = join(homedir(), 'Library', 'Application Support', 'Google', 'Chrome')
    } else {
      chromeUserDataDir = join(homedir(), '.config', 'google-chrome')
    }

    if (!existsSync(chromeUserDataDir)) return result

    const entries = readdirSync(chromeUserDataDir)
    for (const entry of entries) {
      if (entry === 'Default' || entry.startsWith('Profile ')) {
        result.profileCount++
        const profilePath = join(chromeUserDataDir, entry)
        const stat = lstatSync(profilePath)
        if (!stat.isDirectory() || stat.isSymbolicLink()) continue

        // Count extensions
        const extPath = join(profilePath, 'Extensions')
        if (existsSync(extPath)) {
          try {
            const extDirs = readdirSync(extPath)
            result.extensions += extDirs.length
          } catch { /* permission */ }
        }

        // Check cache size
        const cachePath = join(profilePath, 'Cache')
        if (existsSync(cachePath)) {
          try {
            const cacheEntries = readdirSync(cachePath)
            for (const ce of cacheEntries.slice(0, 100)) {
              try {
                const ceStat = statSync(join(cachePath, ce))
                result.totalCacheSize += ceStat.size
              } catch { /* skip */ }
            }
          } catch { /* permission */ }
        }
      }
    }
  } catch { /* Chrome not installed or permission */ }
  return result
}

// ---- Outlook PST Check ----

function detectOutlookPst(): { found: boolean; files: { path: string; sizeMB: number }[] } {
  const result = { found: false, files: [] as { path: string; sizeMB: number }[] }
  if (!isWin) return result

  try {
    const output = execSync(
      'powershell -NoProfile -Command "Get-ChildItem -Path (Join-Path $env:USERPROFILE \'Documents\\Outlook Files\'), (Join-Path $env:LOCALAPPDATA \'Microsoft\\Outlook\') -Filter *.pst -Recurse -ErrorAction SilentlyContinue | Select-Object FullName, @{N=\'SizeMB\';E={[math]::Round($_.Length/1MB,1)}} | ConvertTo-Json"',
      { encoding: 'utf8', timeout: 15000, stdio: 'pipe' }
    ).trim()
    if (output) {
      const parsed = JSON.parse(output)
      const items = Array.isArray(parsed) ? parsed : [parsed]
      for (const item of items) {
        if (item.FullName) {
          result.found = true
          result.files.push({
            path: String(item.FullName),
            sizeMB: item.SizeMB || 0,
          })
        }
      }
    }
  } catch { /* no PST files */ }
  return result
}

// ---- GST Portal Browser Compatibility ----

function checkGstPortalReadiness(): string[] {
  const issues: string[] = []
  if (!isWin) return issues

  // Check Java for digital signature (DSC)
  const java = detectJava()
  if (!java.installed) {
    issues.push('Java not installed — required for GST Portal DSC (Digital Signature Certificate)')
    issues.push('Download Java 8: https://www.java.com/download/')
  } else {
    const hasJava8 = java.versions.some(v => v.startsWith('1.8'))
    if (!hasJava8) {
      issues.push('Java 8 not found — GST Portal DSC tools require Java 8 specifically')
      issues.push(`Found versions: ${java.versions.join(', ')}`)
    }
  }

  // Check if emSigner is installed
  const emSignerPaths = [
    'C:\\Program Files\\eMudhra\\emSigner',
    'C:\\Program Files (x86)\\eMudhra\\emSigner',
  ]
  const emSignerFound = emSignerPaths.some(p => existsSync(p))
  if (!emSignerFound) {
    issues.push('emSigner not installed — required for DSC signing on GST Portal')
    issues.push('Download from: https://emudhra.com/emsigner')
  }

  // Check .NET Framework 3.5 (required by many Indian govt apps)
  try {
    const dotnet35 = execSync(
      'powershell -NoProfile -Command "(Get-WindowsOptionalFeature -Online -FeatureName NetFx3 -ErrorAction SilentlyContinue).State"',
      { encoding: 'utf8', timeout: 15000, stdio: 'pipe' }
    ).trim()
    if (dotnet35 !== 'Enabled') {
      issues.push('.NET Framework 3.5 not enabled — required by many Indian government apps')
    }
  } catch { /* can't check */ }

  return issues
}

// ---- Aadhaar Enrollment Check ----

function checkAadhaarReadiness(): string[] {
  const issues: string[] = []
  if (!isWin) return issues

  // Check for Aadhaar enrollment client
  const aadhaarPaths = [
    'C:\\uidai_client',
    'C:\\Program Files\\UIDAI',
    'C:\\uidai',
  ]
  const aadhaarFound = aadhaarPaths.some(p => existsSync(p))
  if (!aadhaarFound) {
    issues.push('Aadhaar enrollment client not found')
    issues.push('This is a specialized UIDAI software — download from official UIDAI portal')
  }

  // Check for USB biometric device drivers
  try {
    const bioOutput = execSync(
      'powershell -NoProfile -Command "Get-PnpDevice -Class Biometric -ErrorAction SilentlyContinue | Where-Object { $_.Status -eq \'OK\' } | Select-Object FriendlyName | ConvertTo-Json"',
      { encoding: 'utf8', timeout: 10000, stdio: 'pipe' }
    ).trim()
    if (!bioOutput || bioOutput === '[]') {
      issues.push('No biometric devices detected — Aadhaar enrollment requires fingerprint/iris scanner')
    }
  } catch { /* can't check */ }

  return issues
}

// ---- Main Diagnostics ----

export async function runIndiaAppsDiagnostics(): Promise<DiagnosticResult[]> {
  const results: DiagnosticResult[] = []
  const timestamp = Date.now()

  try {
    if (!isWin) {
      results.push({
        id: `india-os-${timestamp}`,
        module: 'india-apps',
        category: 'Platform',
        title: 'India Apps Module (Windows Only)',
        severity: 'info',
        description: 'Most India-specific applications (Tally, GST portal tools, Aadhaar) are Windows-only.',
        details: ['This module is optimized for Windows systems used in Indian offices and shops'],
        fixAvailable: false,
        fixRisk: 'none',
        autoFixable: false,
        timestamp,
      })
      return results
    }

    // 1. Microsoft Office
    const office = detectOfficeInstallation()
    results.push({
      id: `india-office-${timestamp}`,
      module: 'india-apps',
      category: 'Microsoft Office',
      title: office.installed ? `Microsoft Office ${office.version}` : 'Microsoft Office Not Found',
      severity: office.installed ? 'info' : 'warning',
      description: office.installed
        ? `Office ${office.type} v${office.version} installed at ${office.path}`
        : 'Microsoft Office is not installed on this system',
      details: office.installed
        ? [`Type: ${office.type}`, `Version: ${office.version}`, `Path: ${office.path}`]
        : ['Install Office from office.com or use LibreOffice as free alternative'],
      fixAvailable: office.installed,
      fixDescription: office.installed ? 'Run Office Quick Repair' : undefined,
      fixRisk: 'low',
      autoFixable: office.installed,
      timestamp,
    })

    // 2. Outlook PST files
    const pst = detectOutlookPst()
    if (pst.found) {
      const totalSize = pst.files.reduce((sum, f) => sum + f.sizeMB, 0)
      const largePst = pst.files.filter(f => f.sizeMB > 2048) // >2GB PST
      results.push({
        id: `india-pst-${timestamp}`,
        module: 'india-apps',
        category: 'Outlook Data',
        title: `${pst.files.length} PST File(s) Found (${totalSize.toFixed(0)}MB)`,
        severity: largePst.length > 0 ? 'warning' : 'info',
        description: largePst.length > 0
          ? `${largePst.length} PST file(s) exceed 2GB — risk of corruption`
          : `${pst.files.length} Outlook data files found`,
        details: [
          ...pst.files.map(f => `${f.path} (${f.sizeMB}MB)`),
          ...(largePst.length > 0 ? ['WARNING: PST files over 2GB are prone to corruption', 'Recommend archiving old emails or converting to OST'] : []),
        ],
        fixAvailable: largePst.length > 0,
        fixDescription: largePst.length > 0 ? 'Run Outlook PST repair tool (scanpst.exe)' : undefined,
        fixRisk: 'medium',
        autoFixable: false,
        timestamp,
      })
    }

    // 3. Tally ERP
    const tally = detectTally()
    results.push({
      id: `india-tally-${timestamp}`,
      module: 'india-apps',
      category: 'Tally ERP',
      title: tally.installed ? `${tally.version} Detected` : 'Tally Not Installed',
      severity: tally.installed ? 'info' : 'info',
      description: tally.installed
        ? `${tally.version} at ${tally.path}`
        : 'Tally ERP/TallyPrime not found',
      details: tally.installed
        ? [
          `Path: ${tally.path}`,
          `Data: ${tally.dataPath || 'Not found'}`,
          'Backup Tally data regularly to prevent data loss',
        ]
        : ['Tally is not installed on this system'],
      fixAvailable: tally.installed,
      fixDescription: tally.installed ? 'Rewrite Tally data files and fix corruption' : undefined,
      fixRisk: 'medium',
      autoFixable: false,
      timestamp,
    })

    // 4. Java (for banking/GST)
    const java = detectJava()
    results.push({
      id: `india-java-${timestamp}`,
      module: 'india-apps',
      category: 'Java Runtime',
      title: java.installed ? `Java ${java.versions.join(', ')} Installed` : 'Java Not Installed',
      severity: java.installed ? 'info' : 'warning',
      description: java.installed
        ? `Java versions: ${java.versions.join(', ')}`
        : 'Java is required for Indian banking sites, GST portal, and digital signatures',
      details: java.installed
        ? [...java.versions.map((v, i) => `${v}: ${java.paths[i] || 'PATH'}`)]
        : [
          'Java 8 is required for:',
          '  - SBI, HDFC, PNB net banking',
          '  - GST Portal DSC signing',
          '  - Income Tax e-filing DSC',
          '  - IRCTC payment gateway',
          'Download: https://www.java.com/download/',
        ],
      fixAvailable: java.installed,
      fixDescription: java.installed ? 'Fix Java security settings for banking sites' : undefined,
      fixRisk: 'low',
      autoFixable: java.installed,
      timestamp,
    })

    // 5. Chrome profiles
    const chrome = detectChromeProfiles()
    if (chrome.profileCount > 0) {
      results.push({
        id: `india-chrome-${timestamp}`,
        module: 'india-apps',
        category: 'Chrome Browser',
        title: `${chrome.profileCount} Chrome Profile(s)`,
        severity: chrome.extensions > 30 ? 'warning' : 'info',
        description: `Profiles: ${chrome.profileCount}, Extensions: ${chrome.extensions}, Cache: ${(chrome.totalCacheSize / 1024 / 1024).toFixed(0)}MB`,
        details: [
          `Profiles: ${chrome.profileCount}`,
          `Extensions installed: ${chrome.extensions}`,
          `Cache size (sampled): ${(chrome.totalCacheSize / 1024 / 1024).toFixed(0)}MB`,
          ...(chrome.extensions > 30 ? ['Too many extensions can slow down the browser significantly'] : []),
        ],
        fixAvailable: chrome.extensions > 10,
        fixDescription: chrome.extensions > 10 ? 'Clean Chrome cache and review extensions' : undefined,
        fixRisk: 'low',
        autoFixable: false,
        timestamp,
      })
    }

    // 6. GST Portal readiness
    const gstIssues = checkGstPortalReadiness()
    results.push({
      id: `india-gst-${timestamp}`,
      module: 'india-apps',
      category: 'GST Portal',
      title: gstIssues.length === 0 ? 'GST Portal Ready' : `${gstIssues.length} GST Portal Issue(s)`,
      severity: gstIssues.length === 0 ? 'healthy' : 'warning',
      description: gstIssues.length === 0
        ? 'System is ready for GST Portal operations including DSC signing'
        : `Found ${gstIssues.length} issues that may prevent GST Portal usage`,
      details: gstIssues.length > 0 ? gstIssues : ['Java 8, emSigner, and .NET 3.5 are all available'],
      fixAvailable: gstIssues.length > 0,
      fixDescription: gstIssues.length > 0 ? 'Fix GST Portal compatibility issues' : undefined,
      fixRisk: 'low',
      autoFixable: false,
      timestamp,
    })

    // 7. Aadhaar enrollment readiness
    const aadhaarIssues = checkAadhaarReadiness()
    if (aadhaarIssues.length > 0) {
      results.push({
        id: `india-aadhaar-${timestamp}`,
        module: 'india-apps',
        category: 'Aadhaar Enrollment',
        title: `${aadhaarIssues.length} Aadhaar Issue(s)`,
        severity: 'info',
        description: 'Issues detected with Aadhaar enrollment software/hardware',
        details: aadhaarIssues,
        fixAvailable: false,
        fixRisk: 'none',
        autoFixable: false,
        timestamp,
      })
    }
  } catch (err) {
    logger.error('India apps diagnostics failed', err)
    results.push({
      id: `india-error-${timestamp}`,
      module: 'india-apps',
      category: 'Error',
      title: 'India Apps Diagnostics Error',
      severity: 'error',
      description: `Failed: ${err instanceof Error ? err.message : String(err)}`,
      details: [],
      fixAvailable: false,
      fixRisk: 'none',
      autoFixable: false,
      timestamp,
    })
  }

  return results
}

// ---- Fix Functions ----

// Fix: Repair Microsoft Office
export async function repairOffice(): Promise<FixResult> {
  const details: string[] = []
  const changes: FixChange[] = []

  try {
    if (!isWin) {
      return {
        success: false, module: 'india-apps', action: 'repair-office',
        description: 'Office repair is Windows only',
        details: [], changes: [], rollbackAvailable: false, error: 'Windows only'
      }
    }

    const office = detectOfficeInstallation()
    if (!office.installed) {
      return {
        success: false, module: 'india-apps', action: 'repair-office',
        description: 'Microsoft Office is not installed',
        details: [], changes: [], rollbackAvailable: false, error: 'Office not found'
      }
    }

    if (office.type === 'Click-to-Run') {
      // C2R Quick Repair
      const c2rExe = 'C:\\Program Files\\Common Files\\Microsoft Shared\\ClickToRun\\OfficeClickToRun.exe'
      if (existsSync(c2rExe)) {
        execSync(
          `"${c2rExe}" scenario=Repair platform=x64 culture=en-us RepairType=QuickRepair DisplayLevel=False`,
          { timeout: 300000, stdio: 'pipe' } // 5 min
        )
        details.push('Office Click-to-Run Quick Repair initiated')
        changes.push({ type: 'application', action: 'repaired', target: 'Microsoft Office' })
      } else {
        details.push('ClickToRun exe not found at expected path')
      }
    } else {
      // MSI Repair via msiexec
      details.push('For MSI Office, use Control Panel → Programs → Microsoft Office → Change → Repair')
    }

    return {
      success: changes.length > 0, module: 'india-apps', action: 'repair-office',
      description: 'Office repair initiated',
      details, changes, rollbackAvailable: false
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err)
    return {
      success: false, module: 'india-apps', action: 'repair-office',
      description: 'Office repair failed',
      details: [...details, errMsg], changes, rollbackAvailable: false, error: errMsg
    }
  }
}

// Fix: Repair Outlook PST
export async function repairOutlookPst(): Promise<FixResult> {
  const details: string[] = []
  const changes: FixChange[] = []

  try {
    if (!isWin) {
      return {
        success: false, module: 'india-apps', action: 'repair-pst',
        description: 'Outlook PST repair is Windows only',
        details: [], changes: [], rollbackAvailable: false, error: 'Windows only'
      }
    }

    // Find scanpst.exe
    const scanpstPaths = [
      'C:\\Program Files\\Microsoft Office\\root\\Office16\\SCANPST.EXE',
      'C:\\Program Files (x86)\\Microsoft Office\\root\\Office16\\SCANPST.EXE',
      'C:\\Program Files\\Microsoft Office\\Office16\\SCANPST.EXE',
      'C:\\Program Files (x86)\\Microsoft Office\\Office16\\SCANPST.EXE',
      'C:\\Program Files\\Microsoft Office\\root\\Office15\\SCANPST.EXE',
    ]

    let scanpst = ''
    for (const p of scanpstPaths) {
      if (existsSync(p)) {
        scanpst = p
        break
      }
    }

    if (!scanpst) {
      return {
        success: false, module: 'india-apps', action: 'repair-pst',
        description: 'SCANPST.EXE not found',
        details: ['Outlook Inbox Repair Tool (SCANPST.EXE) not found', 'Manually run it from Office installation directory'],
        changes: [], rollbackAvailable: false, error: 'SCANPST.EXE not found'
      }
    }

    const pst = detectOutlookPst()
    if (!pst.found) {
      return {
        success: false, module: 'india-apps', action: 'repair-pst',
        description: 'No PST files found',
        details: [], changes: [], rollbackAvailable: false, error: 'No PST files'
      }
    }

    details.push(`Found SCANPST.EXE at: ${scanpst}`)
    details.push('PST repair must be run with Outlook closed')
    details.push('')
    details.push('To repair each PST file:')
    for (const file of pst.files) {
      details.push(`  "${scanpst}" "${file.path}"`)
    }
    details.push('')
    details.push('NOTE: SCANPST.EXE requires user interaction (GUI tool)')
    details.push('Close Outlook before running repair')

    return {
      success: true, module: 'india-apps', action: 'repair-pst',
      description: 'PST repair instructions generated',
      details, changes, rollbackAvailable: false
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err)
    return {
      success: false, module: 'india-apps', action: 'repair-pst',
      description: 'PST repair check failed',
      details: [errMsg], changes, rollbackAvailable: false, error: errMsg
    }
  }
}

// Fix: Java security for banking sites
export async function fixJavaBanking(): Promise<FixResult> {
  const details: string[] = []
  const changes: FixChange[] = []

  try {
    if (!isWin) {
      return {
        success: false, module: 'india-apps', action: 'fix-java-banking',
        description: 'Java banking fixes are Windows only',
        details: [], changes: [], rollbackAvailable: false, error: 'Windows only'
      }
    }

    const java = detectJava()
    if (!java.installed) {
      return {
        success: false, module: 'india-apps', action: 'fix-java-banking',
        description: 'Java is not installed',
        details: ['Install Java 8 from java.com for banking site compatibility'],
        changes: [], rollbackAvailable: false, error: 'Java not installed'
      }
    }

    // Add banking sites to Java exception list
    const bankingSites = [
      'https://www.onlinesbi.com',
      'https://netbanking.hdfcbank.com',
      'https://netbanking.kotak.com',
      'https://www.pnbnetbanking.com',
      'https://www.gst.gov.in',
      'https://eportal.incometax.gov.in',
      'https://www.irctc.co.in',
    ]

    const javaHome = java.paths[0] || 'C:\\Program Files\\Java\\jre1.8.0_301'
    const deploymentDir = join(homedir(), 'AppData', 'LocalLow', 'Sun', 'Java', 'Deployment', 'security')
    const exceptionFile = join(deploymentDir, 'exception.sites')

    try {
      execSync(`powershell -NoProfile -Command "New-Item -ItemType Directory -Force -Path '${deploymentDir}'"`, {
        timeout: 5000, stdio: 'pipe'
      })

      const siteList = bankingSites.join('\\n')
      execSync(
        `powershell -NoProfile -Command "Set-Content -Path '${exceptionFile}' -Value '${siteList}'"`,
        { timeout: 5000, stdio: 'pipe' }
      )
      details.push('Added Indian banking sites to Java exception list:')
      details.push(...bankingSites.map(s => `  ${s}`))
      changes.push({ type: 'file', action: 'created', target: exceptionFile })
    } catch (err) {
      details.push(`Failed to update exception list: ${err instanceof Error ? err.message : String(err)}`)
    }

    // Set Java security to Medium
    try {
      const deploymentConfig = join(deploymentDir, '..', 'deployment.properties')
      execSync(
        `powershell -NoProfile -Command "Add-Content -Path '${deploymentConfig}' -Value 'deployment.security.level=MEDIUM' -Force"`,
        { timeout: 5000, stdio: 'pipe' }
      )
      details.push('Java security level set to MEDIUM for banking compatibility')
      changes.push({ type: 'file', action: 'modified', target: 'Java deployment.properties' })
    } catch {
      details.push('Could not update Java security level')
    }

    return {
      success: changes.length > 0, module: 'india-apps', action: 'fix-java-banking',
      description: 'Java configured for Indian banking sites',
      details, changes, rollbackAvailable: true
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err)
    return {
      success: false, module: 'india-apps', action: 'fix-java-banking',
      description: 'Java banking fix failed',
      details: [errMsg], changes, rollbackAvailable: false, error: errMsg
    }
  }
}

// Fix: Clean Chrome for better performance
export async function cleanChrome(): Promise<FixResult> {
  const details: string[] = []
  const changes: FixChange[] = []

  try {
    let chromeUserDataDir = ''
    if (isWin) {
      chromeUserDataDir = join(homedir(), 'AppData', 'Local', 'Google', 'Chrome', 'User Data')
    } else if (platform() === 'darwin') {
      chromeUserDataDir = join(homedir(), 'Library', 'Application Support', 'Google', 'Chrome')
    } else {
      chromeUserDataDir = join(homedir(), '.config', 'google-chrome')
    }

    if (!existsSync(chromeUserDataDir)) {
      return {
        success: false, module: 'india-apps', action: 'clean-chrome',
        description: 'Chrome data directory not found',
        details: [], changes: [], rollbackAvailable: false, error: 'Chrome not found'
      }
    }

    // Ensure Chrome is closed first
    if (isWin) {
      execSync('taskkill /IM chrome.exe /F 2>nul', { timeout: 5000, stdio: 'pipe' })
    }

    // Clean caches
    const profileDirs = readdirSync(chromeUserDataDir)
      .filter(d => d === 'Default' || d.startsWith('Profile '))

    let totalCleaned = 0
    for (const profile of profileDirs) {
      const profilePath = join(chromeUserDataDir, profile)
      const stat = lstatSync(profilePath)
      if (!stat.isDirectory() || stat.isSymbolicLink()) continue

      const cacheDirs = ['Cache', 'Code Cache', 'GPUCache', 'Service Worker']
      for (const cacheDir of cacheDirs) {
        const cachePath = join(profilePath, cacheDir)
        if (existsSync(cachePath)) {
          try {
            if (isWin) {
              execSync(`powershell -NoProfile -Command "Remove-Item '${cachePath}\\*' -Recurse -Force -ErrorAction SilentlyContinue"`, {
                timeout: 30000, stdio: 'pipe'
              })
            } else {
              execSync(`rm -rf "${cachePath}"/*`, { timeout: 30000, stdio: 'pipe' })
            }
            totalCleaned++
          } catch { /* cache in use */ }
        }
      }
    }

    details.push(`Cleaned cache directories for ${profileDirs.length} Chrome profile(s)`)
    details.push(`Cleared ${totalCleaned} cache folders`)
    changes.push({ type: 'file', action: 'cleared', target: 'Chrome cache' })

    return {
      success: true, module: 'india-apps', action: 'clean-chrome',
      description: 'Chrome cache cleaned',
      details, changes, rollbackAvailable: false
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err)
    return {
      success: false, module: 'india-apps', action: 'clean-chrome',
      description: 'Chrome cleaning failed',
      details: [errMsg], changes, rollbackAvailable: false, error: errMsg
    }
  }
}

// Fix: Enable .NET Framework 3.5 (for govt apps)
export async function enableDotNet35(): Promise<FixResult> {
  const details: string[] = []
  const changes: FixChange[] = []

  try {
    if (!isWin) {
      return {
        success: false, module: 'india-apps', action: 'enable-dotnet35',
        description: '.NET Framework 3.5 is Windows only',
        details: [], changes: [], rollbackAvailable: false, error: 'Windows only'
      }
    }

    execSync(
      'powershell -NoProfile -Command "Enable-WindowsOptionalFeature -Online -FeatureName NetFx3 -NoRestart -ErrorAction Stop"',
      { timeout: 300000, stdio: 'pipe' } // 5 min (may download from Windows Update)
    )
    details.push('.NET Framework 3.5 enabled successfully')
    details.push('This is required by many Indian government and banking applications')
    changes.push({ type: 'system', action: 'enabled', target: '.NET Framework 3.5' })

    return {
      success: true, module: 'india-apps', action: 'enable-dotnet35',
      description: '.NET Framework 3.5 enabled',
      details, changes, rollbackAvailable: true
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err)
    return {
      success: false, module: 'india-apps', action: 'enable-dotnet35',
      description: 'Failed to enable .NET Framework 3.5',
      details: [errMsg, 'May require internet connection or Windows installation media'],
      changes, rollbackAvailable: false, error: errMsg
    }
  }
}
