import { useState, useEffect } from 'react'
import { Receipt, Loader2, Plus, Search, IndianRupee, QrCode } from 'lucide-react'

interface InvoiceRow {
  id: string
  invoice_number: string
  customer_id: string
  shop_name: string
  subtotal: number
  total: number
  payment_status: string
  created_at: number
}

export function GSTBillingPage(): JSX.Element {
  const [invoices, setInvoices] = useState<InvoiceRow[]>([])
  const [loading, setLoading] = useState('')
  const [stats, setStats] = useState<Record<string, unknown> | null>(null)
  const [showCreate, setShowCreate] = useState(false)

  // Create invoice form state
  const [customerId, setCustomerId] = useState('')
  const [shopName, setShopName] = useState('')
  const [shopGstin, setShopGstin] = useState('')
  const [shopStateCode, setShopStateCode] = useState('27')
  const [lineItems, setLineItems] = useState([
    { description: 'Repair Service', hsnCode: '998314', quantity: 1, rate: 500, amount: 500, gstRate: 18 }
  ])

  useEffect(() => {
    loadInvoices()
    loadStats()
  }, [])

  async function loadInvoices(): Promise<void> {
    setLoading('list')
    try {
      const data = await window.bytefix.getAllInvoices(50)
      setInvoices(data as InvoiceRow[])
    } catch (err) { console.error(err) }
    finally { setLoading('') }
  }

  async function loadStats(): Promise<void> {
    try {
      setStats(await window.bytefix.getInvoiceStats() as Record<string, unknown>)
    } catch (err) { console.error(err) }
  }

  async function handleCreateInvoice(): Promise<void> {
    if (!customerId.trim() || !shopName.trim()) return
    setLoading('create')
    try {
      await window.bytefix.createInvoice({
        customerId, shopName, shopGstin, shopStateCode, lineItems,
        paymentMethod: 'pending', notes: ''
      })
      setShowCreate(false)
      setCustomerId('')
      await loadInvoices()
      await loadStats()
    } catch (err) { console.error(err) }
    finally { setLoading('') }
  }

  async function markPaid(invoiceId: string): Promise<void> {
    setLoading(`pay-${invoiceId}`)
    try {
      await window.bytefix.updatePaymentStatus(invoiceId, 'paid', 'cash')
      await loadInvoices()
      await loadStats()
    } catch (err) { console.error(err) }
    finally { setLoading('') }
  }

  function updateLineItem(idx: number, field: string, value: string | number): void {
    const updated = [...lineItems]
    const item = { ...updated[idx], [field]: value }
    if (field === 'quantity' || field === 'rate') {
      item.amount = Number(item.quantity) * Number(item.rate)
    }
    updated[idx] = item
    setLineItems(updated)
  }

  return (
    <div className="space-y-6 animate-slide-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Receipt className="w-6 h-6 text-emerald-400" /> GST Billing
          </h1>
          <p className="text-gray-400 text-sm mt-1">GST-compliant invoicing with CGST/SGST/IGST calculation</p>
        </div>
        <button onClick={() => setShowCreate(!showCreate)} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> New Invoice
        </button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="card text-center">
            <p className="text-xs text-gray-400">Total Invoices</p>
            <p className="text-xl font-bold text-white">{(stats as Record<string, number>).totalInvoices ?? 0}</p>
          </div>
          <div className="card text-center">
            <p className="text-xs text-gray-400">Total Revenue</p>
            <p className="text-xl font-bold text-emerald-400 flex items-center justify-center gap-1">
              <IndianRupee className="w-4 h-4" />{((stats as Record<string, number>).totalRevenue ?? 0).toLocaleString('en-IN')}
            </p>
          </div>
          <div className="card text-center">
            <p className="text-xs text-gray-400">Paid</p>
            <p className="text-xl font-bold text-emerald-400">{(stats as Record<string, number>).paidCount ?? 0}</p>
          </div>
          <div className="card text-center">
            <p className="text-xs text-gray-400">Pending</p>
            <p className="text-xl font-bold text-yellow-400">{(stats as Record<string, number>).pendingCount ?? 0}</p>
          </div>
        </div>
      )}

      {/* Create Invoice Form */}
      {showCreate && (
        <div className="card border-bytefix-500/30">
          <h3 className="font-medium text-white mb-4">Create New Invoice</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="text-xs text-gray-400">Customer ID</label>
              <input value={customerId} onChange={(e) => setCustomerId(e.target.value)} className="w-full mt-1 px-3 py-2 bg-surface rounded-lg border border-gray-700 text-white text-sm" placeholder="Customer ID" />
            </div>
            <div>
              <label className="text-xs text-gray-400">Shop Name</label>
              <input value={shopName} onChange={(e) => setShopName(e.target.value)} className="w-full mt-1 px-3 py-2 bg-surface rounded-lg border border-gray-700 text-white text-sm" placeholder="ByteFix Shop" />
            </div>
            <div>
              <label className="text-xs text-gray-400">Shop GSTIN</label>
              <input value={shopGstin} onChange={(e) => setShopGstin(e.target.value)} className="w-full mt-1 px-3 py-2 bg-surface rounded-lg border border-gray-700 text-white text-sm" placeholder="27AABCU9603R1ZX" />
            </div>
            <div>
              <label className="text-xs text-gray-400">Shop State Code</label>
              <input value={shopStateCode} onChange={(e) => setShopStateCode(e.target.value)} className="w-full mt-1 px-3 py-2 bg-surface rounded-lg border border-gray-700 text-white text-sm" placeholder="27" />
            </div>
          </div>

          <h4 className="text-sm text-white mb-2">Line Items</h4>
          {lineItems.map((item, idx) => (
            <div key={idx} className="grid grid-cols-5 gap-2 mb-2">
              <input value={item.description} onChange={(e) => updateLineItem(idx, 'description', e.target.value)} className="px-2 py-1 bg-surface rounded border border-gray-700 text-white text-xs" placeholder="Description" />
              <input value={item.hsnCode} onChange={(e) => updateLineItem(idx, 'hsnCode', e.target.value)} className="px-2 py-1 bg-surface rounded border border-gray-700 text-white text-xs" placeholder="HSN" />
              <input type="number" value={item.quantity} onChange={(e) => updateLineItem(idx, 'quantity', Number(e.target.value))} className="px-2 py-1 bg-surface rounded border border-gray-700 text-white text-xs" />
              <input type="number" value={item.rate} onChange={(e) => updateLineItem(idx, 'rate', Number(e.target.value))} className="px-2 py-1 bg-surface rounded border border-gray-700 text-white text-xs" />
              <span className="text-sm text-white flex items-center">{'\u20B9'}{item.amount}</span>
            </div>
          ))}
          <button onClick={() => setLineItems([...lineItems, { description: '', hsnCode: '998314', quantity: 1, rate: 0, amount: 0, gstRate: 18 }])} className="text-xs text-bytefix-400 mt-1">+ Add Line Item</button>

          <div className="flex gap-3 mt-4">
            <button onClick={handleCreateInvoice} disabled={!!loading} className="btn-primary flex items-center gap-2">
              {loading === 'create' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Receipt className="w-4 h-4" />}
              Create Invoice
            </button>
            <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm text-gray-400 hover:text-white">Cancel</button>
          </div>
        </div>
      )}

      {/* Invoice List */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-medium text-white">Invoices</h3>
          <button onClick={loadInvoices} disabled={!!loading} className="text-xs text-bytefix-400 flex items-center gap-1">
            {loading === 'list' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Search className="w-3 h-3" />} Refresh
          </button>
        </div>
        {invoices.length === 0 ? (
          <p className="text-sm text-gray-400">No invoices yet. Create your first invoice above.</p>
        ) : (
          <div className="space-y-2">
            {invoices.map((inv) => (
              <div key={inv.id} className="flex items-center justify-between p-3 bg-surface rounded-lg border border-gray-700/50">
                <div>
                  <p className="text-sm font-medium text-white">{inv.invoice_number}</p>
                  <p className="text-xs text-gray-400">{new Date(inv.created_at * 1000).toLocaleDateString('en-IN')}</p>
                </div>
                <div className="text-right flex items-center gap-4">
                  <div>
                    <p className="text-sm font-bold text-white flex items-center gap-1"><IndianRupee className="w-3 h-3" />{inv.total?.toLocaleString('en-IN')}</p>
                    <span className={`text-xs ${inv.payment_status === 'paid' ? 'text-emerald-400' : 'text-yellow-400'}`}>{inv.payment_status}</span>
                  </div>
                  {inv.payment_status !== 'paid' && (
                    <button onClick={() => markPaid(inv.id)} disabled={!!loading} className="text-xs px-2 py-1 bg-emerald-600/20 text-emerald-400 rounded hover:bg-emerald-600/30">
                      {loading === `pay-${inv.id}` ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Mark Paid'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
