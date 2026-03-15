import { createLogger } from '../logger'
import { getDb } from '../database'
import { nanoid } from 'nanoid'

const logger = createLogger('gst-billing')

// ============================================================
// Indian State Codes for GST Place of Supply
// ============================================================
const INDIAN_STATES: Record<string, string> = {
  '01': 'Jammu & Kashmir', '02': 'Himachal Pradesh', '03': 'Punjab',
  '04': 'Chandigarh', '05': 'Uttarakhand', '06': 'Haryana',
  '07': 'Delhi', '08': 'Rajasthan', '09': 'Uttar Pradesh',
  '10': 'Bihar', '11': 'Sikkim', '12': 'Arunachal Pradesh',
  '13': 'Nagaland', '14': 'Manipur', '15': 'Mizoram',
  '16': 'Tripura', '17': 'Meghalaya', '18': 'Assam',
  '19': 'West Bengal', '20': 'Jharkhand', '21': 'Odisha',
  '22': 'Chhattisgarh', '23': 'Madhya Pradesh', '24': 'Gujarat',
  '25': 'Daman & Diu', '26': 'Dadra & Nagar Haveli',
  '27': 'Maharashtra', '29': 'Karnataka', '30': 'Goa',
  '31': 'Lakshadweep', '32': 'Kerala', '33': 'Tamil Nadu',
  '34': 'Puducherry', '35': 'Andaman & Nicobar', '36': 'Telangana',
  '37': 'Andhra Pradesh', '38': 'Ladakh'
}

// HSN codes for computer repair services
const HSN_CODES: Record<string, { code: string; description: string; gstRate: number }> = {
  repairService: { code: '998314', description: 'Maintenance and repair of computers', gstRate: 18 },
  parts: { code: '8473', description: 'Parts for computing machines', gstRate: 18 },
  software: { code: '8523', description: 'Software media', gstRate: 18 },
  dataRecovery: { code: '998315', description: 'IT consulting and support', gstRate: 18 },
  accessories: { code: '8471', description: 'Computer accessories', gstRate: 18 }
}

// ============================================================
// Types
// ============================================================
export interface GSTLineItem {
  description: string
  hsnCode: string
  quantity: number
  rate: number
  amount: number
  gstRate: number
}

export interface GSTInvoiceData {
  jobId?: string
  customerId: string
  shopName: string
  shopGstin?: string
  shopAddress?: string
  shopStateCode: string
  customerGstin?: string
  customerStateCode?: string
  lineItems: GSTLineItem[]
  paymentMethod?: string
  notes?: string
}

export interface InvoiceRecord {
  id: string
  invoiceNumber: string
  jobId: string | null
  customerId: string
  shopName: string
  shopGstin: string | null
  shopAddress: string | null
  shopStateCode: string | null
  customerGstin: string | null
  customerStateCode: string | null
  isIntraState: number
  subtotal: number
  cgstRate: number
  cgstAmount: number
  sgstRate: number
  sgstAmount: number
  igstRate: number
  igstAmount: number
  total: number
  lineItems: string
  paymentMethod: string | null
  paymentStatus: string
  notes: string | null
  createdAt: number
}

// ============================================================
// Financial Year Helper
// ============================================================
function getCurrentFinancialYear(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1 // 1-12
  // Indian financial year: April to March
  if (month >= 4) {
    return `${year}-${String(year + 1).slice(2)}`
  }
  return `${year - 1}-${String(year).slice(2)}`
}

// ============================================================
// Invoice Number Generation (Sequential, FY-based)
// ============================================================
function generateInvoiceNumber(): string {
  const fy = getCurrentFinancialYear()
  const prefix = `BF/${fy}/`

  // Use CAST to numeric for correct ordering beyond 9999
  const row = getDb().prepare(
    `SELECT invoice_number FROM invoices WHERE invoice_number LIKE ? ORDER BY CAST(SUBSTR(invoice_number, LENGTH(?) + 1) AS INTEGER) DESC LIMIT 1`
  ).get(`${prefix}%`, prefix) as { invoice_number: string } | undefined

  let nextNum = 1
  if (row) {
    const parts = row.invoice_number.split('/')
    const lastNum = parseInt(parts[parts.length - 1], 10)
    if (!isNaN(lastNum)) nextNum = lastNum + 1
  }

  return `${prefix}${String(nextNum).padStart(4, '0')}`
}

// ============================================================
// GST Calculation
// ============================================================
function calculateGST(
  lineItems: GSTLineItem[],
  shopStateCode: string,
  customerStateCode?: string
): {
  subtotal: number
  isIntraState: boolean
  cgstRate: number
  cgstAmount: number
  sgstRate: number
  sgstAmount: number
  igstRate: number
  igstAmount: number
  total: number
} {
  const subtotal = lineItems.reduce((sum, item) => sum + item.amount, 0)
  // Default to intra-state if customer state not provided (B2C local)
  const isIntraState = !customerStateCode || shopStateCode === customerStateCode

  // Calculate GST per line item at its respective rate (legally required)
  let totalCgst = 0
  let totalSgst = 0
  let totalIgst = 0

  for (const item of lineItems) {
    if (isIntraState) {
      totalCgst += Math.round(item.amount * (item.gstRate / 2) / 100 * 100) / 100
      totalSgst += Math.round(item.amount * (item.gstRate / 2) / 100 * 100) / 100
    } else {
      totalIgst += Math.round(item.amount * item.gstRate / 100 * 100) / 100
    }
  }

  // Use dominant GST rate for the rate field (most common rate among items)
  const dominantRate = lineItems.length > 0
    ? lineItems.reduce((max, item) => item.amount > max.amount ? item : max, lineItems[0]).gstRate
    : 18

  if (isIntraState) {
    return {
      subtotal,
      isIntraState: true,
      cgstRate: dominantRate / 2,
      cgstAmount: totalCgst,
      sgstRate: dominantRate / 2,
      sgstAmount: totalSgst,
      igstRate: 0,
      igstAmount: 0,
      total: Math.round((subtotal + totalCgst + totalSgst) * 100) / 100
    }
  } else {
    return {
      subtotal,
      isIntraState: false,
      cgstRate: 0,
      cgstAmount: 0,
      sgstRate: 0,
      sgstAmount: 0,
      igstRate: dominantRate,
      igstAmount: totalIgst,
      total: Math.round((subtotal + totalIgst) * 100) / 100
    }
  }
}

// ============================================================
// Exported Functions
// ============================================================

export function getHsnCodes(): Record<string, { code: string; description: string; gstRate: number }> {
  return HSN_CODES
}

export function getIndianStates(): Record<string, string> {
  return INDIAN_STATES
}

export async function createInvoice(data: GSTInvoiceData): Promise<InvoiceRecord> {
  logger.info('Creating GST invoice', { customerId: data.customerId, items: data.lineItems.length })

  const id = nanoid()

  // Wrap in transaction to prevent race condition on invoice number
  const createInvoiceTx = getDb().transaction((txData: GSTInvoiceData, txId: string) => {
    const invoiceNumber = generateInvoiceNumber()
    const gst = calculateGST(txData.lineItems, txData.shopStateCode, txData.customerStateCode)

    const stmt = getDb().prepare(`
      INSERT INTO invoices (
        id, invoice_number, job_id, customer_id,
        shop_name, shop_gstin, shop_address, shop_state_code,
        customer_gstin, customer_state_code, is_intra_state,
        subtotal, cgst_rate, cgst_amount, sgst_rate, sgst_amount,
        igst_rate, igst_amount, total, line_items,
        payment_method, payment_status, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    stmt.run(
      txId, invoiceNumber, txData.jobId || null, txData.customerId,
      txData.shopName, txData.shopGstin || null, txData.shopAddress || null, txData.shopStateCode,
      txData.customerGstin || null, txData.customerStateCode || null, gst.isIntraState ? 1 : 0,
      gst.subtotal, gst.cgstRate, gst.cgstAmount, gst.sgstRate, gst.sgstAmount,
      gst.igstRate, gst.igstAmount, gst.total, JSON.stringify(txData.lineItems),
      txData.paymentMethod || null, 'pending', txData.notes || null
    )

    return invoiceNumber
  })

  const invoiceNumber = createInvoiceTx(data, id)

  const created = getDb().prepare('SELECT * FROM invoices WHERE id = ?').get(id) as InvoiceRecord
  logger.info('Invoice created', { id, invoiceNumber, total: created.total })

  return created
}

export async function getInvoice(id: string): Promise<InvoiceRecord | undefined> {
  return getDb().prepare('SELECT * FROM invoices WHERE id = ?').get(id) as InvoiceRecord | undefined
}

export async function getInvoicesByCustomer(customerId: string): Promise<InvoiceRecord[]> {
  return getDb().prepare(
    'SELECT * FROM invoices WHERE customer_id = ? ORDER BY created_at DESC'
  ).all(customerId) as InvoiceRecord[]
}

export async function getAllInvoices(limit = 50): Promise<InvoiceRecord[]> {
  return getDb().prepare(
    'SELECT * FROM invoices ORDER BY created_at DESC LIMIT ?'
  ).all(limit) as InvoiceRecord[]
}

export async function updatePaymentStatus(
  invoiceId: string,
  status: 'pending' | 'paid' | 'partial' | 'cancelled',
  method?: string
): Promise<InvoiceRecord | undefined> {
  const updates: string[] = [`payment_status = ?`]
  const params: (string | null)[] = [status]

  if (method) {
    updates.push('payment_method = ?')
    params.push(method)
  }

  params.push(invoiceId)
  getDb().prepare(`UPDATE invoices SET ${updates.join(', ')} WHERE id = ?`).run(...params)

  return getDb().prepare('SELECT * FROM invoices WHERE id = ?').get(invoiceId) as InvoiceRecord | undefined
}

export async function getInvoiceStats(): Promise<{
  totalInvoices: number
  totalRevenue: number
  pendingAmount: number
  paidAmount: number
  currentFyInvoices: number
}> {
  const fy = getCurrentFinancialYear()
  const prefix = `BF/${fy}/`

  const total = getDb().prepare('SELECT COUNT(*) as count, SUM(total) as revenue FROM invoices').get() as { count: number; revenue: number }
  const pending = getDb().prepare("SELECT SUM(total) as amount FROM invoices WHERE payment_status = 'pending'").get() as { amount: number }
  const paid = getDb().prepare("SELECT SUM(total) as amount FROM invoices WHERE payment_status = 'paid'").get() as { amount: number }
  const fyCount = getDb().prepare('SELECT COUNT(*) as count FROM invoices WHERE invoice_number LIKE ?').get(`${prefix}%`) as { count: number }

  return {
    totalInvoices: total.count || 0,
    totalRevenue: total.revenue || 0,
    pendingAmount: pending.amount || 0,
    paidAmount: paid.amount || 0,
    currentFyInvoices: fyCount.count || 0
  }
}
