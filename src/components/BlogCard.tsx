import Link from 'next/link'
import { Post } from '@/types/blog'
import { formatDate, estimateReadingTime } from '@/lib/utils'

export default function BlogCard({ post }: { post: Post }) {
  const readTime = post.body ? estimateReadingTime(post.body) : 3

  return (
    <article className="group overflow-hidden rounded-xl border border-brand-border bg-brand-card transition-all hover:border-brand-green/30">
      <Link href={`/blog/${post.slug.current}/`}>
        {post.featuredImage ? (
          <div className="aspect-video overflow-hidden">
            <img
              src={post.featuredImage}
              alt={post.featuredImageAlt || post.title}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
              loading="lazy"
            />
          </div>
        ) : (
          <div className="flex aspect-video items-center justify-center bg-gradient-to-br from-brand-green/10 to-brand-green/5">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" className="text-brand-green/30">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        )}
      </Link>

      <div className="p-5">
        <div className="mb-3 flex items-center gap-3">
          {post.category && (
            <Link
              href={`/category/${post.category.slug.current}/`}
              className="rounded-full bg-brand-green/10 px-3 py-1 text-xs font-medium text-brand-green transition-colors hover:bg-brand-green/20"
            >
              {post.category.title}
            </Link>
          )}
          <span className="text-xs text-brand-muted">{readTime} min read</span>
        </div>

        <Link href={`/blog/${post.slug.current}/`}>
          <h2 className="mb-2 text-lg font-semibold text-white transition-colors group-hover:text-brand-green">
            {post.title}
          </h2>
        </Link>

        {post.excerpt && (
          <p className="mb-4 line-clamp-2 text-sm text-brand-muted">{post.excerpt}</p>
        )}

        <div className="flex items-center justify-between text-xs text-brand-muted">
          <div className="flex items-center gap-2">
            {post.author && (
              <>
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-green/20 text-brand-green">
                  {post.author.name?.charAt(0) || 'A'}
                </div>
                <span>{post.author.name}</span>
              </>
            )}
          </div>
          {post.publishedAt && <time>{formatDate(post.publishedAt)}</time>}
        </div>
      </div>
    </article>
  )
}
