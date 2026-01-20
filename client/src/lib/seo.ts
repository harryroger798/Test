export interface SEOData {
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
}

export interface LocalBusinessData {
  name: string
  description: string
  url: string
  logo: string
  image: string
  telephone: string
  email: string
  address: {
    streetAddress: string
    addressLocality: string
    addressRegion: string
    postalCode: string
    addressCountry: string
  }
  geo: {
    latitude: number
    longitude: number
  }
  openingHours: string[]
  priceRange: string
  sameAs: string[]
}

export interface ArticleData {
  headline: string
  description: string
  image: string
  author: {
    name: string
    url?: string
  }
  publisher: {
    name: string
    logo: string
  }
  datePublished: string
  dateModified?: string
  mainEntityOfPage: string
}

export interface BreadcrumbItem {
  name: string
  url: string
}

export const BYTECARE_BUSINESS: LocalBusinessData = {
  name: 'ByteCare',
  description: 'Professional laptop, mobile, and PC repair services in Barrackpore, West Bengal. Expert technicians with 12+ years of experience. Same-day repairs available.',
  url: 'https://bytecare.shop',
  logo: 'https://bytecare.shop/images/favicon.png',
  image: 'https://bytecare.shop/images/hero-background.png',
  telephone: '+91-98765-43210',
  email: 'harryroger798@gmail.com',
  address: {
    streetAddress: 'Barrackpore',
    addressLocality: 'Barrackpore',
    addressRegion: 'West Bengal',
    postalCode: '700120',
    addressCountry: 'IN'
  },
  geo: {
    latitude: 22.7647,
    longitude: 88.3697
  },
  openingHours: [
    'Mo-Sa 09:00-20:00'
  ],
  priceRange: '$$',
  sameAs: [
    'https://facebook.com/bytecare',
    'https://instagram.com/bytecare',
    'https://twitter.com/bytecare'
  ]
}

export function generateLocalBusinessSchema(business: LocalBusinessData): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    '@id': `${business.url}/#localbusiness`,
    name: business.name,
    description: business.description,
    url: business.url,
    logo: {
      '@type': 'ImageObject',
      url: business.logo
    },
    image: business.image,
    telephone: business.telephone,
    email: business.email,
    address: {
      '@type': 'PostalAddress',
      streetAddress: business.address.streetAddress,
      addressLocality: business.address.addressLocality,
      addressRegion: business.address.addressRegion,
      postalCode: business.address.postalCode,
      addressCountry: business.address.addressCountry
    },
    geo: {
      '@type': 'GeoCoordinates',
      latitude: business.geo.latitude,
      longitude: business.geo.longitude
    },
    openingHoursSpecification: business.openingHours.map(hours => ({
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: hours.split(' ')[0],
      opens: hours.split(' ')[1]?.split('-')[0],
      closes: hours.split(' ')[1]?.split('-')[1]
    })),
    priceRange: business.priceRange,
    sameAs: business.sameAs,
    areaServed: {
      '@type': 'City',
      name: 'Barrackpore'
    },
    serviceArea: {
      '@type': 'GeoCircle',
      geoMidpoint: {
        '@type': 'GeoCoordinates',
        latitude: business.geo.latitude,
        longitude: business.geo.longitude
      },
      geoRadius: '20000'
    }
  }
}

export function generateOrganizationSchema(business: LocalBusinessData): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${business.url}/#organization`,
    name: business.name,
    url: business.url,
    logo: business.logo,
    contactPoint: {
      '@type': 'ContactPoint',
      telephone: business.telephone,
      contactType: 'customer service',
      availableLanguage: ['English', 'Hindi', 'Bengali']
    },
    sameAs: business.sameAs
  }
}

export function generateArticleSchema(article: ArticleData): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: article.headline,
    description: article.description,
    image: article.image,
    author: {
      '@type': 'Person',
      name: article.author.name,
      url: article.author.url
    },
    publisher: {
      '@type': 'Organization',
      name: article.publisher.name,
      logo: {
        '@type': 'ImageObject',
        url: article.publisher.logo
      }
    },
    datePublished: article.datePublished,
    dateModified: article.dateModified || article.datePublished,
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': article.mainEntityOfPage
    }
  }
}

export function generateBlogPostingSchema(article: ArticleData): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: article.headline,
    description: article.description,
    image: article.image,
    author: {
      '@type': 'Person',
      name: article.author.name,
      url: article.author.url
    },
    publisher: {
      '@type': 'Organization',
      name: article.publisher.name,
      logo: {
        '@type': 'ImageObject',
        url: article.publisher.logo
      }
    },
    datePublished: article.datePublished,
    dateModified: article.dateModified || article.datePublished,
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': article.mainEntityOfPage
    }
  }
}

export function generateBreadcrumbSchema(items: BreadcrumbItem[]): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url
    }))
  }
}

export function generateFAQSchema(faqs: Array<{ question: string; answer: string }>): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map(faq => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer
      }
    }))
  }
}

export function generateHowToSchema(howTo: {
  name: string
  description: string
  totalTime?: string
  steps: Array<{ name: string; text: string; image?: string }>
}): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: howTo.name,
    description: howTo.description,
    totalTime: howTo.totalTime,
    step: howTo.steps.map((step, index) => ({
      '@type': 'HowToStep',
      position: index + 1,
      name: step.name,
      text: step.text,
      image: step.image
    }))
  }
}

export function generateWebsiteSchema(business: LocalBusinessData): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${business.url}/#website`,
    url: business.url,
    name: business.name,
    description: business.description,
    publisher: {
      '@id': `${business.url}/#organization`
    },
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${business.url}/blog?search={search_term_string}`
      },
      'query-input': 'required name=search_term_string'
    }
  }
}

export function updateMetaTags(seo: SEOData): void {
  document.title = seo.title

  const updateOrCreateMeta = (name: string, content: string, property = false) => {
    const attr = property ? 'property' : 'name'
    let meta = document.querySelector(`meta[${attr}="${name}"]`) as HTMLMetaElement
    if (!meta) {
      meta = document.createElement('meta')
      meta.setAttribute(attr, name)
      document.head.appendChild(meta)
    }
    meta.content = content
  }

  updateOrCreateMeta('description', seo.description)
  if (seo.keywords?.length) {
    updateOrCreateMeta('keywords', seo.keywords.join(', '))
  }

  updateOrCreateMeta('og:title', seo.title, true)
  updateOrCreateMeta('og:description', seo.description, true)
  updateOrCreateMeta('og:url', seo.url, true)
  updateOrCreateMeta('og:type', seo.type === 'article' ? 'article' : 'website', true)
  updateOrCreateMeta('og:site_name', 'ByteCare', true)
  if (seo.image) {
    updateOrCreateMeta('og:image', seo.image, true)
    updateOrCreateMeta('og:image:width', '1200', true)
    updateOrCreateMeta('og:image:height', '630', true)
    if (seo.imageAlt) {
      updateOrCreateMeta('og:image:alt', seo.imageAlt, true)
    }
  }

  updateOrCreateMeta('twitter:card', 'summary_large_image')
  updateOrCreateMeta('twitter:title', seo.title)
  updateOrCreateMeta('twitter:description', seo.description)
  if (seo.image) {
    updateOrCreateMeta('twitter:image', seo.image)
  }

  if (seo.type === 'article') {
    if (seo.author) {
      updateOrCreateMeta('article:author', seo.author, true)
    }
    if (seo.publishedAt) {
      updateOrCreateMeta('article:published_time', seo.publishedAt, true)
    }
    if (seo.modifiedAt) {
      updateOrCreateMeta('article:modified_time', seo.modifiedAt, true)
    }
    if (seo.section) {
      updateOrCreateMeta('article:section', seo.section, true)
    }
    document.querySelectorAll('meta[property="article:tag"]').forEach(el => el.remove())
    if (seo.tags?.length) {
      seo.tags.forEach(tag => {
        const meta = document.createElement('meta')
        meta.setAttribute('property', 'article:tag')
        meta.content = tag
        document.head.appendChild(meta)
      })
    }
  }

  let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement
  if (!canonical) {
    canonical = document.createElement('link')
    canonical.rel = 'canonical'
    document.head.appendChild(canonical)
  }
  canonical.href = seo.url
}

export function addSchemaToPage(schema: object): void {
  const existingScript = document.querySelector('script[data-schema="true"]')
  if (existingScript) {
    existingScript.remove()
  }

  const script = document.createElement('script')
  script.type = 'application/ld+json'
  script.setAttribute('data-schema', 'true')
  script.textContent = JSON.stringify(schema)
  document.head.appendChild(script)
}

export function addMultipleSchemasToPage(schemas: object[]): void {
  document.querySelectorAll('script[data-schema="true"]').forEach(el => el.remove())

  schemas.forEach((schema, index) => {
    const script = document.createElement('script')
    script.type = 'application/ld+json'
    script.setAttribute('data-schema', 'true')
    script.setAttribute('data-schema-index', String(index))
    script.textContent = JSON.stringify(schema)
    document.head.appendChild(script)
  })
}

export async function notifyIndexNow(urls: string[]): Promise<boolean> {
  const apiKey = 'bytecare-indexnow-key'
  const host = 'bytecare.shop'
  
  try {
    const response = await fetch('https://api.indexnow.org/indexnow', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        host,
        key: apiKey,
        keyLocation: `https://${host}/${apiKey}.txt`,
        urlList: urls
      })
    })
    
    return response.ok
  } catch (error) {
    console.error('IndexNow notification failed:', error)
    return false
  }
}

export function generateSitemap(posts: Array<{ slug: string; publishedAt: string; modifiedAt?: string }>): string {
  const baseUrl = 'https://bytecare.shop'
  
  const staticPages = [
    { url: '/', priority: '1.0', changefreq: 'weekly' },
    { url: '/services', priority: '0.9', changefreq: 'monthly' },
    { url: '/pricing', priority: '0.8', changefreq: 'monthly' },
    { url: '/about', priority: '0.7', changefreq: 'monthly' },
    { url: '/contact', priority: '0.7', changefreq: 'monthly' },
    { url: '/blog', priority: '0.9', changefreq: 'daily' },
    { url: '/booking', priority: '0.8', changefreq: 'monthly' },
    { url: '/help', priority: '0.6', changefreq: 'monthly' }
  ]

  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n'
  xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'

  staticPages.forEach(page => {
    xml += '  <url>\n'
    xml += `    <loc>${baseUrl}${page.url}</loc>\n`
    xml += `    <changefreq>${page.changefreq}</changefreq>\n`
    xml += `    <priority>${page.priority}</priority>\n`
    xml += '  </url>\n'
  })

  posts.forEach(post => {
    xml += '  <url>\n'
    xml += `    <loc>${baseUrl}/blog/${post.slug}</loc>\n`
    xml += `    <lastmod>${post.modifiedAt || post.publishedAt}</lastmod>\n`
    xml += '    <changefreq>weekly</changefreq>\n'
    xml += '    <priority>0.7</priority>\n'
    xml += '  </url>\n'
  })

  xml += '</urlset>'
  
  return xml
}
