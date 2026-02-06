import { Link } from 'react-router-dom';
import { ArrowLeft, Check, Zap, Crown, Building2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function PricingDetailsPage() {
  const plans = [
    {
      name: 'Free',
      price: '$0',
      period: 'forever',
      description: 'Perfect for trying out TextShift',
      icon: Sparkles,
      iconColor: 'text-gray-400',
      bgColor: 'bg-gray-500/20',
      features: [
        '5,000 words/month',
        'AI Detection only',
        'Basic accuracy',
        'Email support',
      ],
      limitations: [
        'No Humanizer access',
        'No Plagiarism Checker',
        'No Writing Tools',
      ],
    },
    {
      name: 'Starter',
      price: '$9',
      period: '/month',
      description: 'Great for students and individuals',
      icon: Zap,
      iconColor: 'text-blue-400',
      bgColor: 'bg-blue-500/20',
      popular: false,
      features: [
        '50,000 words/month',
        'AI Detection',
        'Humanizer (all modes)',
        'Plagiarism Checker',
        '14 Writing Tools',
        'History & saved results',
        'Priority email support',
      ],
    },
    {
      name: 'Pro',
      price: '$19',
      period: '/month',
      description: 'Best for professionals and content creators',
      icon: Crown,
      iconColor: 'text-emerald-400',
      bgColor: 'bg-emerald-500/20',
      popular: true,
      features: [
        'Unlimited words',
        'AI Detection',
        'Humanizer (all modes)',
        'Plagiarism Checker',
        '14 Writing Tools',
        'History & saved results',
        'Priority support',
        'Advanced analytics',
      ],
    },
    {
      name: 'Enterprise',
      price: '$49',
      period: '/month',
      description: 'For teams and businesses',
      icon: Building2,
      iconColor: 'text-purple-400',
      bgColor: 'bg-purple-500/20',
      features: [
        'Unlimited words',
        'Everything in Pro',
        'API access',
        'Custom integrations',
        'Dedicated account manager',
        'SLA guarantee',
        'Priority phone support',
        'Team management',
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-gradient-to-b from-emerald-500/10 via-emerald-500/5 to-transparent rounded-full blur-3xl" />
      </div>

      <nav className="sticky top-0 z-50 border-b border-white/10 bg-[#0a0a0a]/80 backdrop-blur-lg">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
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

      <main className="max-w-6xl mx-auto px-4 py-12">
        <div className="text-center mb-12">
          <h1 className="text-3xl md:text-4xl font-light text-white mb-4">Pricing Details</h1>
          <p className="text-gray-400 max-w-2xl mx-auto">
            Transparent pricing with no hidden fees. Choose the plan that fits your needs.
            All plans include access to our core AI detection technology.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`relative bg-gradient-to-b from-white/5 to-transparent border rounded-2xl p-6 ${
                plan.popular ? 'border-emerald-500/50' : 'border-white/10'
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-emerald-500 text-black text-xs font-medium rounded-full">
                  Most Popular
                </div>
              )}
              <div className={`w-12 h-12 ${plan.bgColor} rounded-xl flex items-center justify-center mb-4`}>
                <plan.icon className={`w-6 h-6 ${plan.iconColor}`} />
              </div>
              <h3 className="text-xl font-medium text-white mb-1">{plan.name}</h3>
              <div className="flex items-baseline gap-1 mb-2">
                <span className="text-3xl font-bold text-white">{plan.price}</span>
                <span className="text-gray-400">{plan.period}</span>
              </div>
              <p className="text-sm text-gray-400 mb-6">{plan.description}</p>
              <ul className="space-y-3 mb-6">
                {plan.features.map((feature, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-sm text-gray-300">
                    <Check className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                    {feature}
                  </li>
                ))}
                {plan.limitations?.map((limitation, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-sm text-gray-500">
                    <span className="w-4 h-4 flex items-center justify-center mt-0.5 flex-shrink-0">-</span>
                    {limitation}
                  </li>
                ))}
              </ul>
              <Link to="/pricing">
                <Button
                  className={`w-full rounded-full ${
                    plan.popular
                      ? 'bg-emerald-500 hover:bg-emerald-600 text-black'
                      : 'bg-white/10 hover:bg-white/20 text-white'
                  }`}
                >
                  {plan.name === 'Free' ? 'Get Started' : 'Subscribe'}
                </Button>
              </Link>
            </div>
          ))}
        </div>

        <div className="space-y-8">
          <section className="bg-gradient-to-b from-white/5 to-transparent border border-white/10 rounded-2xl p-6">
            <h2 className="text-xl font-medium text-white mb-4">Payment Information</h2>
            <div className="grid md:grid-cols-2 gap-6 text-gray-300">
              <div>
                <h3 className="font-medium text-white mb-2">Accepted Payment Methods</h3>
                <ul className="list-disc list-inside space-y-1 text-gray-400">
                  <li>Credit/Debit Cards (Visa, Mastercard, RuPay)</li>
                  <li>UPI (Google Pay, PhonePe, Paytm)</li>
                  <li>Net Banking</li>
                  <li>Wallets</li>
                </ul>
              </div>
              <div>
                <h3 className="font-medium text-white mb-2">Payment Security</h3>
                <p className="text-gray-400">
                  All payments are processed securely through Razorpay, a PCI-DSS compliant payment gateway. 
                  We never store your card details on our servers.
                </p>
              </div>
            </div>
          </section>

          <section className="bg-gradient-to-b from-white/5 to-transparent border border-white/10 rounded-2xl p-6">
            <h2 className="text-xl font-medium text-white mb-4">Billing Details</h2>
            <div className="space-y-4 text-gray-300">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="p-4 border border-white/10 rounded-xl">
                  <h3 className="font-medium text-white mb-2">Billing Cycle</h3>
                  <p className="text-sm text-gray-400">
                    Subscriptions are billed monthly. Your billing date is the day you first subscribed.
                  </p>
                </div>
                <div className="p-4 border border-white/10 rounded-xl">
                  <h3 className="font-medium text-white mb-2">Auto-Renewal</h3>
                  <p className="text-sm text-gray-400">
                    Subscriptions auto-renew unless cancelled. You can cancel anytime from your account settings.
                  </p>
                </div>
                <div className="p-4 border border-white/10 rounded-xl">
                  <h3 className="font-medium text-white mb-2">Currency</h3>
                  <p className="text-sm text-gray-400">
                    All prices are in USD. Local currency conversion is handled by your payment provider.
                  </p>
                </div>
                <div className="p-4 border border-white/10 rounded-xl">
                  <h3 className="font-medium text-white mb-2">Taxes</h3>
                  <p className="text-sm text-gray-400">
                    Prices shown exclude applicable taxes. GST (18%) applies for Indian customers.
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section className="bg-gradient-to-b from-white/5 to-transparent border border-white/10 rounded-2xl p-6">
            <h2 className="text-xl font-medium text-white mb-4">Word Credits Explained</h2>
            <div className="space-y-4 text-gray-300">
              <p className="leading-relaxed">
                Word credits are consumed when you use our tools. Here's how credits work:
              </p>
              <ul className="list-disc list-inside space-y-2 text-gray-400">
                <li><strong className="text-white">AI Detection:</strong> 1 word = 1 credit</li>
                <li><strong className="text-white">Humanizer:</strong> 1 word = 1 credit</li>
                <li><strong className="text-white">Plagiarism Checker:</strong> 1 word = 1 credit</li>
                <li><strong className="text-white">Writing Tools:</strong> 1 word = 1 credit</li>
              </ul>
              <p className="leading-relaxed mt-4">
                Credits reset monthly on your billing date. Unused credits do not roll over to the next month 
                (except for the Pro and Enterprise plans with unlimited words).
              </p>
            </div>
          </section>

          <section className="bg-gradient-to-b from-white/5 to-transparent border border-white/10 rounded-2xl p-6">
            <h2 className="text-xl font-medium text-white mb-4">Company Information</h2>
            <div className="space-y-2 text-gray-400">
              <p><strong className="text-white">Company:</strong> TextShift</p>
              <p><strong className="text-white">Founder:</strong> Sayan Roy Chowdhury</p>
              <p><strong className="text-white">Address:</strong> 18/1 Banerjee Para Road, West Bengal - 700122, India</p>
              <p><strong className="text-white">Email:</strong> billing@textshift.org</p>
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
