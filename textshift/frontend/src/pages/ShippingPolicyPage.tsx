import { Link } from 'react-router-dom';
import { ArrowLeft, Package, Clock, Globe, Shield } from 'lucide-react';

export default function ShippingPolicyPage() {
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
          <h1 className="text-3xl md:text-4xl font-light text-white mb-4">Shipping & Delivery Policy</h1>
          <p className="text-gray-400">Last updated: February 2026</p>
        </div>

        <div className="space-y-8 text-gray-300">
          <section className="bg-gradient-to-b from-white/5 to-transparent border border-white/10 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-emerald-500/20 rounded-lg">
                <Package className="w-5 h-5 text-emerald-400" />
              </div>
              <h2 className="text-xl font-medium text-white">Digital Service Delivery</h2>
            </div>
            <p className="leading-relaxed">
              TextShift is a digital Software-as-a-Service (SaaS) platform. We do not ship any physical products. 
              All our services are delivered electronically through our web platform at textshift.org.
            </p>
          </section>

          <section className="bg-gradient-to-b from-white/5 to-transparent border border-white/10 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-blue-500/20 rounded-lg">
                <Clock className="w-5 h-5 text-blue-400" />
              </div>
              <h2 className="text-xl font-medium text-white">Instant Access</h2>
            </div>
            <p className="leading-relaxed mb-4">
              Upon successful payment and account creation, you will receive immediate access to all features 
              included in your subscription plan. There is no waiting period or shipping time involved.
            </p>
            <ul className="list-disc list-inside space-y-2 text-gray-400">
              <li>AI Detection tools - Available instantly</li>
              <li>Humanizer tools - Available instantly</li>
              <li>Plagiarism Checker - Available instantly</li>
              <li>Writing Tools (14 tools) - Available instantly</li>
              <li>API Access (Enterprise) - Available instantly</li>
            </ul>
          </section>

          <section className="bg-gradient-to-b from-white/5 to-transparent border border-white/10 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-purple-500/20 rounded-lg">
                <Globe className="w-5 h-5 text-purple-400" />
              </div>
              <h2 className="text-xl font-medium text-white">Global Availability</h2>
            </div>
            <p className="leading-relaxed">
              Our services are available worldwide. As a digital platform, there are no geographical restrictions 
              on service delivery. You can access TextShift from anywhere with an internet connection.
            </p>
          </section>

          <section className="bg-gradient-to-b from-white/5 to-transparent border border-white/10 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-amber-500/20 rounded-lg">
                <Shield className="w-5 h-5 text-amber-400" />
              </div>
              <h2 className="text-xl font-medium text-white">Service Guarantee</h2>
            </div>
            <p className="leading-relaxed mb-4">
              We guarantee 99.9% uptime for our services. In the rare event of service disruption, 
              we will work to restore access as quickly as possible and may provide service credits 
              for extended outages.
            </p>
          </section>

          <section className="bg-gradient-to-b from-white/5 to-transparent border border-white/10 rounded-2xl p-6">
            <h2 className="text-xl font-medium text-white mb-4">Contact Information</h2>
            <p className="leading-relaxed mb-4">
              For any questions regarding our delivery policy or service access, please contact us:
            </p>
            <div className="space-y-2 text-gray-400">
              <p><strong className="text-white">Company:</strong> TextShift</p>
              <p><strong className="text-white">Founder:</strong> Sayan Roy Chowdhury</p>
              <p><strong className="text-white">Address:</strong> 18/1 Banerjee Para Road, West Bengal - 700122, India</p>
              <p><strong className="text-white">Email:</strong> support@textshift.org</p>
            </div>
          </section>
        </div>

        <div className="mt-12 pt-8 border-t border-white/10">
          <div className="flex flex-wrap gap-4 text-sm text-gray-400">
            <Link to="/privacy-policy" className="hover:text-white transition">Privacy Policy</Link>
            <Link to="/terms" className="hover:text-white transition">Terms & Conditions</Link>
            <Link to="/refund-policy" className="hover:text-white transition">Refund Policy</Link>
            <Link to="/contact" className="hover:text-white transition">Contact Us</Link>
          </div>
        </div>
      </main>
    </div>
  );
}
