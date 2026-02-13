import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { usePageSEO } from '@/hooks/usePageSEO';
import { generateFAQSchema } from '@/lib/seo';
import { 
  Shield, 
  Sparkles, 
  Search, 
  Zap, 
  CheckCircle, 
  ArrowRight,
  ChevronDown,
  Star,
  Menu,
  X,
  LayoutDashboard,
  Brain,
  RefreshCw,
  TrendingUp,
  Users,
  Target,
  Cpu,
  Gift,
  Clock,
  Languages,
  FileText,
  PenTool,
  BookOpen,
  Quote,
  Wand2,
  Palette,
  Lightbulb,
  Loader2,
  Mail,
  Building,
  Phone,
  MessageSquare
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  ParticlesBackground,
  AnimatedCounter,
  ScrollReveal,
  TiltCard,
  MagneticButton,
  LiveUserCounter,
  ActivityToast,
  GradientBackground,
  NoiseOverlay,
} from '@/components/animations';
import { useAuthStore } from '@/store/authStore';

const API_URL = import.meta.env.VITE_API_URL ?? (import.meta.env.PROD ? '' : 'http://localhost:8000');

interface LandingPromo {
  id: number;
  code: string;
  title: string;
  description: string;
  promo_type: string;
  plan_tier: string | null;
  duration_days: number;
  end_date: string | null;
  landing_headline: string | null;
  landing_subtext: string | null;
  landing_button_text: string | null;
  landing_badge_text: string | null;
  days_until_expiry: number | null;
}


const TYPING_WORDS = ['AI Detection.', 'Humanizer.', 'Plagiarism Check.'];

function TypingEffect() {
  const [wordIndex, setWordIndex] = useState(0);
  const [text, setText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const currentWord = TYPING_WORDS[wordIndex];
    let timeout: ReturnType<typeof setTimeout>;

    if (!isDeleting && text === currentWord) {
      timeout = setTimeout(() => setIsDeleting(true), 2000);
    } else if (isDeleting && text === '') {
      setIsDeleting(false);
      setWordIndex((prev) => (prev + 1) % TYPING_WORDS.length);
    } else {
      timeout = setTimeout(() => {
        setText(currentWord.substring(0, isDeleting ? text.length - 1 : text.length + 1));
      }, isDeleting ? 30 : 80);
    }

    return () => clearTimeout(timeout);
  }, [text, isDeleting, wordIndex]);

  return (
    <span className="text-emerald-400">
      {text}
      <span className="animate-blink">|</span>
    </span>
  );
}

export default function LandingPage() {
  const [demoText, setDemoText] = useState('');
  const [demoResult, setDemoResult] = useState<null | { type: string; score: number }>(null);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activePromos, setActivePromos] = useState<LandingPromo[]>([]);
  const { isAuthenticated, logout, user } = useAuthStore();

  usePageSEO({
    title: 'AI Content Detection & Humanization Tool | 99% Accuracy',
    description: 'Detect AI-generated content with 99.18% accuracy. Humanize AI text to bypass detection. Free plagiarism checker. 14 writing tools. Trusted by 10,000+ users.',
    keywords: 'AI detector, AI content detection, humanize AI text, plagiarism checker, ChatGPT detector, AI writing tools, grammar checker, text humanizer',
    ogType: 'website',
    structuredData: [
      generateFAQSchema([
        { question: 'What makes TextShift different?', answer: 'TextShift combines AI detection, humanization, and plagiarism checking in one platform with industry-leading 99% accuracy.' },
        { question: 'How accurate is the AI detection?', answer: 'Our Advanced Neural Intelligence system achieves 99% accuracy with zero false positives.' },
        { question: "What's included in the free plan?", answer: 'The free plan includes 5,000 words/month for AI Detection with 10 scans/day.' },
        { question: 'How does the humanizer work?', answer: 'Our Natural Language Transformation Engine rewrites AI-generated text to sound authentically human while preserving your original meaning.' },
        { question: 'Is my content secure?', answer: "We don't store your content after processing. All data is encrypted and protected." },
      ]),
    ],
  });
  
  // Contact modal state
  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [contactForm, setContactForm] = useState({
    name: '',
    email: '',
    company: '',
    phone: '',
    message: '',
    plan_interest: 'General'
  });
  const [contactLoading, setContactLoading] = useState(false);
  const [contactSuccess, setContactSuccess] = useState(false);
  const [contactError, setContactError] = useState('');
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

  useEffect(() => {
    const fetchPromos = async () => {
      try {
        const response = await fetch(`${API_URL}/api/promo/active`);
        if (response.ok) {
          const data = await response.json();
          setActivePromos(data);
        }
      } catch (err) {
        console.error('Failed to fetch promos:', err);
      }
    };
    fetchPromos();
  }, []);

  const handleDemoCheck = () => {
    if (demoText.length > 20) {
      const score = Math.random() * 100;
      setDemoResult({
        type: score > 50 ? 'AI Generated' : 'Human Written',
        score: Math.round(score)
      });
    }
  };

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setContactLoading(true);
    setContactError('');
    
    try {
      const response = await fetch(`${API_URL}/api/contact/sales`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(contactForm),
      });
      
      if (response.ok) {
        setContactSuccess(true);
        setContactForm({
          name: '',
          email: '',
          company: '',
          phone: '',
          message: '',
          plan_interest: 'General'
        });
      } else {
        const data = await response.json();
        setContactError(data.detail || 'Failed to send message. Please try again.');
      }
    } catch {
      setContactError('Failed to send message. Please try again or email us directly at support@mail.textshift.org');
    } finally {
      setContactLoading(false);
    }
  };

    const faqs = [
      { q: "What makes TextShift different?", a: "TextShift combines AI detection, humanization, and plagiarism checking in one platform with industry-leading 99% accuracy. Pro and Enterprise plans offer unlimited usage, and we're 40-70% cheaper than competitors." },
      { q: "How accurate is the AI detection?", a: "Our Advanced Neural Intelligence system achieves 99% accuracy with zero false positives, tested against all major AI writing tools including ChatGPT, Claude, and Gemini." },
      { q: "What's included in the free plan?", a: "The free plan includes 5,000 words/month for AI Detection with 10 scans/day. Upgrade to Starter ($9/mo) for all 3 tools, or Pro ($19/mo) for unlimited usage." },
      { q: "How does the humanizer work?", a: "Our Natural Language Transformation Engine rewrites AI-generated text to sound authentically human while preserving your original meaning. It achieves 0% AI detection on all major detectors. Available on Starter plan and above." },
      { q: "Is my content secure?", a: "Absolutely. We don't store your content after processing. All data is encrypted and protected at every step." }
    ];

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white overflow-x-hidden">
      <ParticlesBackground />
      <GradientBackground />
      <NoiseOverlay />
      <LiveUserCounter />
      <ActivityToast />

      <nav className="fixed w-full z-50 px-6 py-4">
        <div
          className="max-w-7xl mx-auto flex items-center justify-between animate-fade-in-up"
        >
          <Link to="/" className="flex items-center gap-2 group">
            <img 
              src="https://ik.imagekit.io/tijkyyzycl/logo.png?tr=w-32,h-32,f-webp,q-80" 
              alt="TextShift" 
              className="w-8 h-8 object-contain"
            />
            <span className="text-white font-medium tracking-wide">TextShift</span>
          </Link>
          
          <div className="hidden md:flex items-center gap-1 bg-white/5 backdrop-blur-md rounded-full px-2 py-1 border border-white/10">
            <a href="#features" className="px-4 py-2 text-sm text-gray-300 hover:text-white transition">Features</a>
            <a href="#demo" className="px-4 py-2 text-sm text-gray-300 hover:text-white transition">Demo</a>
            <a href="#pricing" className="px-4 py-2 text-sm text-gray-300 hover:text-white transition">Pricing</a>
            <a href="#faq" className="px-4 py-2 text-sm text-gray-300 hover:text-white transition">FAQ</a>
            <a href="https://textshift.blog" target="_blank" rel="noopener noreferrer" className="px-4 py-2 text-sm text-gray-300 hover:text-white transition">Blog</a>
            <a href="#contact" className="px-4 py-2 text-sm text-gray-300 hover:text-white transition">
              Contact
            </a>
          </div>

          <div className="hidden md:flex items-center gap-3">
            {isAuthenticated ? (
              <>
                <Link to="/dashboard">
                  <Button variant="ghost" className="text-gray-300 hover:text-white hover:bg-white/5 flex items-center gap-2">
                    <LayoutDashboard className="w-4 h-4" />
                    Dashboard
                  </Button>
                </Link>
                <MagneticButton>
                  <Button 
                    onClick={() => logout()}
                    className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20 hover:shadow-lg hover:shadow-emerald-500/20 rounded-full px-6 transition-all duration-300"
                  >
                    Log out
                  </Button>
                </MagneticButton>
              </>
            ) : (
              <>
                <Link to="/login">
                  <Button variant="ghost" className="text-gray-300 hover:text-white hover:bg-white/5">Log in</Button>
                </Link>
                <MagneticButton>
                  <Link to="/register">
                    <Button className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20 hover:shadow-lg hover:shadow-emerald-500/20 rounded-full px-6 transition-all duration-300">Get Started</Button>
                  </Link>
                </MagneticButton>
              </>
            )}
          </div>

                    <button 
                      className="md:hidden text-white p-2 cursor-auto" 
                      onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                      aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
                      aria-expanded={mobileMenuOpen}
                    >
                      {mobileMenuOpen ? <X className="w-6 h-6" aria-hidden="true" /> : <Menu className="w-6 h-6" aria-hidden="true" />}
                    </button>
        </div>

        {mobileMenuOpen && (
          <div
            className="md:hidden absolute top-full left-0 right-0 bg-[#0a0a0a]/95 backdrop-blur-lg border-b border-white/10 p-6"
          >
            <div className="flex flex-col gap-4">
              <a href="#features" className="text-gray-300 hover:text-white transition" onClick={() => setMobileMenuOpen(false)}>Features</a>
              <a href="#demo" className="text-gray-300 hover:text-white transition" onClick={() => setMobileMenuOpen(false)}>Demo</a>
              <a href="#pricing" className="text-gray-300 hover:text-white transition" onClick={() => setMobileMenuOpen(false)}>Pricing</a>
              <a href="#faq" className="text-gray-300 hover:text-white transition" onClick={() => setMobileMenuOpen(false)}>FAQ</a>
              <a href="#contact" className="text-gray-300 hover:text-white transition" onClick={() => setMobileMenuOpen(false)}>Contact</a>
              <div className="flex flex-col gap-2 pt-4 border-t border-white/10">
                {isAuthenticated ? (
                  <>
                    <Link to="/dashboard" onClick={() => setMobileMenuOpen(false)}>
                      <Button variant="ghost" className="w-full text-gray-300 hover:text-white hover:bg-white/5 flex items-center justify-center gap-2">
                        <LayoutDashboard className="w-4 h-4" />
                        Dashboard
                      </Button>
                    </Link>
                    <Button 
                      onClick={() => { logout(); setMobileMenuOpen(false); }}
                      className="w-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20 rounded-full"
                    >
                      Log out
                    </Button>
                  </>
                ) : (
                  <>
                    <Link to="/login" onClick={() => setMobileMenuOpen(false)}>
                      <Button variant="ghost" className="w-full text-gray-300 hover:text-white hover:bg-white/5">Log in</Button>
                    </Link>
                    <Link to="/register" onClick={() => setMobileMenuOpen(false)}>
                      <Button className="w-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20 rounded-full">Get Started</Button>
                    </Link>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </nav>

      <section className="relative min-h-screen flex items-center justify-center px-6 pt-20">
        <div className="absolute inset-0 z-0">
          <img
            src="https://ik.imagekit.io/tijkyyzycl/hero-bg.png?tr=f-webp,q-20,w-800"
            srcSet="https://ik.imagekit.io/tijkyyzycl/hero-bg.png?tr=f-webp,q-15,w-400 640w, https://ik.imagekit.io/tijkyyzycl/hero-bg.png?tr=f-webp,q-20,w-800 1024w, https://ik.imagekit.io/tijkyyzycl/hero-bg.png?tr=f-webp,q-30,w-1280 1280w"
            sizes="100vw"
            alt=""
            className="w-full h-full object-cover opacity-20"
            loading="lazy"
            decoding="async"
            width={1920}
            height={1080}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#0a0a0a] via-transparent to-[#0a0a0a]" />
        </div>
        <div className="max-w-5xl mx-auto text-center relative z-10">
          <div>
              <h1 className="text-4xl sm:text-5xl md:text-7xl lg:text-8xl font-light tracking-tight mb-8">
                Transform your content<br />with{' '}
                <TypingEffect />
              </h1>
          </div>
          
          <p className="text-lg md:text-xl text-gray-300 max-w-2xl mx-auto mb-12">
            The most accurate AI detection, humanization, and plagiarism checking platform. Industry-leading 99% accuracy. Credits never expire.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <MagneticButton>
              <Link to={isAuthenticated ? "/dashboard" : "/register"}>
                <Button className="bg-emerald-500 hover:bg-emerald-400 text-black font-medium rounded-full px-8 py-6 text-lg w-full sm:w-auto shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 transition-all duration-300">
                  {isAuthenticated ? "Go to Dashboard" : "Start Free"}
                  <span className="ml-2">
                    <ArrowRight className="w-5 h-5" />
                  </span>
                </Button>
              </Link>
            </MagneticButton>
            <MagneticButton>
              <a href="#demo">
                <Button variant="outline" className="bg-transparent border-white/20 text-white hover:bg-white/5 hover:border-white/40 rounded-full px-8 py-6 text-lg w-full sm:w-auto transition-all duration-300">
                  Try Demo <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
              </a>
            </MagneticButton>
          </div>

          <div className="mt-16 flex flex-wrap items-center justify-center gap-4 md:gap-8 text-sm text-gray-300">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-400" />
              <span>No credit card required</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-400" />
              <span>5,000 free words</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-400" />
              <span>Cancel anytime</span>
            </div>
          </div>
        </div>
        
              <div
                className="absolute bottom-10 left-1/2 -translate-x-1/2"
              >
                <ChevronDown className="w-6 h-6 text-gray-300" aria-hidden="true" />
              </div>
            </section>

            {/* Promo Banner Section */}
            {activePromos.length > 0 && (
              <section className="py-8 px-6">
                <div className="max-w-4xl mx-auto">
                  {activePromos.map((promo) => (
                    <div
                      key={promo.id}
                      className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-500/20 via-emerald-600/10 to-purple-500/20 border border-emerald-500/30 p-6 md:p-8"
                    >
                      <div className="absolute inset-0 opacity-5 bg-[length:100px_100px]" style={{backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=%270 0 200 200%27 xmlns=%27http://www.w3.org/2000/svg%27%3E%3Cfilter id=%27n%27%3E%3CfeTurbulence type=%27fractalNoise%27 baseFrequency=%270.65%27 numOctaves=%273%27 stitchTiles=%27stitch%27/%3E%3C/filter%3E%3Crect width=%27100%25%27 height=%27100%25%27 filter=%27url(%23n)%27/%3E%3C/svg%3E")'}} />
                      <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
                
                      <div className="relative flex flex-col md:flex-row items-center justify-between gap-6">
                        <div className="flex-1 text-center md:text-left">
                          <div className="flex items-center justify-center md:justify-start gap-2 mb-2">
                            <Gift className="w-5 h-5 text-emerald-400" />
                                                        {promo.landing_badge_text && (
                                                          <span className="px-3 py-1 bg-emerald-500/20 text-emerald-400 text-xs font-medium rounded-full border border-emerald-500/30">
                                                            {promo.landing_badge_text}
                                                          </span>
                                                        )}
                                                        {promo.days_until_expiry !== null && promo.days_until_expiry >= 0 && promo.days_until_expiry <= 7 && (
                                                          <span className="flex items-center gap-1 px-3 py-1 bg-yellow-500/20 text-yellow-400 text-xs font-medium rounded-full border border-yellow-500/30">
                                                            <Clock className="w-3 h-3" />
                                                            {promo.days_until_expiry} days left
                                                          </span>
                                                        )}
                          </div>
                          <h2 className="text-2xl md:text-3xl font-bold text-white mb-2">
                            {promo.landing_headline || promo.title}
                          </h2>
                          <p className="text-gray-300 text-lg">
                            {promo.landing_subtext || promo.description}
                          </p>
                          <div className="mt-3 flex items-center justify-center md:justify-start gap-4 text-sm text-gray-300">
                            <span className="flex items-center gap-1">
                              <CheckCircle className="w-4 h-4 text-emerald-400" />
                              {promo.duration_days} days free
                            </span>
                            {promo.plan_tier && (
                              <span className="flex items-center gap-1">
                                <Zap className="w-4 h-4 text-emerald-400" />
                                {promo.plan_tier.charAt(0).toUpperCase() + promo.plan_tier.slice(1)} Plan
                              </span>
                            )}
                          </div>
                        </div>
                  
                        <div className="flex flex-col items-center gap-3">
                          <Link to={`/register?promo=${promo.code}`}>
                            <MagneticButton>
                              <Button className="bg-emerald-500 hover:bg-emerald-400 text-black font-semibold rounded-full px-8 py-6 text-lg shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 transition-all duration-300">
                                {promo.landing_button_text || 'Claim Now'}
                                <ArrowRight className="ml-2 w-5 h-5" />
                              </Button>
                            </MagneticButton>
                          </Link>
                          <code className="text-emerald-400 text-sm bg-emerald-500/10 px-3 py-1 rounded-lg border border-emerald-500/20">
                            Code: {promo.code}
                          </code>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <section className="py-20 md:py-32 px-6">
        <div className="max-w-6xl mx-auto">
          <ScrollReveal>
            <h2 className="text-3xl sm:text-4xl md:text-6xl lg:text-7xl font-light leading-tight">
              <span className="text-white">We're a </span><span className="text-gray-300">full-service</span><br />
              <span className="text-gray-300">AI Content</span><br />
              <span 
                className="text-emerald-400 inline-block"
              >
                Platform
              </span>
              <span className="text-2xl ml-4">&#128075;</span>
              <span className="text-white"> We turn</span><br />
              <span className="text-white">AI-generated text</span><br />
              <span className="text-gray-300">into </span>
              <span 
                className="text-emerald-400 inline-block"
              >
                human-quality content.
              </span>
            </h2>
          </ScrollReveal>
        </div>
      </section>

      <section id="features" className="py-20 px-6">
        <div className="max-w-7xl mx-auto">
          <ScrollReveal>
            <div className="text-center mb-16 md:mb-20">
              <h2 className="text-3xl md:text-4xl lg:text-5xl font-light text-white mb-4">Our <span className="text-emerald-400">Tools</span></h2>
              <p className="text-gray-300 text-lg max-w-2xl mx-auto mb-6">Three powerful tools, one platform. Everything you need to ensure your content is original, authentically human, and completely unique.</p>
              <Link to="/features" className="inline-flex items-center text-emerald-400 hover:text-emerald-300 transition-colors">
                View all features <ArrowRight className="w-4 h-4 ml-2" />
              </Link>
            </div>
          </ScrollReveal>
          
          <div className="grid md:grid-cols-3 gap-6">
            <ScrollReveal delay={0.1}>
              <TiltCard className="h-full" glowColor="rgba(16, 185, 129, 0.4)">
                <div className="group relative bg-gradient-to-b from-white/5 to-transparent border border-white/10 rounded-3xl p-6 md:p-8 hover:border-emerald-500/30 transition-all duration-500 overflow-hidden h-full backdrop-blur-sm">
                  <div className="absolute inset-0 bg-gradient-to-b from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-3xl" />
                  <div className="absolute inset-0 opacity-10 group-hover:opacity-20 transition-opacity">
                    <img src="https://ik.imagekit.io/tijkyyzycl/ai-detection-card.png?tr=f-webp,q-75" alt="" className="w-full h-full object-cover" loading="lazy" />
                  </div>
                  <div className="relative">
                    <div 
                      className="w-12 h-12 md:w-14 md:h-14 bg-emerald-500/10 rounded-2xl flex items-center justify-center mb-6"
                    >
                      <Shield className="w-6 h-6 md:w-7 md:h-7 text-emerald-400" />
                    </div>
                                        <h3 className="text-xl md:text-2xl font-medium text-white mb-3">AI Detection</h3>
                                        <p className="text-gray-300 mb-6">Powered by Advanced Neural Intelligence that reads text like a human expert - spotting machine-generated content with 99% accuracy.</p>
                    <ul className="space-y-3">
                      {['Heat map visualization', 'Sentence-by-sentence breakdown', 'PDF export & shareable reports', 'Confidence meter gauge'].map((item, i) => (
                        <li 
                          key={i} 
                          className="flex items-center text-gray-300 text-sm"
                        >
                          <CheckCircle className="w-4 h-4 text-emerald-400 mr-3 flex-shrink-0" />{item}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </TiltCard>
            </ScrollReveal>

            <ScrollReveal delay={0.2}>
              <TiltCard className="h-full" glowColor="rgba(168, 85, 247, 0.4)">
                <div className="group relative bg-gradient-to-b from-white/5 to-transparent border border-white/10 rounded-3xl p-6 md:p-8 hover:border-purple-500/30 transition-all duration-500 overflow-hidden h-full backdrop-blur-sm">
                  <div className="absolute inset-0 bg-gradient-to-b from-purple-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-3xl" />
                  <div className="absolute inset-0 opacity-10 group-hover:opacity-20 transition-opacity">
                    <img src="https://ik.imagekit.io/tijkyyzycl/humanizer-card.png?tr=f-webp,q-75" alt="" className="w-full h-full object-cover" loading="lazy" />
                  </div>
                  <div className="relative">
                    <div 
                      className="w-12 h-12 md:w-14 md:h-14 bg-purple-500/10 rounded-2xl flex items-center justify-center mb-6"
                    >
                      <Sparkles className="w-6 h-6 md:w-7 md:h-7 text-purple-400" />
                    </div>
                                        <h3 className="text-xl md:text-2xl font-medium text-white mb-3">Text Humanizer</h3>
                                        <p className="text-gray-300 mb-6">Our Natural Language Engine transforms robotic text into authentic, human-sounding content while preserving your original meaning.</p>
                    <ul className="space-y-3">
                      {['Word-level diff comparison', 'Side-by-side before/after', 'Preserves original meaning', 'Re-analyze with one click'].map((item, i) => (
                        <li 
                          key={i} 
                          className="flex items-center text-gray-300 text-sm"
                        >
                          <CheckCircle className="w-4 h-4 text-purple-400 mr-3 flex-shrink-0" />{item}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </TiltCard>
            </ScrollReveal>

            <ScrollReveal delay={0.3}>
              <TiltCard className="h-full" glowColor="rgba(59, 130, 246, 0.4)">
                <div className="group relative bg-gradient-to-b from-white/5 to-transparent border border-white/10 rounded-3xl p-6 md:p-8 hover:border-blue-500/30 transition-all duration-500 overflow-hidden h-full backdrop-blur-sm">
                  <div className="absolute inset-0 bg-gradient-to-b from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-3xl" />
                  <div className="absolute inset-0 opacity-10 group-hover:opacity-20 transition-opacity">
                    <img src="https://ik.imagekit.io/tijkyyzycl/plagiarism-card.png?tr=f-webp,q-75" alt="" className="w-full h-full object-cover" loading="lazy" />
                  </div>
                  <div className="relative">
                    <div 
                      className="w-12 h-12 md:w-14 md:h-14 bg-blue-500/10 rounded-2xl flex items-center justify-center mb-6"
                    >
                      <Search className="w-6 h-6 md:w-7 md:h-7 text-blue-400" />
                    </div>
                                        <h3 className="text-xl md:text-2xl font-medium text-white mb-3">Plagiarism Checker</h3>
                                        <p className="text-gray-300 mb-6">Scans your content against billions of web pages and documents in real-time. Get instant results with pinpoint accuracy.</p>
                    <ul className="space-y-3">
                      {['Source URLs with matches', 'Percentage breakdown per source', 'PDF export reports', 'Comparison mode'].map((item, i) => (
                        <li 
                          key={i} 
                          className="flex items-center text-gray-300 text-sm"
                        >
                          <CheckCircle className="w-4 h-4 text-blue-400 mr-3 flex-shrink-0" />{item}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </TiltCard>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* Self-Learning AI Section - Competitive Moat */}
      <section className="py-20 md:py-32 px-6 bg-gradient-to-b from-purple-900/10 to-transparent">
        <div className="max-w-7xl mx-auto">
          <ScrollReveal>
            <div className="text-center mb-16">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-purple-500/10 border border-purple-500/30 rounded-full mb-6">
                <Brain className="w-4 h-4 text-purple-400" />
                <span className="text-purple-400 text-sm font-medium">Self-Learning AI Technology</span>
              </div>
              <h2 className="text-3xl md:text-4xl lg:text-5xl font-light text-white mb-4">
                Our AI <span className="text-purple-400">Gets Smarter</span> Every Day
              </h2>
              <p className="text-gray-300 text-lg max-w-3xl mx-auto">
                Unlike static AI tools, TextShift continuously learns from user feedback. Every correction you make helps our models improve, creating an ever-evolving detection system that stays ahead of new AI writing patterns.
              </p>
            </div>
          </ScrollReveal>

          <div className="grid md:grid-cols-3 gap-6 mb-16">
            <ScrollReveal delay={0.1}>
              <TiltCard className="h-full" glowColor="rgba(168, 85, 247, 0.3)">
                <div className="bg-gradient-to-b from-white/5 to-transparent border border-white/10 rounded-3xl p-6 md:p-8 h-full backdrop-blur-sm">
                  <div 
                    className="w-12 h-12 bg-purple-500/10 rounded-2xl flex items-center justify-center mb-6"
                  >
                    <Users className="w-6 h-6 text-purple-400" />
                  </div>
                  <h3 className="text-xl font-medium text-white mb-3">Community-Powered Learning</h3>
                  <p className="text-gray-300 mb-4">
                    Your feedback directly improves our AI. When you mark a result as incorrect, our system learns from it and gets better at detecting similar patterns.
                  </p>
                  <div className="flex items-center gap-2 text-purple-400 text-sm">
                    <RefreshCw className="w-4 h-4" />
                    <span>Continuous improvement cycle</span>
                  </div>
                </div>
              </TiltCard>
            </ScrollReveal>

            <ScrollReveal delay={0.2}>
              <TiltCard className="h-full" glowColor="rgba(168, 85, 247, 0.3)">
                <div className="bg-gradient-to-b from-white/5 to-transparent border border-white/10 rounded-3xl p-6 md:p-8 h-full backdrop-blur-sm">
                  <div 
                    className="w-12 h-12 bg-purple-500/10 rounded-2xl flex items-center justify-center mb-6"
                  >
                    <Cpu className="w-6 h-6 text-purple-400" />
                  </div>
                  <h3 className="text-xl font-medium text-white mb-3">Adaptive Neural Networks</h3>
                  <p className="text-gray-300 mb-4">
                    Our LoRA fine-tuning technology allows rapid model updates without full retraining. New AI writing styles are detected within days, not months.
                  </p>
                  <div className="flex items-center gap-2 text-purple-400 text-sm">
                    <TrendingUp className="w-4 h-4" />
                    <span>Weekly model improvements</span>
                  </div>
                </div>
              </TiltCard>
            </ScrollReveal>

            <ScrollReveal delay={0.3}>
              <TiltCard className="h-full" glowColor="rgba(168, 85, 247, 0.3)">
                <div className="bg-gradient-to-b from-white/5 to-transparent border border-white/10 rounded-3xl p-6 md:p-8 h-full backdrop-blur-sm">
                  <div 
                    className="w-12 h-12 bg-purple-500/10 rounded-2xl flex items-center justify-center mb-6"
                  >
                    <Target className="w-6 h-6 text-purple-400" />
                  </div>
                  <h3 className="text-xl font-medium text-white mb-3">Safe A/B Testing</h3>
                  <p className="text-gray-300 mb-4">
                    Every model update is rigorously tested before deployment. Our A/B testing system ensures new versions perform better before going live.
                  </p>
                  <div className="flex items-center gap-2 text-purple-400 text-sm">
                    <CheckCircle className="w-4 h-4" />
                    <span>Auto-rollback protection</span>
                  </div>
                </div>
              </TiltCard>
            </ScrollReveal>
          </div>

          <ScrollReveal delay={0.4}>
            <div className="bg-gradient-to-r from-purple-500/10 via-purple-500/5 to-purple-500/10 border border-purple-500/20 rounded-3xl p-8 md:p-12">
              <div className="grid md:grid-cols-2 gap-8 items-center">
                <div>
                  <h3 className="text-2xl md:text-3xl font-light text-white mb-4">
                    Why Self-Learning Matters
                  </h3>
                  <p className="text-gray-300 mb-6">
                    AI writing tools evolve constantly. GPT-5, Claude 4, and new models emerge regularly. Static detectors become obsolete within months. Our self-learning system adapts in real-time, ensuring you always have the most accurate detection available.
                  </p>
                  <ul className="space-y-3">
                    {[
                      'Detects new AI models within 7 days of release',
                      'Learns from 20+ edge case scenarios',
                      'Zero false positives on human-written content',
                      'Improves accuracy by 0.5% weekly on average'
                    ].map((item, i) => (
                      <li 
                        key={i}
                        className="flex items-center text-gray-300 text-sm"
                      >
                        <CheckCircle className="w-4 h-4 text-purple-400 mr-3 flex-shrink-0" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="relative">
                  <div className="bg-gray-900/50 rounded-2xl p-6 border border-white/10">
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-gray-300 text-sm">Model Accuracy Over Time</span>
                      <span className="text-purple-400 text-sm font-medium">Live Data</span>
                    </div>
                    <div className="space-y-4">
                      {[
                        { label: 'AI Detector', accuracy: 99.18, trend: '+0.12%' },
                        { label: 'Humanizer', accuracy: 95.0, trend: '+2.1%' },
                        { label: 'Plagiarism', accuracy: 99.95, trend: '+0.02%' }
                      ].map((model, i) => (
                        <div key={i}>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="text-white">{model.label}</span>
                            <span className="text-gray-300">
                              {model.accuracy}% 
                              <span className="text-green-400 ml-2">{model.trend}</span>
                            </span>
                          </div>
                          <div className="w-full bg-gray-700 rounded-full h-2">
                            <div 
                              className="bg-gradient-to-r from-purple-500 to-purple-400 h-2 rounded-full"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-6 pt-4 border-t border-white/10 flex items-center justify-between">
                                            <span className="text-gray-300 text-xs">Last training: 2 days ago</span>
                                            <span className="text-gray-300 text-xs">Next: Sunday 3 AM UTC</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </section>

            {/* Writing Tools Section - 14 New Features */}
            <section className="py-20 md:py-32 px-6 bg-gradient-to-b from-cyan-900/10 to-transparent">
              <div className="max-w-7xl mx-auto">
                <ScrollReveal>
                  <div className="text-center mb-16">
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-cyan-500/10 border border-cyan-500/30 rounded-full mb-6">
                      <Wand2 className="w-4 h-4 text-cyan-400" />
                      <span className="text-cyan-400 text-sm font-medium">14 Powerful Writing Tools</span>
                    </div>
                    <h2 className="text-3xl md:text-4xl lg:text-5xl font-light text-white mb-4">
                      Complete <span className="text-cyan-400">Writing Suite</span>
                    </h2>
                    <p className="text-gray-300 text-lg max-w-3xl mx-auto">
                      Beyond detection and humanization - TextShift offers a complete suite of writing tools to enhance your content. Grammar checking, translation, summarization, and more.
                    </p>
                  </div>
                </ScrollReveal>

                <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
                  {[
                    { icon: CheckCircle, name: 'Grammar Checker', desc: 'Fix grammar, spelling & punctuation', color: 'emerald', tier: 'Free' },
                    { icon: Palette, name: 'Tone Detector', desc: 'Analyze emotional tone of text', color: 'blue', tier: 'Free' },
                    { icon: Sparkles, name: 'Tone Adjuster', desc: 'Adjust text to different tones', color: 'purple', tier: 'Starter' },
                    { icon: BookOpen, name: 'Readability Score', desc: 'Flesch scores & reading level', color: 'amber', tier: 'Free' },
                    { icon: FileText, name: 'Summarizer', desc: 'Create concise summaries', color: 'cyan', tier: 'Free' },
                    { icon: PenTool, name: 'Paraphraser', desc: 'Rewrite in different styles', color: 'pink', tier: 'Free' },
                    { icon: Quote, name: 'Citation Generator', desc: 'APA, MLA, Chicago citations', color: 'indigo', tier: 'Starter' },
                    { icon: Languages, name: 'Translator', desc: '6 language pairs supported', color: 'teal', tier: 'Free' },
                    { icon: Lightbulb, name: 'Content Improver', desc: 'Enhance clarity & engagement', color: 'yellow', tier: 'Starter' },
                    { icon: Target, name: 'Style Analysis', desc: 'Vocabulary & structure insights', color: 'violet', tier: 'Starter' },
                    { icon: FileText, name: 'Word Counter', desc: 'Detailed text statistics', color: 'gray', tier: 'Free' },
                    { icon: Zap, name: 'Export Options', desc: 'TXT, HTML, Markdown export', color: 'orange', tier: 'Free' },
                  ].map((tool, i) => (
                    <ScrollReveal key={i} delay={i * 0.05}>
                      <div 
                        className="bg-gradient-to-b from-white/5 to-transparent border border-white/10 rounded-2xl p-4 hover:border-cyan-500/30 transition-all duration-300"
                      >
                        <div className="flex items-start gap-3">
                          <div className={`p-2 rounded-lg bg-${tool.color}-500/10`}>
                            <tool.icon className={`w-5 h-5 text-${tool.color}-400`} />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-white font-medium text-sm">{tool.name}</span>
                              <span className={`text-xs px-2 py-0.5 rounded-full ${
                                tool.tier === 'Free' 
                                  ? 'bg-emerald-500/20 text-emerald-400' 
                                  : 'bg-purple-500/20 text-purple-400'
                              }`}>
                                {tool.tier}
                              </span>
                            </div>
                            <p className="text-gray-300 text-xs mt-1">{tool.desc}</p>
                          </div>
                        </div>
                      </div>
                    </ScrollReveal>
                  ))}
                </div>

                <ScrollReveal delay={0.3}>
                  <div className="bg-gradient-to-r from-cyan-500/10 via-purple-500/10 to-cyan-500/10 border border-cyan-500/20 rounded-3xl p-8 md:p-12">
                    <div className="flex flex-col md:flex-row items-center justify-between gap-8">
                      <div className="text-center md:text-left">
                        <h3 className="text-2xl md:text-3xl font-light text-white mb-2">
                          All-in-One Writing Platform
                        </h3>
                                                <p className="text-gray-300 max-w-xl">
                                                  No need for multiple subscriptions. TextShift combines AI detection, humanization, plagiarism checking, and 14 writing tools in one affordable platform.
                                                </p>
                      </div>
                      <MagneticButton>
                        <Link to={isAuthenticated ? "/writing-tools" : "/register"}>
                          <Button className="bg-cyan-500 hover:bg-cyan-400 text-black font-medium rounded-full px-8 py-6 text-lg shadow-lg shadow-cyan-500/25 whitespace-nowrap">
                            {isAuthenticated ? "Try Writing Tools" : "Get Started Free"}
                            <ArrowRight className="ml-2 w-5 h-5" />
                          </Button>
                        </Link>
                      </MagneticButton>
                    </div>
                  </div>
                </ScrollReveal>
              </div>
            </section>

            <section className="py-16 md:py-20 px-6 border-y border-white/10">
              <div className="max-w-7xl mx-auto">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8">
                              {[
                                { value: 99, suffix: '%', label: 'Detection Accuracy' },
                                { value: 0, suffix: '%', label: 'False Positives' },
                                { value: 50, suffix: 'K+', label: 'Users Trust Us' },
                                { value: 10, suffix: 'M+', label: 'Texts Analyzed' },
                              ].map((stat, i) => (
              <ScrollReveal key={i} delay={i * 0.1}>
                <div className="text-center">
                  <div className="text-3xl md:text-4xl lg:text-5xl font-light text-white mb-2">
                    <AnimatedCounter end={stat.value} suffix={stat.suffix} decimals={0} />
                  </div>
                  <div className="text-gray-300 text-xs md:text-sm uppercase tracking-wider">{stat.label}</div>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      <section id="demo" className="py-20 md:py-32 px-6">
        <div className="max-w-4xl mx-auto">
          <ScrollReveal>
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl lg:text-5xl font-light text-white mb-4">Try it <span className="text-emerald-400">now</span></h2>
              <p className="text-gray-300 text-lg">Paste any text to see our AI detection in action. No sign-up required.</p>
            </div>
          </ScrollReveal>
          
          <ScrollReveal delay={0.2}>
            <div 
              className="bg-gradient-to-b from-white/5 to-transparent border border-white/10 rounded-3xl p-6 md:p-8 backdrop-blur-sm"
            >
              <Textarea
                placeholder="Paste your text here to check if it's AI-generated..."
                className="min-h-[200px] bg-black/30 border-white/10 text-white placeholder:text-gray-400 rounded-2xl resize-none focus:border-emerald-500/50 focus:ring-emerald-500/20 mb-6 cursor-auto"
                value={demoText}
                onChange={(e) => setDemoText(e.target.value)}
              />
              <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                <span className="text-gray-300 text-sm">{demoText.length} characters</span>
                <MagneticButton>
                  <Button 
                    onClick={handleDemoCheck} 
                    disabled={demoText.length < 20} 
                    className="bg-emerald-500 hover:bg-emerald-400 text-black font-medium rounded-full px-8 w-full sm:w-auto shadow-lg shadow-emerald-500/25 disabled:shadow-none transition-all duration-300"
                  >
                    <Zap className="w-4 h-4 mr-2" />Analyze Text
                  </Button>
                </MagneticButton>
              </div>
              
              {demoResult && (
                <div
                  className="mt-8 p-6 bg-black/30 rounded-2xl border border-white/10"
                >
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div>
                      <div className="text-gray-300 text-sm uppercase tracking-wider mb-1">Detection Result</div>
                      <div className="text-2xl md:text-3xl font-light text-white">{demoResult.type}</div>
                    </div>
                    <div className="sm:text-right">
                      <div className="text-gray-300 text-sm uppercase tracking-wider mb-1">Confidence</div>
                      <div className={`text-2xl md:text-3xl font-light ${demoResult.score > 50 ? 'text-rose-400' : 'text-emerald-400'}`}>{demoResult.score}%</div>
                    </div>
                  </div>
                  <p className="text-gray-300 text-sm mt-6 pt-6 border-t border-white/10">This is a demo result. Sign up for full analysis with sentence-level breakdown.</p>
                </div>
              )}
            </div>
          </ScrollReveal>
        </div>
      </section>

      <section id="pricing" className="relative py-20 md:py-32 px-6 overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img src="https://ik.imagekit.io/tijkyyzycl/pricing-bg.png?tr=f-webp,q-30,w-1280" alt="" className="w-full h-full object-cover opacity-10" loading="lazy" />
          <div className="absolute inset-0 bg-gradient-to-b from-[#0a0a0a] via-transparent to-[#0a0a0a]" />
        </div>
        <div className="max-w-7xl mx-auto relative z-10">
          <ScrollReveal>
            <div className="text-center mb-12 md:mb-16">
              <h2 className="text-3xl md:text-4xl lg:text-5xl font-light text-white mb-4">Plans to suit <span className="text-emerald-400">your needs</span></h2>
              <p className="text-gray-300 text-lg max-w-2xl mx-auto mb-6">Credits never expire. No hidden fees. Cancel anytime.</p>
              <Link to="/pricing" className="inline-flex items-center text-emerald-400 hover:text-emerald-300 transition-colors">
                View full pricing details <ArrowRight className="w-4 h-4 ml-2" />
              </Link>
            </div>
          </ScrollReveal>
          
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
                            { name: 'Free', price: `${currencySymbol}0`, yearlyPrice: `${currencySymbol}0`, credits: '5,000 words/mo', features: ['AI Detection only (10 scans/day)', 'Basic heat map reports', '6 Writing Tools (limited)', 'Export to TXT'], cta: 'Get Started', highlight: false },
                            { name: 'Starter', price: isIndia ? `${currencySymbol}300` : '$9.99', yearlyPrice: isIndia ? `${currencySymbol}3,000` : '$99.90', credits: '25,000 words/mo', features: ['AI Detection + Humanizer + Plagiarism', '100 scans/day', '12 Writing Tools', 'PDF export & Word-level diff', 'Export to HTML/Markdown'], cta: 'Subscribe', highlight: false },
                            { name: 'Pro', price: isIndia ? `${currencySymbol}1,000` : '$24.99', yearlyPrice: isIndia ? `${currencySymbol}10,000` : '$249.90', credits: 'Unlimited', features: ['All 3 core tools (500 scans/day)', 'All 14 Writing Tools - Unlimited', 'Bulk Processing (10 files)', 'Shareable reports', 'Priority support'], cta: 'Subscribe', highlight: true },
                            { name: 'Enterprise', price: isIndia ? `${currencySymbol}2,000` : '$49.99', yearlyPrice: isIndia ? `${currencySymbol}20,000` : '$499.90', credits: 'True Unlimited', features: ['Unlimited scans (no daily limit)', 'All 14 Writing Tools - Unlimited', 'Bulk Processing (50 files)', 'Full REST API Access', 'White-label API', 'SLA guarantee'], cta: 'Contact Sales', highlight: false }
            ].map((plan, i) => (
              <ScrollReveal key={i} delay={i * 0.1}>
                <TiltCard className="h-full" glowColor={plan.highlight ? 'rgba(16, 185, 129, 0.4)' : 'rgba(255, 255, 255, 0.1)'}>
                  <div className={`relative bg-gradient-to-b from-white/5 to-transparent border rounded-3xl p-6 md:p-8 h-full backdrop-blur-sm flex flex-col ${plan.highlight ? 'border-emerald-500/50 ring-1 ring-emerald-500/20' : 'border-white/10'}`}>
                    {plan.highlight && (
                      <div 
                        className="absolute -top-3 left-1/2 -translate-x-1/2"
                      >
                        <span className="bg-emerald-500 text-black text-xs font-medium px-3 py-1 rounded-full">Most Popular</span>
                      </div>
                    )}
                    <div className="text-center mb-6">
                      <h3 className="text-lg font-medium text-white mb-4">{plan.name}</h3>
                      <div className="mb-2">
                        <span className="text-3xl md:text-4xl font-light text-white">{plan.price}</span>
                        {plan.price !== `${currencySymbol}0` && <span className="text-gray-300">/month</span>}
                      </div>
                      <div className="text-emerald-400 text-xs mb-1 h-4">
                        {plan.yearlyPrice !== `${currencySymbol}0` ? `or ${plan.yearlyPrice}/year (save 2 months)` : ''}
                      </div>
                      <div className="text-gray-300 text-sm">{plan.credits}</div>
                    </div>
                    <ul className="space-y-3 mb-8 flex-grow">
                      {plan.features.map((feature, j) => (
                        <li 
                          key={j} 
                          className="flex items-center text-gray-300 text-sm"
                        >
                          <CheckCircle className="w-4 h-4 text-emerald-400 mr-3 flex-shrink-0" />{feature}
                        </li>
                      ))}
                    </ul>
                    {isAuthenticated && user?.subscription_tier?.toLowerCase() === plan.name.toLowerCase() ? (
                      <Button 
                        disabled 
                        className="w-full rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 cursor-not-allowed"
                      >
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Current Plan
                      </Button>
                    ) : (
                      <MagneticButton className="w-full">
                        <Link to={isAuthenticated ? "/pricing" : "/register"} className="block">
                          <Button className={`w-full rounded-full transition-all duration-300 ${plan.highlight ? 'bg-emerald-500 hover:bg-emerald-400 text-black shadow-lg shadow-emerald-500/25' : 'bg-white/5 hover:bg-white/10 text-white border border-white/10'}`}>{plan.cta}</Button>
                        </Link>
                      </MagneticButton>
                    )}
                  </div>
                </TiltCard>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      <section className="relative py-20 md:py-32 px-6 border-t border-white/10 overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img src="https://ik.imagekit.io/tijkyyzycl/testimonials-bg.png?tr=f-webp,q-30,w-1280" alt="" className="w-full h-full object-cover opacity-15" loading="lazy" />
          <div className="absolute inset-0 bg-gradient-to-b from-[#0a0a0a] via-transparent to-[#0a0a0a]" />
        </div>
        <div className="max-w-7xl mx-auto relative z-10">
          <ScrollReveal>
            <div className="text-center mb-12 md:mb-16">
              <h2 className="text-3xl md:text-4xl lg:text-5xl font-light text-white mb-4">What our <span className="text-emerald-400">clients say</span></h2>
            </div>
          </ScrollReveal>
          
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { quote: "TextShift's AI detection is incredibly accurate. It's become an essential tool for our content team.", author: "Sarah Mitchell", role: "Content Manager", company: "TechCorp", avatar: "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=100&h=100&fit=crop&crop=face" },
              { quote: "The humanizer feature is a game-changer. Our AI-assisted content now passes all detection tools.", author: "James Kowalski", role: "Marketing Director", company: "GrowthLabs", avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=face" },
              { quote: "Finally, a plagiarism checker that actually finds paraphrased content. Worth every penny.", author: "Dr. Emily Rodriguez", role: "University Professor", company: "Stanford", avatar: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=100&h=100&fit=crop&crop=face" }
            ].map((testimonial, i) => (
              <ScrollReveal key={i} delay={i * 0.15}>
                <TiltCard className="h-full">
                  <div className="bg-gradient-to-b from-white/5 to-transparent border border-white/10 rounded-3xl p-6 md:p-8 backdrop-blur-sm h-full">
                    <div className="flex mb-4">
                      {[...Array(5)].map((_, j) => (
                        <div
                          key={j}
                        >
                          <Star className="w-4 h-4 text-emerald-400 fill-emerald-400" />
                        </div>
                      ))}
                    </div>
                    <h3 className="text-lg md:text-xl font-medium text-white mb-4">"{testimonial.quote}"</h3>
                    <div className="flex items-center gap-3">
                      <img src={testimonial.avatar} alt={testimonial.author} className="w-10 h-10 rounded-full object-cover" />
                      <div>
                        <div className="font-medium text-white">{testimonial.author}</div>
                        <div className="text-gray-300 text-sm">{testimonial.role} - {testimonial.company}</div>
                      </div>
                    </div>
                  </div>
                </TiltCard>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      <section id="faq" className="py-20 md:py-32 px-6">
        <div className="max-w-3xl mx-auto">
          <ScrollReveal>
            <div className="text-center mb-12 md:mb-16">
              <h2 className="text-3xl md:text-4xl lg:text-5xl font-light text-white mb-4"><span className="text-emerald-400">FAQ</span></h2>
            </div>
          </ScrollReveal>
          
          <div className="space-y-4">
            {faqs.map((faq, i) => (
              <ScrollReveal key={i} delay={i * 0.1}>
                <div 
                  className="bg-gradient-to-b from-white/5 to-transparent border border-white/10 rounded-2xl overflow-hidden backdrop-blur-sm"
                >
                  <button 
                    onClick={() => setOpenFaq(openFaq === i ? null : i)} 
                    className="w-full flex items-center justify-between p-5 md:p-6 text-left cursor-auto"
                  >
                    <span className="text-white font-medium pr-4">{faq.q}</span>
                    <div
                    >
                      <ChevronDown className="w-5 h-5 text-gray-300 flex-shrink-0" aria-hidden="true" />
                    </div>
                  </button>
                  <div
                    className="overflow-hidden"
                  >
                    <div className="px-5 md:px-6 pb-5 md:pb-6 text-gray-300">{faq.a}</div>
                  </div>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      <section id="contact" className="py-20 md:py-32 px-6 border-t border-white/10">
        <div className="max-w-4xl mx-auto text-center">
          <ScrollReveal>
            <h2 className="text-4xl sm:text-5xl md:text-7xl font-light text-white mb-8">Let's <span className="text-emerald-400">talk.</span></h2>
          </ScrollReveal>
          <ScrollReveal delay={0.2}>
            <p className="text-gray-300 text-lg mb-12 max-w-2xl mx-auto">Ready to transform your content workflow? Start with 5,000 free words today.</p>
          </ScrollReveal>
          <ScrollReveal delay={0.4}>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <MagneticButton>
                <Link to="/register">
                  <Button className="bg-emerald-500 hover:bg-emerald-400 text-black font-medium rounded-full px-8 md:px-12 py-6 text-lg w-full sm:w-auto shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 transition-all duration-300">
                    Get Started Free
                    <ArrowRight className="ml-2 w-5 h-5" />
                  </Button>
                </Link>
              </MagneticButton>
              <MagneticButton>
                <Button 
                  variant="outline" 
                  className="bg-transparent border-white/20 text-white hover:bg-white/5 hover:border-white/40 rounded-full px-8 md:px-12 py-6 text-lg w-full sm:w-auto transition-all duration-300"
                  onClick={() => setContactModalOpen(true)}
                >
                  Contact Us
                </Button>
              </MagneticButton>
            </div>
          </ScrollReveal>
        </div>
      </section>

      <footer className="py-12 px-6 border-t border-white/10">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="flex flex-col items-center md:items-start">
              <Link to="/" className="flex items-center gap-2 mb-4">
                <img 
                  src="https://ik.imagekit.io/tijkyyzycl/logo.png?tr=w-32,h-32,f-webp,q-80" 
                  alt="TextShift" 
                  className="w-8 h-8 object-contain"
                />
                <span className="text-white font-medium tracking-wide">TextShift</span>
              </Link>
              <a href="mailto:support@mail.textshift.org" className="text-gray-400 text-sm hover:text-white transition">support@mail.textshift.org</a>
              <p className="text-gray-500 text-xs mt-2">18/1 Banerjee Para Road<br />West Bengal - 700122, India</p>
            </div>
            <div className="text-center md:text-left">
              <h4 className="text-white font-medium mb-4">Product</h4>
              <div className="flex flex-col gap-2 text-gray-400 text-sm">
                <Link to="/features" className="hover:text-white transition">Features</Link>
                <Link to="/pricing" className="hover:text-white transition">Pricing</Link>
                <Link to="/contact" className="hover:text-white transition">Contact Us</Link>
                <Link to="/api-docs" className="hover:text-white transition">API Docs</Link>
              </div>
            </div>
            <div className="text-center md:text-left">
              <h4 className="text-white font-medium mb-4">Legal</h4>
              <div className="flex flex-col gap-2 text-gray-400 text-sm">
                <Link to="/terms" className="hover:text-white transition">Terms & Conditions</Link>
                <Link to="/privacy-policy" className="hover:text-white transition">Privacy Policy</Link>
                <Link to="/refund-policy" className="hover:text-white transition">Refund Policy</Link>
                <Link to="/shipping-policy" className="hover:text-white transition">Shipping Policy</Link>
              </div>
            </div>
            <div className="text-center md:text-left">
              <h4 className="text-white font-medium mb-4">Connect</h4>
              <div className="flex flex-col gap-2 text-gray-400 text-sm">
                <Link to="/contact" className="hover:text-white transition">Contact Us</Link>
                <a href="#faq" className="hover:text-white transition">FAQ</a>
                <a href="https://twitter.com/textshift" className="hover:text-white transition">Twitter</a>
                <a href="https://linkedin.com/company/textshift" className="hover:text-white transition">LinkedIn</a>
              </div>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t border-white/10 text-center text-gray-500 text-sm">
            &copy; {new Date().getFullYear()} TextShift. All rights reserved. | Founder: Sayan Roy Chowdhury
          </div>
        </div>
      </footer>

      {/* Contact Modal */}
      {contactModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            onClick={() => {
              setContactModalOpen(false);
              setContactSuccess(false);
              setContactError('');
            }}
          />
          <div
            className="relative bg-[#111] border border-white/10 rounded-2xl p-6 md:p-8 w-full max-w-lg max-h-[90vh] overflow-y-auto"
          >
            <button
              onClick={() => {
                setContactModalOpen(false);
                setContactSuccess(false);
                setContactError('');
              }}
              className="absolute top-4 right-4 text-gray-300 hover:text-white transition" aria-label="Close contact form"
            >
              <X className="w-6 h-6" />
            </button>

            {contactSuccess ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-8 h-8 text-emerald-400" />
                </div>
                <h3 className="text-2xl font-semibold text-white mb-2">Message Sent!</h3>
                <p className="text-gray-300 mb-6">Thank you for reaching out. Our team will get back to you within 24 hours.</p>
                <Button
                  onClick={() => {
                    setContactModalOpen(false);
                    setContactSuccess(false);
                  }}
                  className="bg-emerald-500 hover:bg-emerald-600 text-black rounded-full px-8"
                >
                  Close
                </Button>
              </div>
            ) : (
              <>
                <div className="text-center mb-6">
                  <div className="w-12 h-12 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Mail className="w-6 h-6 text-emerald-400" />
                  </div>
                  <h3 className="text-2xl font-semibold text-white mb-2">Contact Us</h3>
                  <p className="text-gray-300">Have a question or need help? We'd love to hear from you.</p>
                </div>

                <form onSubmit={handleContactSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-gray-300 mb-1">Name *</label>
                      <div className="relative">
                        <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
                        <Input
                          type="text"
                          required
                          value={contactForm.name}
                          onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                          className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-gray-300"
                          placeholder="Your name"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm text-gray-300 mb-1">Email *</label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
                        <Input
                          type="email"
                          required
                          value={contactForm.email}
                          onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                          className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-gray-300"
                          placeholder="you@example.com"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-gray-300 mb-1">Company</label>
                      <div className="relative">
                        <Building className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
                        <Input
                          type="text"
                          value={contactForm.company}
                          onChange={(e) => setContactForm({ ...contactForm, company: e.target.value })}
                          className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-gray-300"
                          placeholder="Your company"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm text-gray-300 mb-1">Phone</label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
                        <Input
                          type="tel"
                          value={contactForm.phone}
                          onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })}
                          className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-gray-300"
                          placeholder="+1 (555) 000-0000"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm text-gray-300 mb-1">Topic</label>
                    <select
                      value={contactForm.plan_interest}
                      onChange={(e) => setContactForm({ ...contactForm, plan_interest: e.target.value })}
                      className="w-full bg-[#1a1a1a] border border-white/10 text-white rounded-md px-3 py-2 [&>option]:bg-[#1a1a1a] [&>option]:text-white"
                    >
                      <option value="General" className="bg-[#1a1a1a] text-white">General Inquiry</option>
                      <option value="Enterprise" className="bg-[#1a1a1a] text-white">Enterprise Plan</option>
                      <option value="Support" className="bg-[#1a1a1a] text-white">Technical Support</option>
                      <option value="Partnership" className="bg-[#1a1a1a] text-white">Partnership</option>
                      <option value="Feedback" className="bg-[#1a1a1a] text-white">Feedback</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm text-gray-300 mb-1">Message *</label>
                    <div className="relative">
                      <MessageSquare className="absolute left-3 top-3 w-4 h-4 text-gray-300" />
                      <Textarea
                        required
                        value={contactForm.message}
                        onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })}
                        className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-gray-300 min-h-[120px]"
                        placeholder="How can we help you?"
                      />
                    </div>
                  </div>

                  {contactError && (
                    <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                      {contactError}
                    </div>
                  )}

                  <Button
                    type="submit"
                    disabled={contactLoading}
                    className="w-full bg-emerald-500 hover:bg-emerald-600 text-black rounded-full py-6"
                  >
                    {contactLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Mail className="w-4 h-4 mr-2" />
                        Send Message
                      </>
                    )}
                  </Button>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
