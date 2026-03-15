import { useState } from 'react'
import { MessageCircle, Loader2, Send, CheckCircle, AlertTriangle, Phone } from 'lucide-react'

export function WhatsAppPage(): JSX.Element {
  const [loading, setLoading] = useState('')
  const [phone, setPhone] = useState('')
  const [message, setMessage] = useState('')
  const [result, setResult] = useState<{ waLink: string; phone: string; message: string } | null>(null)
  const [error, setError] = useState('')

  async function validatePhone(): Promise<boolean> {
    const validation = await window.bytefix.validateIndianPhone(phone) as { valid: boolean; error?: string; cleaned?: string }
    if (!validation.valid) {
      setError(validation.error || 'Invalid phone number')
      return false
    }
    setError('')
    return true
  }

  async function sendCustom(): Promise<void> {
    if (!phone.trim() || !message.trim()) return
    setLoading('custom')
    try {
      if (!(await validatePhone())) return
      const res = await window.bytefix.sendWhatsAppCustomMessage(phone, message) as { waLink: string; phone: string; message: string }
      setResult(res)
    } catch (err) { setError(err instanceof Error ? err.message : String(err)) }
    finally { setLoading('') }
  }

  async function sendJobUpdate(status: string): Promise<void> {
    if (!phone.trim()) return
    setLoading(`job-${status}`)
    try {
      if (!(await validatePhone())) return
      const res = await window.bytefix.sendWhatsAppJobStatus({
        phone, status, customerName: 'Customer', ticketNumber: 'BF-001', shopName: 'ByteFix'
      }) as { waLink: string; phone: string; message: string }
      setResult(res)
    } catch (err) { setError(err instanceof Error ? err.message : String(err)) }
    finally { setLoading('') }
  }

  function openWhatsApp(): void {
    if (result?.waLink) {
      window.open(result.waLink, '_blank')
    }
  }

  return (
    <div className="space-y-6 animate-slide-in">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <MessageCircle className="w-6 h-6 text-green-400" /> WhatsApp Integration
        </h1>
        <p className="text-gray-400 text-sm mt-1">Send job updates, payment links, and diagnostic reports via WhatsApp (free, no API key)</p>
      </div>

      {error && (
        <div className="card border-red-500/50">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400" />
            <p className="text-sm text-red-400">{error}</p>
            <button onClick={() => setError('')} className="ml-auto text-xs text-gray-400">Dismiss</button>
          </div>
        </div>
      )}

      {result && (
        <div className="card border-green-500/50">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="w-4 h-4 text-green-400" />
            <p className="text-sm text-green-400">WhatsApp message ready!</p>
          </div>
          <p className="text-xs text-gray-400 mb-2">To: +91{result.phone}</p>
          <pre className="text-xs text-white bg-surface p-3 rounded-lg whitespace-pre-wrap max-h-40 overflow-y-auto">{result.message}</pre>
          <button onClick={openWhatsApp} className="btn-primary mt-3 flex items-center gap-2">
            <MessageCircle className="w-4 h-4" /> Open in WhatsApp
          </button>
          <button onClick={() => setResult(null)} className="text-xs text-gray-400 mt-2 block">Dismiss</button>
        </div>
      )}

      {/* Phone Input */}
      <div className="card">
        <h3 className="font-medium text-white mb-3 flex items-center gap-2"><Phone className="w-4 h-4 text-green-400" /> Customer Phone</h3>
        <input value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full px-3 py-2 bg-surface rounded-lg border border-gray-700 text-white text-sm" placeholder="Enter 10-digit Indian mobile number" />
        <p className="text-xs text-gray-500 mt-1">Supports formats: 9876543210, +919876543210, 09876543210</p>
      </div>

      {/* Quick Job Status Updates */}
      <div className="card">
        <h3 className="font-medium text-white mb-3">Quick Job Status Updates</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {['received', 'diagnosing', 'waiting_parts', 'ready', 'delivered'].map((status) => (
            <button key={status} onClick={() => sendJobUpdate(status)} disabled={!!loading || !phone.trim()} className="p-3 bg-surface rounded-lg border border-gray-700/50 hover:border-green-500/30 text-left">
              <p className="text-xs font-medium text-white capitalize">{status.replace('_', ' ')}</p>
              {loading === `job-${status}` && <Loader2 className="w-3 h-3 animate-spin text-green-400 mt-1" />}
            </button>
          ))}
        </div>
      </div>

      {/* Custom Message */}
      <div className="card">
        <h3 className="font-medium text-white mb-3">Custom Message</h3>
        <textarea value={message} onChange={(e) => setMessage(e.target.value)} className="w-full px-3 py-2 bg-surface rounded-lg border border-gray-700 text-white text-sm h-24 resize-none" placeholder="Type your message..." />
        <button onClick={sendCustom} disabled={!!loading || !phone.trim() || !message.trim()} className="btn-primary mt-3 flex items-center gap-2">
          {loading === 'custom' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          Send via WhatsApp
        </button>
      </div>
    </div>
  )
}
