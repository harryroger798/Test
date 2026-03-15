import si from 'systeminformation'
import { createLogger } from './logger'

const logger = createLogger('resource-governor')

interface ResourceCheck {
  allowed: boolean
  reason?: string
  availableMemoryMB: number
  availablePercent: number
}

class ResourceGovernor {
  private maxMemoryPercent = 15
  private pauseThreshold = 10

  async canStartJob(estimatedMemoryMB: number): Promise<ResourceCheck> {
    try {
      const mem = await si.mem()
      const availableMB = Math.round(mem.available / (1024 * 1024))
      const availablePercent = Math.round((mem.available / mem.total) * 100)
      const ourUsagePercent = (estimatedMemoryMB * 1024 * 1024 / mem.total) * 100

      if (availablePercent < this.pauseThreshold) {
        logger.warn(`System memory critically low: ${availablePercent}% free`)
        return {
          allowed: false,
          reason: `System memory critically low (${availablePercent}% free). Free up RAM before running this operation.`,
          availableMemoryMB: availableMB,
          availablePercent
        }
      }

      if (ourUsagePercent > this.maxMemoryPercent) {
        logger.warn(`Job needs ~${estimatedMemoryMB}MB, would use ${ourUsagePercent.toFixed(1)}% of total RAM`)
        return {
          allowed: false,
          reason: `This operation needs ~${estimatedMemoryMB}MB RAM which exceeds the safety limit for this system.`,
          availableMemoryMB: availableMB,
          availablePercent
        }
      }

      return { allowed: true, availableMemoryMB: availableMB, availablePercent }
    } catch {
      return { allowed: true, availableMemoryMB: 0, availablePercent: 100 }
    }
  }

  setMaxMemoryPercent(percent: number): void {
    this.maxMemoryPercent = Math.max(5, Math.min(50, percent))
  }
}

export const resourceGovernor = new ResourceGovernor()
