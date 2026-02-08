import { getPostBySlug, getAllSlugs } from '@/lib/sanity'
import { Post } from '@/types/blog'
import PostBody from '@/components/PostBody'
import CTABanner from '@/components/CTABanner'
import Link from 'next/link'
import { formatDate, estimateReadingTime, SITE_URL, SITE_NAME, MAIN_SITE_URL } from '@/lib/utils'
import type { Metadata } from 'next'

export const dynamicParams = false

export async function generateStaticParams() {
  try {
    const slugs = await getAllSlugs()
    if (slugs && slugs.length > 0) {
      return slugs.map((s: { slug: string }) => ({ slug: s.slug }))
    }
  } catch (e) {
    console.error('Failed to fetch post slugs:', e)
  }
  return [{ slug: '__placeholder' }]
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  try {
    const post: Post = await getPostBySlug(params.slug)
    if (!post) return { title: 'Post Not Found' }

    const title = post.metaTitle || post.title
    const description = post.metaDescription || post.excerpt

    return {
      title,
      description,
      keywords: post.keywords?.join(', '),
      openGraph: {
        title,
        description,
        type: 'article',
        publishedTime: post.publishedAt,
        url: `${SITE_URL}/blog/${post.slug.current}/`,
        siteName: SITE_NAME,
        images: post.featuredImage ? [{ url: post.featuredImage, width: 1200, height: 630, alt: post.featuredImageAlt || post.title }] : [],
      },
      twitter: {
        card: 'summary_large_image',
        title,
        description,
        images: post.featuredImage ? [post.featuredImage] : [],
      },
    }
  } catch {
    return { title: 'Post Not Found' }
  }
}

export default async function BlogPostPage({ params }: { params: { slug: string } }) {
  let post: Post | null = null

  try {
    post = await getPostBySlug(params.slug)
  } catch {
    post = null
  }

  if (!post) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 text-center">
        <h1 className="mb-4 text-3xl font-bold text-white">Post Not Found</h1>
        <p className="mb-6 text-brand-muted">The article you&apos;re looking for doesn&apos;t exist.</p>
        <Link href="/" className="text-brand-green hover:underline">
          &larr; Back to Blog
        </Link>
      </div>
    )
  }

  const readTime = post.body ? estimateReadingTime(post.body) : 3

  const articleSchema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: post.excerpt,
    image: post.featuredImage || undefined,
    datePublished: post.publishedAt,
    author: {
      '@type': 'Person',
      name: post.author?.name,
    },
    publisher: {
      '@type': 'Organization',
      name: 'TextShift',
      url: MAIN_SITE_URL,
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': `${SITE_URL}/blog/${post.slug.current}/`,
    },
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }}
      />

      <article className="mx-auto max-w-4xl px-4 py-10">
        <div className="mb-8">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <Link href="/" className="text-sm text-brand-muted hover:text-brand-green">
              &larr; Blog
            </Link>
            {post.category && (
              <>
                <span className="text-brand-muted">/</span>
                <Link
                  href={`/category/${post.category.slug.current}/`}
                  className="rounded-full bg-brand-green/10 px-3 py-1 text-xs font-medium text-brand-green hover:bg-brand-green/20"
                >
                  {post.category.title}
                </Link>
              </>
            )}
          </div>

          <h1 className="mb-4 text-3xl font-extrabold text-white md:text-4xl lg:text-5xl">
            {post.title}
          </h1>

          {post.excerpt && (
            <p className="mb-6 text-lg text-brand-muted">{post.excerpt}</p>
          )}

          <div className="flex flex-wrap items-center gap-4 border-b border-brand-border pb-6 text-sm text-brand-muted">
            {post.author && (
              <Link href={`/author/${post.author.slug.current}/`} className="flex items-center gap-2 hover:text-brand-green">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-green/20 text-sm font-bold text-brand-green">
                  {post.author.name?.charAt(0) || 'A'}
                </div>
                <span>{post.author.name}</span>
              </Link>
            )}
            {post.publishedAt && (
              <time className="flex items-center gap-1">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" />
                </svg>
                {formatDate(post.publishedAt)}
              </time>
            )}
            <span className="flex items-center gap-1">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2zM22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z" />
              </svg>
              {readTime} min read
            </span>
          </div>
        </div>

        {post.featuredImage && (
          <figure className="mb-10 overflow-hidden rounded-xl">
            <img
              src={post.featuredImage}
              alt={post.featuredImageAlt || post.title}
              className="w-full object-cover"
            />
            {post.featuredImageAlt && (
              <figcaption className="mt-2 text-center text-sm text-brand-muted">
                {post.featuredImageAlt}
              </figcaption>
            )}
          </figure>
        )}

        {post.body && <PostBody content={post.body} />}

        <div className="mt-12 border-t border-brand-border pt-8">
          {post.keywords && post.keywords.length > 0 && (
            <div className="mb-6 flex flex-wrap gap-2">
              {post.keywords.map((kw, i) => (
                <span
                  key={i}
                  className="rounded-full border border-brand-border px-3 py-1 text-xs text-brand-muted"
                >
                  {kw}
                </span>
              ))}
            </div>
          )}

          {post.author && (
            <div className="rounded-xl border border-brand-border bg-brand-card p-6">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-green/20 text-lg font-bold text-brand-green">
                  {post.author.name?.charAt(0) || 'A'}
                </div>
                <div>
                  <Link href={`/author/${post.author.slug.current}/`} className="font-semibold text-white hover:text-brand-green">
                    {post.author.name}
                  </Link>
                  {post.author.bio && (
                    <p className="mt-1 text-sm text-brand-muted">{post.author.bio}</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        <CTABanner />
      </article>
    </>
  )
}
