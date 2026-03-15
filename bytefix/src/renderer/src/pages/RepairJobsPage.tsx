import { useState, useEffect, useCallback } from 'react'
import { ClipboardList, Loader2, Plus, Search, ArrowRight, Users } from 'lucide-react'

interface Customer {
  id: string
  phone: string
  name: string
  email?: string
}

interface RepairJob {
  id: string
  ticket_number: string
  customer_id: string
  device_brand?: string
  device_model?: string
  complaint: string
  status: string
  diagnosis?: string
  estimated_cost?: number
  final_cost?: number
  technician?: string
  created_at: number
}

const STATUS_COLORS: Record<string, string> = {
  received: 'bg-blue-500/20 text-blue-400',
  diagnosing: 'bg-purple-500/20 text-purple-400',
  waiting_parts: 'bg-yellow-500/20 text-yellow-400',
  repair_in_progress: 'bg-orange-500/20 text-orange-400',
  ready: 'bg-emerald-500/20 text-emerald-400',
  delivered: 'bg-gray-500/20 text-gray-400',
  cancelled: 'bg-red-500/20 text-red-400'
}

const STATUS_LABELS: Record<string, string> = {
  received: 'Received',
  diagnosing: 'Diagnosing',
  waiting_parts: 'Waiting Parts',
  repair_in_progress: 'Repairing',
  ready: 'Ready',
  delivered: 'Delivered',
  cancelled: 'Cancelled'
}

const NEXT_STATUS: Record<string, string> = {
  received: 'diagnosing',
  diagnosing: 'repair_in_progress',
  waiting_parts: 'repair_in_progress',
  repair_in_progress: 'ready',
  ready: 'delivered'
}

export function RepairJobsPage(): JSX.Element {
  const [jobs, setJobs] = useState<RepairJob[]>([])
  const [loading, setLoading] = useState('')
  const [stats, setStats] = useState<Record<string, unknown> | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [filter, setFilter] = useState('all')

  // Create form
  const [customerId, setCustomerId] = useState('')
  const [customerSearch, setCustomerSearch] = useState('')
  const [customers, setCustomers] = useState<Customer[]>([])
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false)
  const [selectedCustomerName, setSelectedCustomerName] = useState('')
  const [deviceBrand, setDeviceBrand] = useState('')
  const [deviceModel, setDeviceModel] = useState('')
  const [complaint, setComplaint] = useState('')

  const searchCustomers = useCallback(async (query: string) => {
    try {
      if (query.trim().length === 0) {
        setCustomers(await window.bytefix.getAllCustomers(20) as Customer[])
      } else {
        setCustomers(await window.bytefix.searchCustomers(query) as Customer[])
      }
    } catch (err) { console.error(err) }
  }, [])

  useEffect(() => {
    if (showCreate) { searchCustomers('') }
  }, [showCreate, searchCustomers])

  useEffect(() => { loadJobs(); loadStats() }, [])

  async function loadJobs(): Promise<void> {
    setLoading('list')
    try {
      if (filter === 'all') {
        setJobs(await window.bytefix.getAllJobs(100) as RepairJob[])
      } else if (filter === 'active') {
        setJobs(await window.bytefix.getActiveJobs() as RepairJob[])
      } else {
        setJobs(await window.bytefix.getJobsByStatus(filter) as RepairJob[])
      }
    } catch (err) { console.error(err) }
    finally { setLoading('') }
  }

  async function loadStats(): Promise<void> {
    try { setStats(await window.bytefix.getJobStats() as Record<string, unknown>) }
    catch (err) { console.error(err) }
  }

  async function handleCreate(): Promise<void> {
    if (!customerId.trim() || !complaint.trim()) return
    setLoading('create')
    try {
      await window.bytefix.createRepairJob({ customerId, deviceBrand, deviceModel, complaint })
      setShowCreate(false)
      setCustomerId(''); setCustomerSearch(''); setSelectedCustomerName('')
      setDeviceBrand(''); setDeviceModel(''); setComplaint('')
      await loadJobs(); await loadStats()
    } catch (err) { console.error(err) }
    finally { setLoading('') }
  }

  async function advanceStatus(jobId: string, currentStatus: string): Promise<void> {
    const next = NEXT_STATUS[currentStatus]
    if (!next) return
    setLoading(`advance-${jobId}`)
    try {
      await window.bytefix.updateJobStatus(jobId, next)
      await loadJobs(); await loadStats()
    } catch (err) { console.error(err) }
    finally { setLoading('') }
  }

  useEffect(() => { loadJobs() }, [filter])

  return (
    <div className="space-y-6 animate-slide-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <ClipboardList className="w-6 h-6 text-orange-400" /> Repair Jobs
          </h1>
          <p className="text-gray-400 text-sm mt-1">Track repair jobs from intake to delivery</p>
        </div>
        <button onClick={() => setShowCreate(!showCreate)} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> New Job
        </button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
          {Object.entries(STATUS_LABELS).map(([key, label]) => (
            <button key={key} onClick={() => setFilter(key)} className={`card text-center cursor-pointer ${filter === key ? 'border-bytefix-500/50' : ''}`}>
              <p className="text-xs text-gray-400">{label}</p>
              <p className="text-lg font-bold text-white">{((stats as Record<string, Record<string, number>>).byStatus || {})[key] || 0}</p>
            </button>
          ))}
        </div>
      )}

      {/* Filter Bar */}
      <div className="flex gap-2 flex-wrap">
        {['all', 'active', ...Object.keys(STATUS_LABELS)].map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={`text-xs px-3 py-1.5 rounded-full ${filter === f ? 'bg-bytefix-600/30 text-bytefix-400 border border-bytefix-500/30' : 'bg-surface-lighter text-gray-400'}`}>
            {f === 'all' ? 'All' : f === 'active' ? 'Active' : STATUS_LABELS[f] || f}
          </button>
        ))}
      </div>

      {/* Create Form */}
      {showCreate && (
        <div className="card border-bytefix-500/30">
          <h3 className="font-medium text-white mb-3">New Repair Job</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div className="relative">
              <label className="text-xs text-gray-400">Customer (required)</label>
              {selectedCustomerName ? (
                <div className="w-full mt-1 px-3 py-2 bg-surface rounded-lg border border-bytefix-500/50 text-white text-sm flex items-center justify-between">
                  <span className="flex items-center gap-2"><Users className="w-3 h-3 text-bytefix-400" /> {selectedCustomerName}</span>
                  <button onClick={() => { setCustomerId(''); setSelectedCustomerName(''); setCustomerSearch(''); setShowCustomerDropdown(true) }} className="text-xs text-gray-400 hover:text-white">Change</button>
                </div>
              ) : (
                <input
                  value={customerSearch}
                  onChange={(e) => { setCustomerSearch(e.target.value); searchCustomers(e.target.value); setShowCustomerDropdown(true) }}
                  onFocus={() => { setShowCustomerDropdown(true); searchCustomers(customerSearch) }}
                  className="w-full mt-1 px-3 py-2 bg-surface rounded-lg border border-gray-700 text-white text-sm"
                  placeholder="Search by name or phone..."
                />
              )}
              {showCustomerDropdown && !selectedCustomerName && (
                <div className="absolute z-10 w-full mt-1 bg-surface-lighter border border-gray-700 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                  {customers.length === 0 ? (
                    <p className="text-xs text-gray-400 p-3">No customers found. Create one first in the Customers page.</p>
                  ) : (
                    customers.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => {
                          setCustomerId(c.id)
                          setSelectedCustomerName(`${c.name} (${c.phone})`)
                          setShowCustomerDropdown(false)
                        }}
                        className="w-full text-left px-3 py-2 hover:bg-bytefix-600/20 text-sm"
                      >
                        <span className="text-white">{c.name}</span>
                        <span className="text-gray-400 ml-2">{c.phone}</span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
            <div>
              <label className="text-xs text-gray-400">Device Brand</label>
              <input value={deviceBrand} onChange={(e) => setDeviceBrand(e.target.value)} className="w-full mt-1 px-3 py-2 bg-surface rounded-lg border border-gray-700 text-white text-sm" placeholder="e.g. Dell, HP, Lenovo" />
            </div>
            <div>
              <label className="text-xs text-gray-400">Device Model</label>
              <input value={deviceModel} onChange={(e) => setDeviceModel(e.target.value)} className="w-full mt-1 px-3 py-2 bg-surface rounded-lg border border-gray-700 text-white text-sm" placeholder="e.g. Inspiron 15 3520" />
            </div>
            <div>
              <label className="text-xs text-gray-400">Complaint (required)</label>
              <input value={complaint} onChange={(e) => setComplaint(e.target.value)} className="w-full mt-1 px-3 py-2 bg-surface rounded-lg border border-gray-700 text-white text-sm" placeholder="Describe the issue" />
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={handleCreate} disabled={!!loading} className="btn-primary flex items-center gap-2">
              {loading === 'create' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Create Job
            </button>
            <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm text-gray-400 hover:text-white">Cancel</button>
          </div>
        </div>
      )}

      {/* Job List */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-medium text-white">Jobs ({jobs.length})</h3>
          <button onClick={loadJobs} disabled={!!loading} className="text-xs text-bytefix-400">
            {loading === 'list' ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Refresh'}
          </button>
        </div>
        {jobs.length === 0 ? (
          <p className="text-sm text-gray-400">No jobs found.</p>
        ) : (
          <div className="space-y-2">
            {jobs.map((job) => (
              <div key={job.id} className="p-3 bg-surface rounded-lg border border-gray-700/50">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-white">#{job.ticket_number}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[job.status] || 'bg-gray-500/20 text-gray-400'}`}>{STATUS_LABELS[job.status] || job.status}</span>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">{job.complaint}</p>
                    {job.device_brand && <p className="text-xs text-gray-500">{job.device_brand} {job.device_model || ''}</p>}
                    {job.diagnosis && <p className="text-xs text-emerald-400 mt-1">Diagnosis: {job.diagnosis}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    {job.estimated_cost != null && <span className="text-xs text-gray-400">{'\u20B9'}{job.estimated_cost}</span>}
                    {NEXT_STATUS[job.status] && (
                      <button onClick={() => advanceStatus(job.id, job.status)} disabled={!!loading} className="text-xs px-2 py-1 bg-bytefix-600/20 text-bytefix-400 rounded hover:bg-bytefix-600/30 flex items-center gap-1">
                        {loading === `advance-${job.id}` ? <Loader2 className="w-3 h-3 animate-spin" /> : <><ArrowRight className="w-3 h-3" /> {STATUS_LABELS[NEXT_STATUS[job.status]]}</>}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
