import { createClient } from '@sanity/client'

export const client = createClient({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || 'mavn812v',
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET || 'production',
  apiVersion: '2024-01-01',
  useCdn: false,
})

export async function getAllPosts() {
  return client.fetch(
    `*[_type == "post"] | order(publishedAt desc) {
      _id,
      title,
      slug,
      excerpt,
      publishedAt,
      "author": author->{name, slug, image},
      "category": category->{title, slug},
      "featuredImage": featuredImage.asset->url,
      featuredImageAlt,
      metaTitle,
      metaDescription
    }`
  )
}

export async function getPostBySlug(slug: string) {
  return client.fetch(
    `*[_type == "post" && slug.current == $slug][0] {
      _id,
      title,
      slug,
      excerpt,
      body,
      publishedAt,
      "author": author->{name, slug, bio, image, "imageUrl": image.asset->url},
      "category": category->{title, slug},
      "featuredImage": featuredImage.asset->url,
      featuredImageAlt,
      metaTitle,
      metaDescription,
      focusKeyword,
      keywords,
      language
    }`,
    { slug }
  )
}

export async function getPostsByCategory(categorySlug: string) {
  return client.fetch(
    `*[_type == "post" && category->slug.current == $categorySlug] | order(publishedAt desc) {
      _id,
      title,
      slug,
      excerpt,
      publishedAt,
      "author": author->{name, slug, image},
      "category": category->{title, slug},
      "featuredImage": featuredImage.asset->url,
      featuredImageAlt
    }`,
    { categorySlug }
  )
}

export async function getPostsByAuthor(authorSlug: string) {
  return client.fetch(
    `*[_type == "post" && author->slug.current == $authorSlug] | order(publishedAt desc) {
      _id,
      title,
      slug,
      excerpt,
      publishedAt,
      "author": author->{name, slug, image},
      "category": category->{title, slug},
      "featuredImage": featuredImage.asset->url,
      featuredImageAlt
    }`,
    { authorSlug }
  )
}

export async function getAllCategories() {
  return client.fetch(
    `*[_type == "category"] | order(title asc) {
      _id,
      title,
      slug,
      description
    }`
  )
}

export async function getCategoryBySlug(slug: string) {
  return client.fetch(
    `*[_type == "category" && slug.current == $slug][0] {
      _id,
      title,
      slug,
      description
    }`,
    { slug }
  )
}

export async function getAuthorBySlug(slug: string) {
  return client.fetch(
    `*[_type == "author" && slug.current == $slug][0] {
      _id,
      name,
      slug,
      bio,
      "imageUrl": image.asset->url
    }`,
    { slug }
  )
}

export async function getAllAuthors() {
  return client.fetch(
    `*[_type == "author"] {
      _id,
      name,
      slug,
      bio,
      "imageUrl": image.asset->url
    }`
  )
}

export async function getAllSlugs() {
  return client.fetch(
    `*[_type == "post" && defined(slug.current)]{
      "slug": slug.current
    }`
  )
}

export async function getAllCategorySlugs() {
  return client.fetch(
    `*[_type == "category" && defined(slug.current)]{
      "slug": slug.current
    }`
  )
}

export async function getAllAuthorSlugs() {
  return client.fetch(
    `*[_type == "author" && defined(slug.current)]{
      "slug": slug.current
    }`
  )
}

export async function getRecentPosts(limit: number = 5) {
  return client.fetch(
    `*[_type == "post"] | order(publishedAt desc) [0...$limit] {
      _id,
      title,
      slug,
      excerpt,
      publishedAt,
      "author": author->{name, slug},
      "category": category->{title, slug},
      "featuredImage": featuredImage.asset->url,
      featuredImageAlt
    }`,
    { limit }
  )
}
