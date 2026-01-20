import { createClient } from '@sanity/client'

export const sanityClient = createClient({
  projectId: '75uz5ykn',
  dataset: 'production',
  apiVersion: '2024-01-01',
  useCdn: false, // Disable CDN to get fresh data immediately
})

export interface SanityPost {
  _id: string
  title: string
  slug: { current: string }
  body: string
  excerpt: string
  status: string
  publishedAt: string
  featuredImage?: {
    url: string
    alt: string
  }
  seo?: {
    metaTitle: string
    metaDescription: string
    keywords: string[]
  }
  author?: {
    _id: string
    name: string
    slug: { current: string }
    bio: string
  }
  categories?: Array<{
    _id: string
    title: string
    slug: { current: string }
  }>
  internalLinks?: string[]
  externalLinks?: string[]
}

export async function getAllPosts(): Promise<SanityPost[]> {
  const query = `*[_type == "post" && status == "published"] | order(publishedAt desc) {
    _id,
    title,
    slug,
    body,
    excerpt,
    status,
    publishedAt,
    featuredImage,
    seo,
    "author": author->{_id, name, slug, bio},
    "categories": categories[]->{_id, title, slug},
    internalLinks,
    externalLinks
  }`
  
  return sanityClient.fetch(query)
}

export async function getAllPostsIncludingDrafts(): Promise<SanityPost[]> {
  const query = `*[_type == "post"] | order(publishedAt desc) {
    _id,
    title,
    slug,
    body,
    excerpt,
    status,
    publishedAt,
    featuredImage,
    seo,
    "author": author->{_id, name, slug, bio},
    "categories": categories[]->{_id, title, slug},
    internalLinks,
    externalLinks
  }`
  
  return sanityClient.fetch(query)
}

export async function getPostBySlug(slug: string): Promise<SanityPost | null> {
  const query = `*[_type == "post" && slug.current == $slug][0] {
    _id,
    title,
    slug,
    body,
    excerpt,
    status,
    publishedAt,
    featuredImage,
    seo,
    "author": author->{_id, name, slug, bio},
    "categories": categories[]->{_id, title, slug},
    internalLinks,
    externalLinks
  }`
  
  return sanityClient.fetch(query, { slug })
}

export async function getRelatedPosts(currentPostId: string, categoryIds: string[], limit: number = 3): Promise<SanityPost[]> {
  const query = `*[_type == "post" && status == "published" && _id != $currentPostId && count((categories[]._ref)[@ in $categoryIds]) > 0] | order(publishedAt desc) [0...$limit] {
    _id,
    title,
    slug,
    excerpt,
    publishedAt,
    featuredImage,
    "categories": categories[]->{_id, title, slug}
  }`
  
  return sanityClient.fetch(query, { currentPostId, categoryIds, limit })
}

export interface SanityAuthor {
  _id: string
  name: string
  slug: { current: string }
  bio: string
  image?: {
    url: string
    alt: string
  }
}

export interface SanityCategory {
  _id: string
  title: string
  slug: { current: string }
  description?: string
}

export async function getAuthorBySlug(slug: string): Promise<SanityAuthor | null> {
  const query = `*[_type == "author" && slug.current == $slug][0] {
    _id,
    name,
    slug,
    bio,
    "image": {
      "url": image.asset->url,
      "alt": image.alt
    }
  }`
  
  return sanityClient.fetch(query, { slug })
}

export async function getPostsByAuthor(authorSlug: string): Promise<SanityPost[]> {
  const query = `*[_type == "post" && status == "published" && author->slug.current == $authorSlug] | order(publishedAt desc) {
    _id,
    title,
    slug,
    body,
    excerpt,
    status,
    publishedAt,
    featuredImage,
    seo,
    "author": author->{_id, name, slug, bio},
    "categories": categories[]->{_id, title, slug},
    internalLinks,
    externalLinks
  }`
  
  return sanityClient.fetch(query, { authorSlug })
}

export async function getCategoryBySlug(slug: string): Promise<SanityCategory | null> {
  const query = `*[_type == "category" && slug.current == $slug][0] {
    _id,
    title,
    slug,
    description
  }`
  
  return sanityClient.fetch(query, { slug })
}

export async function getPostsByCategory(categorySlug: string): Promise<SanityPost[]> {
  const query = `*[_type == "post" && status == "published" && $categorySlug in categories[]->slug.current] | order(publishedAt desc) {
    _id,
    title,
    slug,
    body,
    excerpt,
    status,
    publishedAt,
    featuredImage,
    seo,
    "author": author->{_id, name, slug, bio},
    "categories": categories[]->{_id, title, slug},
    internalLinks,
    externalLinks
  }`
  
  return sanityClient.fetch(query, { categorySlug })
}

export async function getAllAuthors(): Promise<SanityAuthor[]> {
  const query = `*[_type == "author"] | order(name asc) {
    _id,
    name,
    slug,
    bio,
    "image": {
      "url": image.asset->url,
      "alt": image.alt
    }
  }`
  
  return sanityClient.fetch(query)
}

export async function getAllCategories(): Promise<SanityCategory[]> {
  const query = `*[_type == "category"] | order(title asc) {
    _id,
    title,
    slug,
    description
  }`
  
  return sanityClient.fetch(query)
}
