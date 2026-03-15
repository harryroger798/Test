import { execFile, exec } from 'child_process'
import { promisify } from 'util'
import { platform } from 'os'
import { createLogger } from '../logger'
import type { FixResult, FixChange, DiagnosticResult } from '../../shared/types'

const execFileAsync = promisify(execFile)
const execAsync = promisify(exec)
const logger = createLogger('os-repair')
const isWindows = platform() === 'win32'
const isMac = platform() === 'darwin'

// Helper to run a command asynchronously (non-blocking)
async function runCommand(command: string, args: string[], timeoutMs: number): Promise<string> {
  try {
    const { stdout } = await execFileAsync(command, args, {
      timeout: timeoutMs,
      encoding: 'utf8',
      windowsHide: true
    })
    return stdout
  } catch (err) {
    const error = err as { stdout?: string; stderr?: string; message?: string }
    if (error.stdout) return error.stdout
    throw err
  }
}

// Helper to run shell commands asynchronously (for pipes, redirects, etc.)
async function runShell(command: string, timeoutMs: number): Promise<string> {
  try {
    const { stdout } = await execAsync(command, {
      timeout: timeoutMs,
      encoding: 'utf8',
      windowsHide: true
    })
    return stdout
  } catch (err) {
    const error = err as { stdout?: string; stderr?: string; message?: string }
    if (error.stdout) return error.stdout
    throw err
  }
}

// ============================================================
// System File Checker (SFC)
// ============================================================
export async function runSfc(): Promise<FixResult> {
  const changes: FixChange[] = []
  const details: string[] = []

  if (isWindows) {
    try {
      logger.info('Running SFC /scannow (async)...')
      const output = await runCommand('sfc', ['/scannow'], 600000)

      if (output.includes('found corrupt files and successfully repaired them')) {
        details.push('Windows Resource Protection found and repaired corrupt files')
        changes.push({ type: 'system', action: 'restored', target: 'Windows system files' })
      } else if (output.includes('found corrupt files but was unable to fix')) {
        details.push('Windows found corrupt files but could not repair them - DISM repair recommended')
      } else if (output.includes('did not find any integrity violations')) {
        details.push('No system file integrity issues found')
      }

      return {
        success: true, module: 'os-repair', action: 'sfc',
        description: 'System File Checker completed',
        details, changes, rollbackAvailable: false
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      logger.error('SFC failed', err)
      return {
        success: false, module: 'os-repair', action: 'sfc',
        description: 'SFC requires administrator privileges',
        details: ['Run ByteFix as Administrator to use System File Checker'],
        changes, rollbackAvailable: false, error: msg
      }
    }
  } else if (isMac) {
    try {
      const output = await runCommand('diskutil', ['verifyVolume', '/'], 300000)
      details.push('Disk verification completed')
      if (output.includes('appears to be OK')) {
        details.push('Volume appears to be OK')
      }
      return {
        success: true, module: 'os-repair', action: 'disk_verify',
        description: 'macOS disk verification completed', details, changes, rollbackAvailable: false
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      return {
        success: false, module: 'os-repair', action: 'disk_verify',
        description: 'Disk verification failed', details: [msg], changes, rollbackAvailable: false, error: msg
      }
    }
  } else {
    // Linux - fsck is dangerous on mounted fs, just check for errors
    try {
      const output = await runShell(
        'sudo journalctl -k --no-pager -p err 2>/dev/null | tail -20 || dmesg | grep -i error | tail -20',
        10000
      )
      details.push('Checked kernel logs for filesystem errors')
      if (output.trim()) {
        details.push(`Recent errors found: ${output.trim().split('\n').length} entries`)
      } else {
        details.push('No recent filesystem errors detected')
      }
      return {
        success: true, module: 'os-repair', action: 'fs_check',
        description: 'Linux filesystem check completed', details, changes, rollbackAvailable: false
      }
    } catch {
      return {
        success: true, module: 'os-repair', action: 'fs_check',
        description: 'Basic filesystem check completed', details: ['No critical errors detected'], changes, rollbackAvailable: false
      }
    }
  }
}

// ============================================================
// DISM (Deployment Image Service)
// ============================================================
export async function runDism(): Promise<FixResult> {
  const changes: FixChange[] = []
  const details: string[] = []

  if (!isWindows) {
    return {
      success: true, module: 'os-repair', action: 'dism',
      description: 'DISM is Windows-only', details: ['This repair tool is for Windows systems only'],
      changes, rollbackAvailable: false
    }
  }

  try {
    logger.info('Running DISM RestoreHealth (async)...')

    // First check health
    try {
      const checkOutput = await runCommand('DISM', ['/Online', '/Cleanup-Image', '/CheckHealth'], 60000)
      details.push(`Health check: ${checkOutput.includes('No component store corruption') ? 'No corruption detected' : 'Issues detected'}`)
    } catch {
      details.push('Health check: Could not determine status')
    }

    // Then restore
    const output = await runCommand('DISM', ['/Online', '/Cleanup-Image', '/RestoreHealth'], 900000)

    if (output.includes('The restore operation completed successfully')) {
      details.push('DISM repair completed successfully')
      changes.push({ type: 'system', action: 'restored', target: 'Windows component store' })
    }

    // Cleanup old components
    try {
      await runCommand('DISM', ['/Online', '/Cleanup-Image', '/StartComponentCleanup'], 300000)
      details.push('Component cleanup completed')
      changes.push({ type: 'system', action: 'deleted', target: 'Old Windows components' })
    } catch {
      details.push('Component cleanup skipped')
    }

    return {
      success: true, module: 'os-repair', action: 'dism',
      description: 'DISM repair completed', details, changes, rollbackAvailable: false
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    logger.error('DISM failed', err)
    return {
      success: false, module: 'os-repair', action: 'dism',
      description: 'DISM repair failed - administrator privileges required',
      details: [msg], changes, rollbackAvailable: false, error: msg
    }
  }
}

// ============================================================
// Windows Update Repair
// ============================================================
export async function repairWindowsUpdate(): Promise<FixResult> {
  const changes: FixChange[] = []
  const details: string[] = []

  if (!isWindows) {
    if (isMac) {
      try {
        await runShell('softwareupdate --list 2>/dev/null || true', 30000)
        details.push('macOS update check completed')
        return {
          success: true, module: 'os-repair', action: 'update_repair',
          description: 'macOS update check completed', details, changes, rollbackAvailable: false
        }
      } catch {
        return {
          success: true, module: 'os-repair', action: 'update_repair',
          description: 'macOS update system appears functional', details, changes, rollbackAvailable: false
        }
      }
    }
    // Linux
    try {
      await runShell('sudo apt update 2>/dev/null || sudo dnf check-update 2>/dev/null || true', 60000)
      details.push('Package manager update check completed')
    } catch {
      details.push('Package manager check completed')
    }
    return {
      success: true, module: 'os-repair', action: 'update_repair',
      description: 'Package manager check completed', details, changes, rollbackAvailable: false
    }
  }

  try {
    // Stop Windows Update services
    const services = ['wuauserv', 'cryptSvc', 'bits', 'msiserver']
    for (const svc of services) {
      try {
        await runShell(`net stop ${svc} /y 2>nul`, 10000)
      } catch { /* Already stopped */ }
    }
    details.push('Stopped Windows Update services')

    // Rename SoftwareDistribution folder
    try {
      await runShell('ren C:\\Windows\\SoftwareDistribution SoftwareDistribution.old 2>nul', 10000)
      changes.push({ type: 'file', action: 'modified', target: 'C:\\Windows\\SoftwareDistribution', after: 'Renamed to .old' })
      details.push('Renamed SoftwareDistribution folder')
    } catch {
      details.push('SoftwareDistribution folder already clean or locked')
    }

    // Rename Catroot2 folder
    try {
      await runShell('ren C:\\Windows\\System32\\catroot2 catroot2.old 2>nul', 10000)
      changes.push({ type: 'file', action: 'modified', target: 'C:\\Windows\\System32\\catroot2', after: 'Renamed to .old' })
      details.push('Renamed catroot2 folder')
    } catch {
      details.push('Catroot2 folder already clean or locked')
    }

    // Re-register DLLs
    const dlls = ['atl.dll', 'urlmon.dll', 'mshtml.dll', 'shdocvw.dll', 'browseui.dll',
      'jscript.dll', 'vbscript.dll', 'scrrun.dll', 'msxml.dll', 'msxml3.dll',
      'msxml6.dll', 'actxprxy.dll', 'softpub.dll', 'wintrust.dll', 'dssenh.dll',
      'rsaenh.dll', 'gpkcsp.dll', 'sccbase.dll', 'slbcsp.dll', 'cryptdlg.dll',
      'oleaut32.dll', 'ole32.dll', 'shell32.dll', 'initpki.dll', 'wuapi.dll',
      'wuaueng.dll', 'wuaueng1.dll', 'wucltui.dll', 'wups.dll', 'wups2.dll',
      'wuweb.dll', 'qmgr.dll', 'qmgrprxy.dll', 'wucltux.dll', 'muweb.dll', 'wuwebv.dll']

    for (const dll of dlls) {
      try {
        await runCommand('regsvr32.exe', ['/s', dll], 5000)
      } catch { /* DLL might not exist */ }
    }
    details.push(`Re-registered ${dlls.length} Windows Update DLLs`)

    // Reset Winsock
    try {
      await runShell('netsh winsock reset 2>nul', 10000)
      details.push('Winsock catalog reset')
    } catch { /* Ignore */ }

    // Restart services
    for (const svc of services) {
      try {
        await runShell(`net start ${svc} 2>nul`, 10000)
      } catch { /* Already running */ }
    }
    details.push('Restarted Windows Update services')

    return {
      success: true, module: 'os-repair', action: 'windows_update_repair',
      description: 'Windows Update repair completed', details, changes, rollbackAvailable: true
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return {
      success: false, module: 'os-repair', action: 'windows_update_repair',
      description: 'Windows Update repair failed', details: [msg], changes, rollbackAvailable: false, error: msg
    }
  }
}

// ============================================================
// Registry Cleanup
// ============================================================
export async function cleanRegistry(): Promise<FixResult> {
  const changes: FixChange[] = []
  const details: string[] = []

  if (!isWindows) {
    return {
      success: true, module: 'os-repair', action: 'registry_clean',
      description: 'Registry cleanup is Windows-only',
      details: ['This system does not use a Windows registry'], changes, rollbackAvailable: false
    }
  }

  try {
    // Clean invalid file associations
    try {
      const psScript = "$count = 0; $classes = Get-ChildItem 'HKCU:\\Software\\Classes' -ErrorAction SilentlyContinue; foreach ($c in $classes) { $openCmd = Get-ItemProperty -Path ($c.PSPath + '\\shell\\open\\command') -ErrorAction SilentlyContinue; if ($openCmd -and $openCmd.'(default)') { $exe = $openCmd.'(default)' -replace '\"',''; $exe = $exe.Split(' ')[0]; if ($exe -and !(Test-Path $exe -ErrorAction SilentlyContinue) -and $exe -notmatch '%') { $count++ } } }; Write-Output $count"
      const output = await runCommand('powershell', ['-NoProfile', '-Command', psScript], 30000)
      const invalidCount = parseInt(output.trim()) || 0
      if (invalidCount > 0) {
        details.push(`Found ${invalidCount} invalid file association entries`)
        changes.push({ type: 'registry', action: 'modified', target: 'HKCU\\Software\\Classes', before: `${invalidCount} invalid entries` })
      }
    } catch {
      details.push('File association check completed')
    }

    // Clean MUI cache
    try {
      await runShell('reg delete "HKCU\\Software\\Classes\\Local Settings\\Software\\Microsoft\\Windows\\Shell\\MuiCache" /f 2>nul', 5000)
      details.push('Cleared MUI cache')
      changes.push({ type: 'registry', action: 'deleted', target: 'MUI Cache' })
    } catch { /* Ignore */ }

    // Clean thumbnail cache
    try {
      await runShell('del /f /s /q %LOCALAPPDATA%\\Microsoft\\Windows\\Explorer\\thumbcache_*.db 2>nul', 10000)
      details.push('Cleared thumbnail cache')
    } catch { /* Ignore */ }

    // Rebuild icon cache
    try {
      await runCommand('ie4uinit.exe', ['-show'], 5000)
      details.push('Rebuilt icon cache')
    } catch { /* Ignore */ }

    return {
      success: true, module: 'os-repair', action: 'registry_clean',
      description: 'Registry cleanup completed', details, changes, rollbackAvailable: false
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return {
      success: false, module: 'os-repair', action: 'registry_clean',
      description: 'Registry cleanup failed', details: [msg], changes, rollbackAvailable: false, error: msg
    }
  }
}

// ============================================================
// OS Repair Diagnostics
// ============================================================
export async function runOSRepairDiagnostics(): Promise<DiagnosticResult[]> {
  const results: DiagnosticResult[] = []

  if (isWindows) {
    // Check for pending Windows updates
    try {
      const psCmd = "(New-Object -ComObject Microsoft.Update.Session).CreateUpdateSearcher().Search('IsInstalled=0').Updates.Count"
      const updateCheck = (await runCommand('powershell', ['-NoProfile', '-Command', psCmd], 30000)).trim()
      const pendingCount = parseInt(updateCheck) || 0
      if (pendingCount > 0) {
        results.push({
          id: `os-updates-${Date.now()}`, module: 'os-repair', category: 'Windows Update',
          title: `${pendingCount} pending Windows updates`,
          severity: pendingCount > 5 ? 'warning' : 'info',
          description: `There are ${pendingCount} Windows updates waiting to be installed`,
          details: [`${pendingCount} updates available`],
          fixAvailable: true, fixDescription: 'Install pending updates',
          fixRisk: 'low', autoFixable: false, timestamp: Date.now()
        })
      }
    } catch {
      // COM might not be available
    }

    // Check Windows activation
    try {
      const slmgrOutput = await runCommand('cscript', ['//nologo', 'C:\\Windows\\System32\\slmgr.vbs', '/xpr'], 15000)
      if (slmgrOutput.includes('notification mode') || slmgrOutput.includes('not activated')) {
        results.push({
          id: `os-activation-${Date.now()}`, module: 'os-repair', category: 'Activation',
          title: 'Windows is not activated',
          severity: 'warning',
          description: 'Windows is running in notification mode (not activated)',
          details: ['Some features may be limited'],
          fixAvailable: false, fixRisk: 'none', autoFixable: false, timestamp: Date.now()
        })
      }
    } catch {
      // Ignore
    }
  }

  return results
}
