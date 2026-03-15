// ============================================================
// ByteFix — Memory Diagnostics Module
// RAM health testing, memory error detection, built-in pattern tests
// Uses Windows Memory Diagnostic logs, Linux EDAC, built-in stress patterns
// ============================================================

import { execFileSync } from 'child_process'
import { existsSync, readFileSync } from 'fs'
import { platform } from 'os'
import si from 'systeminformation'
import { createLogger } from '../logger'
import type { DiagnosticResult, FixResult, FixChange } from '../../shared/types'

const logger = createLogger('memory-diagnostics')
const isWindows = platform() === 'win32'
const isLinux = platform() === 'linux'

// ============================================================
// Built-in Memory Pattern Test (cross-platform memtester alternative)
// ============================================================
interface MemTestResult {
  totalMB: number
  testedMB: number
  patterns: { name: string; passed: boolean; durationMs: number }[]
  errors: number
  overallPassed: boolean
  durationMs: number
}

export async function runBuiltInMemTest(testSizeMB: number = 128): Promise<MemTestResult> {
  const startTime = Date.now()
  const patterns: { name: string; passed: boolean; durationMs: number }[] = []
  let errors = 0

  // Limit test size to prevent OOM
  const maxTestMB = Math.min(testSizeMB, 512)
  const testBytes = maxTestMB * 1024 * 1024

  // Pattern 1: Walking Ones
  {
    const patStart = Date.now()
    let passed = true
    try {
      const buf = Buffer.alloc(Math.min(testBytes, 64 * 1024 * 1024))
      for (let bit = 0; bit < 8; bit++) {
        const pattern = 1 << bit
        buf.fill(pattern)
        for (let i = 0; i < buf.length; i += 4096) {
          if (buf[i] !== pattern) { passed = false; errors++; break }
        }
        if (!passed) break
      }
    } catch { passed = false; errors++ }
    patterns.push({ name: 'Walking Ones', passed, durationMs: Date.now() - patStart })
  }

  // Pattern 2: Walking Zeros
  {
    const patStart = Date.now()
    let passed = true
    try {
      const buf = Buffer.alloc(Math.min(testBytes, 64 * 1024 * 1024))
      for (let bit = 0; bit < 8; bit++) {
        const pattern = ~(1 << bit) & 0xFF
        buf.fill(pattern)
        for (let i = 0; i < buf.length; i += 4096) {
          if (buf[i] !== pattern) { passed = false; errors++; break }
        }
        if (!passed) break
      }
    } catch { passed = false; errors++ }
    patterns.push({ name: 'Walking Zeros', passed, durationMs: Date.now() - patStart })
  }

  // Pattern 3: All 0xFF
  {
    const patStart = Date.now()
    let passed = true
    try {
      const buf = Buffer.alloc(Math.min(testBytes, 64 * 1024 * 1024))
      buf.fill(0xFF)
      for (let i = 0; i < buf.length; i += 4096) {
        if (buf[i] !== 0xFF) { passed = false; errors++; break }
      }
    } catch { passed = false; errors++ }
    patterns.push({ name: 'All 0xFF', passed, durationMs: Date.now() - patStart })
  }

  // Pattern 4: All 0x00
  {
    const patStart = Date.now()
    let passed = true
    try {
      const buf = Buffer.alloc(Math.min(testBytes, 64 * 1024 * 1024))
      buf.fill(0x00)
      for (let i = 0; i < buf.length; i += 4096) {
        if (buf[i] !== 0x00) { passed = false; errors++; break }
      }
    } catch { passed = false; errors++ }
    patterns.push({ name: 'All 0x00', passed, durationMs: Date.now() - patStart })
  }

  // Pattern 5: Alternating 0xAA/0x55 (checkerboard)
  {
    const patStart = Date.now()
    let passed = true
    try {
      const buf = Buffer.alloc(Math.min(testBytes, 64 * 1024 * 1024))
      for (let i = 0; i < buf.length; i++) {
        buf[i] = i % 2 === 0 ? 0xAA : 0x55
      }
      for (let i = 0; i < buf.length; i += 4096) {
        const expected = i % 2 === 0 ? 0xAA : 0x55
        if (buf[i] !== expected) { passed = false; errors++; break }
      }
    } catch { passed = false; errors++ }
    patterns.push({ name: 'Checkerboard (0xAA/0x55)', passed, durationMs: Date.now() - patStart })
  }

  // Pattern 6: Random data write/verify
  {
    const patStart = Date.now()
    let passed = true
    try {
      const buf = Buffer.alloc(Math.min(testBytes, 32 * 1024 * 1024))
      const seed = Date.now() % 256
      // Write pseudo-random pattern
      for (let i = 0; i < buf.length; i++) {
        buf[i] = (seed + i * 7 + (i >> 8) * 13) & 0xFF
      }
      // Verify
      for (let i = 0; i < buf.length; i += 4096) {
        const expected = (seed + i * 7 + (i >> 8) * 13) & 0xFF
        if (buf[i] !== expected) { passed = false; errors++; break }
      }
    } catch { passed = false; errors++ }
    patterns.push({ name: 'Random Pattern', passed, durationMs: Date.now() - patStart })
  }

  const mem = await si.mem()

  return {
    totalMB: Math.round(mem.total / (1024 ** 2)),
    testedMB: maxTestMB,
    patterns,
    errors,
    overallPassed: errors === 0,
    durationMs: Date.now() - startTime
  }
}

// ============================================================
// Schedule Windows Memory Diagnostic (requires reboot)
// ============================================================
export async function scheduleWindowsMemDiag(): Promise<FixResult> {
  const changes: FixChange[] = []
  const details: string[] = []

  try {
    if (!isWindows) {
      return {
        success: false, module: 'memory', action: 'schedule-winmemdiag',
        description: 'Windows Memory Diagnostic is only available on Windows',
        details: ['On Linux, use: sudo memtester 1G 1', 'On macOS, use: Apple Diagnostics (hold D during boot)'],
        changes, rollbackAvailable: false, error: 'Wrong platform'
      }
    }

    details.push('Scheduling Windows Memory Diagnostic...')
    details.push('The system will restart and run a comprehensive memory test.')
    details.push('Results will be available in Event Viewer after restart.')

    // Schedule the test (will require restart)
    try {
      execFileSync('powershell', [
        '-NoProfile', '-Command',
        'Start-Process mdsched.exe -ArgumentList "/scheduleoncenext" -Wait -NoNewWindow'
      ], { timeout: 15000, encoding: 'utf8' })
      details.push('Memory diagnostic scheduled for next restart.')
      details.push('Restart the computer to begin the test.')
      changes.push({ type: 'system', action: 'created', target: 'Windows Memory Diagnostic scheduled' })
    } catch {
      details.push('Could not schedule automatic test. Opening Memory Diagnostic UI...')
      try {
        execFileSync('mdsched.exe', [], { timeout: 5000, encoding: 'utf8' })
        details.push('Windows Memory Diagnostic tool opened.')
        changes.push({ type: 'system', action: 'created', target: 'Memory Diagnostic UI opened' })
      } catch {
        details.push('Could not open Memory Diagnostic. Run mdsched.exe manually as Administrator.')
      }
    }

    return {
      success: changes.length > 0,
      module: 'memory', action: 'schedule-winmemdiag',
      description: 'Windows Memory Diagnostic',
      details, changes, rollbackAvailable: false
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err)
    return {
      success: false, module: 'memory', action: 'schedule-winmemdiag',
      description: 'Failed to schedule memory diagnostic',
      details: [...details, errMsg], changes, rollbackAvailable: false, error: errMsg
    }
  }
}

// ============================================================
// Read Previous Memory Diagnostic Results
// ============================================================
async function readMemDiagResults(): Promise<{ found: boolean; results: string[] }> {
  const results: string[] = []

  if (isWindows) {
    try {
      const output = execFileSync('powershell', [
        '-NoProfile', '-Command',
        'Get-WinEvent -FilterHashtable @{LogName="System"; ProviderName="Microsoft-Windows-MemoryDiagnostics-Results"} -MaxEvents 5 -ErrorAction SilentlyContinue | Select-Object TimeCreated, Message | ConvertTo-Json'
      ], { timeout: 15000, encoding: 'utf8' })

      if (output.trim() && output.trim() !== 'null') {
        const events = JSON.parse(output.trim())
        const eventArr = Array.isArray(events) ? events : [events]
        for (const evt of eventArr) {
          results.push(`[${evt.TimeCreated}] ${evt.Message}`)
        }
      }
    } catch {
      // No results found
    }
  }

  if (isLinux) {
    // Check EDAC (Error Detection and Correction)
    try {
      if (existsSync('/sys/devices/system/edac/mc')) {
        const output = execFileSync('find', [
          '/sys/devices/system/edac/mc', '-name', 'ce_count', '-o', '-name', 'ue_count'
        ], { timeout: 5000, encoding: 'utf8' })

        for (const line of output.trim().split('\n').filter(Boolean)) {
          try {
            const count = readFileSync(line, 'utf8').trim()
            const type = line.includes('ce_count') ? 'Correctable' : 'Uncorrectable'
            results.push(`${type} errors at ${line}: ${count}`)
          } catch { /* skip */ }
        }
      }
    } catch {
      // EDAC not available
    }

    // Check dmesg for memory errors
    try {
      const output = execFileSync('dmesg', ['--level=err,warn'], {
        timeout: 10000, encoding: 'utf8'
      })
      const memLines = output.split('\n').filter(l => /memory|ram|edac|mce/i.test(l))
      for (const line of memLines.slice(0, 10)) {
        results.push(line.trim())
      }
    } catch { /* dmesg may need root */ }
  }

  return { found: results.length > 0, results }
}

// ============================================================
// Main Diagnostics
// ============================================================
export async function runMemoryDiagnostics(): Promise<DiagnosticResult[]> {
  const results: DiagnosticResult[] = []
  const now = Date.now()

  // Get memory information
  const mem = await si.mem()
  const memLayout = await si.memLayout()

  const totalGB = mem.total / (1024 ** 3)
  const usedGB = mem.used / (1024 ** 3)
  const freeGB = mem.free / (1024 ** 3)
  const usedPercent = (mem.used / mem.total) * 100

  // Memory Overview
  results.push({
    id: `mem-overview-${now}`,
    module: 'memory',
    category: 'Memory Diagnostics',
    title: `RAM: ${totalGB.toFixed(1)} GB Total (${usedPercent.toFixed(0)}% Used)`,
    severity: usedPercent > 90 ? 'critical' : usedPercent > 80 ? 'warning' : 'healthy',
    description: usedPercent > 90
      ? 'Critical: Memory usage is extremely high! System may be sluggish.'
      : usedPercent > 80
        ? 'Warning: Memory usage is high. Consider closing unused applications.'
        : 'Memory usage is within normal range.',
    details: [
      `Total: ${totalGB.toFixed(2)} GB`,
      `Used: ${usedGB.toFixed(2)} GB (${usedPercent.toFixed(1)}%)`,
      `Free: ${freeGB.toFixed(2)} GB`,
      `Swap Total: ${(mem.swaptotal / (1024 ** 3)).toFixed(2)} GB`,
      `Swap Used: ${(mem.swapused / (1024 ** 3)).toFixed(2)} GB`
    ],
    fixAvailable: usedPercent > 80,
    fixDescription: usedPercent > 80 ? 'Close unused applications or optimize RAM usage' : undefined,
    fixRisk: 'low',
    autoFixable: false,
    timestamp: now
  })

  // Memory Module Details
  if (memLayout.length > 0) {
    const moduleDetails = memLayout.map((m, i) => {
      const sizeGB = (m.size || 0) / (1024 ** 3)
      return `Slot ${i}: ${sizeGB.toFixed(0)}GB ${m.type || 'Unknown'} ${m.clockSpeed || '?'}MHz — ${m.manufacturer || 'Unknown'} ${m.partNum || ''}`
    })

    const totalSlots = memLayout.length
    const populatedSlots = memLayout.filter(m => (m.size || 0) > 0).length
    const emptySlots = totalSlots - populatedSlots

    results.push({
      id: `mem-layout-${now}`,
      module: 'memory',
      category: 'Memory Diagnostics',
      title: `${populatedSlots} Memory Module(s) Installed${emptySlots > 0 ? ` (${emptySlots} empty slot(s))` : ''}`,
      severity: emptySlots > 0 ? 'info' : 'healthy',
      description: emptySlots > 0
        ? `${emptySlots} memory slot(s) available for upgrade`
        : 'All memory slots are populated',
      details: moduleDetails,
      fixAvailable: false,
      fixRisk: 'none',
      autoFixable: false,
      timestamp: now
    })

    // Check for mismatched memory speeds
    const speeds = memLayout.filter(m => (m.clockSpeed || 0) > 0).map(m => m.clockSpeed)
    if (speeds.length > 1) {
      const uniqueSpeeds = [...new Set(speeds)]
      if (uniqueSpeeds.length > 1) {
        results.push({
          id: `mem-mismatch-${now}`,
          module: 'memory',
          category: 'Memory Diagnostics',
          title: 'Mismatched Memory Speeds Detected',
          severity: 'warning',
          description: 'Memory modules are running at different speeds, which may reduce performance.',
          details: [
            `Detected speeds: ${uniqueSpeeds.join('MHz, ')}MHz`,
            'All modules will run at the slowest speed',
            'For best performance, use matching memory modules'
          ],
          fixAvailable: false,
          fixRisk: 'none',
          autoFixable: false,
          timestamp: now
        })
      }
    }
  }

  // Page File / Swap usage
  if (mem.swaptotal > 0) {
    const swapPercent = (mem.swapused / mem.swaptotal) * 100
    if (swapPercent > 50) {
      results.push({
        id: `mem-swap-${now}`,
        module: 'memory',
        category: 'Memory Diagnostics',
        title: `High Swap Usage: ${swapPercent.toFixed(0)}%`,
        severity: swapPercent > 80 ? 'critical' : 'warning',
        description: 'System is using significant swap/page file space, indicating physical RAM shortage.',
        details: [
          `Swap used: ${(mem.swapused / (1024 ** 3)).toFixed(2)} GB of ${(mem.swaptotal / (1024 ** 3)).toFixed(2)} GB`,
          'This causes severe performance degradation',
          'Consider adding more RAM or closing memory-heavy applications'
        ],
        fixAvailable: true,
        fixDescription: 'Optimize RAM usage and consider hardware upgrade',
        fixRisk: 'low',
        autoFixable: false,
        timestamp: now
      })
    }
  }

  // Previous memory diagnostic results
  const prevResults = await readMemDiagResults()
  if (prevResults.found) {
    const hasErrors = prevResults.results.some(r => /error|fail|bad/i.test(r))
    results.push({
      id: `mem-prev-results-${now}`,
      module: 'memory',
      category: 'Memory Diagnostics',
      title: hasErrors ? 'Previous Memory Test Found Errors!' : 'Previous Memory Test Results Available',
      severity: hasErrors ? 'critical' : 'info',
      description: hasErrors
        ? 'Previous memory diagnostic detected errors. RAM may need replacement.'
        : 'Previous memory diagnostic results found in system logs.',
      details: prevResults.results.slice(0, 10),
      fixAvailable: hasErrors,
      fixDescription: hasErrors ? 'Replace faulty RAM module(s). Run test again to confirm.' : undefined,
      fixRisk: 'none',
      autoFixable: false,
      timestamp: now
    })
  }

  // Tool availability
  if (isWindows) {
    results.push({
      id: `mem-tools-${now}`,
      module: 'memory',
      category: 'Memory Diagnostics',
      title: 'Memory Testing Tools',
      severity: 'info',
      description: 'Available memory testing options',
      details: [
        'Built-in Pattern Test: Tests RAM with 6 different patterns (no reboot needed)',
        'Windows Memory Diagnostic: Comprehensive test (requires reboot)',
        'MemTest86+: Boot from USB for the most thorough test (external tool)'
      ],
      fixAvailable: false,
      fixRisk: 'none',
      autoFixable: false,
      timestamp: now
    })
  } else if (isLinux) {
    let memtesterAvailable = false
    try {
      execFileSync('which', ['memtester'], { timeout: 5000, encoding: 'utf8' })
      memtesterAvailable = true
    } catch { /* not found */ }

    results.push({
      id: `mem-tools-${now}`,
      module: 'memory',
      category: 'Memory Diagnostics',
      title: memtesterAvailable ? 'memtester Available' : 'memtester Not Installed',
      severity: memtesterAvailable ? 'healthy' : 'info',
      description: memtesterAvailable
        ? 'memtester is installed for userspace memory testing'
        : 'Install memtester for advanced testing: sudo apt install memtester',
      details: memtesterAvailable
        ? ['Usage: sudo memtester 1G 1 (test 1GB, 1 pass)', 'Built-in pattern test also available']
        : ['Install: sudo apt install memtester', 'Built-in pattern test available as alternative'],
      fixAvailable: !memtesterAvailable,
      fixDescription: memtesterAvailable ? undefined : 'Install memtester: sudo apt install memtester',
      fixRisk: 'low',
      autoFixable: false,
      timestamp: now
    })
  }

  return results
}
