import { createLogger } from '../logger'

const logger = createLogger('whatsapp-service')

// ============================================================
// WhatsApp Integration via wa.me Deep Links
// Free, no API key needed, works offline (generates links)
// ============================================================

export type JobStatus = 'received' | 'diagnosing' | 'waiting_parts' | 'repair_in_progress' | 'ready' | 'delivered'

export interface WhatsAppMessage {
  phone: string
  message: string
  waLink: string
}

// ============================================================
// Indian Phone Number Cleaning
// Handles: +91XXXXXXXXXX, 91XXXXXXXXXX, 0XXXXXXXXXX, XXXXXXXXXX
// ============================================================

export function cleanIndianPhone(phone: string): string {
  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, '')

  if (digits.length === 10) {
    return `91${digits}`
  }
  if (digits.length === 11 && digits.startsWith('0')) {
    return `91${digits.slice(1)}`
  }
  if (digits.length === 12 && digits.startsWith('91')) {
    return digits
  }
  if (digits.length === 13 && digits.startsWith('091')) {
    return digits.slice(1)
  }

  throw new Error(`Invalid Indian phone number: ${phone}. Expected 10-digit mobile number.`)
}

export function validateIndianPhone(phone: string): { valid: boolean; error?: string; cleaned?: string } {
  try {
    const cleaned = cleanIndianPhone(phone)
    // Validate that it starts with a valid Indian mobile prefix (6-9)
    const mobileDigit = cleaned.charAt(2)
    if (!['6', '7', '8', '9'].includes(mobileDigit)) {
      return { valid: false, error: 'Not a valid Indian mobile number (must start with 6-9)' }
    }
    return { valid: true, cleaned }
  } catch (err) {
    return { valid: false, error: (err as Error).message }
  }
}

// ============================================================
// Message Templates for Job Status Updates
// ============================================================

function getJobStatusEmoji(status: JobStatus): string {
  const emojis: Record<JobStatus, string> = {
    received: '\u{1F4E5}',
    diagnosing: '\u{1F50D}',
    waiting_parts: '\u{23F3}',
    repair_in_progress: '\u{1F527}',
    ready: '\u{2705}',
    delivered: '\u{1F4E6}'
  }
  return emojis[status]
}

function getJobStatusTemplate(
  status: JobStatus,
  customerName: string,
  ticketNumber: string,
  shopName: string,
  deviceInfo?: string,
  estimatedCost?: number,
  diagnosis?: string
): string {
  const emoji = getJobStatusEmoji(status)
  const device = deviceInfo || 'your device'

  const templates: Record<JobStatus, string> = {
    received: [
      `${emoji} *${shopName} - Device Received*`,
      ``,
      `Dear ${customerName},`,
      `Your ${device} has been received for repair.`,
      `Ticket: *${ticketNumber}*`,
      ``,
      `We will diagnose the issue and update you shortly.`,
      `Thank you for choosing ${shopName}!`
    ].join('\n'),

    diagnosing: [
      `${emoji} *${shopName} - Diagnosis Update*`,
      ``,
      `Dear ${customerName},`,
      `Your ${device} (Ticket: *${ticketNumber}*) is currently being diagnosed.`,
      diagnosis ? `\nFindings so far: ${diagnosis}` : '',
      estimatedCost ? `\nEstimated cost: Rs. ${estimatedCost.toLocaleString('en-IN')}` : '',
      ``,
      `We will update you once diagnosis is complete.`
    ].filter(Boolean).join('\n'),

    waiting_parts: [
      `${emoji} *${shopName} - Waiting for Parts*`,
      ``,
      `Dear ${customerName},`,
      `Your ${device} (Ticket: *${ticketNumber}*) requires replacement parts.`,
      diagnosis ? `\nDiagnosis: ${diagnosis}` : '',
      estimatedCost ? `Estimated cost: Rs. ${estimatedCost.toLocaleString('en-IN')}` : '',
      ``,
      `We are sourcing the parts and will update you when they arrive.`
    ].filter(Boolean).join('\n'),

    repair_in_progress: [
      `${emoji} *${shopName} - Repair In Progress*`,
      ``,
      `Dear ${customerName},`,
      `Great news! Repair work on your ${device} (Ticket: *${ticketNumber}*) is now in progress.`,
      ``,
      `We will notify you once it's ready for pickup.`
    ].join('\n'),

    ready: [
      `${emoji} *${shopName} - Ready for Pickup!*`,
      ``,
      `Dear ${customerName},`,
      `Your ${device} (Ticket: *${ticketNumber}*) has been repaired and is ready for pickup!`,
      estimatedCost ? `\nTotal cost: Rs. ${estimatedCost.toLocaleString('en-IN')}` : '',
      ``,
      `Please visit our shop at your earliest convenience.`,
      `Thank you for your patience!`
    ].filter(Boolean).join('\n'),

    delivered: [
      `${emoji} *${shopName} - Delivered*`,
      ``,
      `Dear ${customerName},`,
      `Your ${device} (Ticket: *${ticketNumber}*) has been delivered.`,
      ``,
      `If you face any issues, please don't hesitate to contact us.`,
      `Thank you for choosing ${shopName}! \u{1F64F}`
    ].join('\n')
  }

  return templates[status]
}

// ============================================================
// Exported Functions
// ============================================================

export function generateWhatsAppLink(phone: string, message: string): string {
  const cleanedPhone = cleanIndianPhone(phone)
  const encodedMessage = encodeURIComponent(message)
  return `https://wa.me/${cleanedPhone}?text=${encodedMessage}`
}

export async function sendJobStatusMessage(
  phone: string,
  status: JobStatus,
  customerName: string,
  ticketNumber: string,
  shopName: string,
  deviceInfo?: string,
  estimatedCost?: number,
  diagnosis?: string
): Promise<WhatsAppMessage> {
  logger.info('Generating WhatsApp job status message', { phone, status, ticketNumber })

  const message = getJobStatusTemplate(
    status, customerName, ticketNumber, shopName,
    deviceInfo, estimatedCost, diagnosis
  )

  const cleanedPhone = cleanIndianPhone(phone)
  const waLink = generateWhatsAppLink(phone, message)

  return {
    phone: cleanedPhone,
    message,
    waLink
  }
}

export async function sendPaymentLink(
  phone: string,
  shopName: string,
  invoiceNumber: string,
  amount: number,
  upiLink?: string
): Promise<WhatsAppMessage> {
  logger.info('Generating WhatsApp payment link', { phone, invoiceNumber, amount })

  const message = [
    `\u{1F4B0} *${shopName} - Payment Request*`,
    ``,
    `Invoice: *${invoiceNumber}*`,
    `Amount: *Rs. ${amount.toLocaleString('en-IN')}*`,
    upiLink ? `\nUPI Payment Link: ${upiLink}` : '',
    ``,
    `You can pay via UPI, cash, or card at our shop.`,
    `Thank you!`
  ].filter(Boolean).join('\n')

  const cleanedPhone = cleanIndianPhone(phone)
  const waLink = generateWhatsAppLink(phone, message)

  return {
    phone: cleanedPhone,
    message,
    waLink
  }
}

export async function sendDiagnosticReport(
  phone: string,
  shopName: string,
  customerName: string,
  ticketNumber: string,
  issues: string[],
  healthScore: number
): Promise<WhatsAppMessage> {
  logger.info('Generating WhatsApp diagnostic report', { phone, ticketNumber })

  const issuesList = issues.map((issue, i) => `${i + 1}. ${issue}`).join('\n')
  const message = [
    `\u{1F4CB} *${shopName} - Diagnostic Report*`,
    ``,
    `Dear ${customerName},`,
    `Ticket: *${ticketNumber}*`,
    `System Health Score: *${healthScore}/100*`,
    ``,
    `*Issues Found:*`,
    issuesList,
    ``,
    `Please visit our shop to discuss the repair options.`,
    `We're here to help!`
  ].join('\n')

  const cleanedPhone = cleanIndianPhone(phone)
  const waLink = generateWhatsAppLink(phone, message)

  return {
    phone: cleanedPhone,
    message,
    waLink
  }
}

export async function sendCustomMessage(
  phone: string,
  message: string
): Promise<WhatsAppMessage> {
  logger.info('Generating custom WhatsApp message', { phone })

  const cleanedPhone = cleanIndianPhone(phone)
  const waLink = generateWhatsAppLink(phone, message)

  return {
    phone: cleanedPhone,
    message,
    waLink
  }
}
