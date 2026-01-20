import { useEffect, useState } from 'react'
import { getAllPosts, type SanityPost } from '@/lib/sanity'
import { generateSitemap } from '@/lib/seo'

export function SitemapPage() {
  const [sitemap, setSitemap] = useState<string>('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchAndGenerateSitemap() {
      try {
        const posts = await getAllPosts()
        const sitemapPosts = posts.map((post: SanityPost) => ({
          slug: post.slug.current,
          publishedAt: post.publishedAt || new Date().toISOString(),
          modifiedAt: post.publishedAt
        }))
        const xml = generateSitemap(sitemapPosts)
        setSitemap(xml)
      } catch (error) {
        console.error('Error generating sitemap:', error)
        const xml = generateSitemap([])
        setSitemap(xml)
      } finally {
        setLoading(false)
      }
    }

    fetchAndGenerateSitemap()
  }, [])

  useEffect(() => {
    if (sitemap && !loading) {
      document.body.innerHTML = `<pre style="word-wrap: break-word; white-space: pre-wrap;">${sitemap.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>`
      document.title = 'Sitemap - ByteCare'
    }
  }, [sitemap, loading])

  if (loading) {
    return (
      <div style={{ padding: '20px', fontFamily: 'monospace' }}>
        Generating sitemap...
      </div>
    )
  }

  return null
}
