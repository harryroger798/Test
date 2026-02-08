'use client'

export default function PostBody({ content }: { content: string }) {
  return (
    <div
      className="prose prose-invert prose-lg max-w-none
        prose-headings:text-white prose-headings:font-bold
        prose-h2:mt-10 prose-h2:mb-4 prose-h2:text-2xl prose-h2:border-b prose-h2:border-brand-border prose-h2:pb-2
        prose-h3:mt-6 prose-h3:mb-3 prose-h3:text-xl
        prose-p:text-gray-300 prose-p:leading-relaxed
        prose-a:text-brand-green prose-a:no-underline hover:prose-a:underline
        prose-strong:text-white
        prose-ul:text-gray-300 prose-ol:text-gray-300
        prose-li:text-gray-300
        prose-blockquote:border-brand-green prose-blockquote:text-gray-400
        prose-code:text-brand-green prose-code:bg-brand-card prose-code:px-1 prose-code:py-0.5 prose-code:rounded
        prose-img:rounded-xl
        prose-figcaption:text-center prose-figcaption:text-brand-muted prose-figcaption:text-sm
        [&_details]:rounded-xl [&_details]:border [&_details]:border-brand-border [&_details]:bg-brand-card [&_details]:p-4 [&_details]:mb-8
        [&_summary]:cursor-pointer [&_summary]:text-white [&_summary]:font-semibold
        [&_.toc]:mt-3 [&_.toc_ul]:space-y-1 [&_.toc_a]:text-brand-green [&_.toc_a]:text-sm
        [&_.video-container]:relative [&_.video-container]:pb-[56.25%] [&_.video-container]:h-0 [&_.video-container]:overflow-hidden [&_.video-container]:rounded-xl [&_.video-container]:my-6
        [&_.video-container_iframe]:absolute [&_.video-container_iframe]:top-0 [&_.video-container_iframe]:left-0 [&_.video-container_iframe]:w-full [&_.video-container_iframe]:h-full
        [&_figure]:my-6
      "
      dangerouslySetInnerHTML={{ __html: content }}
    />
  )
}
