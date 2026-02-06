import { Link } from 'react-router-dom';
import { ArrowLeft, RefreshCcw, Clock, CreditCard, AlertCircle, CheckCircle, XCircle } from 'lucide-react';

export default function RefundPolicyPage() {
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
          <h1 className="text-3xl md:text-4xl font-light text-white mb-4">Cancellation & Refund Policy</h1>
          <p className="text-gray-400">Last updated: February 2026</p>
        </div>

        <div className="space-y-8 text-gray-300">
          <section className="bg-gradient-to-b from-white/5 to-transparent border border-white/10 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-emerald-500/20 rounded-lg">
                <RefreshCcw className="w-5 h-5 text-emerald-400" />
              </div>
              <h2 className="text-xl font-medium text-white">Overview</h2>
            </div>
            <p className="leading-relaxed">
              At TextShift, we strive to provide the best possible service. We understand that sometimes 
              circumstances change, and we want to ensure a fair and transparent refund process. This policy 
              outlines the terms and conditions for cancellations and refunds.
            </p>
          </section>

          <section className="bg-gradient-to-b from-white/5 to-transparent border border-white/10 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-blue-500/20 rounded-lg">
                <Clock className="w-5 h-5 text-blue-400" />
              </div>
              <h2 className="text-xl font-medium text-white">Refund Eligibility</h2>
            </div>
            <p className="leading-relaxed mb-4">
              You may be eligible for a refund under the following conditions:
            </p>
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                <CheckCircle className="w-5 h-5 text-emerald-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-white">Within 7 Days of Purchase</p>
                  <p className="text-sm text-gray-400">Full refund available if you have used less than 20% of your word credits.</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                <AlertCircle className="w-5 h-5 text-amber-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-white">Technical Issues</p>
                  <p className="text-sm text-gray-400">If you experience persistent technical issues that prevent you from using the service, you may be eligible for a prorated refund.</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl">
                <XCircle className="w-5 h-5 text-rose-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-white">Non-Refundable Cases</p>
                  <p className="text-sm text-gray-400">Refunds are not available after 7 days or if more than 20% of credits have been used.</p>
                </div>
              </div>
            </div>
          </section>

          <section className="bg-gradient-to-b from-white/5 to-transparent border border-white/10 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-purple-500/20 rounded-lg">
                <CreditCard className="w-5 h-5 text-purple-400" />
              </div>
              <h2 className="text-xl font-medium text-white">Subscription Cancellation</h2>
            </div>
            <p className="leading-relaxed mb-4">
              You can cancel your subscription at any time from your account settings. Here's what happens when you cancel:
            </p>
            <ul className="list-disc list-inside space-y-3 text-gray-400">
              <li><strong className="text-white">Immediate Effect:</strong> Your subscription will not renew at the end of the current billing period.</li>
              <li><strong className="text-white">Access Continues:</strong> You will retain access to all features until the end of your paid period.</li>
              <li><strong className="text-white">Credits Preserved:</strong> Any unused word credits will remain available until the subscription expires.</li>
              <li><strong className="text-white">No Partial Refunds:</strong> We do not provide partial refunds for unused time within a billing period.</li>
            </ul>
          </section>

          <section className="bg-gradient-to-b from-white/5 to-transparent border border-white/10 rounded-2xl p-6">
            <h2 className="text-xl font-medium text-white mb-4">How to Request a Refund</h2>
            <p className="leading-relaxed mb-4">
              To request a refund, please follow these steps:
            </p>
            <ol className="list-decimal list-inside space-y-3 text-gray-400">
              <li>Email us at <strong className="text-emerald-400">support@textshift.org</strong> with the subject line "Refund Request"</li>
              <li>Include your registered email address and order/transaction ID</li>
              <li>Provide a brief explanation for your refund request</li>
              <li>Our team will review your request within 2-3 business days</li>
              <li>If approved, refunds will be processed within 5-7 business days</li>
            </ol>
          </section>

          <section className="bg-gradient-to-b from-white/5 to-transparent border border-white/10 rounded-2xl p-6">
            <h2 className="text-xl font-medium text-white mb-4">Refund Processing</h2>
            <p className="leading-relaxed mb-4">
              Once your refund is approved:
            </p>
            <ul className="list-disc list-inside space-y-2 text-gray-400">
              <li>Refunds will be credited to the original payment method used during purchase.</li>
              <li>Processing time depends on your bank or payment provider (typically 5-10 business days).</li>
              <li>You will receive an email confirmation once the refund has been initiated.</li>
              <li>All payments are processed through Razorpay, and refunds follow their standard processing times.</li>
            </ul>
          </section>

          <section className="bg-gradient-to-b from-white/5 to-transparent border border-white/10 rounded-2xl p-6">
            <h2 className="text-xl font-medium text-white mb-4">Plan-Specific Policies</h2>
            <div className="space-y-4">
              <div className="p-4 border border-white/10 rounded-xl">
                <h3 className="font-medium text-white mb-2">Free Plan</h3>
                <p className="text-sm text-gray-400">No payment required, no refund applicable.</p>
              </div>
              <div className="p-4 border border-white/10 rounded-xl">
                <h3 className="font-medium text-white mb-2">Starter Plan ($9/month)</h3>
                <p className="text-sm text-gray-400">Eligible for full refund within 7 days if less than 10,000 words used.</p>
              </div>
              <div className="p-4 border border-white/10 rounded-xl">
                <h3 className="font-medium text-white mb-2">Pro Plan ($19/month)</h3>
                <p className="text-sm text-gray-400">Eligible for full refund within 7 days. Usage is evaluated on a case-by-case basis.</p>
              </div>
              <div className="p-4 border border-white/10 rounded-xl">
                <h3 className="font-medium text-white mb-2">Enterprise Plan ($49/month)</h3>
                <p className="text-sm text-gray-400">Custom refund terms may apply. Please contact our enterprise support team.</p>
              </div>
            </div>
          </section>

          <section className="bg-gradient-to-b from-white/5 to-transparent border border-white/10 rounded-2xl p-6">
            <h2 className="text-xl font-medium text-white mb-4">Exceptions</h2>
            <p className="leading-relaxed mb-4">
              We reserve the right to deny refund requests in the following cases:
            </p>
            <ul className="list-disc list-inside space-y-2 text-gray-400">
              <li>Violation of our Terms of Service</li>
              <li>Fraudulent activity or abuse of the service</li>
              <li>Multiple refund requests from the same user</li>
              <li>Requests made after the 7-day refund window</li>
            </ul>
          </section>

          <section className="bg-gradient-to-b from-white/5 to-transparent border border-white/10 rounded-2xl p-6">
            <h2 className="text-xl font-medium text-white mb-4">Contact Us</h2>
            <p className="leading-relaxed mb-4">
              For any questions about our refund policy or to request a refund, please contact us:
            </p>
            <div className="space-y-2 text-gray-400">
              <p><strong className="text-white">Company:</strong> TextShift</p>
              <p><strong className="text-white">Founder:</strong> Sayan Roy Chowdhury</p>
              <p><strong className="text-white">Address:</strong> 18/1 Banerjee Para Road, West Bengal - 700122, India</p>
              <p><strong className="text-white">Email:</strong> support@textshift.org</p>
              <p><strong className="text-white">Response Time:</strong> Within 24-48 hours</p>
            </div>
          </section>
        </div>

        <div className="mt-12 pt-8 border-t border-white/10">
          <div className="flex flex-wrap gap-4 text-sm text-gray-400">
            <Link to="/privacy-policy" className="hover:text-white transition">Privacy Policy</Link>
            <Link to="/terms" className="hover:text-white transition">Terms & Conditions</Link>
            <Link to="/shipping-policy" className="hover:text-white transition">Shipping Policy</Link>
            <Link to="/contact" className="hover:text-white transition">Contact Us</Link>
          </div>
        </div>
      </main>
    </div>
  );
}
