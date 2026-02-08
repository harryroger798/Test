import { MAIN_SITE_URL } from '@/lib/utils'

export default function CTABanner() {
  return (
    <section className="my-12 overflow-hidden rounded-2xl border border-brand-green/20 bg-gradient-to-r from-brand-green/10 via-brand-card to-brand-green/10 p-8 text-center md:p-12">
      <h2 className="mb-3 text-2xl font-bold text-white md:text-3xl">
        Ready to Transform Your Content?
      </h2>
      <p className="mx-auto mb-6 max-w-xl text-brand-muted">
        Try TextShift&apos;s AI detection, humanization, and plagiarism checking tools.
        Industry-leading 99% accuracy. Get 5,000 free words.
      </p>
      <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
        <a
          href={`${MAIN_SITE_URL}/register`}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-lg bg-brand-green px-6 py-3 font-medium text-black transition-colors hover:bg-brand-green/90"
        >
          Start Free &rarr;
        </a>
        <a
          href={`${MAIN_SITE_URL}/features`}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-lg border border-brand-border px-6 py-3 font-medium text-white transition-colors hover:border-brand-green/50"
        >
          View Features
        </a>
      </div>
      <p className="mt-4 text-xs text-brand-muted">No credit card required</p>
    </section>
  )
}
