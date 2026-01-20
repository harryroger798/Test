import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { Layout } from '@/components/layout/Layout'
import { ScrollToTop } from '@/components/ScrollToTop'
import { LandingPage } from '@/pages/LandingPage'
import { LoginPage } from '@/pages/LoginPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { CustomersPage } from '@/pages/CustomersPage'
import { RepairsPage } from '@/pages/RepairsPage'
import { InvoicesPage } from '@/pages/InvoicesPage'
import { ServicesPage } from '@/pages/ServicesPage'
import { DigitalServicesPage } from '@/pages/DigitalServicesPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { ReportsPage } from '@/pages/ReportsPage'
import { ActivityLogPage } from '@/pages/ActivityLogPage'
import { Toaster } from '@/components/ui/toaster'
import { ThemeProvider } from '@/components/ThemeProvider'
import { PublicServicesPage } from '@/pages/public/ServicesPage'
import { AboutPage } from '@/pages/public/AboutPage'
import { ContactPage } from '@/pages/public/ContactPage'
import { BlogPage } from '@/pages/public/BlogPage'
import { BlogPostPage } from '@/pages/public/BlogPostPage'
import { BookingPage } from '@/pages/public/BookingPage'
import { PricingPage } from '@/pages/public/PricingPage'
import { HelpCenterPage } from '@/pages/public/HelpCenterPage'
import { TrackRepairPage } from '@/pages/public/TrackRepairPage'
import { SitemapPage } from '@/pages/public/SitemapPage'
import { AuthorPage } from '@/pages/public/AuthorPage'
import { CategoryPage } from '@/pages/public/CategoryPage'
import { NotFoundPage } from '@/pages/NotFoundPage'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore()
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }
  
  return <>{children}</>
}

function App() {
  return (
    <ThemeProvider defaultTheme="system" storageKey="bytecare-ui-theme">
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/services" element={<PublicServicesPage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/contact" element={<ContactPage />} />
        <Route path="/blog" element={<BlogPage />} />
        <Route path="/blog/:slug" element={<BlogPostPage />} />
        <Route path="/blog/author/:slug" element={<AuthorPage />} />
        <Route path="/blog/category/:slug" element={<CategoryPage />} />
                <Route path="/booking" element={<BookingPage />} />
                <Route path="/pricing" element={<PricingPage />} />
                                <Route path="/help" element={<HelpCenterPage />} />
                                                                <Route path="/track" element={<TrackRepairPage />} />
                                                                <Route path="/sitemap.xml" element={<SitemapPage />} />
                                                                <Route path="/login" element={<LoginPage />} />
        <Route
          path="/app"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<DashboardPage />} />
          <Route path="customers" element={<CustomersPage />} />
          <Route path="repairs" element={<RepairsPage />} />
          <Route path="invoices" element={<InvoicesPage />} />
          <Route path="services" element={<ServicesPage />} />
          <Route path="digital-services" element={<DigitalServicesPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="reports" element={<ReportsPage />} />
                <Route path="activity" element={<ActivityLogPage />} />
              </Route>
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
      <Toaster />
    </ThemeProvider>
  )
}

export default App
