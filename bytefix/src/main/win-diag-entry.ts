export {
  collectSystemMetrics,
  collectWindowsSensorReadings,
  runOnnxInference
} from './modules/ai-diagnostics'
export { getStartupItems, getLastStartupProbe } from './modules/performance-optimizer'
export { listAudioDevices, isAudioProblemDevice, getLastAudioProbe } from './modules/audio-fixer'
export { buildEvidence, CloudflareProvider } from './modules/ai-provider'
