import { useState } from 'react'
import { QrCode, Loader2, IndianRupee, CheckCircle, AlertTriangle } from 'lucide-react'

export function UPIPaymentPage(): JSX.Element {
  const [loading, setLoading] = useState('')
  const [vpa, setVpa] = useState('')
  const [payeeName, setPayeeName] = useState('')
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [qrResult, setQrResult] = useState<{ deepLink: string; qrCodeDataUrl: string; amount: number } | null>(null)
  const [error, setError] = useState('')

  async function generateQR(): Promise<void> {
    if (!vpa.trim() || !payeeName.trim() || !amount.trim()) return
    setError('')
    setLoading('generate')
    try {
      const validation = await window.bytefix.validateUPIAddress(vpa) as { valid: boolean; error?: string }
      if (!validation.valid) {
        setError(validation.error || 'Invalid UPI address')
        return
      }
      const result = await window.bytefix.generateUPIPayment({
        vpa, payeeName, amount: Number(amount), note: note || undefined
      }) as { deepLink: string; qrCodeDataUrl: string; amount: number }
      setQrResult(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally { setLoading('') }
  }

  return (
    <div className="space-y-6 animate-slide-in">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <QrCode className="w-6 h-6 text-violet-400" /> UPI QR Payment
        </h1>
        <p className="text-gray-400 text-sm mt-1">Generate UPI QR codes for instant payment collection (free, no gateway needed)</p>
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Form */}
        <div className="card">
          <h3 className="font-medium text-white mb-4">Payment Details</h3>
          <div className="space-y-4">
            <div>
              <label className="text-xs text-gray-400">UPI VPA (required)</label>
              <input value={vpa} onChange={(e) => setVpa(e.target.value)} className="w-full mt-1 px-3 py-2 bg-surface rounded-lg border border-gray-700 text-white text-sm" placeholder="shop@upi or 9876543210@paytm" />
            </div>
            <div>
              <label className="text-xs text-gray-400">Payee Name (required)</label>
              <input value={payeeName} onChange={(e) => setPayeeName(e.target.value)} className="w-full mt-1 px-3 py-2 bg-surface rounded-lg border border-gray-700 text-white text-sm" placeholder="ByteFix Repairs" />
            </div>
            <div>
              <label className="text-xs text-gray-400">Amount in {'\u20B9'} (required)</label>
              <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full mt-1 px-3 py-2 bg-surface rounded-lg border border-gray-700 text-white text-sm" placeholder="500" />
            </div>
            <div>
              <label className="text-xs text-gray-400">Note (optional)</label>
              <input value={note} onChange={(e) => setNote(e.target.value)} className="w-full mt-1 px-3 py-2 bg-surface rounded-lg border border-gray-700 text-white text-sm" placeholder="Payment for repair" />
            </div>
            <button onClick={generateQR} disabled={!!loading} className="btn-primary w-full flex items-center justify-center gap-2">
              {loading === 'generate' ? <Loader2 className="w-4 h-4 animate-spin" /> : <QrCode className="w-4 h-4" />}
              Generate QR Code
            </button>
          </div>
        </div>

        {/* QR Display */}
        <div className="card flex flex-col items-center justify-center min-h-[300px]">
          {qrResult ? (
            <>
              <img src={qrResult.qrCodeDataUrl} alt="UPI QR Code" className="w-48 h-48 rounded-lg bg-white p-2" />
              <p className="text-lg font-bold text-white mt-4 flex items-center gap-1">
                <IndianRupee className="w-4 h-4" />{qrResult.amount.toLocaleString('en-IN')}
              </p>
              <p className="text-xs text-gray-400 mt-1">Scan with any UPI app</p>
              <div className="flex items-center gap-1 mt-2 text-emerald-400 text-xs">
                <CheckCircle className="w-3 h-3" /> QR code generated
              </div>
              <p className="text-[10px] text-gray-500 mt-3 text-center break-all max-w-xs">{qrResult.deepLink}</p>
            </>
          ) : (
            <div className="text-center">
              <QrCode className="w-16 h-16 text-gray-600 mx-auto mb-3" />
              <p className="text-sm text-gray-400">QR code will appear here</p>
              <p className="text-xs text-gray-500 mt-1">Fill in the details and click Generate</p>
            </div>
          )}
        </div>
      </div>

      {/* How it works */}
      <div className="card">
        <h3 className="font-medium text-white mb-3">How UPI QR Payment Works</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="text-center">
            <div className="w-10 h-10 rounded-full bg-violet-500/20 text-violet-400 flex items-center justify-center mx-auto mb-2 text-sm font-bold">1</div>
            <p className="text-sm text-white">Generate QR</p>
            <p className="text-xs text-gray-400">Enter amount and shop UPI address</p>
          </div>
          <div className="text-center">
            <div className="w-10 h-10 rounded-full bg-violet-500/20 text-violet-400 flex items-center justify-center mx-auto mb-2 text-sm font-bold">2</div>
            <p className="text-sm text-white">Customer Scans</p>
            <p className="text-xs text-gray-400">Works with Google Pay, PhonePe, Paytm, etc.</p>
          </div>
          <div className="text-center">
            <div className="w-10 h-10 rounded-full bg-violet-500/20 text-violet-400 flex items-center justify-center mx-auto mb-2 text-sm font-bold">3</div>
            <p className="text-sm text-white">Payment Done</p>
            <p className="text-xs text-gray-400">No gateway fees, instant settlement</p>
          </div>
        </div>
      </div>
    </div>
  )
}
