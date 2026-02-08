export default {
  name: 'post',
  title: 'Blog Post',
  type: 'document',
  fields: [
    {
      name: 'title',
      title: 'Title',
      type: 'string',
      validation: (Rule: { required: () => unknown }) => Rule.required(),
    },
    {
      name: 'slug',
      title: 'Slug',
      type: 'slug',
      options: { source: 'title', maxLength: 96 },
      validation: (Rule: { required: () => unknown }) => Rule.required(),
    },
    {
      name: 'excerpt',
      title: 'Excerpt',
      type: 'text',
      rows: 3,
      description: '150-200 character summary for blog listings',
    },
    {
      name: 'body',
      title: 'Body (HTML)',
      type: 'text',
      description: 'Full HTML content of the blog post',
    },
    {
      name: 'author',
      title: 'Author',
      type: 'reference',
      to: [{ type: 'author' }],
    },
    {
      name: 'category',
      title: 'Category',
      type: 'reference',
      to: [{ type: 'category' }],
    },
    {
      name: 'featuredImage',
      title: 'Featured Image',
      type: 'image',
      options: { hotspot: true },
    },
    {
      name: 'featuredImageAlt',
      title: 'Featured Image Alt Text',
      type: 'string',
    },
    {
      name: 'publishedAt',
      title: 'Published At',
      type: 'datetime',
    },
    {
      name: 'metaTitle',
      title: 'Meta Title',
      type: 'string',
      description: 'Under 60 characters, includes primary keyword',
    },
    {
      name: 'metaDescription',
      title: 'Meta Description',
      type: 'text',
      rows: 2,
      description: '150-160 characters, includes primary keyword and CTA',
    },
    {
      name: 'focusKeyword',
      title: 'Focus Keyword',
      type: 'string',
    },
    {
      name: 'keywords',
      title: 'Keywords (Tags)',
      type: 'array',
      of: [{ type: 'string' }],
      options: { layout: 'tags' },
    },
    {
      name: 'language',
      title: 'Language',
      type: 'string',
      options: {
        list: [
          { title: 'English', value: 'en' },
          { title: 'Hindi', value: 'hi' },
          { title: 'Spanish', value: 'es' },
          { title: 'French', value: 'fr' },
          { title: 'German', value: 'de' },
          { title: 'Portuguese', value: 'pt' },
          { title: 'Arabic', value: 'ar' },
          { title: 'Chinese', value: 'zh' },
          { title: 'Japanese', value: 'ja' },
        ],
      },
      initialValue: 'en',
    },
    {
      name: 'linkedTranslation',
      title: 'Linked Translation',
      type: 'reference',
      to: [{ type: 'post' }],
      description: 'Link to translated version of this post',
    },
    {
      name: 'status',
      title: 'Status',
      type: 'string',
      options: {
        list: [
          { title: 'Draft', value: 'draft' },
          { title: 'Published', value: 'published' },
          { title: 'Scheduled', value: 'scheduled' },
        ],
      },
      initialValue: 'draft',
    },
  ],
  orderings: [
    {
      title: 'Published Date (Newest)',
      name: 'publishedAtDesc',
      by: [{ field: 'publishedAt', direction: 'desc' }],
    },
  ],
  preview: {
    select: {
      title: 'title',
      author: 'author.name',
      media: 'featuredImage',
    },
    prepare(selection: { title: string; author: string; media: unknown }) {
      return {
        title: selection.title,
        subtitle: `by ${selection.author || 'Unknown'}`,
        media: selection.media,
      }
    },
  },
}
