export function formatDate(dateString: string): string {
  if (!dateString) return ''
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export function estimateReadingTime(html: string): number {
  if (!html) return 1
  const text = html.replace(/<[^>]*>/g, '')
  const words = text.split(/\s+/).length
  return Math.max(1, Math.ceil(words / 200))
}

export const SITE_URL = 'https://textshift.blog'
export const MAIN_SITE_URL = 'https://textshift.org'
export const SITE_NAME = 'TextShift Blog'
export const SITE_DESCRIPTION = 'Expert guides on AI content detection, humanization, and writing tips. Learn how to create undetectable AI content with TextShift.'
