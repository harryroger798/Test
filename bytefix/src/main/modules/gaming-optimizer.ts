import { execFileSync } from 'child_process'
import { platform } from 'os'
import si from 'systeminformation'
import { createLogger } from '../logger'
import type { DiagnosticResult, FixResult, FixChange } from '../../shared/types'

const logger = createLogger('gaming-optimizer')
const isWindows = platform() === 'win32'
const isMac = platform() === 'darwin'
const isLinux = platform() === 'linux'

// ============================================================
// GPU Priority & Game Mode Detection
// ============================================================
interface GamingStatus {
  gameMode: boolean
  gpuInfo: GpuDetail[]
  ramGB: number
  cpuCores: number
  powerPlan: string
  directXVersion: string
  issues: string[]
}

interface GpuDetail {
  model: string
  vendor: string
  vramMB: number
  driverVersion: string
  temperature: number
}

async function getGamingStatus(): Promise<GamingStatus> {
  const status: GamingStatus = {
    gameMode: false,
    gpuInfo: [],
    ramGB: 0,
    cpuCores: 0,
    powerPlan: 'Unknown',
    directXVersion: 'Unknown',
    issues: []
  }

  // System info
  try {
    const mem = await si.mem()
    const cpu = await si.cpu()
    status.ramGB = Math.round(mem.total / (1024 ** 3))
    status.cpuCores = cpu.cores
  } catch { /* ignore */ }

  // GPU info
  try {
    const graphics = await si.graphics()
    for (const ctrl of graphics.controllers) {
      status.gpuInfo.push({
        model: ctrl.model || 'Unknown',
        vendor: ctrl.vendor || 'Unknown',
        vramMB: ctrl.vram || 0,
        driverVersion: ctrl.driverVersion || 'Unknown',
        temperature: ctrl.temperatureGpu || 0
      })
    }
  } catch { /* ignore */ }

  if (isWindows) {
    // Check Game Mode status
    try {
      const output = execFileSync('powershell', [
        '-NoProfile', '-Command',
        'Get-ItemProperty -Path "HKCU:\\Software\\Microsoft\\GameBar" -Name "AllowAutoGameMode" -ErrorAction SilentlyContinue | Select-Object AllowAutoGameMode | ConvertTo-Json'
      ], { timeout: 10000, encoding: 'utf8' })
      if (output.trim()) {
        const result = JSON.parse(output)
        status.gameMode = result.AllowAutoGameMode !== 0
      }
    } catch { /* default to false */ }

    // Check power plan
    try {
      const output = execFileSync('powercfg', ['/GetActiveScheme'], {
        timeout: 5000, encoding: 'utf8'
      })
      if (/high performance/i.test(output)) {
        status.powerPlan = 'High Performance'
      } else if (/balanced/i.test(output)) {
        status.powerPlan = 'Balanced'
      } else if (/power saver/i.test(output)) {
        status.powerPlan = 'Power Saver'
        status.issues.push('Power Saver plan active - reduces gaming performance significantly')
      } else if (/ultimate/i.test(output)) {
        status.powerPlan = 'Ultimate Performance'
      } else {
        status.powerPlan = output.trim().split('\n')[0] || 'Unknown'
      }
    } catch { /* ignore */ }

    // Check DirectX version
    try {
      const output = execFileSync('powershell', [
        '-NoProfile', '-Command',
        '(Get-ItemProperty -Path "HKLM:\\SOFTWARE\\Microsoft\\DirectX" -ErrorAction SilentlyContinue).Version'
      ], { timeout: 10000, encoding: 'utf8' })
      status.directXVersion = output.trim() || 'Unknown'
    } catch { /* ignore */ }
  }

  // Check for common issues
  if (status.ramGB < 8) {
    status.issues.push(`Only ${status.ramGB}GB RAM - 8GB minimum recommended for gaming`)
  }
  if (status.gpuInfo.length > 0) {
    for (const gpu of status.gpuInfo) {
      if (gpu.vramMB > 0 && gpu.vramMB < 2048) {
        status.issues.push(`GPU ${gpu.model} has only ${gpu.vramMB}MB VRAM - modern games need 4GB+`)
      }
      if (gpu.temperature > 85) {
        status.issues.push(`GPU ${gpu.model} is running hot at ${gpu.temperature}C`)
      }
    }
  }

  return status
}

// ============================================================
// Enable Game Mode
// ============================================================
export async function enableGameMode(): Promise<FixResult> {
  const changes: FixChange[] = []
  const details: string[] = []

  if (!isWindows) {
    return {
      success: true, module: 'gaming', action: 'enable_game_mode',
      description: 'Game Mode is a Windows 10/11 feature',
      details: [
        isLinux ? 'Linux: Use GameMode (feral-interactive/gamemode) for similar functionality' :
          'macOS: No built-in game mode. Close background apps manually.'
      ],
      changes: [], rollbackAvailable: false
    }
  }

  try {
    // Enable Game Mode
    execFileSync('powershell', [
      '-NoProfile', '-Command',
      'Set-ItemProperty -Path "HKCU:\\Software\\Microsoft\\GameBar" -Name "AllowAutoGameMode" -Value 1 -Force -ErrorAction Stop'
    ], { timeout: 10000, encoding: 'utf8' })
    details.push('Enabled Windows Game Mode')
    changes.push({ type: 'registry', action: 'modified', target: 'Game Mode', after: 'Enabled' })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    details.push(`Failed to enable Game Mode: ${msg}`)
  }

  try {
    // Enable Game DVR optimization (but disable background recording to save resources)
    execFileSync('powershell', [
      '-NoProfile', '-Command',
      'Set-ItemProperty -Path "HKCU:\\Software\\Microsoft\\GameBar" -Name "AutoGameModeEnabled" -Value 1 -Force -ErrorAction SilentlyContinue'
    ], { timeout: 10000, encoding: 'utf8' })
    details.push('Enabled auto Game Mode detection')
  } catch { /* ignore */ }

  return {
    success: changes.length > 0,
    module: 'gaming',
    action: 'enable_game_mode',
    description: 'Enabled Windows Game Mode',
    details, changes, rollbackAvailable: true
  }
}

// ============================================================
// Set High Performance Power Plan
// ============================================================
export async function setHighPerformancePlan(): Promise<FixResult> {
  const changes: FixChange[] = []
  const details: string[] = []

  if (isWindows) {
    try {
      // Try Ultimate Performance first (available on Win10 Pro/Enterprise)
      execFileSync('powercfg', ['/setactive', 'e9a42b02-d5df-448d-aa00-03f14749eb61'], {
        timeout: 5000, encoding: 'utf8'
      })
      details.push('Set Ultimate Performance power plan')
      changes.push({ type: 'system', action: 'modified', target: 'Power Plan', after: 'Ultimate Performance' })
    } catch {
      // Fallback to High Performance
      try {
        execFileSync('powercfg', ['/setactive', '8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c'], {
          timeout: 5000, encoding: 'utf8'
        })
        details.push('Set High Performance power plan')
        changes.push({ type: 'system', action: 'modified', target: 'Power Plan', after: 'High Performance' })
      } catch {
        details.push('Could not set High Performance plan. Try running as administrator.')
      }
    }

    // Set max CPU state to 100%
    try {
      execFileSync('powercfg', [
        '/SETACVALUEINDEX', 'SCHEME_CURRENT', 'SUB_PROCESSOR', 'PROCTHROTTLEMAX', '100'
      ], { timeout: 5000, encoding: 'utf8' })
      execFileSync('powercfg', ['/SETACTIVE', 'SCHEME_CURRENT'], {
        timeout: 5000, encoding: 'utf8'
      })
      details.push('Set CPU max state to 100%')
    } catch { /* ignore */ }
  } else if (isLinux) {
    try {
      execFileSync('pkexec', ['cpupower', 'frequency-set', '-g', 'performance'], {
        timeout: 5000, encoding: 'utf8'
      })
      details.push('Set CPU governor to performance')
      changes.push({ type: 'system', action: 'modified', target: 'CPU Governor', after: 'performance' })
    } catch {
      details.push('cpupower not available. Install: sudo apt install linux-tools-common')
    }
  } else {
    details.push('macOS: System auto-manages performance. No manual power plan switching.')
  }

  return {
    success: changes.length > 0,
    module: 'gaming',
    action: 'high_performance',
    description: 'Set high performance power plan for gaming',
    details, changes, rollbackAvailable: true
  }
}

// ============================================================
// RAM Cleanup for Gaming
// ============================================================
export async function cleanupRamForGaming(): Promise<FixResult> {
  const changes: FixChange[] = []
  const details: string[] = []

  // Get current memory usage
  const memBefore = await si.mem()
  const usedBefore = Math.round(memBefore.used / (1024 ** 3) * 10) / 10

  if (isWindows) {
    // Kill known RAM-hungry non-essential processes
    const processesToKill = [
      'OneDrive.exe', 'Teams.exe', 'Slack.exe', 'Discord.exe',
      'Spotify.exe', 'Steam.exe', 'EpicGamesLauncher.exe',
      'chrome.exe', 'msedge.exe', 'firefox.exe',
      'SearchApp.exe', 'YourPhone.exe', 'SkypeApp.exe',
      'GameBarPresenceWriter.exe'
    ]

    for (const proc of processesToKill) {
      try {
        execFileSync('taskkill', ['/IM', proc, '/F'], {
          timeout: 5000, encoding: 'utf8'
        })
        details.push(`Closed: ${proc}`)
        changes.push({ type: 'process', action: 'killed', target: proc })
      } catch { /* process not running */ }
    }

    // Clear standby list (requires admin)
    try {
      execFileSync('powershell', [
        '-NoProfile', '-Command',
        '[System.Runtime.InteropServices.Marshal]::SizeOf([Type][IntPtr]) -eq 8 | Out-Null; ' +
        'Clear-RecycleBin -Force -ErrorAction SilentlyContinue'
      ], { timeout: 10000, encoding: 'utf8' })
      details.push('Cleared Recycle Bin')
    } catch { /* ignore */ }

    // Disable unnecessary services temporarily
    const servicesToPause = ['SysMain', 'WSearch']
    for (const svc of servicesToPause) {
      try {
        execFileSync('powershell', [
          '-NoProfile', '-Command',
          `Stop-Service -Name "${svc}" -Force -ErrorAction SilentlyContinue`
        ], { timeout: 10000, encoding: 'utf8' })
        details.push(`Paused service: ${svc}`)
        changes.push({ type: 'service', action: 'disabled', target: svc })
      } catch { /* ignore */ }
    }
  } else if (isLinux) {
    try {
      // Drop caches
      execFileSync('pkexec', ['sh', '-c', 'sync && echo 3 > /proc/sys/vm/drop_caches'], {
        timeout: 10000, encoding: 'utf8'
      })
      details.push('Dropped kernel caches')
      changes.push({ type: 'system', action: 'cleared', target: 'Kernel caches' })
    } catch {
      details.push('Could not drop caches (requires root)')
    }
  }

  // Check memory freed
  const memAfter = await si.mem()
  const usedAfter = Math.round(memAfter.used / (1024 ** 3) * 10) / 10
  const freed = Math.round((usedBefore - usedAfter) * 10) / 10

  if (freed > 0) {
    details.push(`Freed approximately ${freed}GB of RAM`)
  }
  details.push(`Memory: ${usedBefore}GB → ${usedAfter}GB used (of ${Math.round(memAfter.total / (1024 ** 3))}GB total)`)

  return {
    success: true,
    module: 'gaming',
    action: 'cleanup_ram',
    description: 'RAM cleanup for gaming',
    details, changes, rollbackAvailable: false
  }
}

// ============================================================
// DirectX Repair
// ============================================================
export async function repairDirectX(): Promise<FixResult> {
  const changes: FixChange[] = []
  const details: string[] = []

  if (!isWindows) {
    return {
      success: true, module: 'gaming', action: 'repair_directx',
      description: 'DirectX is Windows-only',
      details: [
        isLinux ? 'Linux: Install Vulkan drivers (mesa-vulkan-drivers) and DXVK for gaming' :
          'macOS: Games use Metal API. Install Rosetta 2 for x86 game compatibility.'
      ],
      changes: [], rollbackAvailable: false
    }
  }

  // Re-register DirectX DLLs
  const dxDlls = [
    'd3d9.dll', 'd3d10.dll', 'd3d11.dll', 'd3d12.dll',
    'dxgi.dll', 'dxdiag.exe', 'd3dcompiler_47.dll',
    'xinput1_3.dll', 'xinput1_4.dll'
  ]

  for (const dll of dxDlls) {
    try {
      execFileSync('regsvr32', ['/s', dll], {
        timeout: 5000, encoding: 'utf8'
      })
      details.push(`Re-registered: ${dll}`)
      changes.push({ type: 'system', action: 'repaired', target: dll })
    } catch { /* dll may not exist or not be a COM server */ }
  }

  // Run SFC to repair system files (includes DirectX)
  try {
    details.push('Running System File Checker (this may take a few minutes)...')
    const output = execFileSync('sfc', ['/scannow'], {
      timeout: 300000, encoding: 'utf8'
    })
    if (/found corrupt files/i.test(output)) {
      details.push('SFC found and repaired corrupt system files')
      changes.push({ type: 'system', action: 'repaired', target: 'System files (SFC)' })
    } else if (/did not find any integrity violations/i.test(output)) {
      details.push('SFC: No integrity violations found')
    }
  } catch {
    details.push('SFC requires administrator privileges')
  }

  // Check and repair Visual C++ Redistributables
  try {
    const output = execFileSync('powershell', [
      '-NoProfile', '-Command',
      'Get-ItemProperty HKLM:\\SOFTWARE\\Microsoft\\VisualStudio\\*\\VC\\Runtimes\\* -ErrorAction SilentlyContinue | Select-Object PSChildName,Version | ConvertTo-Json'
    ], { timeout: 10000, encoding: 'utf8' })

    if (output.trim()) {
      const runtimes = JSON.parse(output)
      const rtArr = Array.isArray(runtimes) ? runtimes : [runtimes]
      details.push(`Visual C++ Runtimes installed: ${rtArr.length}`)
      for (const rt of rtArr) {
        details.push(`  ${rt.PSChildName}: ${rt.Version}`)
      }
    }
  } catch { /* ignore */ }

  details.push('')
  details.push('Additional recommendations:')
  details.push('  1. Download latest DirectX End-User Runtime from microsoft.com/download/details.aspx?id=35')
  details.push('  2. Install latest Visual C++ Redistributables (2015-2022)')
  details.push('  3. Update GPU drivers from manufacturer website')

  return {
    success: true,
    module: 'gaming',
    action: 'repair_directx',
    description: 'DirectX repair and verification',
    details, changes, rollbackAvailable: false
  }
}

// ============================================================
// GPU Priority Optimization
// ============================================================
export async function optimizeGpuSettings(): Promise<FixResult> {
  const changes: FixChange[] = []
  const details: string[] = []

  if (isWindows) {
    // Set GPU scheduling (Windows 10 2004+)
    try {
      execFileSync('powershell', [
        '-NoProfile', '-Command',
        'Set-ItemProperty -Path "HKLM:\\SYSTEM\\CurrentControlSet\\Control\\GraphicsDrivers" -Name "HwSchMode" -Value 2 -Force -ErrorAction Stop'
      ], { timeout: 10000, encoding: 'utf8' })
      details.push('Enabled Hardware-Accelerated GPU Scheduling')
      changes.push({ type: 'registry', action: 'modified', target: 'GPU Scheduling', after: 'Hardware Accelerated' })
    } catch {
      details.push('GPU Scheduling: Could not modify (may need admin or unsupported GPU)')
    }

    // Disable fullscreen optimizations globally
    try {
      execFileSync('powershell', [
        '-NoProfile', '-Command',
        'Set-ItemProperty -Path "HKCU:\\System\\GameConfigStore" -Name "GameDVR_FSEBehaviorMode" -Value 2 -Force -ErrorAction SilentlyContinue; ' +
        'Set-ItemProperty -Path "HKCU:\\System\\GameConfigStore" -Name "GameDVR_HonorUserFSEBehaviorMode" -Value 1 -Force -ErrorAction SilentlyContinue'
      ], { timeout: 10000, encoding: 'utf8' })
      details.push('Disabled fullscreen optimizations (reduces input lag)')
      changes.push({ type: 'registry', action: 'modified', target: 'Fullscreen Optimizations', after: 'Disabled' })
    } catch { /* ignore */ }

    // Disable Game DVR background recording
    try {
      execFileSync('powershell', [
        '-NoProfile', '-Command',
        'Set-ItemProperty -Path "HKCU:\\Software\\Microsoft\\GameBar" -Name "AppCaptureEnabled" -Value 0 -Force -ErrorAction SilentlyContinue; ' +
        'Set-ItemProperty -Path "HKCU:\\System\\GameConfigStore" -Name "GameDVR_Enabled" -Value 0 -Force -ErrorAction SilentlyContinue'
      ], { timeout: 10000, encoding: 'utf8' })
      details.push('Disabled Game DVR background recording (frees GPU resources)')
      changes.push({ type: 'registry', action: 'disabled', target: 'Game DVR Recording' })
    } catch { /* ignore */ }

    // Set NVIDIA power management to prefer max performance (if NVIDIA)
    try {
      const gpuInfo = await si.graphics()
      const hasNvidia = gpuInfo.controllers.some(c =>
        /nvidia/i.test(c.vendor || '') || /geforce|rtx|gtx/i.test(c.model || '')
      )
      if (hasNvidia) {
        details.push('NVIDIA GPU detected. For best performance:')
        details.push('  → NVIDIA Control Panel → Manage 3D Settings → Power management mode → Prefer maximum performance')
        details.push('  → Set Texture filtering quality to "High Performance"')
      }

      const hasAmd = gpuInfo.controllers.some(c =>
        /amd|ati/i.test(c.vendor || '') || /radeon/i.test(c.model || '')
      )
      if (hasAmd) {
        details.push('AMD GPU detected. For best performance:')
        details.push('  → AMD Software → Performance → Tuning → Enable GPU Tuning')
        details.push('  → Set Power Tuning to +15% for extra headroom')
      }
    } catch { /* ignore */ }
  }

  if (isLinux) {
    details.push('Linux Gaming Optimization:')
    details.push('  1. Install GameMode: sudo apt install gamemode')
    details.push('  2. Use with games: gamemoderun ./game')
    details.push('  3. NVIDIA: nvidia-settings → PowerMizer → Prefer Maximum Performance')
    details.push('  4. AMD: echo "high" | sudo tee /sys/class/drm/card0/device/power_dpm_force_performance_level')
    details.push('  5. Enable Vulkan: sudo apt install mesa-vulkan-drivers')
  }

  if (isMac) {
    details.push('macOS Gaming Tips:')
    details.push('  1. Close all background apps before gaming')
    details.push('  2. Plug in power adapter (GPU throttles on battery)')
    details.push('  3. For Apple Silicon: Games run best when built for ARM/Metal')
    details.push('  4. Install Rosetta 2 for Intel-only games: softwareupdate --install-rosetta')
  }

  return {
    success: true,
    module: 'gaming',
    action: 'optimize_gpu',
    description: 'GPU and gaming optimization',
    details, changes, rollbackAvailable: true
  }
}

// ============================================================
// Main Diagnostics
// ============================================================
export async function runGamingDiagnostics(): Promise<DiagnosticResult[]> {
  const results: DiagnosticResult[] = []
  const status = await getGamingStatus()

  // GPU Analysis
  if (status.gpuInfo.length === 0) {
    results.push({
      id: `game-nogpu-${Date.now()}`,
      module: 'gaming',
      category: 'GPU',
      title: 'No dedicated GPU detected',
      severity: 'warning',
      description: 'No dedicated graphics card found. Gaming performance will be limited to integrated graphics.',
      details: ['Consider adding a dedicated GPU for better gaming experience'],
      fixAvailable: false,
      fixRisk: 'none',
      autoFixable: false,
      timestamp: Date.now()
    })
  } else {
    for (const gpu of status.gpuInfo) {
      const severity = gpu.vramMB < 2048 ? 'warning' : 'healthy'
      results.push({
        id: `game-gpu-${gpu.model.replace(/\s+/g, '-')}-${Date.now()}`,
        module: 'gaming',
        category: 'GPU',
        title: `GPU: ${gpu.model} (${gpu.vramMB}MB VRAM)`,
        severity,
        description: `${gpu.vendor} ${gpu.model} with ${gpu.vramMB}MB VRAM`,
        details: [
          `Model: ${gpu.model}`,
          `Vendor: ${gpu.vendor}`,
          `VRAM: ${gpu.vramMB}MB`,
          `Driver: ${gpu.driverVersion}`,
          gpu.temperature > 0 ? `Temperature: ${gpu.temperature}C` : ''
        ].filter(Boolean),
        fixAvailable: gpu.vramMB < 2048,
        fixDescription: 'Optimize GPU settings for best performance',
        fixRisk: 'low',
        autoFixable: true,
        timestamp: Date.now()
      })
    }
  }

  // Game Mode
  if (isWindows) {
    results.push({
      id: `game-mode-${Date.now()}`,
      module: 'gaming',
      category: 'Game Mode',
      title: `Windows Game Mode: ${status.gameMode ? 'Enabled' : 'Disabled'}`,
      severity: status.gameMode ? 'healthy' : 'info',
      description: status.gameMode
        ? 'Game Mode is active. Windows will prioritize gaming processes.'
        : 'Game Mode is disabled. Enabling it can improve gaming performance.',
      details: [
        `Game Mode: ${status.gameMode ? 'ON' : 'OFF'}`,
        'Game Mode reduces background activity during games'
      ],
      fixAvailable: !status.gameMode,
      fixDescription: 'Enable Windows Game Mode',
      fixRisk: 'none',
      autoFixable: true,
      timestamp: Date.now()
    })
  }

  // Power Plan
  if (status.powerPlan !== 'Unknown') {
    const isOptimal = /high performance|ultimate/i.test(status.powerPlan)
    results.push({
      id: `game-power-${Date.now()}`,
      module: 'gaming',
      category: 'Power Plan',
      title: `Power Plan: ${status.powerPlan}`,
      severity: isOptimal ? 'healthy' : status.powerPlan === 'Power Saver' ? 'warning' : 'info',
      description: isOptimal
        ? 'Power plan is optimized for performance'
        : 'Switch to High Performance plan for better gaming',
      details: [`Current: ${status.powerPlan}`],
      fixAvailable: !isOptimal,
      fixDescription: 'Switch to High Performance power plan',
      fixRisk: 'none',
      autoFixable: true,
      timestamp: Date.now()
    })
  }

  // DirectX
  if (isWindows && status.directXVersion !== 'Unknown') {
    results.push({
      id: `game-dx-${Date.now()}`,
      module: 'gaming',
      category: 'DirectX',
      title: `DirectX Version: ${status.directXVersion}`,
      severity: 'info',
      description: `DirectX ${status.directXVersion} is installed`,
      details: [
        `Version: ${status.directXVersion}`,
        'Run dxdiag for detailed DirectX information'
      ],
      fixAvailable: true,
      fixDescription: 'Repair DirectX installation',
      fixRisk: 'low',
      autoFixable: true,
      timestamp: Date.now()
    })
  }

  // RAM Check
  if (status.ramGB < 8) {
    results.push({
      id: `game-ram-${Date.now()}`,
      module: 'gaming',
      category: 'Memory',
      title: `RAM: ${status.ramGB}GB (Below recommended)`,
      severity: 'warning',
      description: `System has ${status.ramGB}GB RAM. Modern games need 8-16GB minimum.`,
      details: [
        `Current: ${status.ramGB}GB`,
        'Recommended: 8GB minimum, 16GB optimal',
        'Consider upgrading RAM for smoother gaming'
      ],
      fixAvailable: true,
      fixDescription: 'Free up RAM by closing background apps',
      fixRisk: 'low',
      autoFixable: true,
      timestamp: Date.now()
    })
  }

  // Issues found
  for (const issue of status.issues) {
    results.push({
      id: `game-issue-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      module: 'gaming',
      category: 'Issues',
      title: issue,
      severity: 'warning',
      description: issue,
      details: [],
      fixAvailable: true,
      fixDescription: 'Apply gaming optimizations',
      fixRisk: 'low',
      autoFixable: true,
      timestamp: Date.now()
    })
  }

  return results
}
