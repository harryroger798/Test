import { createLogger } from '../logger'
import { getDb } from '../database'
import { nanoid } from 'nanoid'

const logger = createLogger('crm-manager')

// ============================================================
// CRM / Customer & Job Management
// Phone number is primary key (Indian market reality)
// Job tracking: Received -> Diagnosing -> Waiting Parts -> Ready -> Delivered
// ============================================================

export type RepairJobStatus = 'received' | 'diagnosing' | 'waiting_parts' | 'repair_in_progress' | 'ready' | 'delivered' | 'cancelled'

export interface CustomerRecord {
  id: string
  phone: string
  name: string
  email: string | null
  address: string | null
  gstin: string | null
  state_code: string | null
  notes: string | null
  created_at: number
  updated_at: number
}

export interface RepairJobRecord {
  id: string
  ticket_number: string
  customer_id: string
  device_brand: string | null
  device_model: string | null
  device_serial: string | null
  complaint: string
  status: string
  diagnosis: string | null
  estimated_cost: number | null
  final_cost: number | null
  technician: string | null
  promised_date: number | null
  notes: string | null
  scan_id: string | null
  created_at: number
  updated_at: number
}

export interface CreateCustomerData {
  phone: string
  name: string
  email?: string
  address?: string
  gstin?: string
  stateCode?: string
  notes?: string
}

export interface CreateJobData {
  customerId: string
  deviceBrand?: string
  deviceModel?: string
  deviceSerial?: string
  complaint: string
  technician?: string
  promisedDate?: number
  notes?: string
}

// ============================================================
// Ticket Number Generation
// ============================================================
function generateTicketNumber(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const prefix = `BF-${year}${month}${day}`

  const row = getDb().prepare(
    `SELECT ticket_number FROM repair_jobs WHERE ticket_number LIKE ? ORDER BY ticket_number DESC LIMIT 1`
  ).get(`${prefix}-%`) as { ticket_number: string } | undefined

  let nextNum = 1
  if (row) {
    const parts = row.ticket_number.split('-')
    const lastNum = parseInt(parts[parts.length - 1], 10)
    if (!isNaN(lastNum)) nextNum = lastNum + 1
  }

  return `${prefix}-${String(nextNum).padStart(3, '0')}`
}

// ============================================================
// Customer CRUD
// ============================================================

export async function createCustomer(data: CreateCustomerData): Promise<CustomerRecord> {
  logger.info('Creating customer', { phone: data.phone, name: data.name })

  // Check if customer already exists by phone
  const existing = getDb().prepare(
    'SELECT * FROM customers WHERE phone = ?'
  ).get(data.phone) as CustomerRecord | undefined

  if (existing) {
    logger.info('Customer already exists, updating', { id: existing.id })
    return updateCustomer(existing.id, data)
  }

  const id = nanoid()
  getDb().prepare(`
    INSERT INTO customers (id, phone, name, email, address, gstin, state_code, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, data.phone, data.name,
    data.email || null, data.address || null,
    data.gstin || null, data.stateCode || null,
    data.notes || null
  )

  return getDb().prepare('SELECT * FROM customers WHERE id = ?').get(id) as CustomerRecord
}

export async function updateCustomer(id: string, data: Partial<CreateCustomerData>): Promise<CustomerRecord> {
  logger.info('Updating customer', { id })

  const updates: string[] = []
  const params: (string | null)[] = []

  if (data.name !== undefined) { updates.push('name = ?'); params.push(data.name) }
  if (data.phone !== undefined) { updates.push('phone = ?'); params.push(data.phone) }
  if (data.email !== undefined) { updates.push('email = ?'); params.push(data.email || null) }
  if (data.address !== undefined) { updates.push('address = ?'); params.push(data.address || null) }
  if (data.gstin !== undefined) { updates.push('gstin = ?'); params.push(data.gstin || null) }
  if (data.stateCode !== undefined) { updates.push('state_code = ?'); params.push(data.stateCode || null) }
  if (data.notes !== undefined) { updates.push('notes = ?'); params.push(data.notes || null) }

  if (updates.length > 0) {
    updates.push("updated_at = strftime('%s', 'now')")
    params.push(id)
    getDb().prepare(`UPDATE customers SET ${updates.join(', ')} WHERE id = ?`).run(...params)
  }

  return getDb().prepare('SELECT * FROM customers WHERE id = ?').get(id) as CustomerRecord
}

export async function getCustomer(id: string): Promise<CustomerRecord | undefined> {
  return getDb().prepare('SELECT * FROM customers WHERE id = ?').get(id) as CustomerRecord | undefined
}

export async function getCustomerByPhone(phone: string): Promise<CustomerRecord | undefined> {
  return getDb().prepare('SELECT * FROM customers WHERE phone = ?').get(phone) as CustomerRecord | undefined
}

export async function searchCustomers(query: string): Promise<CustomerRecord[]> {
  const likeQuery = `%${query}%`
  return getDb().prepare(
    'SELECT * FROM customers WHERE name LIKE ? OR phone LIKE ? ORDER BY updated_at DESC LIMIT 50'
  ).all(likeQuery, likeQuery) as CustomerRecord[]
}

export async function getAllCustomers(limit = 100): Promise<CustomerRecord[]> {
  return getDb().prepare(
    'SELECT * FROM customers ORDER BY updated_at DESC LIMIT ?'
  ).all(limit) as CustomerRecord[]
}

export async function deleteCustomer(id: string): Promise<boolean> {
  // Check for existing jobs
  const jobCount = getDb().prepare(
    'SELECT COUNT(*) as count FROM repair_jobs WHERE customer_id = ?'
  ).get(id) as { count: number }

  if (jobCount.count > 0) {
    throw new Error('Cannot delete customer with existing repair jobs')
  }

  const result = getDb().prepare('DELETE FROM customers WHERE id = ?').run(id)
  return result.changes > 0
}

// ============================================================
// Repair Job CRUD
// ============================================================

export async function createRepairJob(data: CreateJobData): Promise<RepairJobRecord> {
  logger.info('Creating repair job', { customerId: data.customerId, complaint: data.complaint })

  const id = nanoid()
  const ticketNumber = generateTicketNumber()

  getDb().prepare(`
    INSERT INTO repair_jobs (
      id, ticket_number, customer_id, device_brand, device_model, device_serial,
      complaint, status, technician, promised_date, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'received', ?, ?, ?)
  `).run(
    id, ticketNumber, data.customerId,
    data.deviceBrand || null, data.deviceModel || null, data.deviceSerial || null,
    data.complaint, data.technician || null,
    data.promisedDate || null, data.notes || null
  )

  logger.info('Repair job created', { id, ticketNumber })
  return getDb().prepare('SELECT * FROM repair_jobs WHERE id = ?').get(id) as RepairJobRecord
}

export async function updateJobStatus(
  jobId: string,
  status: RepairJobStatus,
  notes?: string
): Promise<RepairJobRecord> {
  logger.info('Updating job status', { jobId, status })

  const updates = ["status = ?", "updated_at = strftime('%s', 'now')"]
  const params: (string | number | null)[] = [status]

  if (notes) {
    updates.push('notes = ?')
    params.push(notes)
  }

  params.push(jobId)
  getDb().prepare(`UPDATE repair_jobs SET ${updates.join(', ')} WHERE id = ?`).run(...params)

  return getDb().prepare('SELECT * FROM repair_jobs WHERE id = ?').get(jobId) as RepairJobRecord
}

export async function updateJobDiagnosis(
  jobId: string,
  diagnosis: string,
  estimatedCost?: number,
  scanId?: string
): Promise<RepairJobRecord> {
  logger.info('Updating job diagnosis', { jobId })

  const updates = ["diagnosis = ?", "status = 'diagnosing'", "updated_at = strftime('%s', 'now')"]
  const params: (string | number | null)[] = [diagnosis]

  if (estimatedCost !== undefined) {
    updates.push('estimated_cost = ?')
    params.push(estimatedCost)
  }
  if (scanId) {
    updates.push('scan_id = ?')
    params.push(scanId)
  }

  params.push(jobId)
  getDb().prepare(`UPDATE repair_jobs SET ${updates.join(', ')} WHERE id = ?`).run(...params)

  return getDb().prepare('SELECT * FROM repair_jobs WHERE id = ?').get(jobId) as RepairJobRecord
}

export async function getRepairJob(id: string): Promise<RepairJobRecord | undefined> {
  return getDb().prepare('SELECT * FROM repair_jobs WHERE id = ?').get(id) as RepairJobRecord | undefined
}

export async function getRepairJobByTicket(ticketNumber: string): Promise<RepairJobRecord | undefined> {
  return getDb().prepare('SELECT * FROM repair_jobs WHERE ticket_number = ?').get(ticketNumber) as RepairJobRecord | undefined
}

export async function getJobsByCustomer(customerId: string): Promise<RepairJobRecord[]> {
  return getDb().prepare(
    'SELECT * FROM repair_jobs WHERE customer_id = ? ORDER BY created_at DESC'
  ).all(customerId) as RepairJobRecord[]
}

export async function getJobsByStatus(status: RepairJobStatus): Promise<RepairJobRecord[]> {
  return getDb().prepare(
    'SELECT * FROM repair_jobs WHERE status = ? ORDER BY created_at DESC'
  ).all(status) as RepairJobRecord[]
}

export async function getAllJobs(limit = 100): Promise<RepairJobRecord[]> {
  return getDb().prepare(
    'SELECT * FROM repair_jobs ORDER BY created_at DESC LIMIT ?'
  ).all(limit) as RepairJobRecord[]
}

export async function getActiveJobs(): Promise<RepairJobRecord[]> {
  return getDb().prepare(
    "SELECT * FROM repair_jobs WHERE status NOT IN ('delivered', 'cancelled') ORDER BY created_at DESC"
  ).all() as RepairJobRecord[]
}

export async function getJobStats(): Promise<{
  total: number
  received: number
  diagnosing: number
  waitingParts: number
  repairInProgress: number
  ready: number
  delivered: number
  cancelled: number
  totalRevenue: number
}> {
  const total = getDb().prepare('SELECT COUNT(*) as count FROM repair_jobs').get() as { count: number }
  const received = getDb().prepare("SELECT COUNT(*) as count FROM repair_jobs WHERE status = 'received'").get() as { count: number }
  const diagnosing = getDb().prepare("SELECT COUNT(*) as count FROM repair_jobs WHERE status = 'diagnosing'").get() as { count: number }
  const waitingParts = getDb().prepare("SELECT COUNT(*) as count FROM repair_jobs WHERE status = 'waiting_parts'").get() as { count: number }
  const repairInProgress = getDb().prepare("SELECT COUNT(*) as count FROM repair_jobs WHERE status = 'repair_in_progress'").get() as { count: number }
  const ready = getDb().prepare("SELECT COUNT(*) as count FROM repair_jobs WHERE status = 'ready'").get() as { count: number }
  const delivered = getDb().prepare("SELECT COUNT(*) as count FROM repair_jobs WHERE status = 'delivered'").get() as { count: number }
  const cancelled = getDb().prepare("SELECT COUNT(*) as count FROM repair_jobs WHERE status = 'cancelled'").get() as { count: number }
  const revenue = getDb().prepare("SELECT SUM(final_cost) as total FROM repair_jobs WHERE status = 'delivered'").get() as { total: number }

  return {
    total: total.count,
    received: received.count,
    diagnosing: diagnosing.count,
    waitingParts: waitingParts.count,
    repairInProgress: repairInProgress.count,
    ready: ready.count,
    delivered: delivered.count,
    cancelled: cancelled.count,
    totalRevenue: revenue.total || 0
  }
}

export async function getCustomerWithJobs(customerId: string): Promise<{
  customer: CustomerRecord
  jobs: RepairJobRecord[]
  totalSpent: number
  totalVisits: number
}> {
  const customer = await getCustomer(customerId)
  if (!customer) throw new Error(`Customer not found: ${customerId}`)

  const jobs = await getJobsByCustomer(customerId)
  const totalSpent = jobs.reduce((sum, j) => sum + (j.final_cost || 0), 0)

  return {
    customer,
    jobs,
    totalSpent,
    totalVisits: jobs.length
  }
}
