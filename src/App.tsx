import { useState, useEffect, useRef } from 'react'
import { motion, useInView, useScroll, useTransform } from 'framer-motion'
import { ArrowRight, Zap, Shield, Globe, Clock, Check, ChevronDown, Menu, X, Star, Download, Users, MapPin, MessageCircle, Search, Send, Linkedin, Instagram, Facebook, Twitter, TrendingUp, AlertTriangle } from 'lucide-react'

/* ─── COUNTER HOOK ─── */
function useCountUp(end: number, duration = 2000, startOnView = true) {
  const [count, setCount] = useState(0)
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true })
  
  useEffect(() => {
    if (!startOnView || !inView) return
    let start = 0
    const increment = end / (duration / 16)
    const timer = setInterval(() => {
      start += increment
      if (start >= end) { setCount(end); clearInterval(timer) }
      else setCount(Math.floor(start))
    }, 16)
    return () => clearInterval(timer)
  }, [end, duration, startOnView, inView])
  
  return { count, ref }
}

/* ─── FADE IN ANIMATION ─── */
const fadeIn = {
  hidden: { opacity: 0, y: 40 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: [0.25, 0.46, 0.45, 0.94] as const } }
}

const stagger = {
  visible: { transition: { staggerChildren: 0.15 } }
}

/* ─── NAVBAR ─── */
function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  
  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 50)
    window.addEventListener('scroll', handler)
    return () => window.removeEventListener('scroll', handler)
  }, [])

  return (
    <nav className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 transition-all duration-300 ${scrolled ? 'w-[95%] max-w-5xl bg-dark/90 backdrop-blur-xl border border-dark-border shadow-2xl' : 'w-[95%] max-w-5xl bg-dark/70 backdrop-blur-md border border-dark-border/50'} rounded-full px-6 py-3 flex items-center justify-between`}>
      <a href="#" className="flex items-center gap-2">
        <img src="/images/logo.png" alt="SnapLeads" className="w-8 h-8 rounded-lg" />
        <span className="font-mono font-bold text-sm tracking-wider uppercase">SnapLeads</span>
      </a>
      
      <div className="hidden md:flex items-center gap-6">
        <a href="#features" className="text-xs font-mono uppercase tracking-wider text-gray-400 hover:text-white transition-colors">Features</a>
        <a href="#platforms" className="text-xs font-mono uppercase tracking-wider text-gray-400 hover:text-white transition-colors">Platforms</a>
        <a href="#pricing" className="text-xs font-mono uppercase tracking-wider text-gray-400 hover:text-white transition-colors">Pricing</a>
        <a href="#faq" className="text-xs font-mono uppercase tracking-wider text-gray-400 hover:text-white transition-colors">FAQ</a>
      </div>
      
      <div className="flex items-center gap-3">
        <a href="#pricing" className="hidden md:flex items-center gap-2 bg-accent hover:bg-accent-hover text-white font-mono text-xs uppercase tracking-wider px-5 py-2.5 rounded-full transition-all duration-300 hover:shadow-lg hover:shadow-accent/30">
          Get Started <ArrowRight size={14} />
        </a>
        <button onClick={() => setMenuOpen(!menuOpen)} className="md:hidden text-white">
          {menuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>
      
      {menuOpen && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="absolute top-full left-0 right-0 mt-2 bg-dark/95 backdrop-blur-xl border border-dark-border rounded-2xl p-6 flex flex-col gap-4 md:hidden">
          <a href="#features" onClick={() => setMenuOpen(false)} className="text-sm font-mono uppercase tracking-wider text-gray-400 hover:text-white">Features</a>
          <a href="#platforms" onClick={() => setMenuOpen(false)} className="text-sm font-mono uppercase tracking-wider text-gray-400 hover:text-white">Platforms</a>
          <a href="#pricing" onClick={() => setMenuOpen(false)} className="text-sm font-mono uppercase tracking-wider text-gray-400 hover:text-white">Pricing</a>
          <a href="#faq" onClick={() => setMenuOpen(false)} className="text-sm font-mono uppercase tracking-wider text-gray-400 hover:text-white">FAQ</a>
          <a href="#pricing" className="flex items-center justify-center gap-2 bg-accent text-white font-mono text-sm uppercase px-5 py-3 rounded-full">Get Started <ArrowRight size={14} /></a>
        </motion.div>
      )}
    </nav>
  )
}

/* ─── HERO ─── */
function Hero() {
  const { scrollY } = useScroll()
  const y1 = useTransform(scrollY, [0, 500], [0, -50])
  const y2 = useTransform(scrollY, [0, 500], [0, -30])
  
  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center pt-24 pb-16 px-4 overflow-hidden">
      {/* Background gradient glow */}
      <div className="absolute inset-0 bg-dark" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] rounded-full blur-3xl" style={{ background: 'radial-gradient(ellipse at center, rgba(255,69,0,0.15) 0%, rgba(255,69,0,0.05) 40%, transparent 70%)' }} />
      <div className="absolute top-[10%] left-[20%] w-[400px] h-[400px] rounded-full blur-3xl" style={{ background: 'radial-gradient(ellipse at center, rgba(255,107,53,0.1) 0%, transparent 60%)' }} />
      <div className="absolute top-[5%] right-[15%] w-[350px] h-[350px] rounded-full blur-3xl" style={{ background: 'radial-gradient(ellipse at center, rgba(220,50,0,0.08) 0%, transparent 60%)' }} />
      <div className="absolute bottom-[30%] left-[10%] w-[300px] h-[300px] rounded-full blur-3xl" style={{ background: 'radial-gradient(ellipse at center, rgba(168,85,247,0.05) 0%, transparent 60%)' }} />
      
      {/* Floating platform icons */}
      <motion.div style={{ y: y1 }} className="absolute top-32 left-[10%] animate-float">
        <div className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-600/30"><Linkedin size={28} className="text-white" /></div>
      </motion.div>
      <motion.div style={{ y: y2 }} className="absolute top-40 right-[12%] animate-float-delayed">
        <div className="w-14 h-14 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center shadow-lg shadow-purple-500/30"><Instagram size={28} className="text-white" /></div>
      </motion.div>
      <motion.div style={{ y: y1 }} className="absolute top-56 left-[5%] animate-float-delayed">
        <div className="w-12 h-12 bg-red-500 rounded-2xl flex items-center justify-center shadow-lg shadow-red-500/30"><Globe size={24} className="text-white" /></div>
      </motion.div>
      <motion.div style={{ y: y2 }} className="absolute top-48 right-[5%] animate-float">
        <div className="w-12 h-12 bg-green-500 rounded-2xl flex items-center justify-center shadow-lg shadow-green-500/30"><MapPin size={24} className="text-white" /></div>
      </motion.div>
      <motion.div style={{ y: y1 }} className="absolute bottom-[35%] left-[8%] animate-float">
        <div className="w-11 h-11 bg-sky-500 rounded-2xl flex items-center justify-center shadow-lg shadow-sky-500/30"><Send size={22} className="text-white" /></div>
      </motion.div>
      <motion.div style={{ y: y2 }} className="absolute bottom-[40%] right-[8%] animate-float-delayed">
        <div className="w-11 h-11 bg-orange-500 rounded-2xl flex items-center justify-center shadow-lg shadow-orange-500/30"><MessageCircle size={22} className="text-white" /></div>
      </motion.div>
      
      {/* Badge */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="flex items-center gap-2 bg-dark-card border border-dark-border px-5 py-2 rounded-full mb-8 relative z-10">
        <Star size={14} className="text-accent fill-accent" />
        <span className="font-mono text-xs uppercase tracking-wider text-gray-300">#1 Lead Extraction Software 2026</span>
        <Star size={14} className="text-accent fill-accent" />
      </motion.div>
      
      {/* Headline */}
      <motion.h1 initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4, duration: 0.8 }} className="text-5xl md:text-7xl lg:text-8xl font-black uppercase text-center leading-none tracking-tighter max-w-5xl relative z-10">
        Extract <span className="italic text-gray-500">Leads</span> From
        <br />
        <span className="text-gradient">12+ Platforms</span> In Minutes
      </motion.h1>
      
      {/* Subtitle */}
      <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7 }} className="text-gray-400 text-base md:text-lg max-w-xl text-center mt-6 mb-8 relative z-10">
        The most powerful desktop app for extracting emails, phones, and business data from social media, Google Maps, and the web. Zero proxies needed.
      </motion.p>
      
      {/* CTAs */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.9 }} className="flex flex-col sm:flex-row items-center gap-4 relative z-10">
        <a href="#pricing" className="flex items-center gap-2 bg-accent hover:bg-accent-hover text-white font-mono text-sm uppercase tracking-wider px-8 py-4 rounded-full transition-all duration-300 hover:shadow-xl hover:shadow-accent/30 animate-pulse-glow">
          Download Now <ArrowRight size={16} />
        </a>
        <a href="#features" className="flex items-center gap-2 border border-gray-700 hover:border-gray-500 text-white font-mono text-sm uppercase tracking-wider px-8 py-4 rounded-full transition-all duration-300 hover:bg-white/5">
          See Features
        </a>
      </motion.div>
      
      {/* Hero Image */}
      <motion.div initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.1, duration: 0.8 }} className="relative mt-16 w-full max-w-4xl mx-auto z-10">
        <div className="relative rounded-2xl overflow-hidden border border-dark-border shadow-2xl">
          <img src="/images/hero-team.png" alt="SnapLeads in action" className="w-full h-auto" />
          <div className="absolute inset-0 bg-gradient-to-t from-dark via-transparent to-transparent" />
        </div>
      </motion.div>
      
      {/* Logo Marquee */}
      <div className="w-full mt-16 overflow-hidden relative z-10">
        <div className="flex animate-marquee whitespace-nowrap">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex items-center gap-12 mx-6">
              {['LinkedIn', 'Facebook', 'Instagram', 'Reddit', 'Twitter/X', 'Google Maps', 'Telegram', 'WhatsApp', 'TikTok', 'YouTube'].map((name) => (
                <span key={`${i}-${name}`} className="font-mono text-sm uppercase tracking-wider text-gray-600 hover:text-gray-400 transition-colors">{name}</span>
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ─── STATS (ORANGE) ─── */
function Stats() {
  const s1 = useCountUp(10000, 2000)
  const s2 = useCountUp(12, 1500)
  const s3 = useCountUp(100, 1800)
  
  return (
    <section className="bg-accent py-20 px-4">
      <motion.div variants={stagger} initial="hidden" whileInView="visible" viewport={{ once: true }} className="max-w-6xl mx-auto">
        <motion.h2 variants={fadeIn} className="text-4xl md:text-5xl font-black uppercase text-center text-white mb-16 tracking-tight">
          A Little About Us
        </motion.h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <motion.div variants={fadeIn} className="border-l-2 border-white/30 pl-6">
            <h6 className="font-mono text-xs uppercase tracking-widest text-white/80 mb-4">Trusted By Professionals</h6>
            <div className="text-5xl font-black text-white mb-2"><span ref={s1.ref}>{s1.count.toLocaleString()}</span>+</div>
            <p className="text-white/70 text-sm">Leads extracted daily by users worldwide. From startups to enterprise sales teams.</p>
          </motion.div>
          <motion.div variants={fadeIn} className="border-l-2 border-white/30 pl-6">
            <h6 className="font-mono text-xs uppercase tracking-widest text-white/80 mb-4">Platform Coverage</h6>
            <div className="text-5xl font-black text-white mb-2"><span ref={s2.ref}>{s2.count}</span>+</div>
            <p className="text-white/70 text-sm">Social platforms and data sources supported. LinkedIn, Google Maps, Reddit, Telegram, and more.</p>
          </motion.div>
          <motion.div variants={fadeIn} className="border-l-2 border-white/30 pl-6">
            <h6 className="font-mono text-xs uppercase tracking-widest text-white/80 mb-4">Zero Cost Infrastructure</h6>
            <div className="text-5xl font-black text-white mb-2"><span ref={s3.ref}>{s3.count}</span>%</div>
            <p className="text-white/70 text-sm">Runs entirely on your machine. No monthly API costs, no proxy fees, no hidden charges.</p>
          </motion.div>
        </div>
      </motion.div>
    </section>
  )
}

/* ─── WHO WE ARE MARQUEE ─── */
function WhoWeAre() {
  return (
    <section className="py-20 bg-dark noise-bg overflow-hidden">
      <div className="mb-8 flex justify-center">
        <span className="font-mono text-xs uppercase tracking-widest text-gray-500 border border-dark-border px-4 py-2 rounded-full">[ What Is SnapLeads ]</span>
      </div>
      <div className="overflow-hidden whitespace-nowrap relative z-10">
        <div className="animate-marquee inline-flex">
          {[...Array(2)].map((_, i) => (
            <span key={i} className="text-4xl md:text-6xl lg:text-7xl font-black uppercase tracking-tight text-gray-800 mx-4">
              THE MOST POWERFUL DESKTOP APP FOR EXTRACTING LEADS, EMAILS, PHONES AND BUSINESS DATA FROM 12+ SOCIAL PLATFORMS AND GOOGLE MAPS.&nbsp;&nbsp;&nbsp;
            </span>
          ))}
        </div>
      </div>
      <div className="flex justify-center mt-8">
        <span className="font-mono text-xs uppercase tracking-widest text-gray-500 border border-dark-border px-4 py-2 rounded-full">[ Windows, Mac & Linux — Works Everywhere ]</span>
      </div>
    </section>
  )
}

/* ─── FEATURES (VALUE PROPS) ─── */
function Features() {
  const features = [
    { icon: <Search size={24} />, title: 'EXTRACT', subtitle: 'Pull leads from any platform', desc: 'Extract emails, phones, names, and business data from LinkedIn, Instagram, Reddit, Google Maps, and 8 more platforms.', img: '/images/hero-team.png' },
    { icon: <Shield size={24} />, title: 'PROTECT', subtitle: 'Built-in account safety', desc: 'Advanced anti-detection technology with smart rate limiting, randomized behavior patterns, and built-in safety controls to keep your accounts protected.', img: '/images/strategy.png' },
    { icon: <Zap size={24} />, title: 'AUTOMATE', subtitle: 'Schedule & scale extractions', desc: 'Set up recurring extraction schedules. Run campaigns on autopilot while you focus on closing deals.', img: '/images/team-celebrate.png' },
    { icon: <Clock size={24} />, title: 'ENRICH', subtitle: 'Verify & export instantly', desc: 'Built-in email verification, CSV/Excel export, HubSpot CRM integration, and email outreach — all in one app.', img: '/images/strategy.png' },
  ]
  
  return (
    <section id="features" className="py-24 px-4 bg-light text-dark">
      <div className="max-w-6xl mx-auto">
        <motion.div variants={stagger} initial="hidden" whileInView="visible" viewport={{ once: true }}>
          <motion.div variants={fadeIn} className="text-center mb-16">
            <span className="font-mono text-xs uppercase tracking-widest text-gray-500 border border-gray-300 px-4 py-2 rounded-full">[ Features ]</span>
            <h2 className="text-4xl md:text-6xl font-black uppercase mt-6 tracking-tight">
              Why <span className="italic text-gray-400">Users</span> Choose SnapLeads
            </h2>
            <p className="text-gray-500 mt-4 max-w-2xl mx-auto">Everything you need to extract, verify, and convert leads — in a single desktop application that runs entirely on your machine.</p>
          </motion.div>
          
          <div className="space-y-4">
            {features.map((f, i) => (
              <FeatureCard key={i} {...f} index={i} />
            ))}
          </div>
          
          <motion.div variants={fadeIn} className="flex justify-center mt-12">
            <a href="#pricing" className="flex items-center gap-2 bg-accent hover:bg-accent-hover text-white font-mono text-sm uppercase tracking-wider px-8 py-4 rounded-full transition-all duration-300 hover:shadow-lg hover:shadow-accent/30">
              Start Extracting <ArrowRight size={16} />
            </a>
          </motion.div>
        </motion.div>
      </div>
    </section>
  )
}

function FeatureCard({ icon, title, subtitle, desc, img }: { icon: React.ReactNode; title: string; subtitle: string; desc: string; img: string; index: number }) {
  const [hovered, setHovered] = useState(false)
  
  return (
    <motion.div variants={fadeIn} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} className="group bg-white rounded-2xl border border-gray-200 overflow-hidden cursor-pointer transition-all duration-500 hover:shadow-xl">
      <div className="flex flex-col md:flex-row items-stretch">
        <div className="flex-1 p-8 md:p-10">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-accent">{icon}</span>
            <h3 className="font-mono text-xs uppercase tracking-widest text-accent">{title}</h3>
          </div>
          <h4 className="text-2xl md:text-3xl font-bold text-dark mb-3">{subtitle}</h4>
          <p className="text-gray-500 leading-relaxed">{desc}</p>
          <div className="flex items-center gap-2 mt-6 text-accent font-mono text-xs uppercase tracking-wider">
            Learn more <ArrowRight size={14} className={`transition-transform duration-300 ${hovered ? 'translate-x-1' : ''}`} />
          </div>
        </div>
        <div className={`w-full md:w-80 h-48 md:h-auto overflow-hidden transition-all duration-500 ${hovered ? 'md:w-96' : 'md:w-80'}`}>
          <img src={img} alt={title} className={`w-full h-full object-cover transition-transform duration-700 ${hovered ? 'scale-105' : 'scale-100'}`} />
        </div>
      </div>
    </motion.div>
  )
}

/* ─── PLATFORM SHOWCASE ─── */
function Platforms() {
  const platforms = [
    { num: '01', name: 'Google Maps Lead Finder', stats: [{ val: '50K+', label: 'businesses/day' }, { val: '100%', label: 'data accuracy' }, { val: '6+', label: 'data fields' }], color: 'from-red-600 to-orange-500' },
    { num: '02', name: 'LinkedIn Lead Extractor', stats: [{ val: '10K+', label: 'profiles/session' }, { val: '95%', label: 'email match' }, { val: '0%', label: 'ban rate' }], color: 'from-blue-600 to-cyan-500' },
    { num: '03', name: 'Reddit Lead Finder', stats: [{ val: '200+', label: 'subreddits' }, { val: '5K+', label: 'leads/query' }, { val: '3x', label: 'faster' }], color: 'from-orange-500 to-red-500' },
    { num: '04', name: 'Telegram Group Extractor', stats: [{ val: '500+', label: 'members/group' }, { val: '100%', label: 'safe extraction' }, { val: '5+', label: 'groups/day' }], color: 'from-sky-500 to-blue-600' },
    { num: '05', name: 'Instagram + Facebook', stats: [{ val: '1K+', label: 'profiles/run' }, { val: '90%', label: 'data capture' }, { val: '4+', label: 'data points' }], color: 'from-purple-500 to-pink-500' },
  ]

  return (
    <section id="platforms" className="py-24 px-4 bg-light text-dark">
      <div className="max-w-6xl mx-auto">
        <motion.div variants={stagger} initial="hidden" whileInView="visible" viewport={{ once: true }}>
          <motion.div variants={fadeIn} className="text-center mb-16">
            <span className="font-mono text-xs uppercase tracking-widest text-gray-500 border border-gray-300 px-4 py-2 rounded-full">[ Platforms — 12+ ]</span>
            <h2 className="text-4xl md:text-6xl font-black uppercase mt-6 tracking-tight">
              Our <span className="italic text-gray-400">Supported</span> Platforms
            </h2>
            <p className="text-gray-500 mt-4 max-w-2xl mx-auto">Extract leads from the biggest platforms on the internet. Each extractor is purpose-built with safety controls and smart rate limiting.</p>
          </motion.div>
          
          <div className="space-y-4">
            {platforms.map((p, i) => (
              <motion.div key={i} variants={fadeIn} className="group bg-white rounded-2xl border border-gray-200 p-8 hover:shadow-xl transition-all duration-500 cursor-pointer">
                <div className="flex flex-col md:flex-row md:items-center gap-6">
                  <span className="text-accent font-mono text-lg font-bold">{p.num}.</span>
                  <h3 className="text-2xl md:text-3xl font-black uppercase tracking-tight flex-1">{p.name}</h3>
                  <div className="flex gap-8">
                    {p.stats.map((s, j) => (
                      <div key={j} className="text-center">
                        <div className="text-2xl font-black text-dark">{s.val}</div>
                        <div className="text-xs text-gray-400 font-mono uppercase">{s.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  )
}

/* ─── PRICING ─── */
function Pricing() {
  const [annual, setAnnual] = useState(false)
  
  return (
    <section id="pricing" className="py-24 px-4 bg-dark noise-bg relative">
      <div className="max-w-5xl mx-auto relative z-10">
        <motion.div variants={stagger} initial="hidden" whileInView="visible" viewport={{ once: true }}>
          <motion.div variants={fadeIn} className="text-center mb-12">
            <span className="font-mono text-xs uppercase tracking-widest text-gray-500 border border-dark-border px-4 py-2 rounded-full">[ Pricing ]</span>
            <h2 className="text-4xl md:text-6xl font-black uppercase mt-6 tracking-tight">
              Simple <span className="italic text-gray-500">Pricing</span> For Every User
            </h2>
            <p className="text-gray-400 mt-4 max-w-xl mx-auto">Choose the plan that fits your needs. Upgrade anytime, cancel anytime.</p>
          </motion.div>
          
          {/* Urgency Banner */}
          <motion.div variants={fadeIn} className="flex items-center justify-center gap-3 mb-8">
            <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 text-red-400 font-mono text-xs uppercase tracking-wider px-5 py-2.5 rounded-full">
              <AlertTriangle size={14} />
              <span>Launch Pricing — Prices Go Up Soon</span>
            </div>
          </motion.div>
          
          {/* Toggle */}
          <motion.div variants={fadeIn} className="flex items-center justify-center gap-4 mb-12">
            <span className={`font-mono text-sm uppercase tracking-wider ${!annual ? 'text-white' : 'text-gray-500'}`}>Monthly</span>
            <button onClick={() => setAnnual(!annual)} className={`relative w-14 h-7 rounded-full transition-colors duration-300 ${annual ? 'bg-accent' : 'bg-gray-700'}`}>
              <div className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-transform duration-300 ${annual ? 'left-8' : 'left-1'}`} />
            </button>
            <span className={`font-mono text-sm uppercase tracking-wider ${annual ? 'text-white' : 'text-gray-500'}`}>Annually</span>
            {annual && <span className="bg-accent/20 text-accent font-mono text-xs px-3 py-1 rounded-full">Save 30%+</span>}
          </motion.div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Starter */}
            <motion.div variants={fadeIn} className="bg-dark-card border border-dark-border rounded-2xl overflow-hidden group hover:border-gray-700 transition-all duration-500">
              <div className="h-36 bg-gradient-to-br from-gray-800 to-gray-900 p-8 flex flex-col justify-end">
                <div className="flex items-center gap-2 mb-1"><Zap size={16} className="text-accent" /><span className="font-mono text-xs uppercase tracking-widest text-gray-400">Starter</span></div>
                <div className="flex items-baseline gap-3">
                  <div className="text-4xl font-black text-white">${annual ? '79' : '9'}<span className="text-lg text-gray-400 font-normal">/{annual ? 'yr' : 'mo'}</span></div>
                  <span className="text-gray-500 line-through text-lg">${annual ? '149' : '29'}</span>
                  <span className="bg-green-500/20 text-green-400 font-mono text-xs px-2 py-0.5 rounded-full">{annual ? '47% OFF' : '69% OFF'}</span>
                </div>
              </div>
              <div className="p-8">
                <h6 className="font-mono text-xs uppercase tracking-widest text-gray-400 mb-4">What's Included</h6>
                {['5 social platforms (LinkedIn, FB, IG, Reddit, Twitter)', 'Google Maps lead extraction', 'CSV & Excel export', 'Email verification', '500 leads per extraction', 'Desktop app (Win/Mac/Linux)'].map((item, i) => (
                  <div key={i} className="flex items-start gap-3 mb-3">
                    <Check size={16} className="text-accent mt-0.5 flex-shrink-0" />
                    <span className="text-gray-300 text-sm">{item}</span>
                  </div>
                ))}
                <a href="#" className="flex items-center justify-center gap-2 bg-accent hover:bg-accent-hover text-white font-mono text-xs uppercase tracking-wider px-6 py-3.5 rounded-full transition-all duration-300 mt-6 w-full hover:shadow-lg hover:shadow-accent/30">
                  Get Starter <ArrowRight size={14} />
                </a>
              </div>
            </motion.div>
            
            {/* Pro */}
            <motion.div variants={fadeIn} className="bg-dark-card border border-accent/30 rounded-2xl overflow-hidden group hover:border-accent/60 transition-all duration-500 relative">
              <div className="absolute top-4 right-4 bg-accent text-white font-mono text-xs px-3 py-1 rounded-full">Most Popular</div>
              <div className="h-36 bg-gradient-to-br from-accent/30 to-orange-900/40 p-8 flex flex-col justify-end">
                <div className="flex items-center gap-2 mb-1"><Zap size={16} className="text-accent fill-accent" /><span className="font-mono text-xs uppercase tracking-widest text-accent">Pro</span></div>
                <div className="flex items-baseline gap-3">
                  <div className="text-4xl font-black text-white">${annual ? '249' : '29'}<span className="text-lg text-gray-400 font-normal">/{annual ? 'yr' : 'mo'}</span></div>
                  <span className="text-gray-500 line-through text-lg">${annual ? '499' : '79'}</span>
                  <span className="bg-green-500/20 text-green-400 font-mono text-xs px-2 py-0.5 rounded-full">{annual ? '50% OFF' : '63% OFF'}</span>
                </div>
              </div>
              <div className="p-8">
                <h6 className="font-mono text-xs uppercase tracking-widest text-gray-400 mb-4">Everything in Starter, plus</h6>
                {['All 12+ platforms + Google Maps', 'Scheduled automated extractions', 'Email outreach campaigns', 'HubSpot & Salesforce CRM export', 'Telegram + WhatsApp extractors', 'Website email finder', 'Unlimited leads per extraction', 'Priority support & updates'].map((item, i) => (
                  <div key={i} className="flex items-start gap-3 mb-3">
                    <Check size={16} className="text-accent mt-0.5 flex-shrink-0" />
                    <span className="text-gray-300 text-sm">{item}</span>
                  </div>
                ))}
                <a href="#" className="flex items-center justify-center gap-2 bg-accent hover:bg-accent-hover text-white font-mono text-xs uppercase tracking-wider px-6 py-3.5 rounded-full transition-all duration-300 mt-6 w-full hover:shadow-lg hover:shadow-accent/30 animate-pulse-glow">
                  Get Pro <ArrowRight size={14} />
                </a>
              </div>
            </motion.div>
          </div>
          
          {/* Lifetime Deal */}
          <motion.div variants={fadeIn} className="mt-6 bg-dark-card border border-accent/20 rounded-2xl p-8 relative overflow-hidden">
            <div className="absolute top-0 right-0 bg-accent text-white font-mono text-xs px-4 py-1.5 rounded-bl-xl">LIMITED TIME</div>
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              <div>
                <h3 className="font-mono text-xs uppercase tracking-widest text-accent mb-2">Lifetime Deal — Pay Once, Use Forever</h3>
                <p className="text-gray-500 text-sm">No subscriptions. Includes all future updates and new features forever.</p>
              </div>
              <div className="flex items-center gap-8">
                <div className="text-center">
                  <div className="text-gray-500 line-through text-lg">$499</div>
                  <div className="text-4xl font-black text-white">$149</div>
                  <span className="bg-red-500/20 text-red-400 font-mono text-[10px] px-2 py-0.5 rounded-full">70% OFF</span>
                  <div className="text-gray-600 font-mono text-[10px] uppercase mt-1">Starter Lifetime</div>
                </div>
                <div className="text-center">
                  <div className="text-gray-500 line-through text-lg">$999</div>
                  <div className="text-4xl font-black text-white">$399</div>
                  <span className="bg-red-500/20 text-red-400 font-mono text-[10px] px-2 py-0.5 rounded-full">60% OFF</span>
                  <div className="text-gray-600 font-mono text-[10px] uppercase mt-1">Pro Lifetime</div>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-center gap-2 mt-6">
              <TrendingUp size={14} className="text-accent" />
              <span className="text-gray-400 font-mono text-xs uppercase tracking-wider">Only <span className="text-accent font-bold">47 lifetime keys</span> remaining — then this offer is gone forever</span>
            </div>
          </motion.div>

          {/* Money-back guarantee */}
          <motion.div variants={fadeIn} className="mt-4 text-center">
            <p className="text-gray-500 font-mono text-xs uppercase tracking-wider">14-Day Money-Back Guarantee — No Questions Asked</p>
          </motion.div>
        </motion.div>
      </div>
    </section>
  )
}

/* ─── TESTIMONIAL ─── */
function Testimonial() {
  const testimonials = [
    { quote: "SnapLeads replaced 3 separate tools for us. The Google Maps extractor alone saved us 20 hours per week of manual prospecting.", name: "Marcus Rodriguez", title: "CEO at LeadFlow Agency", img: "/images/testimonial-person.png" },
    { quote: "The account safety features are incredible. We have been running extractions for 6 months with zero issues. This is the real deal.", name: "James Chen", title: "Growth Lead at TechScale", img: "/images/testimonial-person.png" },
    { quote: "From extraction to outreach in one tool — we closed $50K in new business in the first month using SnapLeads Pro.", name: "David Park", title: "Founder at CloudReach", img: "/images/testimonial-person.png" },
  ]
  const [active, setActive] = useState(0)

  return (
    <section className="py-24 px-4 bg-dark noise-bg relative">
      <div className="max-w-4xl mx-auto text-center relative z-10">
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger}>
          <motion.div variants={fadeIn}>
            <span className="font-mono text-xs uppercase tracking-widest text-gray-500 border border-dark-border px-4 py-2 rounded-full">[ Helping Businesses Scale ]</span>
          </motion.div>
          <motion.div variants={fadeIn} className="mt-10">
            <div className="text-accent text-6xl font-serif mb-6">&ldquo;</div>
            <h3 className="text-2xl md:text-4xl font-black uppercase tracking-tight leading-tight">
              {testimonials[active].quote}
            </h3>
            <div className="mt-8">
              <img src={testimonials[active].img} alt={testimonials[active].name} className="w-16 h-16 rounded-full mx-auto mb-3 object-cover border-2 border-accent/30" />
              <p className="font-bold text-white">{testimonials[active].name}</p>
              <p className="font-mono text-xs uppercase tracking-wider text-gray-500">{testimonials[active].title}</p>
            </div>
          </motion.div>
          <div className="flex justify-center gap-3 mt-8">
            {testimonials.map((_, i) => (
              <button key={i} onClick={() => setActive(i)} className={`w-3 h-3 rounded-full transition-all duration-300 ${i === active ? 'bg-accent w-8' : 'bg-gray-700 hover:bg-gray-600'}`} />
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  )
}

/* ─── HOW IT WORKS ─── */
function HowItWorks() {
  return (
    <section className="py-24 px-4 bg-light text-dark">
      <div className="max-w-6xl mx-auto">
        <motion.div variants={stagger} initial="hidden" whileInView="visible" viewport={{ once: true }}>
          <motion.div variants={fadeIn} className="text-center mb-16">
            <span className="font-mono text-xs uppercase tracking-widest text-gray-500 border border-gray-300 px-4 py-2 rounded-full">[ How It Works ]</span>
            <h2 className="text-4xl md:text-6xl font-black uppercase mt-6 tracking-tight">
              Three Steps To <span className="italic text-gray-400">Unlimited</span> Leads
            </h2>
          </motion.div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { step: '01', title: 'Download & Activate', desc: 'Install the desktop app on Windows, Mac, or Linux. Enter your license key and you\'re ready to go.', icon: <Download size={28} /> },
              { step: '02', title: 'Choose Your Platform', desc: 'Select from 12+ platforms. Configure your search query, filters, and extraction limits.', icon: <Search size={28} /> },
              { step: '03', title: 'Extract & Export', desc: 'Hit start and watch leads pour in. Export to CSV, Excel, or push directly to HubSpot CRM.', icon: <Users size={28} /> },
            ].map((s, i) => (
              <motion.div key={i} variants={fadeIn} className="bg-white rounded-2xl border border-gray-200 p-8 hover:shadow-xl transition-all duration-500 group">
                <span className="text-accent font-mono text-lg font-bold">{s.step}.</span>
                <div className="w-14 h-14 bg-accent/10 rounded-xl flex items-center justify-center my-4 group-hover:bg-accent/20 transition-colors text-accent">{s.icon}</div>
                <h3 className="text-xl font-bold mb-2">{s.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{s.desc}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  )
}

/* ─── FAQ ─── */
function FAQ() {
  const faqs = [
    { q: 'Is SnapLeads really that affordable?', a: 'Yes! Our Starter plan is just $9/month. We believe powerful lead extraction should not cost hundreds. Your license gives you full access to the desktop app with no hidden costs, no API fees, and no proxy charges.' },
    { q: 'Will my accounts get banned using SnapLeads?', a: 'We have built enterprise-grade account safety: smart rate limiting, randomized behavior patterns, and built-in safety controls. In 6+ months of testing, zero bans reported.' },
    { q: 'What platforms can I extract leads from?', a: 'LinkedIn, Facebook, Instagram, Reddit, Twitter/X, TikTok, YouTube, Google Maps, Telegram, WhatsApp, and more. Pro plan includes all platforms; Starter includes 5 core platforms.' },
    { q: 'Does it work on Windows, Mac, and Linux?', a: 'Yes! SnapLeads works on all three platforms. Download the installer for your OS and you are ready in under 2 minutes.' },
    { q: 'Can I export leads to my CRM?', a: 'Pro plan includes direct HubSpot and Salesforce CRM integration. All plans support CSV and Excel export. We are adding more CRM integrations based on user demand.' },
    { q: 'What if I do not like it? Is there a refund?', a: 'We offer a 14-day money-back guarantee on all plans. If SnapLeads does not meet your needs, we will refund you — no questions asked.' },
  ]
  
  const [open, setOpen] = useState<number | null>(null)
  
  return (
    <section id="faq" className="py-24 px-4 bg-light text-dark">
      <div className="max-w-3xl mx-auto">
        <motion.div variants={stagger} initial="hidden" whileInView="visible" viewport={{ once: true }}>
          <motion.div variants={fadeIn} className="text-center mb-16">
            <span className="font-mono text-xs uppercase tracking-widest text-gray-500 border border-gray-300 px-4 py-2 rounded-full">[ Answers To Your Questions ]</span>
            <h2 className="text-4xl md:text-5xl font-black uppercase mt-6 tracking-tight">Frequently Asked Questions</h2>
            <p className="text-gray-500 mt-4">Everything you need to know before getting started with SnapLeads.</p>
          </motion.div>
          
          <div className="space-y-3">
            {faqs.map((faq, i) => (
              <motion.div key={i} variants={fadeIn} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <button onClick={() => setOpen(open === i ? null : i)} className="w-full flex items-center justify-between p-6 text-left hover:bg-gray-50 transition-colors">
                  <span className="font-bold text-sm uppercase tracking-wide pr-4">{faq.q}</span>
                  <ChevronDown size={18} className={`text-gray-400 flex-shrink-0 transition-transform duration-300 ${open === i ? 'rotate-180' : ''}`} />
                </button>
                {open === i && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} transition={{ duration: 0.3 }} className="px-6 pb-6">
                    <p className="text-gray-500 text-sm leading-relaxed border-t border-gray-100 pt-4">{faq.a}</p>
                  </motion.div>
                )}
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  )
}

/* ─── FINAL CTA ─── */
function FinalCTA() {
  return (
    <section className="py-24 px-4 bg-dark noise-bg relative">
      <div className="max-w-4xl mx-auto text-center relative z-10">
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger}>
          <motion.h2 variants={fadeIn} className="text-4xl md:text-6xl lg:text-7xl font-black uppercase tracking-tight leading-none">
            Your Ultimate Lead Extraction Machine.
            <span className="text-gradient"> Start Today.</span>
          </motion.h2>
          <motion.div variants={fadeIn} className="mt-8">
            <a href="#pricing" className="inline-flex items-center gap-2 bg-accent hover:bg-accent-hover text-white font-mono text-sm uppercase tracking-wider px-10 py-5 rounded-full transition-all duration-300 hover:shadow-xl hover:shadow-accent/30 animate-pulse-glow">
              Download SnapLeads <ArrowRight size={16} />
            </a>
          </motion.div>
        </motion.div>
      </div>
    </section>
  )
}

/* ─── KEYWORD MARQUEE ─── */
function KeywordMarquee() {
  const keywords = ['Lead Extraction', 'Email Finder', 'Google Maps', 'Account Safety', 'CRM Export', 'No Proxies', 'Desktop App', 'Scheduled Runs']
  return (
    <div className="py-6 bg-dark border-t border-b border-dark-border overflow-hidden">
      <div className="flex animate-marquee whitespace-nowrap">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="flex items-center gap-4 mx-4">
            {keywords.map((kw, j) => (
              <span key={`${i}-${j}`} className="font-mono text-xs uppercase tracking-widest text-gray-600 border border-dark-border px-5 py-2 rounded-full hover:text-gray-400 hover:border-gray-600 transition-colors">{kw}</span>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

/* ─── FOOTER ─── */
function Footer() {
  return (
    <footer className="py-16 px-4 bg-dark">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
          {/* Socials */}
          <div>
            <h6 className="font-mono text-xs uppercase tracking-widest text-gray-400 mb-4">Follow Us</h6>
            <div className="space-y-3">
              {[
                { icon: <Twitter size={16} />, name: 'X (Twitter)', href: '#' },
                { icon: <Facebook size={16} />, name: 'Facebook', href: '#' },
                { icon: <Linkedin size={16} />, name: 'LinkedIn', href: '#' },
              ].map((s, i) => (
                <a key={i} href={s.href} className="flex items-center gap-2 text-gray-500 hover:text-white transition-colors text-sm">
                  {s.icon} <span className="font-mono text-xs uppercase tracking-wider">{s.name}</span>
                </a>
              ))}
            </div>
          </div>
          
          {/* Product */}
          <div>
            <h6 className="font-mono text-xs uppercase tracking-widest text-gray-400 mb-4">Product</h6>
            {[
              { label: 'Features', href: '#features' },
              { label: 'Platforms', href: '#platforms' },
              { label: 'Pricing', href: '#pricing' },
              { label: 'Download', href: '#pricing' },
            ].map((item, i) => (
              <a key={i} href={item.href} className="block text-gray-500 hover:text-white transition-colors mb-2 font-mono text-xs uppercase tracking-wider">{item.label}</a>
            ))}
          </div>
          
          {/* Support */}
          <div>
            <h6 className="font-mono text-xs uppercase tracking-widest text-gray-400 mb-4">Support</h6>
            {[
              { label: 'FAQ', href: '#faq' },
              { label: 'Contact', href: 'mailto:support@getsnapleads.store' },
              { label: 'Documentation', href: '#faq' },
              { label: 'Changelog', href: '#features' },
            ].map((item, i) => (
              <a key={i} href={item.href} className="block text-gray-500 hover:text-white transition-colors mb-2 font-mono text-xs uppercase tracking-wider">{item.label}</a>
            ))}
          </div>
          
          {/* Legal */}
          <div>
            <h6 className="font-mono text-xs uppercase tracking-widest text-gray-400 mb-4">Legal</h6>
            {[
              { label: 'Privacy Policy', href: '#' },
              { label: 'Terms of Service', href: '#' },
              { label: 'Refund Policy', href: '#faq' },
              { label: 'License Agreement', href: '#' },
            ].map((item, i) => (
              <a key={i} href={item.href} className="block text-gray-500 hover:text-white transition-colors mb-2 font-mono text-xs uppercase tracking-wider">{item.label}</a>
            ))}
          </div>
        </div>
        
        <div className="border-t border-dark-border pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <img src="/images/logo.png" alt="SnapLeads" className="w-8 h-8 rounded-lg" />
            <span className="font-mono font-bold text-sm tracking-wider uppercase text-white">SnapLeads</span>
          </div>
          <p className="font-mono text-xs uppercase tracking-wider text-gray-600">&copy; 2026 SnapLeads. All Rights Reserved.</p>
        </div>
      </div>
    </footer>
  )
}

/* ─── MAIN APP ─── */
function App() {
  return (
    <div className="min-h-screen bg-dark">
      <Navbar />
      <Hero />
      <Stats />
      <WhoWeAre />
      <Features />
      <Platforms />
      <Pricing />
      <Testimonial />
      <HowItWorks />
      <FAQ />
      <FinalCTA />
      <KeywordMarquee />
      <Footer />
    </div>
  )
}

export default App
