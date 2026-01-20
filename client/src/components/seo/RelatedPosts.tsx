import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Calendar, ArrowRight } from 'lucide-react'
import { motion } from 'framer-motion'
import { getRelatedPosts, type SanityPost } from '@/lib/sanity'

interface RelatedPostsProps {
  currentPostId: string
  categoryIds: string[]
  className?: string
}

export function RelatedPosts({ currentPostId, categoryIds, className = '' }: RelatedPostsProps) {
  const [posts, setPosts] = useState<SanityPost[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchRelatedPosts() {
      setLoading(true)
      if (!categoryIds.length) {
        setPosts([])
        setLoading(false)
        return
      }

      try {
        const relatedPosts = await getRelatedPosts(currentPostId, categoryIds, 3)
        setPosts(relatedPosts)
      } catch (error) {
        setPosts([])
      } finally {
        setLoading(false)
      }
    }

    fetchRelatedPosts()
  }, [currentPostId, categoryIds])

  if (loading) {
    return (
      <div className={`${className}`}>
        <h3 className="text-xl font-bold mb-6">Related Articles</h3>
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse">
              <div className="bg-slate-200 dark:bg-slate-700 h-32 rounded-lg mb-3" />
              <div className="bg-slate-200 dark:bg-slate-700 h-4 rounded w-3/4 mb-2" />
              <div className="bg-slate-200 dark:bg-slate-700 h-3 rounded w-1/2" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (posts.length === 0) {
    return null
  }

  return (
    <div className={`${className}`}>
      <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
        <span className="bg-gradient-to-r from-primary to-purple-500 bg-clip-text text-transparent">
          Related Articles
        </span>
      </h3>
      <div className="grid gap-4 md:grid-cols-3">
        {posts.map((post, index) => (
          <motion.article
            key={post._id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: index * 0.1 }}
            className="group"
          >
            <Link to={`/blog/${post.slug.current}`}>
              <div className="relative h-32 rounded-lg overflow-hidden mb-3">
                <img
                  src={post.featuredImage?.url || '/images/blog-tech-tips.png'}
                  alt={post.featuredImage?.alt || post.title}
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
              </div>
              <h4 className="font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-2 mb-2">
                {post.title}
              </h4>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Calendar className="h-3 w-3" />
                {new Date(post.publishedAt).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric'
                })}
              </div>
              <span className="inline-flex items-center gap-1 text-xs text-primary mt-2 group-hover:gap-2 transition-all">
                Read more <ArrowRight className="h-3 w-3" />
              </span>
            </Link>
          </motion.article>
        ))}
      </div>
    </div>
  )
}
