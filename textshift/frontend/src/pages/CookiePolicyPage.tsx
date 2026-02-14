import { Link } from 'react-router-dom';
import { ArrowLeft, Shield, Settings, BarChart3, HelpCircle } from 'lucide-react';

export default function CookiePolicyPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-gradient-to-b from-emerald-500/10 via-emerald-500/5 to-transparent rounded-full blur-3xl" />
      </div>

      <nav className="sticky top-0 z-50 border-b border-white/10 bg-[#0a0a0a]/80 backdrop-blur-lg">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <Link to="/" className="flex items-center gap-2">
              <img src="/images/logo.png" alt="TextShift" className="h-8 w-auto" />
              <span className="text-white font-medium tracking-wide">TextShift</span>
            </Link>
            <Link to="/" className="flex items-center gap-2 text-gray-400 hover:text-white transition">
              <ArrowLeft className="w-4 h-4" />
              Back to Home
            </Link>
          </div>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-4 py-12">
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-light text-white mb-4">Cookie Policy</h1>
          <p className="text-gray-400">Last updated: February 2026</p>
        </div>

        <div className="space-y-8 text-gray-300">
          <section className="bg-gradient-to-b from-white/5 to-transparent border border-white/10 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-emerald-500/20 rounded-lg">
                <Shield className="w-5 h-5 text-emerald-400" />
              </div>
              <h2 className="text-xl font-medium text-white">What Are Cookies?</h2>
            </div>
            <p className="leading-relaxed mb-4">
              This Cookie Policy explains how TextShift (&quot;Company,&quot; &quot;we,&quot; &quot;us,&quot; and &quot;our&quot;) uses cookies and
              similar technologies to recognize you when you visit our website at{' '}
              <a href="https://textshift.org" className="text-emerald-400 hover:underline">https://textshift.org</a> (&quot;Website&quot;).
              It explains what these technologies are and why we use them, as well as your rights to control our use of them.
            </p>
            <p className="leading-relaxed mb-4">
              Cookies are small data files that are placed on your computer or mobile device when you visit a website.
              Cookies are widely used by website owners in order to make their websites work, or to work more efficiently,
              as well as to provide reporting information.
            </p>
            <p className="leading-relaxed">
              Cookies set by the website owner (in this case, TextShift) are called &quot;first-party cookies.&quot;
              Cookies set by parties other than the website owner are called &quot;third-party cookies.&quot; Third-party
              cookies enable third-party features or functionality to be provided on or through the website
              (e.g., advertising, interactive content, and analytics).
            </p>
          </section>

          <section className="bg-gradient-to-b from-white/5 to-transparent border border-white/10 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-blue-500/20 rounded-lg">
                <HelpCircle className="w-5 h-5 text-blue-400" />
              </div>
              <h2 className="text-xl font-medium text-white">Why Do We Use Cookies?</h2>
            </div>
            <p className="leading-relaxed">
              We use first- and third-party cookies for several reasons. Some cookies are required for technical
              reasons in order for our Website to operate, and we refer to these as &quot;essential&quot; or &quot;strictly
              necessary&quot; cookies. Other cookies also enable us to track and target the interests of our users to
              enhance the experience on our Online Properties. Third parties serve cookies through our Website for
              advertising, analytics, and other purposes.
            </p>
          </section>

          <section className="bg-gradient-to-b from-white/5 to-transparent border border-white/10 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-purple-500/20 rounded-lg">
                <Settings className="w-5 h-5 text-purple-400" />
              </div>
              <h2 className="text-xl font-medium text-white">How Can I Control Cookies?</h2>
            </div>
            <p className="leading-relaxed mb-4">
              You have the right to decide whether to accept or reject cookies. You can exercise your cookie rights
              by setting your preferences in the Cookie Consent Manager. The Cookie Consent Manager allows you to
              select which categories of cookies you accept or reject. Essential cookies cannot be rejected as they
              are strictly necessary to provide you with services.
            </p>
            <p className="leading-relaxed">
              If you choose to reject cookies, you may still use our Website though your access to some functionality
              and areas of our Website may be restricted. You may also set or amend your web browser controls to
              accept or refuse cookies.
            </p>
          </section>

          <section className="bg-gradient-to-b from-white/5 to-transparent border border-white/10 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-amber-500/20 rounded-lg">
                <BarChart3 className="w-5 h-5 text-amber-400" />
              </div>
              <h2 className="text-xl font-medium text-white">Cookies We Use</h2>
            </div>

            <h3 className="text-lg font-medium text-white mt-4 mb-3">Essential Website Cookies</h3>
            <p className="leading-relaxed mb-4 text-gray-400">
              These cookies are strictly necessary to provide you with services available through our Website.
            </p>
            <div className="space-y-3 mb-6">
              <div className="p-4 bg-white/5 border border-white/10 rounded-xl">
                <p className="font-medium text-white">TERMLY_API_CACHE</p>
                <p className="text-sm text-gray-400">Used to store visitor&apos;s consent result to improve performance of the consent banner.</p>
                <p className="text-xs text-gray-500 mt-1">Provider: textshift.org | Type: Local Storage | Expires: 1 year</p>
              </div>
              <div className="p-4 bg-white/5 border border-white/10 rounded-xl">
                <p className="font-medium text-white">csrf_token</p>
                <p className="text-sm text-gray-400">Protects against hacking and malicious actors.</p>
                <p className="text-xs text-gray-500 mt-1">Provider: textshift.org | Type: HTTP Cookie | Expires: 30 days</p>
              </div>
            </div>

            <h3 className="text-lg font-medium text-white mt-4 mb-3">Performance & Functionality Cookies</h3>
            <p className="leading-relaxed mb-4 text-gray-400">
              These cookies enhance the performance and functionality of our Website but are non-essential.
            </p>
            <div className="space-y-3 mb-6">
              <div className="p-4 bg-white/5 border border-white/10 rounded-xl">
                <p className="font-medium text-white">_cfuvid</p>
                <p className="text-sm text-gray-400">Set by Cloudflare to enhance security and performance for trusted web traffic.</p>
                <p className="text-xs text-gray-500 mt-1">Provider: .app.termly.io | Type: Server Cookie | Expires: Session</p>
              </div>
            </div>

            <h3 className="text-lg font-medium text-white mt-4 mb-3">Analytics & Customization Cookies</h3>
            <p className="leading-relaxed mb-4 text-gray-400">
              These cookies collect information to help us understand how our Website is being used.
            </p>
            <div className="space-y-3">
              <div className="p-4 bg-white/5 border border-white/10 rounded-xl">
                <p className="font-medium text-white">s7</p>
                <p className="text-sm text-gray-400">Gathers data regarding site usage and user behavior on the website.</p>
                <p className="text-xs text-gray-500 mt-1">Provider: textshift.org | Type: Local Storage | Expires: Persistent</p>
              </div>
            </div>
          </section>

          <section className="bg-gradient-to-b from-white/5 to-transparent border border-white/10 rounded-2xl p-6">
            <h2 className="text-xl font-medium text-white mb-4">Other Tracking Technologies</h2>
            <p className="leading-relaxed mb-4">
              Cookies are not the only way to recognize or track visitors to a website. We may use other,
              similar technologies from time to time, like web beacons (sometimes called &quot;tracking pixels&quot;
              or &quot;clear gifs&quot;). These are tiny graphics files that contain a unique identifier that enables
              us to recognize when someone has visited our Website or opened an email including them.
            </p>
            <p className="leading-relaxed">
              In many instances, these technologies are reliant on cookies to function properly, and so
              declining cookies will impair their functioning.
            </p>
          </section>

          <section className="bg-gradient-to-b from-white/5 to-transparent border border-white/10 rounded-2xl p-6">
            <h2 className="text-xl font-medium text-white mb-4">Updates to This Policy</h2>
            <p className="leading-relaxed">
              We may update this Cookie Policy from time to time in order to reflect changes to the cookies
              we use or for other operational, legal, or regulatory reasons. Please revisit this Cookie Policy
              regularly to stay informed about our use of cookies and related technologies.
            </p>
          </section>

          <section className="bg-gradient-to-b from-white/5 to-transparent border border-white/10 rounded-2xl p-6">
            <h2 className="text-xl font-medium text-white mb-4">Contact Us</h2>
            <p className="leading-relaxed mb-4">
              If you have any questions about our use of cookies or other technologies, please contact us:
            </p>
            <div className="space-y-2 text-gray-400">
              <p><strong className="text-white">Company:</strong> TextShift</p>
              <p><strong className="text-white">Founder:</strong> Sayan Roy Chowdhury</p>
              <p><strong className="text-white">Address:</strong> 18/1 Banerjee Para Road, West Bengal - 700122, India</p>
              <p><strong className="text-white">Email:</strong> privacy@mail.textshift.org</p>
              <p><strong className="text-white">Phone:</strong> (+1)2025559871</p>
            </div>
          </section>
        </div>

        <div className="mt-12 pt-8 border-t border-white/10">
          <div className="flex flex-wrap gap-4 text-sm text-gray-400">
            <Link to="/privacy-policy" className="hover:text-white transition">Privacy Policy</Link>
            <Link to="/terms" className="hover:text-white transition">Terms & Conditions</Link>
            <Link to="/shipping-policy" className="hover:text-white transition">Shipping Policy</Link>
            <Link to="/refund-policy" className="hover:text-white transition">Refund Policy</Link>
            <Link to="/contact" className="hover:text-white transition">Contact Us</Link>
          </div>
        </div>
      </main>
    </div>
  );
}
