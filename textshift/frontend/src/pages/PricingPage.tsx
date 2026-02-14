import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { usePageSEO } from '@/hooks/usePageSEO';
import { generateFAQSchema } from '@/lib/seo';
import { 
  CheckCircle, 
  ArrowLeft,
  Loader2,
  ChevronDown,
  ArrowRight,
  X
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { paymentApi, contactApi } from '@/lib/api';

declare global {
  interface Window {
    paypal?: any;
  }
}

export default function PricingPage() {
  const { isAuthenticated, user } = useAuthStore();
  const navigate = useNavigate();
  const [loading, setLoading] = useState<string | null>(null);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [showContactModal, setShowContactModal] = useState(false);
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>('monthly');
  const [contactForm, setContactForm] = useState({
    name: '',
    email: user?.email || '',
    company: '',
    phone: '',
    message: ''
  });
  const [contactLoading, setContactLoading] = useState(false);
  const [contactSuccess, setContactSuccess] = useState(false);
  const [countryCode, setCountryCode] = useState('');
  const [currencySymbol, setCurrencySymbol] = useState('$');

  useEffect(() => {
    const detectCountry = async () => {
      try {
        const cached = sessionStorage.getItem('ts_country');
        if (cached && cached.length === 2) {
          setCountryCode(cached);
          if (cached === 'IN') setCurrencySymbol('\u20b9');
          return;
        }
        const res = await fetch('/api/payment/detect-region', { signal: AbortSignal.timeout(8000) });
        if (res.ok) {
          const data = await res.json();
          const code = data.country_code || '';
          if (code.length === 2) {
            setCountryCode(code);
            sessionStorage.setItem('ts_country', code);
            if (code === 'IN') setCurrencySymbol(data.symbol || '\u20b9');
          }
        }
      } catch {}
    };
    detectCountry();
  }, []);

  const isIndia = countryCode === 'IN';

        const monthlyPlans = [
          { 
            id: 'free', 
            name: 'Free', 
            price: 0, 
            credits: '5,000 words/mo', 
            features: [
              'AI Detection only (10 scans/day)',
              'Basic heat map reports',
              'Grammar Checker (500 words/day)',
              'Readability Score (basic)',
              'Summarizer (500 words max)',
              'Paraphraser (standard mode only)',
              'Word Counter',
              'Translator (500 words/day)',
              'Export to TXT only'
            ], 
            notIncluded: [
              'Humanizer',
              'Plagiarism Checker',
              'Tone Adjuster',
              'Citation Generator',
              'Style Analysis',
              'Content Improver',
              'Bulk Processing',
              'API Access'
            ],
            cta: 'Get Started', 
            popular: false 
          },
          { 
            id: 'starter', 
            name: 'Starter', 
            price: isIndia ? 300 : 9.99, 
            credits: '25,000 words/mo',
            features: [
              'AI Detection + Humanizer + Plagiarism',
              '100 scans/day',
              'PDF export & Word-level diff',
              'Grammar Checker (5,000 words/day)',
              'Tone Detector (unlimited)',
              'Tone Adjuster',
              'Readability Score (detailed)',
              'Summarizer (5,000 words max)',
              'Paraphraser (all 5 modes)',
              'Citation Generator (APA, MLA, Chicago)',
              'Style Analysis',
              'Content Improver',
              'Translator (5,000 words/day)',
              'Export to TXT, HTML, Markdown'
            ], 
            notIncluded: [
              'Bulk Processing',
              'API Access'
            ],
            cta: 'Subscribe', 
            popular: false 
          },
          { 
            id: 'pro', 
            name: 'Pro', 
            price: isIndia ? 1000 : 24.99, 
            credits: 'Unlimited',
            features: [
              'All 3 core tools (500 scans/day)',
              'All 14 Writing Tools - Unlimited',
              'Grammar Checker (unlimited)',
              'Summarizer (unlimited)',
              'Translator (unlimited)',
              'Bulk Processing (up to 10 files)',
              'Shareable reports',
              'Priority support',
              'Everything in Starter'
            ], 
            notIncluded: [
              'API Access',
              'White-label API'
            ],
            cta: 'Subscribe', 
            popular: true 
          },
          { 
            id: 'enterprise', 
            name: 'Enterprise', 
            price: isIndia ? 2000 : 49.99, 
            credits: 'True Unlimited',
            features: [
              'Unlimited scans (no daily limit)',
              'All 14 Writing Tools - Unlimited',
              'Bulk Processing (up to 50 files)',
              'Full REST API Access',
              'White-label API',
              'Custom integrations',
              'Dedicated account manager',
              'SLA guarantee (99.9% uptime)',
              'Everything in Pro'
            ], 
            notIncluded: [],
            cta: 'Contact Sales', 
            popular: false 
          }
        ];

  const yearlyPricesINR: Record<string, number> = { starter: 3000, pro: 10000, enterprise: 20000 };

  const getYearlyPrice = (monthlyPrice: number, planId?: string) => {
    if (monthlyPrice === 0) return 0;
    if (isIndia && planId && yearlyPricesINR[planId]) return yearlyPricesINR[planId];
    return Math.round(monthlyPrice * 10 * 100) / 100;
  };

  const getYearlySavings = (monthlyPrice: number, planId?: string) => {
    if (monthlyPrice === 0) return 0;
    if (isIndia && planId && yearlyPricesINR[planId]) return monthlyPrice * 12 - yearlyPricesINR[planId];
    return Math.round(monthlyPrice * 2 * 100) / 100;
  };

  const plans = monthlyPlans.map(plan => ({
    ...plan,
    displayPrice: billingPeriod === 'monthly' ? plan.price : getYearlyPrice(plan.price, plan.id),
    savings: billingPeriod === 'yearly' ? getYearlySavings(plan.price, plan.id) : 0,
  }));

  const faqs = [
    { q: 'What does "words" mean in the plans?', a: 'Words are the unit we use to measure usage. Each word you scan counts toward your monthly limit. Pro and Enterprise plans have unlimited words!' },
    { q: 'What\'s the difference between Pro and Enterprise unlimited?', a: 'Pro has a fair use limit of 500 scans/day to prevent abuse. Enterprise has truly unlimited scans with no daily limits, plus white-label API access.' },
    { q: 'Can I upgrade or downgrade my plan?', a: 'Yes, you can change your plan at any time. Upgrades take effect immediately.' },
    { q: 'What payment methods do you accept?', a: 'We accept PayPal for secure payments. You can pay with your PayPal balance, bank account, or credit/debit card through PayPal.' },
    { q: 'Is there a free plan?', a: 'Yes! Our Free plan includes 5,000 words/month for AI Detection. Upgrade to Starter or higher to access Humanizer and Plagiarism Checker.' },
    { q: 'How accurate is the AI detection?', a: 'Our Advanced Neural Intelligence achieves industry-leading 99% accuracy with zero false positives, tested against all major AI writing tools.' },
    { q: 'Can I cancel anytime?', a: 'Absolutely. Cancel your subscription anytime with no questions asked.' }
  ];

  usePageSEO({
    title: 'Pricing - AI Detection & Humanization Plans',
    description: 'Choose the perfect TextShift plan. Free tier with 5,000 words/month. Starter at $9.99, Pro at $24.99, Enterprise at $49.99. AI detection, humanization, plagiarism checking.',
    keywords: 'TextShift pricing, AI detector pricing, text humanizer plans, plagiarism checker cost, writing tools subscription',
    structuredData: [
      generateFAQSchema(
        faqs.map(f => ({ question: f.q, answer: f.a }))
      ),
    ],
  });

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setContactLoading(true);
    try {
      await contactApi.contactSales({
        ...contactForm,
        plan_interest: 'enterprise'
      });
      setContactSuccess(true);
    } catch (error) {
      console.error('Failed to submit contact form:', error);
      alert('Failed to submit. Please try again or email us at harryroger798@gmail.com');
    } finally {
      setContactLoading(false);
    }
  };

  const handleSubscribe = async (planId: string) => {
    if (!isAuthenticated) {
      navigate('/register');
      return;
    }
    if (planId === 'free') {
      navigate('/dashboard');
      return;
    }
    if (planId === 'enterprise') {
      setShowContactModal(true);
      return;
    }
    setLoading(planId);
    try {
      const order = await paymentApi.createOrder(planId, billingPeriod, countryCode);
      if (order.approval_url) {
        window.location.href = order.approval_url;
      }
    } catch (error) {
      console.error('Failed to create order:', error);
      alert('Failed to create order. Please try again.');
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-b from-emerald-500/20 via-emerald-500/5 to-transparent rounded-full blur-3xl" />
      </div>

      <nav className="sticky top-0 z-50 border-b border-white/10 bg-[#0a0a0a]/80 backdrop-blur-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
                        <Link to="/" className="flex items-center gap-2">
                          <img src="/images/logo.png" alt="TextShift" className="h-8 w-auto" />
                          <span className="text-white font-medium tracking-wide">TextShift</span>
                        </Link>
            <div className="flex items-center gap-4">
              {isAuthenticated ? (
                <Link to="/dashboard">
                                    <Button variant="outline" className="bg-transparent border-white/20 text-white hover:bg-white/5 rounded-full">
                                      <ArrowLeft className="w-4 h-4 mr-2" />Back to Dashboard
                                    </Button>
                </Link>
              ) : (
                <>
                  <Link to="/login">
                    <Button variant="ghost" className="text-gray-300 hover:text-white hover:bg-white/5">Log in</Button>
                  </Link>
                  <Link to="/register">
                    <Button className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20 rounded-full px-6">Get Started</Button>
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 py-16 md:py-24">
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-light text-white mb-4">
            Plans to suit <span className="text-emerald-400">your needs</span>
          </h1>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto mb-8">
            Credits never expire. No hidden fees. Cancel anytime. Pay with PayPal for secure transactions.
          </p>
          
          {/* Billing Period Toggle */}
          <div className="flex items-center justify-center gap-4">
            <span className={`text-sm ${billingPeriod === 'monthly' ? 'text-white' : 'text-gray-500'}`}>Monthly</span>
            <button
              onClick={() => setBillingPeriod(billingPeriod === 'monthly' ? 'yearly' : 'monthly')}
              className={`relative w-14 h-7 rounded-full transition-colors ${
                billingPeriod === 'yearly' ? 'bg-emerald-500' : 'bg-white/20'
              }`}
            >
              <div className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-transform ${
                billingPeriod === 'yearly' ? 'translate-x-8' : 'translate-x-1'
              }`} />
            </button>
            <span className={`text-sm ${billingPeriod === 'yearly' ? 'text-white' : 'text-gray-500'}`}>
              Yearly
            </span>
            {billingPeriod === 'yearly' && (
              <span className="bg-emerald-500/20 text-emerald-400 text-xs px-2 py-1 rounded-full border border-emerald-500/30">
                2 months FREE
              </span>
            )}
          </div>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-20">
          {plans.map((plan) => (
            <div 
              key={plan.id} 
              className={`relative bg-gradient-to-b from-white/5 to-transparent border rounded-3xl p-6 md:p-8 ${
                plan.popular ? 'border-emerald-500/50 ring-1 ring-emerald-500/20' : 'border-white/10'
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="bg-emerald-500 text-black text-xs font-medium px-3 py-1 rounded-full">Most Popular</span>
                </div>
              )}
              <div className="text-center mb-6">
                <h3 className="text-lg font-medium text-white mb-4">{plan.name}</h3>
                <div className="mb-2">
                  <span className="text-3xl md:text-4xl font-light text-white">
                    {plan.displayPrice === 0 ? `${currencySymbol}0` : `${currencySymbol}${isIndia ? Math.round(plan.displayPrice).toLocaleString('en-IN') : plan.displayPrice.toFixed(2)}`}
                  </span>
                  {plan.displayPrice !== 0 && (
                    <span className="text-gray-500">/{billingPeriod === 'monthly' ? 'month' : 'year'}</span>
                  )}
                </div>
                {billingPeriod === 'yearly' && plan.savings > 0 && (
                  <div className="text-emerald-400 text-xs mb-1">Save {currencySymbol}{isIndia ? Math.round(plan.savings).toLocaleString('en-IN') : plan.savings.toFixed(2)}/year</div>
                )}
                <div className="text-gray-500 text-sm">{plan.credits}</div>
              </div>
              <ul className="space-y-2 mb-6">
                {plan.features.map((feature, j) => (
                  <li key={j} className="flex items-start text-gray-300 text-sm">
                    <CheckCircle className="w-4 h-4 text-emerald-400 mr-2 flex-shrink-0 mt-0.5" />{feature}
                  </li>
                ))}
              </ul>
              {plan.notIncluded && plan.notIncluded.length > 0 && (
                <ul className="space-y-2 mb-6 pt-4 border-t border-white/5">
                  {plan.notIncluded.map((feature, j) => (
                    <li key={j} className="flex items-start text-gray-500 text-sm">
                      <X className="w-4 h-4 text-gray-600 mr-2 flex-shrink-0 mt-0.5" />{feature}
                    </li>
                  ))}
                </ul>
              )}
              {isAuthenticated && user?.subscription_tier?.toLowerCase() === plan.id ? (
                <Button 
                  disabled
                  className="w-full rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 cursor-default"
                >
                  <CheckCircle className="w-4 h-4 mr-2" />Current Plan
                </Button>
              ) : (
                <Button 
                  onClick={() => handleSubscribe(plan.id)}
                  disabled={loading === plan.id}
                  className={`w-full rounded-full ${
                    plan.popular ? 'bg-emerald-500 hover:bg-emerald-600 text-black' : 'bg-white/5 hover:bg-white/10 text-white border border-white/10'
                  }`}
                >
                  {loading === plan.id ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin" />Processing...</>) : plan.cta}
                </Button>
              )}
            </div>
          ))}
        </div>

        <div className="max-w-3xl mx-auto mb-20">
          <h2 className="text-3xl md:text-4xl font-light text-white text-center mb-12">
            <span className="text-emerald-400">FAQ</span>
          </h2>
          <div className="space-y-4">
            {faqs.map((faq, i) => (
              <div key={i} className="bg-gradient-to-b from-white/5 to-transparent border border-white/10 rounded-2xl overflow-hidden">
                <button onClick={() => setOpenFaq(openFaq === i ? null : i)} className="w-full flex items-center justify-between p-5 md:p-6 text-left">
                  <span className="text-white font-medium pr-4">{faq.q}</span>
                  <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform flex-shrink-0 ${openFaq === i ? 'rotate-180' : ''}`} />
                </button>
                {openFaq === i && (<div className="px-5 md:px-6 pb-5 md:pb-6 text-gray-400">{faq.a}</div>)}
              </div>
            ))}
          </div>
        </div>

        <div className="text-center py-12 border-t border-white/10">
          <h2 className="text-2xl md:text-3xl font-light text-white mb-4">Still have questions?</h2>
          <p className="text-gray-400 mb-8">Contact our support team and we'll help you find the right plan.</p>
          <Button
            variant="outline"
            onClick={() => setShowContactModal(true)}
            className="bg-transparent border-white/20 text-white hover:bg-white/5 rounded-full px-8"
          >
            Contact Support <ArrowRight className="ml-2 w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Contact Sales Modal */}
      {showContactModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => !contactLoading && setShowContactModal(false)} />
          <div className="relative w-full max-w-lg bg-gradient-to-b from-[#1a1a1a] to-[#0a0a0a] border border-white/10 rounded-3xl p-6 md:p-8 shadow-2xl max-h-[90vh] overflow-y-auto">
            <button 
              onClick={() => !contactLoading && setShowContactModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
            >
              <X className="w-6 h-6" />
            </button>

            {contactSuccess ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                  <CheckCircle className="w-8 h-8 text-emerald-400" />
                </div>
                <h3 className="text-2xl font-medium text-white mb-3">Thank You!</h3>
                <p className="text-gray-400 mb-6">
                  We've received your inquiry and our team will contact you within 24 hours.
                </p>
                <Button 
                  onClick={() => {
                    setShowContactModal(false);
                    setContactSuccess(false);
                    setContactForm({ name: '', email: user?.email || '', company: '', phone: '', message: '' });
                  }}
                  className="bg-emerald-500 hover:bg-emerald-600 text-black rounded-full px-8"
                >
                  Close
                </Button>
              </div>
            ) : (
              <>
                <div className="text-center mb-8">
                  <div className="w-12 h-12 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-2xl">🏢</span>
                  </div>
                  <h3 className="text-2xl font-medium text-white mb-2">Contact Sales</h3>
                  <p className="text-gray-400">
                    Get a custom Enterprise plan tailored to your organization's needs.
                  </p>
                </div>

                <form onSubmit={handleContactSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Full Name *</label>
                    <input
                      type="text"
                      required
                      value={contactForm.name}
                      onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all"
                      placeholder="John Smith"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Work Email *</label>
                    <input
                      type="email"
                      required
                      value={contactForm.email}
                      onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all"
                      placeholder="john@company.com"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Company</label>
                      <input
                        type="text"
                        value={contactForm.company}
                        onChange={(e) => setContactForm({ ...contactForm, company: e.target.value })}
                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all"
                        placeholder="Acme Inc."
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Phone</label>
                      <input
                        type="tel"
                        value={contactForm.phone}
                        onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })}
                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all"
                        placeholder="+1 (555) 000-0000"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">How can we help? *</label>
                    <textarea
                      required
                      rows={4}
                      value={contactForm.message}
                      onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })}
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all resize-none"
                      placeholder="Tell us about your team size, use case, and any specific requirements..."
                    />
                  </div>

                  <Button
                    type="submit"
                    disabled={contactLoading}
                    className="w-full bg-emerald-500 hover:bg-emerald-600 text-black font-medium py-3 rounded-full transition-all"
                  >
                    {contactLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      'Send Message'
                    )}
                  </Button>

                  <p className="text-center text-gray-500 text-sm">
                    We'll respond within 24 hours. No spam, ever.
                  </p>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
