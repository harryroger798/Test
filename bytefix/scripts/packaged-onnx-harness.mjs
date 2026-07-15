import { appendFileSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'

const asarPath = process.argv[2]
if (!asarPath) throw new Error('Usage: node scripts/packaged-onnx-harness.mjs <app.asar>')

const workdir = mkdtempSync(join(tmpdir(), 'bytefix-packaged-onnx-'))
const extracted = join(workdir, 'app')
const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx'
const runAsar = (args) => {
  const result = spawnSync(npx, ['--yes', 'asar', ...args], {
    encoding: 'utf8',
    stdio: 'inherit'
  })
  if (result.status !== 0) throw new Error(`asar command failed with status ${result.status}`)
}

try {
  runAsar(['extract', asarPath, extracted])
  const mainPath = join(extracted, 'out', 'main', 'index.js')
  const current = readFileSync(mainPath, 'utf8')
  const marker = 'BYTEFIX_PACKAGED_ONNX_HARNESS'
  if (current.includes(marker)) throw new Error('Harness already injected')
  appendFileSync(mainPath, `
// ${marker}
if (process.argv.includes('--onnx-harness')) {
  require$$1.app.whenReady().then(async () => {
    try {
      const result = await runOnnxInference({
        cpuUsagePercent: 20, ramUsagePercent: 40, diskUsagePercent: 30,
        temperatureCelsius: 45, processCount: 100, diskIOLatencyMs: 2,
        networkLatencyMs: 20, errorCount: 0, uptimeHours: 4, fanRPM: 1000,
        provenance: {
          cpuUsagePercent: 'measured', ramUsagePercent: 'measured',
          diskUsagePercent: 'measured', temperatureCelsius: 'measured',
          processCount: 'measured', diskIOLatencyMs: 'measured',
          networkLatencyMs: 'measured', errorCount: 'measured',
          uptimeHours: 'measured', fanRPM: 'measured'
        }
      });
      process.stdout.write('BYTEFIX_PACKAGED_ONNX_RESULT=' + JSON.stringify(result) + '\\\\n');
      process.exitCode = result.provider === 'onnx' ? 0 : 2;
    } catch (error) {
      process.stderr.write('BYTEFIX_PACKAGED_ONNX_ERROR=' + (error?.stack || error) + '\\\\n');
      process.exitCode = 1;
    } finally {
      require$$1.app.quit();
    }
  });
}
`)
  rmSync(asarPath)
  runAsar(['pack', extracted, asarPath])
} finally {
  rmSync(workdir, { recursive: true, force: true })
}
