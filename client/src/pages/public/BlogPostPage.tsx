import { useTranslation } from 'react-i18next'
import { PublicLayout } from '@/components/layout/PublicLayout'
import { motion } from 'framer-motion'
import { Calendar, User, ArrowLeft, Clock, Tag, ExternalLink, Loader2 } from 'lucide-react'
import { GradientOrbs, FloatingTechIcons, DotGridPattern, FloatingParticles } from '@/components/ui/visual-enhancements'
import { useEffect, useState, useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getPostBySlug, type SanityPost } from '@/lib/sanity'
import { Button } from '@/components/ui/button'
import DOMPurify from 'dompurify'
import {
  SEOHead,
  SocialShareButtons,
  TableOfContents,
  Breadcrumbs,
  RelatedPosts,
  Comments,
  ReadingProgress,
  NewsletterSubscribe
} from '@/components/seo'

export function BlogPostPage() {
  const { t } = useTranslation()
  const { slug } = useParams<{ slug: string }>()
  const [post, setPost] = useState<SanityPost | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // useMemo must be called before any early returns to follow React hook rules
  const sanitizedBody = useMemo(() => {
    if (!post?.body) return ''
    return DOMPurify.sanitize(post.body, {
      ADD_TAGS: ['iframe'],
      ADD_ATTR: ['allow', 'allowfullscreen', 'frameborder', 'scrolling', 'target']
    })
  }, [post?.body])

  useEffect(() => {
    async function fetchPost() {
      if (!slug) return
      
      try {
        setLoading(true)
        const fetchedPost = await getPostBySlug(slug)
        if (fetchedPost) {
          setPost(fetchedPost)
        } else {
          setError('Post not found')
        }
      } catch (err) {
        console.error('Error fetching post from Sanity:', err)
        setError('Failed to load blog post')
      } finally {
        setLoading(false)
      }
    }
    fetchPost()
  }, [slug])

  if (loading) {
    return (
      <PublicLayout>
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-slate-50 to-white dark:from-slate-900 dark:to-slate-800">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-2 text-muted-foreground">Loading blog post...</span>
        </div>
      </PublicLayout>
    )
  }

  if (error || !post) {
    return (
      <PublicLayout>
        <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-slate-50 to-white dark:from-slate-900 dark:to-slate-800">
          <h1 className="text-2xl font-bold text-foreground mb-4">{error || 'Post not found'}</h1>
          <Link to="/blog">
            <Button variant="outline" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Blog
            </Button>
          </Link>
        </div>
      </PublicLayout>
    )
  }

    const wordCount = post.body?.split(/\s+/).filter(Boolean).length || 0
    const readingTime = Math.max(1, Math.ceil(wordCount / 200))
    const postUrl = `https://bytecare.shop/blog/${post.slug.current}`
    const categoryIds = post.categories?.map(c => c._id) || []

    const breadcrumbItems = [
      { name: 'Blog', url: '/blog' },
      ...(post.categories?.[0] ? [{ name: post.categories[0].title, url: `/blog/category/${post.categories[0].slug.current}` }] : []),
      { name: post.title, url: `/blog/${post.slug.current}` }
    ]

    return (
      <PublicLayout>
        {/* SEO Head with Schema Markup */}
        <SEOHead
          title={post.seo?.metaTitle || post.title}
          description={post.seo?.metaDescription || post.excerpt}
          keywords={post.seo?.keywords}
          image={post.featuredImage?.url}
          imageAlt={post.featuredImage?.alt || post.title}
          url={postUrl}
          type="article"
          author={post.author?.name}
          publishedAt={post.publishedAt}
          section={post.categories?.[0]?.title}
          tags={post.categories?.map(c => c.title)}
          breadcrumbs={breadcrumbItems}
          includeLocalBusiness={true}
          articleData={{
            headline: post.title,
            description: post.excerpt,
            author: post.author ? {
              name: post.author.name,
              url: `https://bytecare.shop/blog/author/${post.author.slug?.current || 'bytecare'}`
            } : undefined,
            datePublished: post.publishedAt
          }}
        />

        {/* Reading Progress Bar */}
        <ReadingProgress />

        {/* Floating Social Share Buttons (Desktop) */}
        <div className="hidden lg:block">
          <SocialShareButtons
            url={postUrl}
            title={post.title}
            variant="floating"
          />
        </div>

        {/* Hero Section */}
      <section className="relative py-20 bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600/20 via-purple-600/20 to-pink-600/20 animate-pulse" />
        <FloatingParticles count={20} color="white" />
        <FloatingTechIcons variant="light" />
        <div className="container mx-auto px-4 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="max-w-4xl mx-auto"
          >
            {/* Breadcrumbs */}
            <Breadcrumbs items={breadcrumbItems.slice(0, -1)} className="mb-6 text-white/70" />
            
            <Link to="/blog" className="inline-flex items-center gap-2 text-white/70 hover:text-white mb-6 transition-colors">
              <ArrowLeft className="h-4 w-4" />
              Back to Blog
            </Link>
            
            {post.status === 'draft' && (
              <div className="inline-block px-3 py-1 bg-yellow-500 text-white text-sm font-semibold rounded-full mb-4">
                Draft - Not Published
              </div>
            )}
            
            <h1 className="text-3xl md:text-5xl font-bold text-white mb-6">
              {post.title}
            </h1>
            
            <div className="flex flex-wrap items-center gap-4 text-white/70">
              <span className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                {new Date(post.publishedAt).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </span>
              {post.author && (
                <span className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  {post.author.name}
                </span>
              )}
              <span className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                {readingTime} min read
              </span>
            </div>
            
            {post.categories && post.categories.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-4">
                {post.categories.map((category) => (
                  <span
                    key={category._id}
                    className="flex items-center gap-1 px-3 py-1 bg-white/10 text-white text-sm rounded-full"
                  >
                    <Tag className="h-3 w-3" />
                    {category.title}
                  </span>
                ))}
              </div>
            )}
          </motion.div>
        </div>
      </section>

      {/* Featured Image */}
      {post.featuredImage?.url && (
        <section className="relative -mt-10 z-10">
          <div className="container mx-auto px-4">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="max-w-4xl mx-auto"
            >
              <img
                src={post.featuredImage.url}
                alt={post.featuredImage.alt || post.title}
                className="w-full h-64 md:h-96 object-cover rounded-2xl shadow-2xl"
              />
            </motion.div>
          </div>
        </section>
      )}

      {/* Content Section */}
      <section className="relative py-16 bg-gradient-to-b from-slate-50 to-white dark:from-slate-900 dark:to-slate-800 overflow-hidden">
        <GradientOrbs variant="subtle" />
        <DotGridPattern opacity="light" />
        <div className="container mx-auto px-4 relative z-10">
          <motion.article
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="max-w-4xl mx-auto"
          >
            <div className="backdrop-blur-lg bg-white/70 dark:bg-slate-800/70 border border-white/20 dark:border-slate-700/50 rounded-2xl shadow-xl p-8 md:p-12">
              {/* Table of Contents */}
              <TableOfContents content={post.body} className="mb-8" />

              {/* Blog Content */}
              <div 
                className="prose prose-lg dark:prose-invert max-w-none
                  prose-headings:scroll-mt-20
                  prose-h1:text-3xl prose-h1:font-bold prose-h1:mt-8 prose-h1:mb-4
                  prose-h2:text-2xl prose-h2:font-bold prose-h2:mt-6 prose-h2:mb-3
                  prose-h3:text-xl prose-h3:font-bold prose-h3:mt-4 prose-h3:mb-2
                  prose-p:mb-4 prose-p:text-muted-foreground prose-p:leading-relaxed
                  prose-a:text-primary prose-a:hover:underline
                  prose-img:rounded-lg prose-img:shadow-lg prose-img:my-6
                  prose-table:border-collapse prose-table:w-full
                  prose-th:bg-slate-100 prose-th:dark:bg-slate-700 prose-th:p-3 prose-th:text-left prose-th:border prose-th:border-slate-200 prose-th:dark:border-slate-600
                  prose-td:p-3 prose-td:border prose-td:border-slate-200 prose-td:dark:border-slate-600
                  prose-figure:my-6 prose-figcaption:text-center prose-figcaption:text-sm prose-figcaption:text-muted-foreground prose-figcaption:mt-2
                  [&_.video-container]:my-6 [&_.video-container]:rounded-lg [&_.video-container]:overflow-hidden [&_.video-container]:shadow-lg"
                dangerouslySetInnerHTML={{ __html: sanitizedBody }}
              />

              {/* Social Share Buttons (Bottom of article) */}
              <div className="mt-8 pt-8 border-t border-slate-200 dark:border-slate-700">
                <h3 className="font-bold text-lg mb-4">Share this article</h3>
                <SocialShareButtons
                  url={postUrl}
                  title={post.title}
                />
              </div>

              {/* Author Bio */}
              {post.author && (
                <div className="mt-8 pt-8 border-t border-slate-200 dark:border-slate-700">
                  <div className="flex items-start gap-4">
                    <div className="h-16 w-16 rounded-full bg-gradient-to-br from-cyan-500 to-purple-500 flex items-center justify-center text-white text-xl font-bold">
                      {post.author.name.charAt(0)}
                    </div>
                    <div>
                      <Link 
                        to={`/blog/author/${post.author.slug?.current || 'bytecare'}`}
                        className="font-bold text-lg hover:text-primary transition-colors"
                      >
                        {post.author.name}
                      </Link>
                      {post.author.bio && (
                        <p className="text-muted-foreground mt-1">{post.author.bio}</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Links Section */}
              {((post.internalLinks && post.internalLinks.length > 0) || (post.externalLinks && post.externalLinks.length > 0)) && (
                <div className="mt-8 pt-8 border-t border-slate-200 dark:border-slate-700">
                  <h3 className="font-bold text-lg mb-4">Related Links</h3>
                  <div className="flex flex-wrap gap-3">
                    {post.internalLinks?.map((link, index) => (
                      <Link
                        key={`internal-${index}`}
                        to={link}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition-colors"
                      >
                        {link}
                      </Link>
                    ))}
                    {post.externalLinks?.map((link, index) => (
                      <a
                        key={`external-${index}`}
                        href={link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-700 text-foreground rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                      >
                        <ExternalLink className="h-4 w-4" />
                        {new URL(link).hostname}
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Related Posts */}
            {categoryIds.length > 0 && (
              <div className="mt-8">
                <RelatedPosts
                  currentPostId={post._id}
                  categoryIds={categoryIds}
                  className="backdrop-blur-lg bg-white/70 dark:bg-slate-800/70 border border-white/20 dark:border-slate-700/50 rounded-2xl shadow-xl p-8"
                />
              </div>
            )}

            {/* Comments Section */}
            <div className="mt-8">
              <div className="backdrop-blur-lg bg-white/70 dark:bg-slate-800/70 border border-white/20 dark:border-slate-700/50 rounded-2xl shadow-xl p-8">
                <Comments postId={post._id} />
              </div>
            </div>

            {/* Newsletter Subscribe */}
            <div className="mt-8">
              <NewsletterSubscribe />
            </div>

            {/* Back to Blog CTA */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.5 }}
              className="mt-8 text-center"
            >
              <Link to="/blog">
                <Button variant="outline" size="lg" className="gap-2">
                  <ArrowLeft className="h-4 w-4" />
                  {t('public.blog.backToBlog') || 'Back to All Posts'}
                </Button>
              </Link>
            </motion.div>
          </motion.article>
        </div>
      </section>
    </PublicLayout>
  )
}
