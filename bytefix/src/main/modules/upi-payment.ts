import { createLogger } from '../logger'
import QRCode from 'qrcode'

const logger = createLogger('upi-payment')

// ============================================================
// UPI Payment Link & QR Code Generator
// Generates UPI deep links and QR codes for invoice payments
// No payment gateway needed - free, offline-capable
// ============================================================

export interface UPIPaymentRequest {
  /** UPI VPA (Virtual Payment Address) e.g. shop@upi */
  vpa: string
  /** Payee display name */
  payeeName: string
  /** Amount in INR */
  amount: number
  /** Transaction note (max 50 chars) */
  note?: string
  /** Transaction reference ID */
  referenceId?: string
  /** Invoice number for tracking */
  invoiceNumber?: string
}

export interface UPIPaymentResult {
  deepLink: string
  qrCodeDataUrl: string
  amount: number
  vpa: string
  note: string
}

// ============================================================
// UPI Deep Link Builder
// Format: upi://pay?pa=VPA&pn=NAME&am=AMOUNT&tn=NOTE&tr=REF
// ============================================================

function sanitizeUPIParam(value: string, maxLen: number): string {
  return value
    .replace(/[&=?#]/g, '') // Remove URL-unsafe chars
    .trim()
    .slice(0, maxLen)
}

function validateVPA(vpa: string): boolean {
  // UPI VPA format: username@bankhandle
  const vpaRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9]+$/
  return vpaRegex.test(vpa)
}

function buildUPIDeepLink(request: UPIPaymentRequest): string {
  const params = new URLSearchParams()
  params.set('pa', request.vpa)
  params.set('pn', sanitizeUPIParam(request.payeeName, 50))
  params.set('am', request.amount.toFixed(2))
  params.set('cu', 'INR')

  if (request.note) {
    params.set('tn', sanitizeUPIParam(request.note, 50))
  }
  if (request.referenceId) {
    params.set('tr', sanitizeUPIParam(request.referenceId, 35))
  }

  // Replace '+' with '%20' — some UPI apps (Paytm, PhonePe) don't handle '+' as space
  return `upi://pay?${params.toString().replace(/\+/g, '%20')}`
}

// ============================================================
// Exported Functions
// ============================================================

export async function generateUPIPayment(request: UPIPaymentRequest): Promise<UPIPaymentResult> {
  logger.info('Generating UPI payment', { vpa: request.vpa, amount: request.amount })

  if (!validateVPA(request.vpa)) {
    throw new Error(`Invalid UPI VPA format: ${request.vpa}. Expected format: username@bankhandle`)
  }

  if (request.amount <= 0 || request.amount > 200000) {
    throw new Error(`Invalid amount: ${request.amount}. Must be between 0.01 and 2,00,000`)
  }

  const note = request.invoiceNumber
    ? `ByteFix Invoice ${request.invoiceNumber}`
    : request.note || 'ByteFix Payment'

  const deepLink = buildUPIDeepLink({
    ...request,
    note
  })

  // Generate QR code as data URL (base64 PNG)
  const qrCodeDataUrl = await QRCode.toDataURL(deepLink, {
    errorCorrectionLevel: 'M',
    width: 300,
    margin: 2,
    color: {
      dark: '#000000',
      light: '#FFFFFF'
    }
  })

  logger.info('UPI payment generated', { deepLink: deepLink.slice(0, 50) + '...' })

  return {
    deepLink,
    qrCodeDataUrl,
    amount: request.amount,
    vpa: request.vpa,
    note
  }
}

export async function generateInvoiceUPI(
  vpa: string,
  payeeName: string,
  invoiceNumber: string,
  amount: number
): Promise<UPIPaymentResult> {
  return generateUPIPayment({
    vpa,
    payeeName,
    amount,
    invoiceNumber,
    referenceId: invoiceNumber.replace(/[^a-zA-Z0-9]/g, '').slice(0, 35),
    note: `ByteFix Invoice ${invoiceNumber}`
  })
}

export function validateUPIAddress(vpa: string): { valid: boolean; error?: string } {
  if (!vpa || vpa.trim().length === 0) {
    return { valid: false, error: 'UPI VPA cannot be empty' }
  }
  if (!vpa.includes('@')) {
    return { valid: false, error: 'UPI VPA must contain @ symbol (e.g. shop@upi)' }
  }
  if (!validateVPA(vpa)) {
    return { valid: false, error: 'Invalid VPA format. Use format: username@bankhandle' }
  }
  return { valid: true }
}
