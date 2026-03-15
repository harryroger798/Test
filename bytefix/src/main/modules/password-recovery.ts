// ============================================================
// ByteFix Phase 2 — Password Recovery Module
// Guidance-based recovery for Windows, Mac, BIOS passwords
// IMPORTANT: This module provides GUIDANCE only — never touches SAM/hashes directly
// ============================================================

import { execSync } from 'child_process'
import { existsSync } from 'fs'
import { platform } from 'os'
import { createLogger } from '../logger'
import type { DiagnosticResult, FixResult, FixChange } from '../../shared/types'

const logger = createLogger('password-recovery')

const isWin = platform() === 'win32'
const isMac = platform() === 'darwin'

// Detect account type on Windows
function detectWindowsAccountType(): { type: 'local' | 'microsoft' | 'domain' | 'unknown'; username: string; domain: string }[] {
  const accounts: { type: 'local' | 'microsoft' | 'domain' | 'unknown'; username: string; domain: string }[] = []
  if (!isWin) return accounts

  try {
    const output = execSync(
      'powershell -NoProfile -Command "Get-LocalUser | Select-Object Name, Enabled, PrincipalSource, LastLogon | ConvertTo-Json"',
      { encoding: 'utf8', timeout: 10000, stdio: 'pipe' }
    ).trim()

    if (output) {
      const users = JSON.parse(output)
      const items = Array.isArray(users) ? users : [users]
      for (const user of items) {
        if (!user.Name) continue
        let accountType: 'local' | 'microsoft' | 'domain' | 'unknown' = 'unknown'
        const source = String(user.PrincipalSource || '').toLowerCase()
        if (source.includes('microsoftaccount')) {
          accountType = 'microsoft'
        } else if (source.includes('activedirectory')) {
          accountType = 'domain'
        } else if (source.includes('local')) {
          accountType = 'local'
        }
        accounts.push({
          type: accountType,
          username: String(user.Name),
          domain: source,
        })
      }
    }
  } catch (err) {
    logger.warn('Failed to detect Windows accounts', err)
  }
  return accounts
}

// Check if BitLocker is enabled
function checkBitLocker(): { enabled: boolean; drives: { drive: string; status: string; protectionStatus: string }[] } {
  const result = { enabled: false, drives: [] as { drive: string; status: string; protectionStatus: string }[] }
  if (!isWin) return result

  try {
    const output = execSync(
      'powershell -NoProfile -Command "Get-BitLockerVolume | Select-Object MountPoint, VolumeStatus, ProtectionStatus, EncryptionPercentage | ConvertTo-Json"',
      { encoding: 'utf8', timeout: 15000, stdio: 'pipe' }
    ).trim()

    if (output) {
      const volumes = JSON.parse(output)
      const items = Array.isArray(volumes) ? volumes : [volumes]
      for (const vol of items) {
        if (!vol.MountPoint) continue
        const status = String(vol.VolumeStatus || 'Unknown')
        const protection = String(vol.ProtectionStatus || 'Unknown')
        result.drives.push({
          drive: String(vol.MountPoint),
          status,
          protectionStatus: protection,
        })
        if (protection === 'On' || protection === '1') {
          result.enabled = true
        }
      }
    }
  } catch {
    // BitLocker cmdlet not available (Home edition)
  }
  return result
}

// Check if Windows Hello is configured
function checkWindowsHello(): { pinConfigured: boolean; fingerprintConfigured: boolean; faceConfigured: boolean } {
  const result = { pinConfigured: false, fingerprintConfigured: false, faceConfigured: false }
  if (!isWin) return result

  try {
    // Check for PIN
    const pinPath = 'C:\\Windows\\ServiceProfiles\\LocalService\\AppData\\Local\\Microsoft\\Ngc'
    if (existsSync(pinPath)) {
      result.pinConfigured = true
    }

    // Check for biometric devices
    const output = execSync(
      'powershell -NoProfile -Command "Get-PnpDevice -Class Biometric -ErrorAction SilentlyContinue | Select-Object FriendlyName, Status | ConvertTo-Json"',
      { encoding: 'utf8', timeout: 10000, stdio: 'pipe' }
    ).trim()

    if (output && output !== '[]') {
      const devices = JSON.parse(output)
      const items = Array.isArray(devices) ? devices : [devices]
      for (const dev of items) {
        const name = String(dev.FriendlyName || '').toLowerCase()
        if (name.includes('fingerprint')) result.fingerprintConfigured = true
        if (name.includes('face') || name.includes('camera') || name.includes('ir')) result.faceConfigured = true
      }
    }
  } catch {
    // Not critical
  }
  return result
}

// Check for BitLocker recovery key in Microsoft account
function getBitLockerRecoveryGuidance(): string[] {
  const steps: string[] = []
  steps.push('BitLocker Recovery Key Sources:')
  steps.push('1. Microsoft Account: Go to https://account.microsoft.com/devices/recoverykey')
  steps.push('2. Azure AD: If device was joined to organization, contact IT admin')
  steps.push('3. USB Drive: Check if customer saved recovery key to USB during BitLocker setup')
  steps.push('4. Printout: Customer may have printed the key during setup')
  steps.push('5. Active Directory: If domain-joined, admin can retrieve from AD')
  steps.push('')
  steps.push('WITHOUT recovery key: Data on encrypted drive CANNOT be accessed.')
  steps.push('The drive must be formatted, losing all data.')
  return steps
}

// Generate Windows password recovery guidance
function getWindowsRecoveryGuide(accountType: 'local' | 'microsoft' | 'domain' | 'unknown'): string[] {
  const steps: string[] = []

  if (accountType === 'microsoft') {
    steps.push('=== Microsoft Account Password Reset ===')
    steps.push('1. From any device with internet, go to: https://account.live.com/password/reset')
    steps.push('2. Choose reset method: email, SMS, or Authenticator app')
    steps.push('3. If no recovery methods available: https://account.live.com/acsr (form review, 24-48h)')
    steps.push('4. If Windows Hello PIN is set, try PIN login → then change password from Settings')
    steps.push('')
    steps.push('Success rate: ~99% if has recovery email/phone, ~30% via form')
  } else if (accountType === 'local') {
    steps.push('=== Local Account Password Recovery ===')
    steps.push('Method 1: Security Questions (Windows 10 1803+)')
    steps.push('  - At login screen, click "Reset password" link')
    steps.push('  - Answer 3 security questions set during account creation')
    steps.push('')
    steps.push('Method 2: Password Reset Disk (if created before)')
    steps.push('  - At login screen → "Reset password" → Use password reset disk')
    steps.push('')
    steps.push('Method 3: Another Admin Account')
    steps.push('  - Login as another admin on same PC')
    steps.push('  - Control Panel → User Accounts → Manage another account → Change password')
    steps.push('')
    steps.push('Method 4: Offline Tools (Technician Use)')
    steps.push('  - Boot from Linux Live USB (Ubuntu/Hiren\'s Boot)')
    steps.push('  - Use chntpw to blank the password in SAM registry hive')
    steps.push('  - Reboot → login with blank password → set new password')
    steps.push('  - Download chntpw: https://pogostick.net/~pnh/ntpasswd/')
    steps.push('')
    steps.push('Method 5: Utilman/Sethc Replacement (WinRE)')
    steps.push('  - Boot to Recovery: Hold Shift + Restart, or force-off 3 times')
    steps.push('  - Troubleshoot → Advanced → Command Prompt')
    steps.push('  - Backup and replace utilman.exe with cmd.exe')
    steps.push('  - At login screen, click Ease of Access → get SYSTEM cmd')
    steps.push('  - Run: net user <username> <newpassword>')
    steps.push('  - IMPORTANT: Restore original utilman.exe after')
    steps.push('')
    steps.push('Success rate: ~90-95% for local accounts')
  } else if (accountType === 'domain') {
    steps.push('=== Domain Account Password Reset ===')
    steps.push('1. Contact organization IT department / helpdesk')
    steps.push('2. IT admin can reset password in Active Directory')
    steps.push('3. If AD self-service portal exists, use: https://passwordreset.microsoftonline.com')
    steps.push('4. Cached credentials may allow offline login with old password')
    steps.push('')
    steps.push('Note: Domain accounts CANNOT be reset locally without AD admin access')
  } else {
    steps.push('=== Password Recovery (Unknown Account Type) ===')
    steps.push('1. Try Windows Hello PIN if configured')
    steps.push('2. Check if another admin account exists on this PC')
    steps.push('3. Try Microsoft account reset: https://account.live.com/password/reset')
    steps.push('4. For local accounts, use offline tools (chntpw via Linux USB)')
  }

  return steps
}

// Generate Mac password recovery guidance
function getMacRecoveryGuide(): string[] {
  return [
    '=== Mac Password Recovery ===',
    '',
    'Method 1: Apple ID Reset (Easiest)',
    '  - At login, enter wrong password 3 times',
    '  - Click "Reset it using your Apple ID"',
    '  - Enter Apple ID credentials → Set new password',
    '  - Note: Old Keychain will be inaccessible',
    '',
    'Method 2: Recovery Mode (Intel Macs pre-2020)',
    '  - Shut down → Power on → Hold Cmd+R immediately',
    '  - In Recovery: Utilities → Terminal',
    '  - Type: resetpassword',
    '  - Select user → Set new password → Reboot',
    '',
    'Method 3: Recovery Mode (Apple Silicon M1/M2/M3/M4)',
    '  - Shut down → Press and HOLD power button',
    '  - "Loading startup options" → Options → Continue',
    '  - Utilities → Terminal → resetpassword',
    '  - Note: FileVault ON requires authentication first',
    '',
    'Method 4: FileVault Recovery Key',
    '  - If FileVault enabled: Need recovery key or Apple ID',
    '  - Check Apple ID: At login → "Restart and show password reset options"',
    '  - Recovery key format: XXXX-XXXX-XXXX-XXXX-XXXX-XXXX',
    '  - No key + no Apple ID = Data UNRECOVERABLE (AES-256)',
    '',
    'Method 5: Target Disk Mode (Intel Macs without T2)',
    '  - Shut down → Power on → Hold T immediately',
    '  - Connect to another Mac via Thunderbolt/USB-C',
    '  - Access files directly (no password needed if no FileVault)',
    '',
    'Apple Silicon + Activation Lock:',
    '  - Find My Mac enabled: Need Apple ID or proof of purchase',
    '  - Apple Store can remove Activation Lock with receipt',
    '',
    'Success rates:',
    '  Apple ID linked: ~80%',
    '  Recovery Mode (Intel): ~98%',
    '  Apple Silicon + FileVault: ~50%',
    '  Activation Lock: ~30%',
  ]
}

// Generate BIOS password guidance
function getBiosRecoveryGuide(): string[] {
  return [
    '=== BIOS/UEFI Password Recovery ===',
    '',
    'Method 1: Manufacturer Master Password',
    '  - Many laptops have a master/backdoor password',
    '  - Get the "System Disabled" code shown after 3 failed attempts',
    '  - Look up master password at: https://bios-pw.org',
    '  - Works for: Dell, HP, Lenovo, Acer, Samsung, Fujitsu',
    '',
    'Method 2: CMOS Battery Reset (Desktop/accessible laptops)',
    '  - Power off → Unplug → Open case',
    '  - Remove CMOS battery (CR2032) for 30 seconds',
    '  - Replace battery → Power on → BIOS settings reset',
    '  - Note: Resets ALL BIOS settings, not just password',
    '',
    'Method 3: CMOS Jumper Reset',
    '  - Locate CLR_CMOS or JCMOS1 jumper on motherboard',
    '  - Move jumper to reset position for 10 seconds',
    '  - Return to normal position → Power on',
    '',
    'Method 4: Manufacturer Contact',
    '  - Dell: Provide Service Tag → They generate master password',
    '  - HP: Contact support with proof of ownership',
    '  - Lenovo: Service center with purchase receipt',
    '',
    'Method 5: EEPROM Programmer (Advanced)',
    '  - CH341A USB programmer (~Rs.200-500 on Amazon India)',
    '  - SOIC8 clip to connect to BIOS chip',
    '  - Read BIOS chip → Clear password bytes → Write back',
    '  - WARNING: Can brick the device if done incorrectly',
    '',
    'IMPORTANT: BIOS password recovery should only be done on devices',
    'with verified ownership. Document the service request.',
    '',
    'Success rates:',
    '  Master password (bios-pw.org): ~60-70%',
    '  CMOS reset: ~90% (if accessible)',
    '  Manufacturer contact: ~80% (with proof)',
    '  EEPROM programming: ~85% (advanced skill)',
  ]
}

// Check Windows product key (for license recovery before format)
function findWindowsProductKey(): string | null {
  if (!isWin) return null
  try {
    const output = execSync(
      'powershell -NoProfile -Command "(Get-WmiObject -Query \'SELECT OA3xOriginalProductKey FROM SoftwareLicensingService\').OA3xOriginalProductKey"',
      { encoding: 'utf8', timeout: 10000, stdio: 'pipe' }
    ).trim()
    if (output && output.length > 10) return output
  } catch { /* not available */ }

  try {
    const output = execSync(
      'powershell -NoProfile -Command "(Get-ItemProperty -Path \'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\SoftwareLicensingTokens\' -ErrorAction SilentlyContinue).ProductKey"',
      { encoding: 'utf8', timeout: 10000, stdio: 'pipe' }
    ).trim()
    if (output && output.length > 10) return output
  } catch { /* not available */ }

  return null
}

// Check saved WiFi passwords (useful before format)
function getSavedWifiPasswords(): { ssid: string; password: string }[] {
  const passwords: { ssid: string; password: string }[] = []
  if (!isWin) return passwords

  try {
    const profiles = execSync(
      'netsh wlan show profiles',
      { encoding: 'utf8', timeout: 10000, stdio: 'pipe' }
    )
    const ssids = profiles.match(/All User Profile\s*:\s*(.+)/g) || []

    for (const line of ssids.slice(0, 20)) { // Limit to 20
      const ssid = line.replace(/All User Profile\s*:\s*/, '').trim()
      if (!ssid) continue
      try {
        const detail = execSync(
          `netsh wlan show profile name="${ssid}" key=clear`,
          { encoding: 'utf8', timeout: 5000, stdio: 'pipe' }
        )
        const keyMatch = detail.match(/Key Content\s*:\s*(.+)/)
        if (keyMatch) {
          passwords.push({ ssid, password: keyMatch[1].trim() })
        }
      } catch { /* skip individual failures */ }
    }
  } catch (err) {
    logger.warn('Failed to get WiFi passwords', err)
  }
  return passwords
}

// Main diagnostics function
export async function runPasswordRecoveryDiagnostics(): Promise<DiagnosticResult[]> {
  const results: DiagnosticResult[] = []
  const timestamp = Date.now()

  try {
    if (isWin) {
      // 1. Detect account types
      const accounts = detectWindowsAccountType()
      if (accounts.length > 0) {
        const accountDetails = accounts.map(a => `${a.username} (${a.type})`)
        results.push({
          id: `pw-accounts-${timestamp}`,
          module: 'password-recovery',
          category: 'User Accounts',
          title: 'Windows User Accounts',
          severity: 'info',
          description: `Found ${accounts.length} user accounts`,
          details: accountDetails,
          fixAvailable: true,
          fixDescription: 'View password recovery guide for each account type',
          fixRisk: 'none',
          autoFixable: false,
          timestamp,
        })
      }

      // 2. Check BitLocker
      const bitlocker = checkBitLocker()
      if (bitlocker.enabled) {
        results.push({
          id: `pw-bitlocker-${timestamp}`,
          module: 'password-recovery',
          category: 'Encryption',
          title: 'BitLocker Encryption Detected',
          severity: 'warning',
          description: 'One or more drives are BitLocker encrypted. Recovery key is required for any offline password reset.',
          details: [
            ...bitlocker.drives.map(d => `${d.drive}: ${d.status} (Protection: ${d.protectionStatus})`),
            ...getBitLockerRecoveryGuidance(),
          ],
          fixAvailable: false,
          fixRisk: 'high',
          autoFixable: false,
          timestamp,
        })
      }

      // 3. Check Windows Hello
      const hello = checkWindowsHello()
      if (hello.pinConfigured || hello.fingerprintConfigured || hello.faceConfigured) {
        const methods: string[] = []
        if (hello.pinConfigured) methods.push('PIN')
        if (hello.fingerprintConfigured) methods.push('Fingerprint')
        if (hello.faceConfigured) methods.push('Face Recognition')

        results.push({
          id: `pw-hello-${timestamp}`,
          module: 'password-recovery',
          category: 'Windows Hello',
          title: 'Alternative Sign-in Methods Available',
          severity: 'info',
          description: `Windows Hello configured: ${methods.join(', ')}. These may bypass the need for password recovery.`,
          details: [
            `Active methods: ${methods.join(', ')}`,
            'If PIN works, use it to login → then change password from Settings → Accounts → Sign-in options',
          ],
          fixAvailable: false,
          fixRisk: 'none',
          autoFixable: false,
          timestamp,
        })
      }

      // 4. Windows product key (backup before format)
      const productKey = findWindowsProductKey()
      if (productKey) {
        results.push({
          id: `pw-productkey-${timestamp}`,
          module: 'password-recovery',
          category: 'License Recovery',
          title: 'Windows Product Key Found',
          severity: 'info',
          description: 'Windows product key recovered. Save this before any format/reinstall.',
          details: [`Product Key: ${productKey}`, 'Save this key before formatting the drive'],
          fixAvailable: false,
          fixRisk: 'none',
          autoFixable: false,
          timestamp,
        })
      }

      // 5. Saved WiFi passwords (backup)
      const wifiPasswords = getSavedWifiPasswords()
      if (wifiPasswords.length > 0) {
        results.push({
          id: `pw-wifi-${timestamp}`,
          module: 'password-recovery',
          category: 'Saved Credentials',
          title: `${wifiPasswords.length} Saved WiFi Passwords Found`,
          severity: 'info',
          description: 'WiFi passwords recovered from system. Save these before format/reset.',
          details: wifiPasswords.map(w => `${w.ssid}: ${w.password}`),
          fixAvailable: false,
          fixRisk: 'none',
          autoFixable: false,
          timestamp,
        })
      }

      // 6. Recovery guide based on detected accounts
      for (const account of accounts) {
        const guide = getWindowsRecoveryGuide(account.type)
        results.push({
          id: `pw-guide-${timestamp}-${account.username}`,
          module: 'password-recovery',
          category: 'Recovery Guide',
          title: `Recovery Guide: ${account.username} (${account.type})`,
          severity: 'info',
          description: `Step-by-step password recovery guide for ${account.type} account`,
          details: guide,
          fixAvailable: false,
          fixRisk: 'none',
          autoFixable: false,
          timestamp,
        })
      }
    } else if (isMac) {
      // Mac recovery guide
      results.push({
        id: `pw-mac-guide-${timestamp}`,
        module: 'password-recovery',
        category: 'Recovery Guide',
        title: 'Mac Password Recovery Guide',
        severity: 'info',
        description: 'Complete guide for recovering Mac login password',
        details: getMacRecoveryGuide(),
        fixAvailable: false,
        fixRisk: 'none',
        autoFixable: false,
        timestamp,
      })

      // Check FileVault status
      try {
        const fvOutput = execFileSync('fdesetup', ['status'], { encoding: 'utf8', timeout: 5000, stdio: 'pipe' })
        const fvEnabled = fvOutput.includes('On')
        results.push({
          id: `pw-filevault-${timestamp}`,
          module: 'password-recovery',
          category: 'Encryption',
          title: `FileVault: ${fvEnabled ? 'ENABLED' : 'Disabled'}`,
          severity: fvEnabled ? 'warning' : 'info',
          description: fvEnabled
            ? 'FileVault is enabled. Recovery key or Apple ID required for password reset.'
            : 'FileVault is not enabled. Recovery Mode password reset will work without encryption key.',
          details: fvEnabled
            ? ['FileVault recovery key or linked Apple ID is REQUIRED', 'Without it, data cannot be recovered']
            : ['Recovery Mode → resetpassword command will work'],
          fixAvailable: false,
          fixRisk: 'none',
          autoFixable: false,
          timestamp,
        })
      } catch { /* fdesetup not available */ }
    }

    // BIOS recovery guide (always available)
    results.push({
      id: `pw-bios-guide-${timestamp}`,
      module: 'password-recovery',
      category: 'BIOS Recovery',
      title: 'BIOS/UEFI Password Recovery Guide',
      severity: 'info',
      description: 'Guide for recovering BIOS/UEFI passwords on various laptop brands',
      details: getBiosRecoveryGuide(),
      fixAvailable: false,
      fixRisk: 'none',
      autoFixable: false,
      timestamp,
    })

  } catch (err) {
    logger.error('Password recovery diagnostics failed', err)
    results.push({
      id: `pw-error-${timestamp}`,
      module: 'password-recovery',
      category: 'Error',
      title: 'Password Recovery Diagnostics Error',
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

// Enable hidden Administrator account (Windows)
export async function enableAdminAccount(): Promise<FixResult> {
  const details: string[] = []
  const changes: FixChange[] = []

  try {
    if (!isWin) {
      return {
        success: false, module: 'password-recovery', action: 'enable-admin',
        description: 'This operation is Windows only',
        details: [], changes: [], rollbackAvailable: false, error: 'Windows only'
      }
    }

    execSync('net user Administrator /active:yes', { timeout: 10000, stdio: 'pipe' })
    details.push('Built-in Administrator account has been enabled')
    details.push('IMPORTANT: Disable it after use with: net user Administrator /active:no')
    changes.push({ type: 'system', action: 'enabled', target: 'Built-in Administrator account' })

    return {
      success: true, module: 'password-recovery', action: 'enable-admin',
      description: 'Built-in Administrator account enabled',
      details, changes, rollbackAvailable: true
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err)
    return {
      success: false, module: 'password-recovery', action: 'enable-admin',
      description: 'Failed to enable Administrator account (may require elevation)',
      details: [errMsg], changes, rollbackAvailable: false, error: errMsg
    }
  }
}

// Disable hidden Administrator account (rollback)
export async function disableAdminAccount(): Promise<FixResult> {
  try {
    if (!isWin) {
      return {
        success: false, module: 'password-recovery', action: 'disable-admin',
        description: 'Windows only', details: [], changes: [], rollbackAvailable: false, error: 'Windows only'
      }
    }
    execSync('net user Administrator /active:no', { timeout: 10000, stdio: 'pipe' })
    return {
      success: true, module: 'password-recovery', action: 'disable-admin',
      description: 'Built-in Administrator account disabled',
      details: ['Administrator account deactivated for security'],
      changes: [{ type: 'system', action: 'disabled', target: 'Built-in Administrator account' }],
      rollbackAvailable: false
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err)
    return {
      success: false, module: 'password-recovery', action: 'disable-admin',
      description: 'Failed to disable Administrator account',
      details: [errMsg], changes: [], rollbackAvailable: false, error: errMsg
    }
  }
}
