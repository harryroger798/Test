import { getAllPosts, getAllCategories } from '@/lib/sanity'
import { Post, Category } from '@/types/blog'
import BlogCard from '@/components/BlogCard'
import CTABanner from '@/components/CTABanner'
import Link from 'next/link'
import type { Metadata } from 'next'
import { SITE_NAME } from '@/lib/utils'

export const metadata: Metadata = {
  title: `All Articles | ${SITE_NAME}`,
  description: 'Browse all articles on AI content detection, humanization, writing tips, and more from the TextShift team.',
}

export default async function BlogIndexPage() {
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
    <div className="mx-auto max-w-6xl px-4 py-12">
      <div className="mb-10">
        <h1 className="mb-3 text-3xl font-bold text-white md:text-4xl">All Articles</h1>
        <p className="text-brand-muted">
          Expert guides on AI content, detection tools, humanization techniques, and writing tips.
        </p>
      </div>

      {categories.length > 0 && (
        <div className="mb-10 flex flex-wrap gap-2">
          <Link
            href="/blog/"
            className="rounded-full bg-brand-green px-4 py-2 text-sm font-medium text-black"
          >
            All
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
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {posts.map((post) => (
            <BlogCard key={post._id} post={post} />
          ))}
        </div>
      ) : (
        <div className="py-16 text-center">
          <h2 className="mb-3 text-xl font-bold text-white">No articles yet</h2>
          <p className="text-brand-muted">Content is being prepared. Check back soon!</p>
        </div>
      )}

      <CTABanner />
    </div>
  )
}
