import { useState, useEffect } from 'react'
import { MessageSquare, Send, Calendar, Loader2, CheckCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import { motion, AnimatePresence } from 'framer-motion'
import { sanityClient } from '@/lib/sanity'

interface Comment {
  _id: string
  name: string
  content: string
  createdAt: string
  status: 'pending' | 'approved' | 'spam'
}

interface CommentsProps {
  postId: string
  className?: string
}

export function Comments({ postId, className = '' }: CommentsProps) {
  const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    content: '',
    website: '' // Honeypot field
  })
  const { toast } = useToast()

  useEffect(() => {
    async function fetchComments() {
      try {
        const query = `*[_type == "comment" && post._ref == $postId && status == "approved"] | order(createdAt desc) {
          _id,
          name,
          content,
          createdAt,
          status
        }`
        const fetchedComments = await sanityClient.fetch(query, { postId })
        setComments(fetchedComments || [])
      } catch (error) {
        console.error('Error fetching comments:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchComments()
  }, [postId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Honeypot check - if website field is filled, it's a bot
    if (formData.website) {
      // Silently reject but show success to confuse bots
      setSubmitted(true)
      return
    }

    // Basic validation
    if (!formData.name.trim() || !formData.email.trim() || !formData.content.trim()) {
      toast({
        title: 'Missing fields',
        description: 'Please fill in all required fields.',
        variant: 'destructive'
      })
      return
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(formData.email)) {
      toast({
        title: 'Invalid email',
        description: 'Please enter a valid email address.',
        variant: 'destructive'
      })
      return
    }

    // Content length check
    if (formData.content.length < 10) {
      toast({
        title: 'Comment too short',
        description: 'Please write at least 10 characters.',
        variant: 'destructive'
      })
      return
    }

    if (formData.content.length > 1000) {
      toast({
        title: 'Comment too long',
        description: 'Please keep your comment under 1000 characters.',
        variant: 'destructive'
      })
      return
    }

    setSubmitting(true)

    try {
      const response = await fetch('/api/blog/comments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          content: formData.content,
          postId,
          honeypot: formData.website
        }),
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Failed to submit comment')
      }
      
      setSubmitted(true)
      setFormData({ name: '', email: '', content: '', website: '' })
      
      toast({
        title: 'Comment submitted!',
        description: 'Your comment is awaiting moderation and will appear once approved.',
      })
    } catch (error) {
      // Error is handled by toast notification
      toast({
        title: 'Error',
        description: 'Failed to submit comment. Please try again.',
        variant: 'destructive'
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className={`${className}`}>
      <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
        <MessageSquare className="h-5 w-5 text-primary" />
        Comments ({comments.length})
      </h3>

      {/* Comment Form */}
      <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-6 mb-8">
        <h4 className="font-semibold mb-4">Leave a Comment</h4>
        
        <AnimatePresence mode="wait">
          {submitted ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex flex-col items-center justify-center py-8 text-center"
            >
              <CheckCircle className="h-12 w-12 text-green-500 mb-4" />
              <h5 className="font-semibold text-lg mb-2">Thank you for your comment!</h5>
              <p className="text-muted-foreground mb-4">
                Your comment is awaiting moderation and will appear once approved.
              </p>
              <Button
                variant="outline"
                onClick={() => setSubmitted(false)}
              >
                Write another comment
              </Button>
            </motion.div>
          ) : (
            <motion.form
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onSubmit={handleSubmit}
              className="space-y-4"
            >
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium mb-1">
                    Name <span className="text-red-500">*</span>
                  </label>
                  <Input
                    id="name"
                    placeholder="Your name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label htmlFor="email" className="block text-sm font-medium mb-1">
                    Email <span className="text-red-500">*</span>
                  </label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="your@email.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Your email will not be published.
                  </p>
                </div>
              </div>

              {/* Honeypot field - hidden from users, visible to bots */}
              <div className="hidden" aria-hidden="true">
                <label htmlFor="website">Website</label>
                <Input
                  id="website"
                  name="website"
                  tabIndex={-1}
                  autoComplete="off"
                  value={formData.website}
                  onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                />
              </div>

              <div>
                <label htmlFor="content" className="block text-sm font-medium mb-1">
                  Comment <span className="text-red-500">*</span>
                </label>
                <Textarea
                  id="content"
                  placeholder="Write your comment here..."
                  rows={4}
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  required
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {formData.content.length}/1000 characters
                </p>
              </div>

              <Button type="submit" disabled={submitting} className="gap-2">
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    Submit Comment
                  </>
                )}
              </Button>
            </motion.form>
          )}
        </AnimatePresence>
      </div>

      {/* Comments List */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse">
              <div className="flex items-center gap-3 mb-2">
                <div className="h-10 w-10 rounded-full bg-slate-200 dark:bg-slate-700" />
                <div>
                  <div className="h-4 w-24 bg-slate-200 dark:bg-slate-700 rounded mb-1" />
                  <div className="h-3 w-16 bg-slate-200 dark:bg-slate-700 rounded" />
                </div>
              </div>
              <div className="h-16 bg-slate-200 dark:bg-slate-700 rounded" />
            </div>
          ))}
        </div>
      ) : comments.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No comments yet. Be the first to comment!</p>
        </div>
      ) : (
        <div className="space-y-6">
          {comments.map((comment, index) => (
            <motion.div
              key={comment._id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.1 }}
              className="border-b border-slate-200 dark:border-slate-700 pb-6 last:border-0"
            >
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary to-purple-500 flex items-center justify-center text-white font-semibold">
                  {comment.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold">{comment.name}</span>
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {new Date(comment.createdAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                      })}
                    </span>
                  </div>
                  <p className="text-muted-foreground">{comment.content}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}
