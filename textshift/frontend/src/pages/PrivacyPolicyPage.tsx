import { Link } from 'react-router-dom';
import { ArrowLeft, Shield, Eye, Database, Lock, Bell, UserCheck } from 'lucide-react';

export default function PrivacyPolicyPage() {
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
          <h1 className="text-3xl md:text-4xl font-light text-white mb-4">Privacy Policy</h1>
          <p className="text-gray-400">Last updated: February 2026</p>
        </div>

        <div className="space-y-8 text-gray-300">
          <section className="bg-gradient-to-b from-white/5 to-transparent border border-white/10 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-emerald-500/20 rounded-lg">
                <Shield className="w-5 h-5 text-emerald-400" />
              </div>
              <h2 className="text-xl font-medium text-white">Introduction</h2>
            </div>
            <p className="leading-relaxed mb-4">
              TextShift ("we," "our," or "us") is committed to protecting your privacy. This Privacy Policy 
              explains how we collect, use, disclose, and safeguard your information when you use our website 
              and services at textshift.org.
            </p>
            <p className="leading-relaxed">
              TextShift is operated by Sayan Roy Chowdhury, located at 18/1 Banerjee Para Road, West Bengal - 700122, India.
            </p>
          </section>

          <section className="bg-gradient-to-b from-white/5 to-transparent border border-white/10 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-blue-500/20 rounded-lg">
                <Eye className="w-5 h-5 text-blue-400" />
              </div>
              <h2 className="text-xl font-medium text-white">Information We Collect</h2>
            </div>
            <h3 className="text-lg font-medium text-white mt-4 mb-2">Personal Information</h3>
            <p className="leading-relaxed mb-4">When you register or use our services, we may collect:</p>
            <ul className="list-disc list-inside space-y-2 text-gray-400 mb-4">
              <li>Name and email address</li>
              <li>Account credentials (password is encrypted)</li>
              <li>Payment information (processed securely by Razorpay)</li>
              <li>Usage data and preferences</li>
            </ul>
            <h3 className="text-lg font-medium text-white mt-4 mb-2">Content Data</h3>
            <p className="leading-relaxed mb-4">
              When you use our AI Detection, Humanizer, or other tools, we temporarily process the text you submit. 
              This content is used solely to provide the requested service and is not stored permanently unless 
              you explicitly save it to your history.
            </p>
            <h3 className="text-lg font-medium text-white mt-4 mb-2">Automatically Collected Information</h3>
            <ul className="list-disc list-inside space-y-2 text-gray-400">
              <li>IP address and browser type</li>
              <li>Device information</li>
              <li>Pages visited and time spent</li>
              <li>Referring website</li>
            </ul>
          </section>

          <section className="bg-gradient-to-b from-white/5 to-transparent border border-white/10 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-purple-500/20 rounded-lg">
                <Database className="w-5 h-5 text-purple-400" />
              </div>
              <h2 className="text-xl font-medium text-white">How We Use Your Information</h2>
            </div>
            <p className="leading-relaxed mb-4">We use the collected information to:</p>
            <ul className="list-disc list-inside space-y-2 text-gray-400">
              <li>Provide and maintain our services</li>
              <li>Process your transactions and manage your account</li>
              <li>Send you service-related communications</li>
              <li>Improve our services and develop new features</li>
              <li>Analyze usage patterns to enhance user experience</li>
              <li>Detect and prevent fraud or abuse</li>
              <li>Comply with legal obligations</li>
            </ul>
          </section>

          <section className="bg-gradient-to-b from-white/5 to-transparent border border-white/10 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-amber-500/20 rounded-lg">
                <Lock className="w-5 h-5 text-amber-400" />
              </div>
              <h2 className="text-xl font-medium text-white">Data Security</h2>
            </div>
            <p className="leading-relaxed mb-4">
              We implement appropriate technical and organizational measures to protect your personal information:
            </p>
            <ul className="list-disc list-inside space-y-2 text-gray-400">
              <li>SSL/TLS encryption for all data transmission</li>
              <li>Encrypted password storage using industry-standard hashing</li>
              <li>Secure payment processing through Razorpay (PCI-DSS compliant)</li>
              <li>Regular security audits and updates</li>
              <li>Access controls and authentication measures</li>
            </ul>
          </section>

          <section className="bg-gradient-to-b from-white/5 to-transparent border border-white/10 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-rose-500/20 rounded-lg">
                <Bell className="w-5 h-5 text-rose-400" />
              </div>
              <h2 className="text-xl font-medium text-white">Information Sharing</h2>
            </div>
            <p className="leading-relaxed mb-4">
              We do not sell, trade, or rent your personal information. We may share your information only in 
              the following circumstances:
            </p>
            <ul className="list-disc list-inside space-y-2 text-gray-400">
              <li><strong className="text-white">Service Providers:</strong> With trusted third parties who assist in operating our service (e.g., Razorpay for payments)</li>
              <li><strong className="text-white">Legal Requirements:</strong> When required by law or to protect our rights</li>
              <li><strong className="text-white">Business Transfers:</strong> In connection with a merger, acquisition, or sale of assets</li>
              <li><strong className="text-white">With Your Consent:</strong> When you explicitly authorize us to share information</li>
            </ul>
          </section>

          <section className="bg-gradient-to-b from-white/5 to-transparent border border-white/10 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-cyan-500/20 rounded-lg">
                <UserCheck className="w-5 h-5 text-cyan-400" />
              </div>
              <h2 className="text-xl font-medium text-white">Your Rights</h2>
            </div>
            <p className="leading-relaxed mb-4">You have the right to:</p>
            <ul className="list-disc list-inside space-y-2 text-gray-400">
              <li><strong className="text-white">Access:</strong> Request a copy of your personal data</li>
              <li><strong className="text-white">Correction:</strong> Request correction of inaccurate data</li>
              <li><strong className="text-white">Deletion:</strong> Request deletion of your account and data</li>
              <li><strong className="text-white">Portability:</strong> Request your data in a portable format</li>
              <li><strong className="text-white">Opt-out:</strong> Unsubscribe from marketing communications</li>
            </ul>
            <p className="leading-relaxed mt-4">
              To exercise these rights, please contact us at privacy@textshift.org.
            </p>
          </section>

          <section className="bg-gradient-to-b from-white/5 to-transparent border border-white/10 rounded-2xl p-6">
            <h2 className="text-xl font-medium text-white mb-4">Cookies and Tracking</h2>
            <p className="leading-relaxed mb-4">
              We use cookies and similar technologies to:
            </p>
            <ul className="list-disc list-inside space-y-2 text-gray-400">
              <li>Keep you logged in to your account</li>
              <li>Remember your preferences</li>
              <li>Analyze site traffic and usage</li>
              <li>Improve our services</li>
            </ul>
            <p className="leading-relaxed mt-4">
              You can control cookies through your browser settings. Note that disabling cookies may affect 
              the functionality of our service.
            </p>
          </section>

          <section className="bg-gradient-to-b from-white/5 to-transparent border border-white/10 rounded-2xl p-6">
            <h2 className="text-xl font-medium text-white mb-4">Data Retention</h2>
            <p className="leading-relaxed">
              We retain your personal information for as long as your account is active or as needed to provide 
              services. We may retain certain information as required by law or for legitimate business purposes. 
              Content submitted for processing is not stored permanently unless you save it to your history.
            </p>
          </section>

          <section className="bg-gradient-to-b from-white/5 to-transparent border border-white/10 rounded-2xl p-6">
            <h2 className="text-xl font-medium text-white mb-4">Children's Privacy</h2>
            <p className="leading-relaxed">
              Our service is not intended for users under 18 years of age. We do not knowingly collect personal 
              information from children. If you believe we have collected information from a child, please 
              contact us immediately.
            </p>
          </section>

          <section className="bg-gradient-to-b from-white/5 to-transparent border border-white/10 rounded-2xl p-6">
            <h2 className="text-xl font-medium text-white mb-4">Changes to This Policy</h2>
            <p className="leading-relaxed">
              We may update this Privacy Policy from time to time. We will notify you of any material changes 
              by posting the new policy on this page and updating the "Last updated" date. We encourage you to 
              review this policy periodically.
            </p>
          </section>

          <section className="bg-gradient-to-b from-white/5 to-transparent border border-white/10 rounded-2xl p-6">
            <h2 className="text-xl font-medium text-white mb-4">Contact Us</h2>
            <p className="leading-relaxed mb-4">
              If you have questions about this Privacy Policy, please contact us:
            </p>
            <div className="space-y-2 text-gray-400">
              <p><strong className="text-white">Company:</strong> TextShift</p>
              <p><strong className="text-white">Founder:</strong> Sayan Roy Chowdhury</p>
              <p><strong className="text-white">Address:</strong> 18/1 Banerjee Para Road, West Bengal - 700122, India</p>
              <p><strong className="text-white">Email:</strong> privacy@textshift.org</p>
            </div>
          </section>
        </div>

        <div className="mt-12 pt-8 border-t border-white/10">
          <div className="flex flex-wrap gap-4 text-sm text-gray-400">
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
