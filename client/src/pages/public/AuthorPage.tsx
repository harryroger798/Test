import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import { Calendar, ArrowLeft, User } from 'lucide-react'
import { PublicLayout } from '@/components/layout/PublicLayout'
import { getAuthorBySlug, getPostsByAuthor, type SanityAuthor, type SanityPost } from '@/lib/sanity'
import { SEOHead, Breadcrumbs } from '@/components/seo'

export function AuthorPage() {
  const { slug } = useParams<{ slug: string }>()
  const { t } = useTranslation()
  const [author, setAuthor] = useState<SanityAuthor | null>(null)
  const [posts, setPosts] = useState<SanityPost[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    async function fetchData() {
      if (!slug) return
      
      try {
        setError(null)
        const [authorData, postsData] = await Promise.all([
          getAuthorBySlug(slug),
          getPostsByAuthor(slug)
        ])
        setAuthor(authorData)
        setPosts(postsData)
      } catch (err) {
        setError(err as Error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [slug])

  if (loading) {
    return (
      <PublicLayout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </PublicLayout>
    )
  }

  if (error) {
    return (
      <PublicLayout>
        <div className="min-h-screen flex flex-col items-center justify-center">
          <h1 className="text-2xl font-bold mb-4">Error Loading Author</h1>
          <p className="text-muted-foreground mb-4">Failed to load author data. Please try again later.</p>
          <Link to="/blog" className="text-primary hover:underline">
            Back to Blog
          </Link>
        </div>
      </PublicLayout>
    )
  }

  if (!author) {
    return (
      <PublicLayout>
        <div className="min-h-screen flex flex-col items-center justify-center">
          <h1 className="text-2xl font-bold mb-4">Author Not Found</h1>
          <Link to="/blog" className="text-primary hover:underline">
            Back to Blog
          </Link>
        </div>
      </PublicLayout>
    )
  }

  const breadcrumbItems = [
    { name: 'Home', url: '/' },
    { name: 'Blog', url: '/blog' },
    { name: author.name, url: `/blog/author/${slug}` }
  ]

  return (
    <PublicLayout>
      <SEOHead
        title={`${author.name} - Author at ByteCare Blog`}
        description={author.bio || `Read articles by ${author.name} on ByteCare Blog`}
        url={`https://bytecare.shop/blog/author/${slug}`}
        type="website"
      />

      <div className="bg-gradient-to-b from-primary/5 to-background">
        <div className="container mx-auto px-4 py-8">
          <Breadcrumbs items={breadcrumbItems} />

          <Link
            to="/blog"
            className="inline-flex items-center text-primary hover:underline mb-6"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            {t('public.blog.backToBlog', 'Back to All Posts')}
          </Link>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-card rounded-xl p-8 shadow-lg mb-8"
          >
            <div className="flex items-center gap-6">
              <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center">
                {author.image?.url ? (
                  <img
                    src={author.image.url}
                    alt={author.name}
                    className="w-24 h-24 rounded-full object-cover"
                  />
                ) : (
                  <User className="w-12 h-12 text-primary" />
                )}
              </div>
              <div>
                <h1 className="text-3xl font-bold mb-2">{author.name}</h1>
                {author.bio && (
                  <p className="text-muted-foreground">{author.bio}</p>
                )}
                <p className="text-sm text-muted-foreground mt-2">
                  {posts.length} {posts.length === 1 ? 'article' : 'articles'} published
                </p>
              </div>
            </div>
          </motion.div>

          <h2 className="text-2xl font-bold mb-6">
            Articles by {author.name}
          </h2>

          {posts.length === 0 ? (
            <p className="text-muted-foreground">No articles found.</p>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {posts.map((post, index) => (
                <motion.article
                  key={post._id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="bg-card rounded-xl overflow-hidden shadow-lg hover:shadow-xl transition-shadow"
                >
                  <Link to={`/blog/${post.slug.current}`}>
                    {post.featuredImage?.url && (
                      <img
                        src={post.featuredImage.url}
                        alt={post.featuredImage.alt || post.title}
                        className="w-full h-48 object-cover"
                      />
                    )}
                    <div className="p-6">
                      <h3 className="text-xl font-semibold mb-2 hover:text-primary transition-colors">
                        {post.title}
                      </h3>
                      {post.excerpt && (
                        <p className="text-muted-foreground text-sm mb-4 line-clamp-2">
                          {post.excerpt}
                        </p>
                      )}
                      <div className="flex items-center text-sm text-muted-foreground">
                        <Calendar className="w-4 h-4 mr-1" />
                        {new Date(post.publishedAt).toLocaleDateString('en-IN', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}
                      </div>
                    </div>
                  </Link>
                </motion.article>
              ))}
            </div>
          )}
        </div>
      </div>
    </PublicLayout>
  )
}
