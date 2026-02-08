import { getCategoryBySlug, getPostsByCategory, getAllCategorySlugs } from '@/lib/sanity'
import { Post, Category } from '@/types/blog'
import BlogCard from '@/components/BlogCard'
import CTABanner from '@/components/CTABanner'
import Link from 'next/link'
import type { Metadata } from 'next'
import { SITE_NAME } from '@/lib/utils'

export const dynamicParams = false

export async function generateStaticParams() {
  try {
    const slugs = await getAllCategorySlugs()
    if (slugs && slugs.length > 0) {
      return slugs.map((s: { slug: string }) => ({ slug: s.slug }))
    }
  } catch (e) {
    console.error('Failed to fetch category slugs:', e)
  }
  return [{ slug: '__placeholder' }]
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  try {
    const category: Category = await getCategoryBySlug(params.slug)
    if (!category) return { title: 'Category Not Found' }
    return {
      title: `${category.title} | ${SITE_NAME}`,
      description: category.description || `Browse all ${category.title} articles on ${SITE_NAME}.`,
    }
  } catch {
    return { title: 'Category Not Found' }
  }
}

export default async function CategoryPage({ params }: { params: { slug: string } }) {
  let category: Category | null = null
  let posts: Post[] = []

  try {
    category = await getCategoryBySlug(params.slug)
    posts = await getPostsByCategory(params.slug)
  } catch {
    category = null
    posts = []
  }

  if (!category) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 text-center">
        <h1 className="mb-4 text-3xl font-bold text-white">Category Not Found</h1>
        <Link href="/" className="text-brand-green hover:underline">&larr; Back to Blog</Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <div className="mb-10">
        <Link href="/" className="mb-4 inline-block text-sm text-brand-muted hover:text-brand-green">
          &larr; Back to Blog
        </Link>
        <h1 className="mb-2 text-3xl font-bold text-white md:text-4xl">{category.title}</h1>
        {category.description && (
          <p className="text-brand-muted">{category.description}</p>
        )}
        <p className="mt-2 text-sm text-brand-muted">{posts.length} article{posts.length !== 1 ? 's' : ''}</p>
      </div>

      {posts.length > 0 ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {posts.map((post) => (
            <BlogCard key={post._id} post={post} />
          ))}
        </div>
      ) : (
        <div className="py-16 text-center">
          <h2 className="mb-3 text-xl font-bold text-white">No articles in this category yet</h2>
          <p className="text-brand-muted">Check back soon!</p>
        </div>
      )}

      <CTABanner />
    </div>
  )
}
