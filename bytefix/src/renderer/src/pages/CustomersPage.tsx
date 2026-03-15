import { useState, useEffect } from 'react'
import { Users, Loader2, Plus, Search, Phone, Trash2 } from 'lucide-react'

interface Customer {
  id: string
  phone: string
  name: string
  email?: string
  address?: string
  gstin?: string
  created_at: number
}

export function CustomersPage(): JSX.Element {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [phone, setPhone] = useState('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [address, setAddress] = useState('')

  useEffect(() => { loadCustomers() }, [])

  async function loadCustomers(): Promise<void> {
    setLoading('list')
    try { setCustomers(await window.bytefix.getAllCustomers(100) as Customer[]) }
    catch (err) { console.error(err) }
    finally { setLoading('') }
  }

  async function handleSearch(): Promise<void> {
    if (!searchQuery.trim()) { await loadCustomers(); return }
    setLoading('search')
    try { setCustomers(await window.bytefix.searchCustomers(searchQuery) as Customer[]) }
    catch (err) { console.error(err) }
    finally { setLoading('') }
  }

  async function handleCreate(): Promise<void> {
    if (!phone.trim() || !name.trim()) return
    setLoading('create')
    try {
      await window.bytefix.createCustomer({ phone, name, email, address })
      setShowCreate(false)
      setPhone(''); setName(''); setEmail(''); setAddress('')
      await loadCustomers()
    } catch (err) { console.error(err) }
    finally { setLoading('') }
  }

  async function handleDelete(id: string): Promise<void> {
    setLoading(`del-${id}`)
    try { await window.bytefix.deleteCustomer(id); await loadCustomers() }
    catch (err) { console.error(err) }
    finally { setLoading('') }
  }

  return (
    <div className="space-y-6 animate-slide-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Users className="w-6 h-6 text-blue-400" /> Customers
          </h1>
          <p className="text-gray-400 text-sm mt-1">Customer database with phone-based lookup (Indian market)</p>
        </div>
        <button onClick={() => setShowCreate(!showCreate)} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> Add Customer
        </button>
      </div>

      {/* Search */}
      <div className="card flex items-center gap-3">
        <Search className="w-4 h-4 text-gray-400" />
        <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSearch()} className="flex-1 bg-transparent text-white text-sm outline-none" placeholder="Search by name or phone..." />
        <button onClick={handleSearch} disabled={!!loading} className="text-xs text-bytefix-400">
          {loading === 'search' ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Search'}
        </button>
      </div>

      {/* Create Form */}
      {showCreate && (
        <div className="card border-bytefix-500/30">
          <h3 className="font-medium text-white mb-3">New Customer</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="text-xs text-gray-400">Phone (required)</label>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full mt-1 px-3 py-2 bg-surface rounded-lg border border-gray-700 text-white text-sm" placeholder="9876543210" />
            </div>
            <div>
              <label className="text-xs text-gray-400">Name (required)</label>
              <input value={name} onChange={(e) => setName(e.target.value)} className="w-full mt-1 px-3 py-2 bg-surface rounded-lg border border-gray-700 text-white text-sm" placeholder="Customer name" />
            </div>
            <div>
              <label className="text-xs text-gray-400">Email</label>
              <input value={email} onChange={(e) => setEmail(e.target.value)} className="w-full mt-1 px-3 py-2 bg-surface rounded-lg border border-gray-700 text-white text-sm" placeholder="email@example.com" />
            </div>
            <div>
              <label className="text-xs text-gray-400">Address</label>
              <input value={address} onChange={(e) => setAddress(e.target.value)} className="w-full mt-1 px-3 py-2 bg-surface rounded-lg border border-gray-700 text-white text-sm" placeholder="Address" />
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={handleCreate} disabled={!!loading} className="btn-primary flex items-center gap-2">
              {loading === 'create' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Create
            </button>
            <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm text-gray-400 hover:text-white">Cancel</button>
          </div>
        </div>
      )}

      {/* Customer List */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-medium text-white">All Customers ({customers.length})</h3>
          <button onClick={loadCustomers} disabled={!!loading} className="text-xs text-bytefix-400">
            {loading === 'list' ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Refresh'}
          </button>
        </div>
        {customers.length === 0 ? (
          <p className="text-sm text-gray-400">No customers yet.</p>
        ) : (
          <div className="space-y-2">
            {customers.map((c) => (
              <div key={c.id} className="flex items-center justify-between p-3 bg-surface rounded-lg border border-gray-700/50">
                <div>
                  <p className="text-sm font-medium text-white">{c.name}</p>
                  <p className="text-xs text-gray-400 flex items-center gap-1"><Phone className="w-3 h-3" /> {c.phone}</p>
                  {c.email && <p className="text-xs text-gray-500">{c.email}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">{new Date(c.created_at * 1000).toLocaleDateString('en-IN')}</span>
                  <button onClick={() => handleDelete(c.id)} disabled={!!loading} className="text-gray-500 hover:text-red-400">
                    {loading === `del-${c.id}` ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
