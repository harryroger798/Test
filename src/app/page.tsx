import { getAllPosts, getAllCategories } from '@/lib/sanity'
import { Post, Category } from '@/types/blog'
import BlogCard from '@/components/BlogCard'
import CTABanner from '@/components/CTABanner'
import Link from 'next/link'
import { MAIN_SITE_URL, SITE_NAME } from '@/lib/utils'

export default async function HomePage() {
  let posts: Post[] = []
  let categories: Category[] = []

  try {
    posts = await getAllPosts()
  } catch {
    posts = []
  }

  try {
    categories = await getAllCategories()
  } catch {
    categories = []
  }

  return (
    <>
      <section className="border-b border-brand-border bg-gradient-to-b from-brand-green/5 to-brand-dark px-4 py-16 md:py-24">
        <div className="mx-auto max-w-4xl text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-brand-green/20 bg-brand-green/10 px-4 py-1.5">
            <span className="h-2 w-2 rounded-full bg-brand-green"></span>
            <span className="text-sm text-brand-green">Expert AI Content Guides</span>
          </div>
          <h1 className="mb-6 text-4xl font-extrabold tracking-tight text-white md:text-5xl lg:text-6xl">
            Master AI Content with{' '}
            <span className="text-brand-green">TextShift</span>
          </h1>
          <p className="mx-auto mb-8 max-w-2xl text-lg text-brand-muted">
            Learn how to humanize AI text, bypass AI detectors, avoid plagiarism, and create
            authentic content. Expert tips from the team behind{' '}
            <a href={MAIN_SITE_URL} target="_blank" rel="noopener noreferrer" className="text-brand-green hover:underline">
              TextShift.org
            </a>.
          </p>
          <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
            <a
              href={`${MAIN_SITE_URL}/register`}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg bg-brand-green px-6 py-3 font-medium text-black transition-colors hover:bg-brand-green/90"
            >
              Try TextShift Free &rarr;
            </a>
            <Link
              href="/blog/"
              className="rounded-lg border border-brand-border px-6 py-3 font-medium text-white transition-colors hover:border-brand-green/50"
            >
              Browse Articles
            </Link>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4 py-12">
        {categories.length > 0 && (
          <div className="mb-12 flex flex-wrap items-center justify-center gap-2">
            <Link
              href="/blog/"
              className="rounded-full border border-brand-border px-4 py-2 text-sm text-gray-300 transition-colors hover:border-brand-green hover:text-brand-green"
            >
              All Posts
            </Link>
            {categories.map((cat) => (
              <Link
                key={cat._id}
                href={`/category/${cat.slug.current}/`}
                className="rounded-full border border-brand-border px-4 py-2 text-sm text-gray-300 transition-colors hover:border-brand-green hover:text-brand-green"
              >
                {cat.title}
              </Link>
            ))}
          </div>
        )}

        {posts.length > 0 ? (
          <>
            <h2 className="mb-8 text-2xl font-bold text-white">Latest Articles</h2>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {posts.map((post) => (
                <BlogCard key={post._id} post={post} />
              ))}
            </div>
          </>
        ) : (
          <div className="py-20 text-center">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" className="mx-auto mb-4 text-brand-green/30">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <h2 className="mb-3 text-2xl font-bold text-white">Coming Soon</h2>
            <p className="mx-auto max-w-md text-brand-muted">
              We&apos;re preparing expert guides on AI content detection, humanization, and writing tips.
              Check back soon or visit{' '}
              <a href={MAIN_SITE_URL} target="_blank" rel="noopener noreferrer" className="text-brand-green hover:underline">
                TextShift.org
              </a>{' '}
              to try our tools.
            </p>
          </div>
        )}

        <CTABanner />
      </div>
    </>
  )
}
