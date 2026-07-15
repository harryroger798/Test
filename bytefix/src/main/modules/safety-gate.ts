import type { FixResult } from '../../shared/types'
import { createLogger } from '../logger'
import { recordSafetyAction } from './activity-log'

export type SafetyRisk = 'none' | 'low' | 'medium' | 'high'

export interface SafetyPolicy {
  risk: SafetyRisk
  destructive: boolean
  description: string
  reversibility: string
}

export const SAFETY_REGISTRY: Record<string, SafetyPolicy> = {
  'perf:disableStartupItem': { risk: 'low', destructive: false, description: 'Disable one startup item.', reversibility: 'Reversible from startup settings.' },
  'perf:runCleanup': { risk: 'low', destructive: false, description: 'Remove selected temporary files.', reversibility: 'Some cleanup is not reversible.' },
  'perf:optimizeRam': { risk: 'low', destructive: false, description: 'Apply memory optimization steps.', reversibility: 'Reversible by restoring process settings.' },
  'perf:optimizeDisk': { risk: 'medium', destructive: false, description: 'Apply disk performance optimization.', reversibility: 'Generally reversible through system settings.' },
  'network:resetAdapter': { risk: 'medium', destructive: false, description: 'Reset a network adapter.', reversibility: 'Reversible by reconnecting or restoring adapter settings.' },
  'network:flushDns': { risk: 'none', destructive: false, description: 'Flush the DNS resolver cache.', reversibility: 'No persistent change.' },
  'network:resetWinsock': { risk: 'medium', destructive: false, description: 'Reset the Windows Winsock catalog.', reversibility: 'Requires reboot; applications can reconfigure networking.' },
  'network:resetTcpIp': { risk: 'medium', destructive: false, description: 'Reset the TCP/IP stack.', reversibility: 'Requires reboot; network settings can be restored.' },
  'os:runSfc': { risk: 'medium', destructive: false, description: 'Repair protected Windows system files.', reversibility: 'Windows replaces files from its component store.' },
  'os:runDism': { risk: 'medium', destructive: false, description: 'Repair the Windows component store.', reversibility: 'Windows manages the component-store changes.' },
  'os:repairWindowsUpdate': { risk: 'medium', destructive: false, description: 'Repair Windows Update components.', reversibility: 'Can be reversed through Windows services/settings.' },
  'os:cleanRegistry': { risk: 'high', destructive: true, description: 'Modify or clean registry entries.', reversibility: 'Not reliably reversible without a backup.' },
  'battery:optimizePower': { risk: 'low', destructive: false, description: 'Apply power-management optimizations.', reversibility: 'Reversible through power settings.' },
  'disk:runChkdsk': { risk: 'low', destructive: false, description: 'Run an online filesystem scan.', reversibility: 'Read-only scan; no persistent repair.' },
  'recovery:restoreShadowCopy': { risk: 'medium', destructive: false, description: 'Restore files from a shadow copy.', reversibility: 'Restored files may be overwritten again from backup.' },
  'recovery:restoreRecycleBin': { risk: 'medium', destructive: false, description: 'Restore items from the recycle bin.', reversibility: 'Restored files can be moved again.' },
  'recovery:runPhotorec': { risk: 'medium', destructive: false, description: 'Recover files to a destination directory.', reversibility: 'Source is read-only; destination files can be removed.' },
  'recovery:repairFilesystem': { risk: 'high', destructive: true, description: 'Repair filesystem metadata.', reversibility: 'Not reliably reversible.' },
  'password:enableAdmin': { risk: 'high', destructive: true, description: 'Enable the local administrator account.', reversibility: 'Requires a later explicit disable action.' },
  'password:disableAdmin': { risk: 'high', destructive: true, description: 'Disable the local administrator account.', reversibility: 'Requires a later explicit enable action.' },
  'audio:restartService': { risk: 'low', destructive: false, description: 'Restart audio services.', reversibility: 'Services can be started again.' },
  'audio:reinstallDrivers': { risk: 'medium', destructive: false, description: 'Reinstall audio drivers.', reversibility: 'Requires a driver backup or reinstall source.' },
  'audio:enableMicPrivacy': { risk: 'low', destructive: false, description: 'Enable microphone privacy access.', reversibility: 'Reversible in Windows privacy settings.' },
  'audio:disableEnhancements': { risk: 'low', destructive: false, description: 'Disable audio enhancements.', reversibility: 'Reversible in audio properties.' },
  'bluetooth:restartService': { risk: 'low', destructive: false, description: 'Restart Bluetooth services.', reversibility: 'Services can be started again.' },
  'bluetooth:clearCache': { risk: 'low', destructive: false, description: 'Clear Bluetooth pairing cache.', reversibility: 'Devices can be paired again.' },
  'bluetooth:reinstallDrivers': { risk: 'medium', destructive: false, description: 'Reinstall Bluetooth drivers.', reversibility: 'Requires a driver backup or reinstall source.' },
  'bluetooth:fixAudio': { risk: 'medium', destructive: false, description: 'Apply Bluetooth audio settings.', reversibility: 'Reversible through audio settings.' },
  'printer:restartSpooler': { risk: 'low', destructive: false, description: 'Restart the print spooler.', reversibility: 'Service can be started again.' },
  'printer:clearQueue': { risk: 'medium', destructive: false, description: 'Clear pending print jobs.', reversibility: 'Jobs must be submitted again.' },
  'printer:convertWsdToTcpIp': { risk: 'medium', destructive: false, description: 'Change a printer connection to TCP/IP.', reversibility: 'Printer connection can be changed back.' },
  'printer:enableDiscovery': { risk: 'low', destructive: false, description: 'Enable printer discovery.', reversibility: 'Reversible in network settings.' },
  'display:reinstallDrivers': { risk: 'medium', destructive: false, description: 'Reinstall display drivers.', reversibility: 'Requires a driver backup or reinstall source.' },
  'display:fixTdr': { risk: 'medium', destructive: false, description: 'Adjust display timeout settings.', reversibility: 'Reversible through display settings.' },
  'display:disableHwAccel': { risk: 'low', destructive: false, description: 'Disable hardware acceleration.', reversibility: 'Reversible in application settings.' },
  'webcam:enablePrivacy': { risk: 'low', destructive: false, description: 'Enable camera privacy access.', reversibility: 'Reversible in privacy settings.' },
  'webcam:reinstallDrivers': { risk: 'medium', destructive: false, description: 'Reinstall camera drivers.', reversibility: 'Requires a driver backup or reinstall source.' },
  'webcam:powerCycle': { risk: 'medium', destructive: false, description: 'Power-cycle the camera device.', reversibility: 'Device can be re-enabled.' },
  'usb:disableSelectiveSuspend': { risk: 'low', destructive: false, description: 'Disable USB selective suspend.', reversibility: 'Reversible in power settings.' },
  'usb:reinstallDrivers': { risk: 'medium', destructive: false, description: 'Reinstall USB drivers.', reversibility: 'Requires a driver backup or reinstall source.' },
  'usb:repairRawDrive': { risk: 'high', destructive: true, description: 'Repair a raw USB drive.', reversibility: 'May alter or destroy filesystem data.' },
  'usb:disablePowerMgmt': { risk: 'low', destructive: false, description: 'Disable USB power management.', reversibility: 'Reversible in device power settings.' },
  'india:repairOffice': { risk: 'medium', destructive: false, description: 'Repair an Office installation.', reversibility: 'Can be changed through installed-app settings.' },
  'india:repairPst': { risk: 'medium', destructive: false, description: 'Repair an Outlook data file.', reversibility: 'Original data should be backed up first.' },
  'india:fixJavaBanking': { risk: 'medium', destructive: false, description: 'Apply Java banking compatibility settings.', reversibility: 'Reversible through Java/application settings.' },
  'india:cleanChrome': { risk: 'medium', destructive: false, description: 'Clean selected Chrome data.', reversibility: 'Some browser data may not be recoverable.' },
  'india:enableDotNet35': { risk: 'medium', destructive: false, description: 'Enable the .NET Framework feature.', reversibility: 'Reversible through Windows features.' },
  'thermal:optimizeCooling': { risk: 'low', destructive: false, description: 'Apply cooling configuration changes.', reversibility: 'Reversible through power settings.' },
  'thermal:killHighCpu': { risk: 'medium', destructive: false, description: 'Stop selected high-CPU processes.', reversibility: 'Processes may be started again.' },
  'hardware:guideMemTest': { risk: 'medium', destructive: false, description: 'Schedule a memory test.', reversibility: 'Requires reboot and can be cancelled before reboot.' },
  'keyboard:fixFilterKeys': { risk: 'low', destructive: false, description: 'Adjust Filter Keys settings.', reversibility: 'Reversible in accessibility settings.' },
  'keyboard:toggleTouchpad': { risk: 'low', destructive: false, description: 'Toggle the touchpad device.', reversibility: 'Device can be toggled back.' },
  'keyboard:reinstallDrivers': { risk: 'medium', destructive: false, description: 'Reinstall input drivers.', reversibility: 'Requires a driver backup or reinstall source.' },
  'gaming:enableGameMode': { risk: 'low', destructive: false, description: 'Enable game mode.', reversibility: 'Reversible in Windows settings.' },
  'gaming:setHighPerformance': { risk: 'medium', destructive: false, description: 'Select the high-performance power plan.', reversibility: 'Reversible by selecting another power plan.' },
  'gaming:cleanupRam': { risk: 'low', destructive: false, description: 'Clean up selected gaming processes.', reversibility: 'Processes can be started again.' },
  'gaming:repairDirectX': { risk: 'medium', destructive: false, description: 'Repair DirectX components.', reversibility: 'Windows component changes are managed by the installer.' },
  'gaming:optimizeGpu': { risk: 'medium', destructive: false, description: 'Apply GPU optimization settings.', reversibility: 'Reversible through graphics settings.' },
  'partition:repairBcd': { risk: 'high', destructive: true, description: 'Modify Windows boot configuration.', reversibility: 'Requires a boot configuration backup.' },
  'partition:repairGrub': { risk: 'high', destructive: true, description: 'Modify GRUB boot configuration.', reversibility: 'Requires a boot configuration backup.' },
  'activation:troubleshoot': { risk: 'medium', destructive: false, description: 'Run the Windows activation troubleshooter.', reversibility: 'Windows manages the activation changes.' },
  'email:autoConfigure': { risk: 'medium', destructive: false, description: 'Configure an email account profile.', reversibility: 'Profile settings can be edited or removed.' },
  'email:repairOutlook': { risk: 'medium', destructive: false, description: 'Repair an Outlook profile.', reversibility: 'Profile settings can be edited or removed.' },
  'email:clearCredentials': { risk: 'high', destructive: true, description: 'Remove stored email credentials.', reversibility: 'Credentials must be entered again.' },
  'phone:guideUsbDebugging': { risk: 'medium', destructive: false, description: 'Enable USB debugging guidance.', reversibility: 'Can be disabled on the phone.' },
  'phone:pullFiles': { risk: 'medium', destructive: false, description: 'Copy files from a phone.', reversibility: 'Source files are not modified.' },
  'diskimg:clonePartition': { risk: 'high', destructive: true, description: 'Clone a partition to a destination.', reversibility: 'Destination data may be overwritten.' },
  'diskimg:rescueDrive': { risk: 'medium', destructive: false, description: 'Copy recoverable data from a drive.', reversibility: 'Destination files can be removed.' },
  'partmgr:resize': { risk: 'high', destructive: true, description: 'Resize a partition.', reversibility: 'Requires a partition backup.' },
  'partmgr:format': { risk: 'high', destructive: true, description: 'Format a partition.', reversibility: 'Destroys existing filesystem data.' },
  'partmgr:create': { risk: 'high', destructive: true, description: 'Create a partition.', reversibility: 'Disk layout changes require a backup.' },
  'memdiag:runPatternTest': { risk: 'medium', destructive: false, description: 'Run a memory pattern test.', reversibility: 'No persistent change, but it loads memory.' },
  'memdiag:scheduleWinTest': { risk: 'medium', destructive: false, description: 'Schedule the Windows memory test.', reversibility: 'Requires reboot and can be cancelled before reboot.' },
  'firmware:updateDrivers': { risk: 'high', destructive: true, description: 'Update system drivers.', reversibility: 'Driver rollback may not always be available.' },
  'remote:enableRdp': { risk: 'high', destructive: true, description: 'Enable Remote Desktop.', reversibility: 'Must be explicitly disabled again.' },
  'remote:disableRdp': { risk: 'medium', destructive: false, description: 'Disable Remote Desktop.', reversibility: 'Can be re-enabled in system settings.' },
  'remote:configureWol': { risk: 'medium', destructive: false, description: 'Configure Wake-on-LAN.', reversibility: 'Reversible in network adapter settings.' }
}

const logger = createLogger('safety-gate')

function blockedResult(channel: string, policy: SafetyPolicy): FixResult {
  return {
    success: false,
    module: 'safety',
    action: channel,
    description: 'Explicit confirmation is required before this high-risk action can run.',
    details: [policy.description, `Reversibility: ${policy.reversibility}`, 'No action was executed.'],
    changes: [],
    rollbackAvailable: false,
    error: 'confirmation_required',
    execution: {
      commands: [],
      steps: ['No action was executed.'],
      outputTail: 'Confirmation required; no action was executed.'
    }
  }
}

export function withSafetyGate<TArgs = unknown>(
  channel: string,
  handler: (args: TArgs) => Promise<FixResult>
): (args?: TArgs) => Promise<FixResult> {
  return async (args?: TArgs): Promise<FixResult> => {
    const policy = SAFETY_REGISTRY[channel]
    if (!policy) throw new Error(`No safety policy registered for ${channel}`)
    const confirmation = typeof args === 'object' && args !== null
      ? (args as { confirm?: unknown }).confirm === true
      : false
    logger.info('remediation offered', { channel, risk: policy.risk, destructive: policy.destructive })
    recordSafetyAction({ phase: 'offered', channel, risk: policy.risk, destructive: policy.destructive })
    if (policy.destructive || policy.risk === 'high') {
      if (!confirmation) {
        logger.warn('remediation blocked: confirmation required', { channel })
        recordSafetyAction({
          phase: 'blocked',
          channel,
          risk: policy.risk,
          destructive: policy.destructive,
          success: false,
          exitInfo: 'confirmation_required'
        })
        return blockedResult(channel, policy)
      }
      logger.info('remediation confirmed', { channel })
      recordSafetyAction({ phase: 'confirmed', channel, risk: policy.risk, destructive: policy.destructive })
    }
    try {
      const result = await handler((args || {}) as TArgs)
      const execution = result.execution || {
        commands: result.details.slice(-10),
        steps: result.details.slice(-10),
        exitCode: result.success ? 0 : 1,
        outputTail: result.details.slice(-5).join('\n').slice(-1200)
      }
      const evidenceDetails = [...result.details]
      if (execution.commands.length > 0) evidenceDetails.push(`Executed steps: ${execution.commands.join(' | ')}`)
      if (execution.exitCode !== undefined) evidenceDetails.push(`Exit status: ${execution.exitCode}`)
      if (execution.outputTail) evidenceDetails.push(`Output tail: ${execution.outputTail}`)
      const enrichedResult = { ...result, details: evidenceDetails, execution }
      logger.info('remediation executed', {
        channel,
        success: enrichedResult.success,
        exitInfo: enrichedResult.error || enrichedResult.details?.slice(-1)[0] || 'completed'
      })
      recordSafetyAction({
        phase: 'executed',
        channel,
        risk: policy.risk,
        destructive: policy.destructive,
        success: enrichedResult.success,
        exitCode: execution.exitCode,
        exitInfo: enrichedResult.error || 'completed',
        commands: execution.commands,
        outputTail: execution.outputTail
      })
      return enrichedResult
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      logger.error('remediation failed', { channel, exitInfo: message })
      recordSafetyAction({
        phase: 'failed',
        channel,
        risk: policy.risk,
        destructive: policy.destructive,
        success: false,
        exitCode: 1,
        exitInfo: message
      })
      return {
        success: false,
        module: 'safety',
        action: channel,
        description: 'Remediation failed.',
        details: [message],
        changes: [],
        rollbackAvailable: false,
        error: message,
        execution: { commands: [], steps: [message], exitCode: 1, outputTail: message }
      }
    }
  }
}
