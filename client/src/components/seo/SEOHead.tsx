import { useEffect } from 'react'
import {
  SEOData,
  updateMetaTags,
  addMultipleSchemasToPage,
  generateLocalBusinessSchema,
  generateOrganizationSchema,
  generateWebsiteSchema,
  generateBlogPostingSchema,
  generateBreadcrumbSchema,
  BYTECARE_BUSINESS,
  BreadcrumbItem,
  ArticleData
} from '@/lib/seo'

interface SEOHeadProps {
  title: string
  description: string
  keywords?: string[]
  image?: string
  imageAlt?: string
  url: string
  type?: 'website' | 'article' | 'local_business'
  author?: string
  publishedAt?: string
  modifiedAt?: string
  section?: string
  tags?: string[]
  breadcrumbs?: BreadcrumbItem[]
  includeLocalBusiness?: boolean
  articleData?: Partial<ArticleData>
}

export function SEOHead({
  title,
  description,
  keywords,
  image,
  imageAlt,
  url,
  type = 'website',
  author,
  publishedAt,
  modifiedAt,
  section,
  tags,
  breadcrumbs,
  includeLocalBusiness = false,
  articleData
}: SEOHeadProps) {
  useEffect(() => {
    const fullTitle = title.includes('ByteCare') ? title : `${title} | ByteCare`
    const fullUrl = url.startsWith('http') ? url : `https://bytecare.shop${url}`
    const fullImage = image?.startsWith('http') ? image : image ? `https://bytecare.shop${image}` : 'https://bytecare.shop/images/hero-background.png'

    const seoData: SEOData = {
      title: fullTitle,
      description,
      keywords,
      image: fullImage,
      imageAlt: imageAlt || title,
      url: fullUrl,
      type,
      author,
      publishedAt,
      modifiedAt,
      section,
      tags
    }

    updateMetaTags(seoData)

    const schemas: object[] = []

    schemas.push(generateWebsiteSchema(BYTECARE_BUSINESS))
    schemas.push(generateOrganizationSchema(BYTECARE_BUSINESS))

    if (includeLocalBusiness) {
      schemas.push(generateLocalBusinessSchema(BYTECARE_BUSINESS))
    }

    if (breadcrumbs && breadcrumbs.length > 0) {
      const fullBreadcrumbs = breadcrumbs.map(item => ({
        name: item.name,
        url: item.url.startsWith('http') ? item.url : `https://bytecare.shop${item.url}`
      }))
      schemas.push(generateBreadcrumbSchema(fullBreadcrumbs))
    }

    if (type === 'article' && articleData) {
      const datePublishedValue = articleData.datePublished || publishedAt
      if (!datePublishedValue) {
        console.warn('SEOHead: publishedAt is missing for article type. Using current date as fallback.')
      }
      const fullArticleData: ArticleData = {
        headline: articleData.headline || title,
        description: articleData.description || description,
        image: fullImage,
        author: articleData.author || {
          name: author || 'ByteCare Team',
          url: `https://bytecare.shop/blog/author/${author?.toLowerCase().replace(/\s+/g, '-') || 'bytecare'}`
        },
        publisher: articleData.publisher || {
          name: 'ByteCare',
          logo: 'https://bytecare.shop/images/favicon.png'
        },
        datePublished: datePublishedValue || new Date().toISOString(),
        dateModified: articleData.dateModified || modifiedAt,
        mainEntityOfPage: fullUrl
      }
      schemas.push(generateBlogPostingSchema(fullArticleData))
    }

    addMultipleSchemasToPage(schemas)

    return () => {
      document.querySelectorAll('script[data-schema="true"]').forEach(el => el.remove())
    }
  }, [title, description, keywords, image, imageAlt, url, type, author, publishedAt, modifiedAt, section, tags, breadcrumbs, includeLocalBusiness, articleData])

  return null
}
