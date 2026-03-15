import { execFileSync } from 'child_process'
import { platform } from 'os'
import * as net from 'net'
import * as tls from 'tls'
import { createLogger } from '../logger'
import type { DiagnosticResult, FixResult, FixChange } from '../../shared/types'

const logger = createLogger('email-account-setup')
const isWindows = platform() === 'win32'
const isMac = platform() === 'darwin'
const isLinux = platform() === 'linux'

// ============================================================
// Email Provider Auto-Configuration Database
// ============================================================
interface EmailProviderConfig {
  name: string
  domains: string[]
  imap: { host: string; port: number; ssl: boolean }
  smtp: { host: string; port: number; ssl: boolean; starttls: boolean }
  pop3?: { host: string; port: number; ssl: boolean }
  notes: string[]
}

const EMAIL_PROVIDERS: EmailProviderConfig[] = [
  {
    name: 'Gmail',
    domains: ['gmail.com', 'googlemail.com'],
    imap: { host: 'imap.gmail.com', port: 993, ssl: true },
    smtp: { host: 'smtp.gmail.com', port: 587, ssl: false, starttls: true },
    pop3: { host: 'pop.gmail.com', port: 995, ssl: true },
    notes: [
      'Enable "Less secure apps" or use App Passwords (recommended)',
      'For App Passwords: Google Account → Security → 2-Step Verification → App Passwords',
      'IMAP must be enabled: Gmail → Settings → Forwarding and POP/IMAP → Enable IMAP'
    ]
  },
  {
    name: 'Outlook.com / Hotmail',
    domains: ['outlook.com', 'hotmail.com', 'live.com', 'msn.com', 'outlook.in'],
    imap: { host: 'outlook.office365.com', port: 993, ssl: true },
    smtp: { host: 'smtp-mail.outlook.com', port: 587, ssl: false, starttls: true },
    pop3: { host: 'outlook.office365.com', port: 995, ssl: true },
    notes: [
      'Use full email address as username',
      'App Password required if 2FA is enabled',
      'POP3 must be enabled in Outlook.com settings'
    ]
  },
  {
    name: 'Yahoo Mail',
    domains: ['yahoo.com', 'yahoo.in', 'yahoo.co.in', 'ymail.com', 'rocketmail.com'],
    imap: { host: 'imap.mail.yahoo.com', port: 993, ssl: true },
    smtp: { host: 'smtp.mail.yahoo.com', port: 587, ssl: false, starttls: true },
    pop3: { host: 'pop.mail.yahoo.com', port: 995, ssl: true },
    notes: [
      'Generate App Password: Yahoo Account → Account Security → App Passwords',
      'Allow apps that use less secure sign in must be enabled'
    ]
  },
  {
    name: 'Office 365 / Exchange Online',
    domains: ['office365.com'],
    imap: { host: 'outlook.office365.com', port: 993, ssl: true },
    smtp: { host: 'smtp.office365.com', port: 587, ssl: false, starttls: true },
    notes: [
      'SMTP AUTH must be enabled by Office 365 admin',
      'Use full email as username',
      'Modern Authentication (OAuth) recommended over basic auth'
    ]
  },
  {
    name: 'Zoho Mail',
    domains: ['zoho.com', 'zoho.in', 'zohomail.in'],
    imap: { host: 'imap.zoho.com', port: 993, ssl: true },
    smtp: { host: 'smtp.zoho.com', port: 587, ssl: false, starttls: true },
    notes: [
      'Use App Password if 2FA is enabled',
      'IMAP access must be enabled in Zoho settings',
      'Popular with Indian businesses'
    ]
  },
  {
    name: 'Rediffmail',
    domains: ['rediffmail.com', 'rediff.com'],
    imap: { host: 'imap.rediffmail.com', port: 993, ssl: true },
    smtp: { host: 'smtp.rediffmail.com', port: 587, ssl: false, starttls: true },
    notes: [
      'Common Indian email provider',
      'POP3/IMAP may need to be enabled in settings',
      'Use full email as username'
    ]
  },
  {
    name: 'BSNL Email',
    domains: ['bsnl.in', 'dataone.in', 'sancharnet.in'],
    imap: { host: 'mail.bsnl.in', port: 993, ssl: true },
    smtp: { host: 'mail.bsnl.in', port: 587, ssl: false, starttls: true },
    notes: [
      'Indian government telecom email',
      'Settings may vary by circle/region',
      'Contact BSNL support if connection fails'
    ]
  },
  {
    name: 'iCloud Mail',
    domains: ['icloud.com', 'me.com', 'mac.com'],
    imap: { host: 'imap.mail.me.com', port: 993, ssl: true },
    smtp: { host: 'smtp.mail.me.com', port: 587, ssl: false, starttls: true },
    notes: [
      'Generate App-Specific Password: appleid.apple.com → Security → App-Specific Passwords',
      '2FA must be enabled on Apple ID first'
    ]
  },
  {
    name: 'GoDaddy Email',
    domains: ['secureserver.net', 'godaddysites.com'],
    imap: { host: 'imap.secureserver.net', port: 993, ssl: true },
    smtp: { host: 'smtpout.secureserver.net', port: 465, ssl: true, starttls: false },
    notes: [
      'Common for Indian small business domains',
      'Use workspace email credentials'
    ]
  },
  {
    name: 'Hostinger',
    domains: ['hostinger.com'],
    imap: { host: 'imap.hostinger.com', port: 993, ssl: true },
    smtp: { host: 'smtp.hostinger.com', port: 465, ssl: true, starttls: false },
    notes: [
      'Popular hosting with Indian users',
      'Custom domain email settings in hPanel'
    ]
  }
]

function lookupProvider(email: string): EmailProviderConfig | undefined {
  const domain = email.split('@')[1]?.toLowerCase()
  if (!domain) return undefined
  return EMAIL_PROVIDERS.find(p => p.domains.some(d => domain.endsWith(d)))
}

// ============================================================
// Port Connectivity Test
// ============================================================
interface PortTestResult {
  host: string
  port: number
  reachable: boolean
  tlsValid: boolean
  responseTime: number
  error: string
}

async function testPort(host: string, port: number, useTls: boolean, timeoutMs: number = 10000): Promise<PortTestResult> {
  const result: PortTestResult = {
    host, port, reachable: false, tlsValid: false, responseTime: 0, error: ''
  }

  const startTime = Date.now()

  return new Promise<PortTestResult>((resolve) => {
    let resolved = false
    const done = (patch: Partial<PortTestResult>): void => {
      if (resolved) return
      resolved = true
      Object.assign(result, patch)
      resolve(result)
    }

    try {
      if (useTls) {
        // For TLS: only listen for secureConnect (not connect, which fires before TLS handshake)
        const tlsSocket = tls.connect({ host, port, rejectUnauthorized: true, timeout: timeoutMs })

        tlsSocket.on('secureConnect', () => {
          tlsSocket.destroy()
          done({ reachable: true, tlsValid: true, responseTime: Date.now() - startTime })
        })

        tlsSocket.on('error', (err: Error) => {
          tlsSocket.destroy()
          done({ error: err.message, responseTime: Date.now() - startTime })
        })

        tlsSocket.on('timeout', () => {
          tlsSocket.destroy()
          done({ error: 'Connection timed out', responseTime: Date.now() - startTime })
        })

        // Hard backstop timeout
        setTimeout(() => {
          tlsSocket.destroy()
          done({ error: result.error || 'Hard timeout', responseTime: Date.now() - startTime })
        }, timeoutMs + 2000)
      } else {
        // For plain TCP: listen for connect
        const socket = net.createConnection({ host, port, timeout: timeoutMs })

        socket.on('connect', () => {
          socket.destroy()
          done({ reachable: true, responseTime: Date.now() - startTime })
        })

        socket.on('error', (err: Error) => {
          socket.destroy()
          done({ error: err.message, responseTime: Date.now() - startTime })
        })

        socket.on('timeout', () => {
          socket.destroy()
          done({ error: 'Connection timed out', responseTime: Date.now() - startTime })
        })

        // Hard backstop timeout
        setTimeout(() => {
          socket.destroy()
          done({ error: result.error || 'Hard timeout', responseTime: Date.now() - startTime })
        }, timeoutMs + 2000)
      }
    } catch (err) {
      done({ error: err instanceof Error ? err.message : String(err) })
    }
  })
}

// ============================================================
// Outlook Profile Repair (Windows)
// ============================================================
export async function repairOutlookProfile(): Promise<FixResult> {
  const changes: FixChange[] = []
  const details: string[] = []

  if (!isWindows) {
    return {
      success: true, module: 'email-setup', action: 'repair_outlook',
      description: 'Outlook profile repair is Windows-only',
      details: [
        isMac ? 'macOS: Remove and re-add account in Outlook → Preferences → Accounts' :
          'Linux: Thunderbird profiles are in ~/.thunderbird/'
      ],
      changes: [], rollbackAvailable: false
    }
  }

  // Check if Outlook is installed
  try {
    const output = execFileSync('powershell', [
      '-NoProfile', '-Command',
      '(Get-ItemProperty "HKLM:\\SOFTWARE\\Microsoft\\Office\\*\\Outlook" -ErrorAction SilentlyContinue).Bitness'
    ], { timeout: 10000, encoding: 'utf8' })
    if (!output.trim()) {
      details.push('Microsoft Outlook is not installed')
      return {
        success: false, module: 'email-setup', action: 'repair_outlook',
        description: 'Outlook not found', details, changes: [], rollbackAvailable: false
      }
    }
  } catch { /* continue anyway */ }

  // Step 1: Reset Outlook navigation pane
  try {
    execFileSync('powershell', [
      '-NoProfile', '-Command',
      'Start-Process "outlook.exe" -ArgumentList "/resetnavpane" -ErrorAction SilentlyContinue'
    ], { timeout: 10000, encoding: 'utf8' })
    details.push('Reset Outlook navigation pane')
    changes.push({ type: 'application', action: 'repaired', target: 'Outlook navigation pane' })
  } catch {
    details.push('Could not reset navigation pane')
  }

  // Step 2: Clear Outlook cache
  try {
    execFileSync('powershell', [
      '-NoProfile', '-Command',
      'Get-Process outlook -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue; Start-Sleep -Seconds 2; ' +
      'Remove-Item "$env:LOCALAPPDATA\\Microsoft\\Outlook\\RoamCache\\*" -Force -Recurse -ErrorAction SilentlyContinue'
    ], { timeout: 15000, encoding: 'utf8' })
    details.push('Cleared Outlook RoamCache')
    changes.push({ type: 'file', action: 'deleted', target: 'Outlook RoamCache' })
  } catch {
    details.push('Could not clear Outlook cache')
  }

  // Step 3: Run ScanPST (Inbox Repair Tool)
  details.push('')
  details.push('If Outlook data file (.pst/.ost) is corrupted:')
  details.push('  1. Close Outlook')
  details.push('  2. Run ScanPST.exe (Inbox Repair Tool):')
  details.push('     64-bit: C:\\Program Files\\Microsoft Office\\root\\Office16\\SCANPST.EXE')
  details.push('     32-bit: C:\\Program Files (x86)\\Microsoft Office\\root\\Office16\\SCANPST.EXE')
  details.push('  3. Browse to your .pst file (usually in Documents\\Outlook Files)')
  details.push('  4. Click Start to scan and repair')

  // Step 4: Create new Outlook profile guide
  details.push('')
  details.push('To create a new Outlook profile (nuclear option):')
  details.push('  1. Control Panel → Mail → Show Profiles → Add')
  details.push('  2. Enter a name for the new profile')
  details.push('  3. Set up email account in the new profile')
  details.push('  4. Set new profile as default')
  details.push('  5. Delete old profile once everything works')

  return {
    success: changes.length > 0,
    module: 'email-setup',
    action: 'repair_outlook',
    description: 'Outlook profile repair',
    details, changes, rollbackAvailable: false
  }
}

// ============================================================
// Credential Manager Operations
// ============================================================
export async function clearEmailCredentials(target: string): Promise<FixResult> {
  const changes: FixChange[] = []
  const details: string[] = []

  if (isWindows) {
    // List and clear stored email credentials
    try {
      const output = execFileSync('powershell', [
        '-NoProfile', '-Command',
        'cmdkey /list | Select-String "Target:" | ForEach-Object { $_.ToString().Trim() }'
      ], { timeout: 10000, encoding: 'utf8' })

      const targets = output.split('\n').filter(l => l.trim())
      const emailTargets = targets.filter(t =>
        /outlook|office|live|hotmail|gmail|yahoo|imap|smtp|pop/i.test(t)
      )

      if (emailTargets.length > 0) {
        details.push(`Found ${emailTargets.length} stored email credentials:`)
        for (const t of emailTargets) {
          details.push(`  ${t}`)
        }
      } else {
        details.push('No stored email credentials found in Credential Manager')
      }

      // Clear specific target if provided
      if (target) {
        try {
          execFileSync('cmdkey', ['/delete', target], {
            timeout: 5000, encoding: 'utf8'
          })
          details.push(`Removed credential: ${target}`)
          changes.push({ type: 'credential', action: 'deleted', target })
        } catch {
          details.push(`Could not remove credential: ${target}`)
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      details.push(`Error accessing Credential Manager: ${msg}`)
    }
  } else if (isMac) {
    details.push('macOS Keychain:')
    details.push('  Open Keychain Access → Search for email server name')
    details.push('  Delete old credentials and re-enter in mail client')
    details.push('  Or: security delete-internet-password -s imap.gmail.com')
  } else {
    details.push('Linux credential stores:')
    details.push('  GNOME Keyring: seahorse (Passwords and Keys app)')
    details.push('  KDE Wallet: kwalletmanager5')
    details.push('  secret-tool: secret-tool search service imap')
  }

  return {
    success: true,
    module: 'email-setup',
    action: 'clear_credentials',
    description: 'Email credential management',
    details, changes, rollbackAvailable: false
  }
}

// ============================================================
// Auto-Configure Email Client
// ============================================================
export async function autoConfigureEmail(email: string): Promise<FixResult> {
  const changes: FixChange[] = []
  const details: string[] = []

  const provider = lookupProvider(email)

  if (provider) {
    details.push(`Detected provider: ${provider.name}`)
    details.push('')
    details.push('=== IMAP (Incoming Mail) Settings ===')
    details.push(`  Server: ${provider.imap.host}`)
    details.push(`  Port: ${provider.imap.port}`)
    details.push(`  Security: ${provider.imap.ssl ? 'SSL/TLS' : 'None'}`)
    details.push(`  Username: ${email}`)
    details.push('')
    details.push('=== SMTP (Outgoing Mail) Settings ===')
    details.push(`  Server: ${provider.smtp.host}`)
    details.push(`  Port: ${provider.smtp.port}`)
    details.push(`  Security: ${provider.smtp.starttls ? 'STARTTLS' : provider.smtp.ssl ? 'SSL/TLS' : 'None'}`)
    details.push(`  Username: ${email}`)

    if (provider.pop3) {
      details.push('')
      details.push('=== POP3 (Alternative Incoming) Settings ===')
      details.push(`  Server: ${provider.pop3.host}`)
      details.push(`  Port: ${provider.pop3.port}`)
      details.push(`  Security: ${provider.pop3.ssl ? 'SSL/TLS' : 'None'}`)
    }

    details.push('')
    details.push('=== Notes ===')
    for (const note of provider.notes) {
      details.push(`  • ${note}`)
    }

    // Test connectivity
    details.push('')
    details.push('=== Connectivity Test ===')

    const imapTest = await testPort(provider.imap.host, provider.imap.port, provider.imap.ssl)
    details.push(`  IMAP (${provider.imap.host}:${provider.imap.port}): ${imapTest.reachable ? 'OK' : 'FAILED'} ${imapTest.reachable ? `(${imapTest.responseTime}ms)` : `- ${imapTest.error}`}`)

    const smtpTest = await testPort(provider.smtp.host, provider.smtp.port, provider.smtp.ssl)
    details.push(`  SMTP (${provider.smtp.host}:${provider.smtp.port}): ${smtpTest.reachable ? 'OK' : 'FAILED'} ${smtpTest.reachable ? `(${smtpTest.responseTime}ms)` : `- ${smtpTest.error}`}`)

    if (!imapTest.reachable || !smtpTest.reachable) {
      details.push('')
      details.push('  Connection issues detected! Check:')
      details.push('  1. Internet connection is active')
      details.push('  2. Firewall is not blocking email ports')
      details.push('  3. Antivirus/security software is not interfering')
      details.push('  4. ISP is not blocking SMTP port 587/465')
    }

    changes.push({ type: 'system', action: 'created', target: `Email config for ${provider.name}` })
  } else {
    const domain = email.split('@')[1] || ''
    details.push(`Provider not in database for domain: ${domain}`)
    details.push('')
    details.push('Trying common server patterns:')
    details.push(`  IMAP: imap.${domain} (port 993, SSL)`)
    details.push(`  SMTP: smtp.${domain} (port 587, STARTTLS)`)
    details.push(`  POP3: pop.${domain} (port 995, SSL)`)

    // Test common patterns
    if (domain) {
      const imapTest = await testPort(`imap.${domain}`, 993, true)
      const smtpTest = await testPort(`smtp.${domain}`, 587, false)

      details.push('')
      details.push('Connectivity test:')
      details.push(`  imap.${domain}:993 → ${imapTest.reachable ? 'REACHABLE' : 'Not reachable'}`)
      details.push(`  smtp.${domain}:587 → ${smtpTest.reachable ? 'REACHABLE' : 'Not reachable'}`)

      if (!imapTest.reachable) {
        const altImap = await testPort(`mail.${domain}`, 993, true)
        details.push(`  mail.${domain}:993 → ${altImap.reachable ? 'REACHABLE' : 'Not reachable'}`)
      }
    }

    details.push('')
    details.push('Contact your email provider or IT admin for correct server settings')
  }

  return {
    success: true,
    module: 'email-setup',
    action: 'auto_configure',
    description: `Email configuration for ${email}`,
    details, changes, rollbackAvailable: false
  }
}

// ============================================================
// Main Diagnostics
// ============================================================
export async function runEmailDiagnostics(): Promise<DiagnosticResult[]> {
  const results: DiagnosticResult[] = []

  // 1. Check default mail client
  if (isWindows) {
    try {
      const output = execFileSync('powershell', [
        '-NoProfile', '-Command',
        'Get-ItemProperty "HKCU:\\Software\\Clients\\Mail" -ErrorAction SilentlyContinue | Select-Object "(default)" | ConvertTo-Json; ' +
        '(Get-ItemProperty "HKLM:\\SOFTWARE\\Clients\\Mail" -ErrorAction SilentlyContinue)."(default)"'
      ], { timeout: 10000, encoding: 'utf8' })

      const mailClient = output.trim() || 'None detected'
      results.push({
        id: `email-client-${Date.now()}`,
        module: 'email-setup',
        category: 'Mail Client',
        title: `Default mail client: ${mailClient}`,
        severity: 'info',
        description: `Current default email application: ${mailClient}`,
        details: [
          `Mail client: ${mailClient}`,
          'To change: Settings → Apps → Default apps → Email'
        ],
        fixAvailable: false,
        fixRisk: 'none',
        autoFixable: false,
        timestamp: Date.now()
      })
    } catch { /* ignore */ }
  }

  // 2. Test common email port connectivity
  const portTests = [
    { name: 'IMAP/SSL', host: 'imap.gmail.com', port: 993, tls: true },
    { name: 'SMTP/TLS', host: 'smtp.gmail.com', port: 587, tls: false },
    { name: 'POP3/SSL', host: 'pop.gmail.com', port: 995, tls: true }
  ]

  const testResults: string[] = []
  let blockedPorts = 0

  for (const test of portTests) {
    const result = await testPort(test.host, test.port, test.tls, 5000)
    testResults.push(
      `${test.name} (${test.host}:${test.port}): ${result.reachable ? 'OK' : 'BLOCKED'} ${result.reachable ? `${result.responseTime}ms` : result.error}`
    )
    if (!result.reachable) blockedPorts++
  }

  results.push({
    id: `email-ports-${Date.now()}`,
    module: 'email-setup',
    category: 'Network',
    title: blockedPorts > 0 ? `${blockedPorts} email port(s) blocked` : 'All email ports accessible',
    severity: blockedPorts > 0 ? 'warning' : 'healthy',
    description: blockedPorts > 0
      ? 'Some email ports are not accessible. Firewall or ISP may be blocking them.'
      : 'Standard email ports (IMAP, SMTP, POP3) are all accessible',
    details: testResults,
    fixAvailable: blockedPorts > 0,
    fixDescription: 'Check firewall settings and ISP restrictions',
    fixRisk: 'none',
    autoFixable: false,
    timestamp: Date.now()
  })

  // 3. Provider quick reference
  results.push({
    id: `email-providers-${Date.now()}`,
    module: 'email-setup',
    category: 'Provider Database',
    title: `${EMAIL_PROVIDERS.length} email providers in database`,
    severity: 'info',
    description: 'Auto-configuration available for popular Indian and global email providers',
    details: EMAIL_PROVIDERS.map(p =>
      `${p.name}: ${p.domains.join(', ')} → IMAP: ${p.imap.host}:${p.imap.port} | SMTP: ${p.smtp.host}:${p.smtp.port}`
    ),
    fixAvailable: false,
    fixRisk: 'none',
    autoFixable: false,
    timestamp: Date.now()
  })

  // 4. Check Outlook profiles (Windows)
  if (isWindows) {
    try {
      const output = execFileSync('powershell', [
        '-NoProfile', '-Command',
        'Get-ChildItem "HKCU:\\Software\\Microsoft\\Office\\*\\Outlook\\Profiles" -ErrorAction SilentlyContinue | Select-Object Name | ConvertTo-Json'
      ], { timeout: 10000, encoding: 'utf8' })

      if (output.trim()) {
        const profiles = JSON.parse(output)
        const profArr = Array.isArray(profiles) ? profiles : [profiles]
        results.push({
          id: `email-outlook-profiles-${Date.now()}`,
          module: 'email-setup',
          category: 'Outlook',
          title: `${profArr.length} Outlook profile(s) found`,
          severity: 'info',
          description: 'Microsoft Outlook mail profiles',
          details: profArr.map((p: { Name: string }) => `Profile: ${p.Name?.split('\\').pop() || 'Unknown'}`),
          fixAvailable: true,
          fixDescription: 'Repair Outlook profile',
          fixRisk: 'low',
          autoFixable: true,
          timestamp: Date.now()
        })
      }
    } catch { /* no Outlook profiles */ }
  }

  return results
}
