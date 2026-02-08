export interface Post {
  _id: string
  title: string
  slug: { current: string }
  excerpt: string
  body?: string
  publishedAt: string
  author: Author
  category: Category
  featuredImage: string | null
  featuredImageAlt: string
  metaTitle?: string
  metaDescription?: string
  focusKeyword?: string
  keywords?: string[]
  language?: string
}

export interface Author {
  _id?: string
  name: string
  slug: { current: string }
  bio?: string
  image?: unknown
  imageUrl?: string
}

export interface Category {
  _id?: string
  title: string
  slug: { current: string }
  description?: string
}
