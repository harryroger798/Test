import { Facebook, Twitter, Linkedin, Link2, MessageCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'

interface SocialShareButtonsProps {
  url: string
  title: string
  className?: string
  variant?: 'default' | 'compact' | 'floating'
}

export function SocialShareButtons({
  url,
  title,
  className = '',
  variant = 'default'
}: SocialShareButtonsProps) {
  const { toast } = useToast()
  
  const fullUrl = url.startsWith('http') ? url : `https://bytecare.shop${url}`
  const encodedUrl = encodeURIComponent(fullUrl)
  const encodedTitle = encodeURIComponent(title)

  const shareLinks = {
    whatsapp: `https://wa.me/?text=${encodedTitle}%20${encodedUrl}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}&quote=${encodedTitle}`,
    twitter: `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`
  }

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(fullUrl)
      toast({
        title: 'Link copied!',
        description: 'The link has been copied to your clipboard.',
      })
    } catch (err) {
      toast({
        title: 'Failed to copy',
        description: 'Please copy the link manually.',
        variant: 'destructive'
      })
    }
  }

  const handleShare = (platform: keyof typeof shareLinks) => {
    window.open(shareLinks[platform], '_blank', 'width=600,height=400')
  }

  if (variant === 'floating') {
    return (
      <div className={`fixed left-4 top-1/2 -translate-y-1/2 flex flex-col gap-2 z-50 ${className}`}>
        <Button
          size="icon"
          variant="outline"
          className="rounded-full bg-green-500 hover:bg-green-600 text-white border-0 shadow-lg"
          onClick={() => handleShare('whatsapp')}
          title="Share on WhatsApp"
          aria-label="Share on WhatsApp"
        >
          <MessageCircle className="h-5 w-5" />
        </Button>
        <Button
          size="icon"
          variant="outline"
          className="rounded-full bg-blue-600 hover:bg-blue-700 text-white border-0 shadow-lg"
          onClick={() => handleShare('facebook')}
          title="Share on Facebook"
          aria-label="Share on Facebook"
        >
          <Facebook className="h-5 w-5" />
        </Button>
        <Button
          size="icon"
          variant="outline"
          className="rounded-full bg-sky-500 hover:bg-sky-600 text-white border-0 shadow-lg"
          onClick={() => handleShare('twitter')}
          title="Share on Twitter"
          aria-label="Share on Twitter"
        >
          <Twitter className="h-5 w-5" />
        </Button>
        <Button
          size="icon"
          variant="outline"
          className="rounded-full bg-blue-700 hover:bg-blue-800 text-white border-0 shadow-lg"
          onClick={() => handleShare('linkedin')}
          title="Share on LinkedIn"
          aria-label="Share on LinkedIn"
        >
          <Linkedin className="h-5 w-5" />
        </Button>
        <Button
          size="icon"
          variant="outline"
          className="rounded-full bg-slate-600 hover:bg-slate-700 text-white border-0 shadow-lg"
          onClick={handleCopyLink}
          title="Copy link"
          aria-label="Copy link"
        >
          <Link2 className="h-5 w-5" />
        </Button>
      </div>
    )
  }

  if (variant === 'compact') {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <span className="text-sm text-muted-foreground mr-2">Share:</span>
        <button
          onClick={() => handleShare('whatsapp')}
          className="p-2 rounded-full bg-green-500 hover:bg-green-600 text-white transition-colors"
          title="Share on WhatsApp"
          aria-label="Share on WhatsApp"
        >
          <MessageCircle className="h-4 w-4" />
        </button>
        <button
          onClick={() => handleShare('facebook')}
          className="p-2 rounded-full bg-blue-600 hover:bg-blue-700 text-white transition-colors"
          title="Share on Facebook"
          aria-label="Share on Facebook"
        >
          <Facebook className="h-4 w-4" />
        </button>
        <button
          onClick={() => handleShare('twitter')}
          className="p-2 rounded-full bg-sky-500 hover:bg-sky-600 text-white transition-colors"
          title="Share on Twitter"
          aria-label="Share on Twitter"
        >
          <Twitter className="h-4 w-4" />
        </button>
        <button
          onClick={() => handleShare('linkedin')}
          className="p-2 rounded-full bg-blue-700 hover:bg-blue-800 text-white transition-colors"
          title="Share on LinkedIn"
          aria-label="Share on LinkedIn"
        >
          <Linkedin className="h-4 w-4" />
        </button>
        <button
          onClick={handleCopyLink}
          className="p-2 rounded-full bg-slate-600 hover:bg-slate-700 text-white transition-colors"
          title="Copy link"
          aria-label="Copy link"
        >
          <Link2 className="h-4 w-4" />
        </button>
      </div>
    )
  }

  return (
    <div className={`flex flex-wrap items-center gap-3 ${className}`}>
      <span className="text-sm font-medium text-foreground">Share this article:</span>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          className="gap-2 bg-green-500 hover:bg-green-600 text-white border-0"
          onClick={() => handleShare('whatsapp')}
        >
          <MessageCircle className="h-4 w-4" />
          WhatsApp
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="gap-2 bg-blue-600 hover:bg-blue-700 text-white border-0"
          onClick={() => handleShare('facebook')}
        >
          <Facebook className="h-4 w-4" />
          Facebook
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="gap-2 bg-sky-500 hover:bg-sky-600 text-white border-0"
          onClick={() => handleShare('twitter')}
        >
          <Twitter className="h-4 w-4" />
          Twitter
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="gap-2 bg-blue-700 hover:bg-blue-800 text-white border-0"
          onClick={() => handleShare('linkedin')}
        >
          <Linkedin className="h-4 w-4" />
          LinkedIn
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={handleCopyLink}
        >
          <Link2 className="h-4 w-4" />
          Copy Link
        </Button>
      </div>
    </div>
  )
}
