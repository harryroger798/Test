import Link from 'next/link'
import { MAIN_SITE_URL, SITE_NAME } from '@/lib/utils'

export default function Footer() {
  return (
    <footer className="border-t border-brand-border bg-brand-dark">
      <div className="mx-auto max-w-6xl px-4 py-12">
        <div className="grid gap-8 md:grid-cols-4">
          <div className="md:col-span-1">
            <Link href="/" className="flex items-center gap-2">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-brand-green">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span className="text-lg font-bold text-white">TextShift</span>
              <span className="rounded bg-brand-green/10 px-1.5 py-0.5 text-xs text-brand-green">Blog</span>
            </Link>
            <p className="mt-3 text-sm text-brand-muted">
              Expert guides on AI content detection, humanization, and content writing tips.
            </p>
          </div>

          <div>
            <h4 className="mb-3 text-sm font-semibold text-white">Blog</h4>
            <ul className="space-y-2 text-sm text-brand-muted">
              <li><Link href="/" className="hover:text-brand-green">Latest Posts</Link></li>
              <li><Link href="/blog/" className="hover:text-brand-green">All Articles</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="mb-3 text-sm font-semibold text-white">TextShift</h4>
            <ul className="space-y-2 text-sm text-brand-muted">
              <li><a href={MAIN_SITE_URL} target="_blank" rel="noopener noreferrer" className="hover:text-brand-green">Main Website</a></li>
              <li><a href={`${MAIN_SITE_URL}/features`} target="_blank" rel="noopener noreferrer" className="hover:text-brand-green">Features</a></li>
              <li><a href={`${MAIN_SITE_URL}/pricing`} target="_blank" rel="noopener noreferrer" className="hover:text-brand-green">Pricing</a></li>
              <li><a href={`${MAIN_SITE_URL}/contact`} target="_blank" rel="noopener noreferrer" className="hover:text-brand-green">Contact</a></li>
            </ul>
          </div>

          <div>
            <h4 className="mb-3 text-sm font-semibold text-white">Legal</h4>
            <ul className="space-y-2 text-sm text-brand-muted">
              <li><a href={`${MAIN_SITE_URL}/terms`} target="_blank" rel="noopener noreferrer" className="hover:text-brand-green">Terms</a></li>
              <li><a href={`${MAIN_SITE_URL}/privacy-policy`} target="_blank" rel="noopener noreferrer" className="hover:text-brand-green">Privacy Policy</a></li>
            </ul>
          </div>
        </div>

        <div className="mt-10 border-t border-brand-border pt-6 text-center text-sm text-brand-muted">
          &copy; {new Date().getFullYear()} {SITE_NAME}. All rights reserved. |{' '}
          <a href={MAIN_SITE_URL} target="_blank" rel="noopener noreferrer" className="text-brand-green hover:underline">
            TextShift.org
          </a>
        </div>
      </div>
    </footer>
  )
}
