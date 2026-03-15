import { execFileSync } from 'child_process'
import { platform } from 'os'
import { createLogger } from '../logger'
import type { DiagnosticResult, FixResult, FixChange } from '../../shared/types'

const logger = createLogger('windows-activation')
const isWindows = platform() === 'win32'

// ============================================================
// License Status Detection
// ============================================================
interface ActivationStatus {
  activated: boolean
  licenseType: string
  partialKey: string
  expirationDate: string
  edition: string
  statusDescription: string
  errorCode: string
  kmsServer: string
  graceRemaining: number
}

async function getActivationStatus(): Promise<ActivationStatus> {
  const status: ActivationStatus = {
    activated: false,
    licenseType: 'Unknown',
    partialKey: '',
    expirationDate: '',
    edition: '',
    statusDescription: 'Could not determine activation status',
    errorCode: '',
    kmsServer: '',
    graceRemaining: 0
  }

  if (!isWindows) {
    status.statusDescription = 'Windows activation check is only available on Windows'
    return status
  }

  // Get license status via slmgr
  try {
    const output = execFileSync('cscript', [
      '//nologo', 'C:\\Windows\\System32\\slmgr.vbs', '/dli'
    ], { timeout: 30000, encoding: 'utf8' })

    // Parse license status
    const nameMatch = output.match(/Name:\s*(.+)/i)
    if (nameMatch) status.edition = nameMatch[1].trim()

    const descMatch = output.match(/Description:\s*(.+)/i)
    if (descMatch) status.licenseType = descMatch[1].trim()

    const statusMatch = output.match(/License Status:\s*(.+)/i)
    if (statusMatch) {
      status.statusDescription = statusMatch[1].trim()
      status.activated = /licensed/i.test(statusMatch[1])
    }

    const keyMatch = output.match(/Partial Product Key:\s*(.+)/i)
    if (keyMatch) status.partialKey = keyMatch[1].trim()

    // Check for grace period
    const graceMatch = output.match(/Grace Time Remaining:\s*(\d+)/i)
    if (graceMatch) status.graceRemaining = parseInt(graceMatch[1])
  } catch (err) {
    logger.warn('slmgr /dli failed', err)
  }

  // Get detailed activation info
  try {
    const output = execFileSync('cscript', [
      '//nologo', 'C:\\Windows\\System32\\slmgr.vbs', '/dlv'
    ], { timeout: 30000, encoding: 'utf8' })

    const expMatch = output.match(/License Expiration:\s*(.+)/i)
    if (expMatch) status.expirationDate = expMatch[1].trim()

    const kmsMatch = output.match(/KMS Machine Name:\s*(.+)/i)
    if (kmsMatch) status.kmsServer = kmsMatch[1].trim()

    const errorMatch = output.match(/Error Code:\s*(.+)/i)
    if (errorMatch) status.errorCode = errorMatch[1].trim()
  } catch {
    // dlv may fail without admin
  }

  // Fallback: Check via PowerShell if slmgr failed
  if (status.edition === '') {
    try {
      const output = execFileSync('powershell', [
        '-NoProfile', '-Command',
        '(Get-CimInstance -ClassName SoftwareLicensingProduct -Filter "ApplicationId=\'55c92734-d682-4d71-983e-d6ec3f16059f\' AND PartialProductKey IS NOT NULL" -ErrorAction SilentlyContinue | Select-Object Name,LicenseStatus,PartialProductKey,Description | ConvertTo-Json)'
      ], { timeout: 15000, encoding: 'utf8' })

      if (output.trim()) {
        const data = JSON.parse(output)
        const item = Array.isArray(data) ? data[0] : data
        if (item) {
          status.edition = item.Name || status.edition
          status.partialKey = item.PartialProductKey || status.partialKey
          status.licenseType = item.Description || status.licenseType
          // LicenseStatus: 0=Unlicensed, 1=Licensed, 2=OOBGrace, 3=OOTGrace, 4=NonGenuine, 5=Notification, 6=ExtendedGrace
          const ls = item.LicenseStatus
          status.activated = ls === 1
          const statusMap: Record<number, string> = {
            0: 'Unlicensed',
            1: 'Licensed (Activated)',
            2: 'Out-of-Box Grace Period',
            3: 'Out-of-Tolerance Grace Period',
            4: 'Non-Genuine',
            5: 'Notification Mode',
            6: 'Extended Grace Period'
          }
          status.statusDescription = statusMap[ls] || `Unknown (${ls})`
        }
      }
    } catch { /* ignore */ }
  }

  return status
}

// ============================================================
// Common Activation Issues Detection
// ============================================================
interface ActivationIssue {
  code: string
  description: string
  severity: 'info' | 'warning' | 'critical'
  solution: string[]
}

function detectActivationIssues(status: ActivationStatus): ActivationIssue[] {
  const issues: ActivationIssue[] = []

  if (!status.activated) {
    if (/grace/i.test(status.statusDescription)) {
      issues.push({
        code: 'GRACE_PERIOD',
        description: 'Windows is in grace period. Activation required soon.',
        severity: 'warning',
        solution: [
          'Go to Settings → System → Activation',
          'Click "Troubleshoot" to attempt automatic activation',
          'If you have a product key, click "Change product key"',
          'If this is a new PC, the OEM key should activate automatically when online'
        ]
      })
    } else if (/non-genuine|notification/i.test(status.statusDescription)) {
      issues.push({
        code: 'NON_GENUINE',
        description: 'Windows license is not genuine.',
        severity: 'critical',
        solution: [
          'Purchase a genuine Windows license from microsoft.com',
          'Check if the PC came with an OEM license (sticker on bottom/battery bay)',
          'Contact Microsoft support for activation help: support.microsoft.com/windows',
          'Phone activation: slui 4 (in Run dialog)'
        ]
      })
    } else if (/unlicensed/i.test(status.statusDescription)) {
      issues.push({
        code: 'UNLICENSED',
        description: 'Windows is not activated.',
        severity: 'warning',
        solution: [
          'Go to Settings → System → Activation',
          'Enter a valid product key if you have one',
          'Run the activation troubleshooter',
          'If recently reinstalled with digital license, sign in with Microsoft account linked to the license'
        ]
      })
    }
  }

  // Check for common error codes
  if (status.errorCode) {
    const errorSolutions: Record<string, ActivationIssue> = {
      '0xC004C003': {
        code: '0xC004C003',
        description: 'The activation server determined the specified product key is blocked.',
        severity: 'critical',
        solution: [
          'This key has been used on too many devices or is invalid',
          'Contact Microsoft support',
          'Purchase a new license'
        ]
      },
      '0xC004F074': {
        code: '0xC004F074',
        description: 'KMS activation failed - could not contact KMS server.',
        severity: 'warning',
        solution: [
          'Check network connectivity to your organization KMS server',
          'Contact IT administrator to verify KMS server is running',
          'Ensure firewall allows KMS traffic (TCP port 1688)'
        ]
      },
      '0xC004C008': {
        code: '0xC004C008',
        description: 'The activation server reported that the product key has exceeded its unlock limit.',
        severity: 'warning',
        solution: [
          'This key has been used on the maximum number of devices',
          'Deactivate on old device first, or use phone activation',
          'Contact Microsoft: slui 4 for phone activation'
        ]
      },
      '0xC004F034': {
        code: '0xC004F034',
        description: 'Volume license key not found.',
        severity: 'warning',
        solution: [
          'Contact IT administrator for correct volume license key',
          'Run: slmgr /ipk <your-volume-key> from elevated prompt'
        ]
      }
    }

    const knownError = Object.keys(errorSolutions).find(code =>
      status.errorCode.includes(code)
    )
    if (knownError) {
      issues.push(errorSolutions[knownError])
    }
  }

  // KMS-related check
  if (status.kmsServer && !status.activated) {
    issues.push({
      code: 'KMS_ISSUE',
      description: `KMS server configured (${status.kmsServer}) but activation failed.`,
      severity: 'warning',
      solution: [
        `Verify KMS server ${status.kmsServer} is reachable`,
        'Check DNS SRV record: nslookup -type=srv _vlmcs._tcp',
        'Contact IT administrator'
      ]
    })
  }

  return issues
}

// ============================================================
// Run Activation Troubleshooter
// ============================================================
export async function runActivationTroubleshooter(): Promise<FixResult> {
  const changes: FixChange[] = []
  const details: string[] = []

  if (!isWindows) {
    return {
      success: true, module: 'windows-activation', action: 'troubleshoot',
      description: 'Windows activation is only available on Windows',
      details: ['This feature is not applicable on macOS/Linux'],
      changes: [], rollbackAvailable: false
    }
  }

  // Launch the built-in activation troubleshooter
  try {
    execFileSync('powershell', [
      '-NoProfile', '-Command',
      'Start-Process "ms-settings:activation" -ErrorAction SilentlyContinue'
    ], { timeout: 10000, encoding: 'utf8' })
    details.push('Opened Windows Activation settings')
    details.push('Click "Troubleshoot" to run the activation troubleshooter')
    changes.push({ type: 'system', action: 'created', target: 'Activation Settings opened' })
  } catch {
    details.push('Could not open Activation settings automatically')
    details.push('Manual steps: Settings → System → Activation → Troubleshoot')
  }

  // Try command-line activation troubleshooter
  try {
    execFileSync('powershell', [
      '-NoProfile', '-Command',
      'Get-TroubleshootingPack -Path "C:\\Windows\\diagnostics\\system\\WindowsActivation" -ErrorAction SilentlyContinue | Invoke-TroubleshootingPack -ErrorAction SilentlyContinue'
    ], { timeout: 60000, encoding: 'utf8' })
    details.push('Ran Windows Activation troubleshooter')
    changes.push({ type: 'system', action: 'repaired', target: 'Activation Troubleshooter' })
  } catch {
    details.push('Automated troubleshooter could not run (may need admin privileges)')
  }

  // Additional steps
  details.push('')
  details.push('Additional activation methods:')
  details.push('  1. Phone activation: Run slui 4 (Start → Run → slui 4)')
  details.push('  2. Microsoft support: support.microsoft.com/windows')
  details.push('  3. Digital license: Sign in with Microsoft account linked to your license')
  details.push('  4. OEM key: Check sticker on bottom of laptop or battery compartment')

  return {
    success: true,
    module: 'windows-activation',
    action: 'troubleshoot',
    description: 'Activation troubleshooting',
    details, changes, rollbackAvailable: false
  }
}

// ============================================================
// Check Office Activation Status
// ============================================================
interface OfficeActivationStatus {
  installed: boolean
  version: string
  activated: boolean
  licenseType: string
  details: string[]
}

async function checkOfficeActivation(): Promise<OfficeActivationStatus> {
  const result: OfficeActivationStatus = {
    installed: false,
    version: '',
    activated: false,
    licenseType: '',
    details: []
  }

  if (!isWindows) return result

  try {
    // Check for Office installation
    const output = execFileSync('powershell', [
      '-NoProfile', '-Command',
      '$paths = @("C:\\Program Files\\Microsoft Office", "C:\\Program Files (x86)\\Microsoft Office", "C:\\Program Files\\Microsoft Office 15", "C:\\Program Files\\Microsoft Office 16"); foreach ($p in $paths) { if (Test-Path $p) { $p; break } }'
    ], { timeout: 10000, encoding: 'utf8' })

    if (output.trim()) {
      result.installed = true
      result.details.push(`Office found at: ${output.trim()}`)
    }
  } catch { /* ignore */ }

  if (result.installed) {
    // Check Office license status
    try {
      const osppPaths = [
        'C:\\Program Files\\Microsoft Office\\Office16\\ospp.vbs',
        'C:\\Program Files\\Microsoft Office\\Office15\\ospp.vbs',
        'C:\\Program Files (x86)\\Microsoft Office\\Office16\\ospp.vbs',
        'C:\\Program Files (x86)\\Microsoft Office\\Office15\\ospp.vbs'
      ]

      for (const osppPath of osppPaths) {
        try {
          const output = execFileSync('cscript', [
            '//nologo', osppPath, '/dstatus'
          ], { timeout: 30000, encoding: 'utf8' })

          if (output.trim()) {
            const licenseMatch = output.match(/LICENSE STATUS:\s*(.+)/i)
            if (licenseMatch) {
              result.activated = /---LICENSED---/i.test(licenseMatch[1])
              result.licenseType = licenseMatch[1].trim()
            }
            const versionMatch = output.match(/LICENSE NAME:\s*(.+)/i)
            if (versionMatch) result.version = versionMatch[1].trim()
            break
          }
        } catch { /* try next path */ }
      }
    } catch { /* ignore */ }
  }

  // Fallback: Check via registry
  if (result.installed && !result.version) {
    try {
      const output = execFileSync('powershell', [
        '-NoProfile', '-Command',
        'Get-ItemProperty "HKLM:\\SOFTWARE\\Microsoft\\Office\\*\\Common\\InstallRoot" -ErrorAction SilentlyContinue | Select-Object PSParentPath | ConvertTo-Json'
      ], { timeout: 10000, encoding: 'utf8' })

      if (output.trim()) {
        const data = JSON.parse(output)
        const item = Array.isArray(data) ? data[0] : data
        if (item?.PSParentPath) {
          const vMatch = item.PSParentPath.match(/Office\\(\d+)/)
          if (vMatch) {
            const verMap: Record<string, string> = {
              '16': 'Office 2016/2019/2021/365',
              '15': 'Office 2013',
              '14': 'Office 2010'
            }
            result.version = verMap[vMatch[1]] || `Office ${vMatch[1]}`
          }
        }
      }
    } catch { /* ignore */ }
  }

  return result
}

// ============================================================
// Main Diagnostics
// ============================================================
export async function runActivationDiagnostics(): Promise<DiagnosticResult[]> {
  const results: DiagnosticResult[] = []

  if (!isWindows) {
    results.push({
      id: `act-nowin-${Date.now()}`,
      module: 'windows-activation',
      category: 'Activation',
      title: 'Windows activation check not applicable',
      severity: 'info',
      description: 'This module is for Windows activation diagnostics only',
      details: [
        `Current OS: ${platform()}`,
        'macOS: Check Apple ID in System Preferences',
        'Linux: Most distributions are free and do not require activation'
      ],
      fixAvailable: false,
      fixRisk: 'none',
      autoFixable: false,
      timestamp: Date.now()
    })
    return results
  }

  // 1. Windows activation status
  const status = await getActivationStatus()

  results.push({
    id: `act-status-${Date.now()}`,
    module: 'windows-activation',
    category: 'Windows Activation',
    title: `Windows: ${status.statusDescription}`,
    severity: status.activated ? 'healthy' : 'warning',
    description: status.activated
      ? `Windows is activated (${status.licenseType})`
      : `Windows is NOT activated: ${status.statusDescription}`,
    details: [
      `Edition: ${status.edition}`,
      `Status: ${status.statusDescription}`,
      `License type: ${status.licenseType}`,
      status.partialKey ? `Partial key: ${status.partialKey}` : 'No product key found',
      status.expirationDate ? `Expiration: ${status.expirationDate}` : '',
      status.kmsServer ? `KMS server: ${status.kmsServer}` : '',
      status.errorCode ? `Error: ${status.errorCode}` : ''
    ].filter(Boolean),
    fixAvailable: !status.activated,
    fixDescription: 'Run activation troubleshooter',
    fixRisk: 'none',
    autoFixable: true,
    timestamp: Date.now()
  })

  // 2. Activation issues
  const issues = detectActivationIssues(status)
  for (const issue of issues) {
    results.push({
      id: `act-issue-${issue.code}-${Date.now()}`,
      module: 'windows-activation',
      category: 'Activation Issues',
      title: `[${issue.code}] ${issue.description}`,
      severity: issue.severity,
      description: issue.description,
      details: issue.solution,
      fixAvailable: true,
      fixDescription: 'Run activation troubleshooter',
      fixRisk: 'none',
      autoFixable: true,
      timestamp: Date.now()
    })
  }

  // 3. Office activation
  const office = await checkOfficeActivation()
  if (office.installed) {
    results.push({
      id: `act-office-${Date.now()}`,
      module: 'windows-activation',
      category: 'Office Activation',
      title: office.activated
        ? `Microsoft Office: Activated (${office.version})`
        : `Microsoft Office: NOT Activated (${office.version})`,
      severity: office.activated ? 'healthy' : 'warning',
      description: office.activated
        ? `${office.version} is properly licensed`
        : `${office.version} needs activation`,
      details: [
        `Version: ${office.version}`,
        `License: ${office.licenseType || 'Unknown'}`,
        `Activated: ${office.activated ? 'Yes' : 'No'}`,
        ...office.details,
        ...(office.activated ? [] : [
          'To activate Office:',
          '  1. Open any Office app (Word, Excel, etc.)',
          '  2. Go to File → Account',
          '  3. Click "Activate Product" or enter your product key',
          '  4. Sign in with Microsoft account if using Microsoft 365'
        ])
      ],
      fixAvailable: !office.activated,
      fixDescription: 'Guide to Office activation',
      fixRisk: 'none',
      autoFixable: false,
      timestamp: Date.now()
    })
  }

  return results
}
