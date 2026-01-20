import { useState } from 'react'
import { Mail, Send, Loader2, CheckCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'
import { motion, AnimatePresence } from 'framer-motion'

interface NewsletterSubscribeProps {
  className?: string
  variant?: 'default' | 'compact' | 'inline'
}

export function NewsletterSubscribe({ className = '', variant = 'default' }: NewsletterSubscribeProps) {
  const [email, setEmail] = useState('')
  const [honeypot, setHoneypot] = useState('')
  const [loading, setLoading] = useState(false)
  const [subscribed, setSubscribed] = useState(false)
  const { toast } = useToast()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!email.trim()) {
      toast({
        title: 'Email required',
        description: 'Please enter your email address.',
        variant: 'destructive'
      })
      return
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      toast({
        title: 'Invalid email',
        description: 'Please enter a valid email address.',
        variant: 'destructive'
      })
      return
    }

    setLoading(true)

    try {
      const response = await fetch('/api/blog/newsletter/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, honeypot }),
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Failed to subscribe')
      }
      
      setSubscribed(true)
      setEmail('')
      
      toast({
        title: 'Subscribed!',
        description: data.message || 'Thank you for subscribing to our newsletter.',
      })
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to subscribe. Please try again.',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  if (variant === 'inline') {
    return (
      <form onSubmit={handleSubmit} className={`flex gap-2 ${className}`}>
        <input
          type="text"
          name="website"
          value={honeypot}
          onChange={(e) => setHoneypot(e.target.value)}
          style={{ display: 'none' }}
          tabIndex={-1}
          autoComplete="off"
        />
        <Input
          type="email"
          placeholder="Enter your email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="flex-1"
          disabled={loading || subscribed}
        />
        <Button 
          type="submit" 
          disabled={loading || subscribed}
          aria-label={loading ? 'Subscribing...' : subscribed ? 'Subscribed' : 'Subscribe to newsletter'}
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : subscribed ? (
            <CheckCircle className="h-4 w-4" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </form>
    )
  }

  if (variant === 'compact') {
    return (
      <div className={`bg-primary/5 rounded-lg p-4 ${className}`}>
        <div className="flex items-center gap-2 mb-2">
          <Mail className="h-4 w-4 text-primary" />
          <span className="font-medium text-sm">Get tech tips in your inbox</span>
        </div>
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            type="text"
            name="website"
            value={honeypot}
            onChange={(e) => setHoneypot(e.target.value)}
            style={{ display: 'none' }}
            tabIndex={-1}
            autoComplete="off"
          />
          <Input
            type="email"
            placeholder="your@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="flex-1 h-9 text-sm"
            disabled={loading || subscribed}
          />
          <Button type="submit" size="sm" disabled={loading || subscribed}>
            {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Subscribe'}
          </Button>
        </form>
      </div>
    )
  }

  return (
    <div className={`bg-gradient-to-br from-primary/10 to-purple-500/10 rounded-xl p-6 ${className}`}>
      <AnimatePresence mode="wait">
        {subscribed ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="text-center py-4"
          >
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <h4 className="font-bold text-lg mb-2">You're subscribed!</h4>
            <p className="text-muted-foreground">
              Thank you for subscribing. Check your inbox for a confirmation email.
            </p>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="h-12 w-12 rounded-full bg-primary/20 flex items-center justify-center">
                <Mail className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h4 className="font-bold text-lg">Subscribe to our Newsletter</h4>
                <p className="text-sm text-muted-foreground">
                  Get the latest tech tips and repair guides
                </p>
              </div>
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-3">
              <input
                type="text"
                name="website"
                value={honeypot}
                onChange={(e) => setHoneypot(e.target.value)}
                style={{ display: 'none' }}
                tabIndex={-1}
                autoComplete="off"
              />
              <Input
                type="email"
                placeholder="Enter your email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
              />
              <Button type="submit" className="w-full gap-2" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Subscribing...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    Subscribe Now
                  </>
                )}
              </Button>
              <p className="text-xs text-center text-muted-foreground">
                No spam, unsubscribe anytime. We respect your privacy.
              </p>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
