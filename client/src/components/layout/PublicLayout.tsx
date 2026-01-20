// Force rebuild v3
import { Link, useLocation } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { LanguageSelector } from '@/components/LanguageSelector'
import { ThemeToggle } from '@/components/ThemeToggle'
import { Menu, X, Mail, MapPin, Phone, Facebook, Twitter, Instagram, Linkedin, MessageCircle, ArrowUp, Calendar, PhoneCall, Zap } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

// Floating WhatsApp Button Component
function FloatingWhatsApp() {
  const [isHovered, setIsHovered] = useState(false)
  const { i18n } = useTranslation()
  const whatsappNumber = '919876543210' // Replace with actual number
  const message = encodeURIComponent(
    i18n.language === 'hi' ? 'Namaste! Mujhe repair service chahiye.' :
    i18n.language === 'bn' ? 'নমস্কার! আমার মেরামত সেবা দরকার।' :
    'Hello! I need repair service.'
  )
  
  return (
    <motion.a
      href={`https://wa.me/${whatsappNumber}?text=${message}`}
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-24 right-6 z-50 flex items-center gap-2"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      transition={{ delay: 1, type: 'spring', stiffness: 200 }}
    >
      <AnimatePresence>
        {isHovered && (
          <motion.span
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="bg-white dark:bg-slate-800 px-4 py-2 rounded-full shadow-lg text-sm font-medium text-slate-700 dark:text-white whitespace-nowrap"
          >
            {i18n.language === 'hi' ? 'WhatsApp pe baat karein!' :
             i18n.language === 'bn' ? 'WhatsApp-এ কথা বলুন!' :
             'Chat on WhatsApp!'}
          </motion.span>
        )}
      </AnimatePresence>
      <motion.div
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        className="h-14 w-14 bg-green-500 rounded-full flex items-center justify-center shadow-lg shadow-green-500/30"
      >
        <MessageCircle className="h-7 w-7 text-white fill-white" />
      </motion.div>
      <motion.div
        className="absolute -top-1 -right-1 h-4 w-4 bg-red-500 rounded-full"
        animate={{ scale: [1, 1.2, 1] }}
        transition={{ duration: 1.5, repeat: Infinity }}
      />
    </motion.a>
  )
}

// Back to Top Button
function BackToTop() {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const toggleVisibility = () => {
      if (window.scrollY > 300) {
        setIsVisible(true)
      } else {
        setIsVisible(false)
      }
    }
    window.addEventListener('scroll', toggleVisibility)
    return () => window.removeEventListener('scroll', toggleVisibility)
  }, [])

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.button
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          onClick={scrollToTop}
          className="fixed bottom-6 right-6 z-50 h-12 w-12 bg-primary rounded-full flex items-center justify-center shadow-lg shadow-primary/30 hover:bg-primary/90 transition-colors"
        >
          <ArrowUp className="h-5 w-5 text-white" />
        </motion.button>
      )}
    </AnimatePresence>
  )
}

// Mobile Quick Action Bar
function MobileQuickActions() {
  const { i18n } = useTranslation()
  const whatsappNumber = '919876543210'
  
  return (
    <motion.div
      initial={{ y: 100 }}
      animate={{ y: 0 }}
      transition={{ delay: 0.5 }}
      className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700 shadow-lg"
    >
      <div className="grid grid-cols-3 divide-x divide-slate-200 dark:divide-slate-700">
        <a
          href="tel:+919876543210"
          className="flex flex-col items-center justify-center py-3 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
        >
          <PhoneCall className="h-5 w-5 mb-1 text-primary" />
          <span className="text-xs font-medium">
            {i18n.language === 'hi' ? 'Call' : i18n.language === 'bn' ? 'কল' : 'Call'}
          </span>
        </a>
        <a
          href={`https://wa.me/${whatsappNumber}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex flex-col items-center justify-center py-3 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
        >
          <MessageCircle className="h-5 w-5 mb-1 text-green-500" />
          <span className="text-xs font-medium">WhatsApp</span>
        </a>
        <Link
          to="/booking"
          className="flex flex-col items-center justify-center py-3 bg-gradient-to-r from-primary to-purple-500 text-white"
        >
          <Calendar className="h-5 w-5 mb-1" />
          <span className="text-xs font-medium">
            {i18n.language === 'hi' ? 'Book' : i18n.language === 'bn' ? 'বুক' : 'Book'}
          </span>
        </Link>
      </div>
    </motion.div>
  )
}

// Emergency Repair Banner
function EmergencyBanner() {
  const { i18n } = useTranslation()
  const [isVisible, setIsVisible] = useState(true)
  
  if (!isVisible) return null
  
  return (
    <motion.div
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      className="bg-gradient-to-r from-red-500 via-orange-500 to-red-500 text-white py-2 px-4 relative overflow-hidden"
    >
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse" />
      <div className="container mx-auto flex items-center justify-center gap-3 text-sm font-medium relative z-10">
        <motion.div
          animate={{ scale: [1, 1.2, 1] }}
          transition={{ duration: 1, repeat: Infinity }}
        >
          <Zap className="h-4 w-4 fill-yellow-300 text-yellow-300" />
        </motion.div>
        <span>
          {i18n.language === 'hi' ? 'Same Day Repair Available! Abhi Book Karein' :
           i18n.language === 'bn' ? 'একই দিনে মেরামত উপলব্ধ! এখনই বুক করুন' :
           'Same Day Repair Available! Book Now'}
        </span>
        <Link to="/booking" className="underline hover:no-underline">
          {i18n.language === 'hi' ? 'Book' : i18n.language === 'bn' ? 'বুক' : 'Book'}
        </Link>
        <button
          onClick={() => setIsVisible(false)}
          className="absolute right-4 top-1/2 -translate-y-1/2 hover:bg-white/20 rounded p-1"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </motion.div>
  )
}

interface PublicLayoutProps {
  children: React.ReactNode
}

export function PublicLayout({ children }: PublicLayoutProps) {
  const { t } = useTranslation()
  const location = useLocation()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

        const navLinks = [
          { href: '/', label: t('nav.home') },
          { href: '/services', label: t('nav.services') },
          { href: '/pricing', label: t('nav.pricing') },
          { href: '/blog', label: t('nav.blog') },
          { href: '/about', label: t('nav.about') },
          { href: '/contact', label: t('nav.contact') },
          { href: '/help', label: t('nav.help') },
          { href: '/booking', label: t('nav.booking') },
        ]

  const isActive = (href: string) => {
    if (href === '/') return location.pathname === '/'
    return location.pathname.startsWith(href)
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      {/* Emergency Banner */}
      <EmergencyBanner />
      
      {/* Header */}
      <header className="border-b border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4">
          <div className="flex h-16 items-center justify-between">
                        {/* Logo */}
                        <Link to="/" className="flex items-center gap-2">
                                                    <img src="/images/favicon.png" alt="ByteCare" className="h-14 w-14 object-contain" />
                                                    <span className="text-3xl font-bold text-primary">ByteCare</span>
                        </Link>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-6">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  to={link.href}
                  className={`text-sm font-medium transition-colors hover:text-primary ${
                    isActive(link.href)
                      ? 'text-primary'
                      : 'text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </nav>

            {/* Right side actions */}
            <div className="flex items-center gap-2">
              <LanguageSelector />
              <ThemeToggle />
              <Link to="/login" className="hidden sm:block">
                <Button>{t('nav.login')}</Button>
              </Link>
              
              {/* Mobile menu button */}
              <button
                className="md:hidden p-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              >
                {mobileMenuOpen ? (
                  <X className="h-6 w-6 text-slate-600 dark:text-slate-300" />
                ) : (
                  <Menu className="h-6 w-6 text-slate-600 dark:text-slate-300" />
                )}
              </button>
            </div>
          </div>

          {/* Mobile Navigation */}
          {mobileMenuOpen && (
            <div className="md:hidden py-4 border-t border-slate-200 dark:border-slate-700">
              <nav className="flex flex-col gap-2">
                {navLinks.map((link) => (
                  <Link
                    key={link.href}
                    to={link.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                      isActive(link.href)
                        ? 'bg-primary/10 text-primary'
                        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    {link.label}
                  </Link>
                ))}
                <Link
                  to="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="px-4 py-2 mt-2"
                >
                  <Button className="w-full">{t('nav.login')}</Button>
                </Link>
              </nav>
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1">
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-slate-900 text-white">
        <div className="container mx-auto px-4 py-12">
          <div className="grid gap-8 md:grid-cols-4">
            {/* Company Info */}
            <div className="md:col-span-1">
                                                        <div className="flex items-center gap-2 mb-4">
                                                          <img src="/images/favicon.png" alt="ByteCare" className="h-14 w-14 object-contain" />
                                                          <span className="text-2xl font-bold">ByteCare</span>
                                                        </div>
              <p className="text-slate-400 text-sm mb-4">
                {t('footer.description')}
              </p>
              <div className="flex gap-4">
                <a href="#" className="text-slate-400 hover:text-white transition-colors">
                  <Facebook className="h-5 w-5" />
                </a>
                <a href="#" className="text-slate-400 hover:text-white transition-colors">
                  <Twitter className="h-5 w-5" />
                </a>
                <a href="#" className="text-slate-400 hover:text-white transition-colors">
                  <Instagram className="h-5 w-5" />
                </a>
                <a href="#" className="text-slate-400 hover:text-white transition-colors">
                  <Linkedin className="h-5 w-5" />
                </a>
              </div>
            </div>

            {/* Quick Links */}
            <div>
              <h3 className="font-semibold mb-4">{t('footer.quickLinks')}</h3>
              <ul className="space-y-2">
                {navLinks.slice(1).map((link) => (
                  <li key={link.href}>
                    <Link
                      to={link.href}
                      className="text-slate-400 hover:text-white transition-colors text-sm"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Services */}
            <div>
              <h3 className="font-semibold mb-4">{t('footer.services')}</h3>
              <ul className="space-y-2 text-sm text-slate-400">
                <li>{t('footer.pcRepair')}</li>
                <li>{t('footer.mobileRepair')}</li>
                <li>{t('footer.laptopRepair')}</li>
                <li>{t('footer.dataRecovery')}</li>
                <li>{t('footer.webDevelopment')}</li>
              </ul>
            </div>

            {/* Contact Info */}
            <div>
              <h3 className="font-semibold mb-4">{t('footer.contactUs')}</h3>
              <ul className="space-y-3 text-sm text-slate-400">
                <li className="flex items-start gap-2">
                  <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <span>Barrackpore, West Bengal, India</span>
                </li>
                <li className="flex items-center gap-2">
                  <Phone className="h-4 w-4 flex-shrink-0" />
                  <span>+91 98765 43210</span>
                </li>
                <li className="flex items-center gap-2">
                  <Mail className="h-4 w-4 flex-shrink-0" />
                  <span>harryroger798@gmail.com</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="border-t border-slate-800 mt-8 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-slate-400 text-sm">
              &copy; {new Date().getFullYear()} ByteCare. {t('footer.rights')}
            </p>
            <div className="flex items-center gap-4">
              <Link to="/login" className="text-slate-400 hover:text-white transition-colors text-sm">
                {t('footer.adminLogin')}
              </Link>
            </div>
          </div>
        </div>
      </footer>
      
      {/* Floating Components */}
      <FloatingWhatsApp />
      <BackToTop />
      <MobileQuickActions />
    </div>
  )
}
