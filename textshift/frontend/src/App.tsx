import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, lazy, Suspense } from 'react';
import { useAuthStore } from '@/store/authStore';

// Eager load critical pages for fast initial render
import LandingPage from '@/pages/LandingPage';
import LoginPage from '@/pages/LoginPage';
import RegisterPage from '@/pages/RegisterPage';

// Lazy load non-critical pages for better performance
const ForgotPasswordPage = lazy(() => import('@/pages/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('@/pages/ResetPasswordPage'));
const VerifyEmailPage = lazy(() => import('@/pages/VerifyEmailPage'));
const VerifyEmailPendingPage = lazy(() => import('@/pages/VerifyEmailPendingPage'));
const Dashboard = lazy(() => import('@/pages/Dashboard'));
const PricingPage = lazy(() => import('@/pages/PricingPage'));
const HistoryPage = lazy(() => import('@/pages/HistoryPage'));
const AdminDashboard = lazy(() => import('@/pages/AdminDashboard'));
const AdminPanel = lazy(() => import('@/pages/AdminPanel'));
const SettingsPage = lazy(() => import('@/pages/SettingsPage'));
const WritingTools = lazy(() => import('@/pages/WritingTools'));
const ApiDocsPage = lazy(() => import('@/pages/ApiDocsPage'));
const FeaturesPage = lazy(() => import('@/pages/FeaturesPage'));

// Policy pages for Razorpay compliance
const ShippingPolicyPage = lazy(() => import('@/pages/ShippingPolicyPage'));
const ContactPage = lazy(() => import('@/pages/ContactPage'));
const PricingDetailsPage = lazy(() => import('@/pages/PricingDetailsPage'));
const TermsPage = lazy(() => import('@/pages/TermsPage'));
const PrivacyPolicyPage = lazy(() => import('@/pages/PrivacyPolicyPage'));
const RefundPolicyPage = lazy(() => import('@/pages/RefundPolicyPage'));

// Loading fallback component
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50">
    <div className="flex flex-col items-center gap-4">
      <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      <p className="text-sm text-gray-500">Loading...</p>
    </div>
  </div>
);

function ScrollToTop() {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    if (hash) {
      const element = document.getElementById(hash.substring(1));
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
      }
    } else {
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
  }, [pathname, hash]);

  return null;
}

const queryClient= new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 1,
    },
  },
});

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const user = useAuthStore((state) => state.user);
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
  if (user && !user.is_verified) {
    return <Navigate to="/verify-email-pending" state={{ email: user.email }} replace />;
  }
  
  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  
  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }
  
  return <>{children}</>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <ScrollToTop />
        <Suspense fallback={<PageLoader />}>
          <Routes>
                        {/* Public pages - no auth required */}
                        <Route path="/" element={<LandingPage />} />
                        <Route path="/pricing" element={<PricingPage />} />
                        <Route path="/api-docs" element={<ApiDocsPage />} />
                        <Route path="/features" element={<FeaturesPage />} />
            
                        {/* Policy pages for Razorpay compliance */}
                        <Route path="/shipping-policy" element={<ShippingPolicyPage />} />
                        <Route path="/contact" element={<ContactPage />} />
                        <Route path="/pricing-details" element={<PricingDetailsPage />} />
                        <Route path="/terms" element={<TermsPage />} />
                        <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
                        <Route path="/refund-policy" element={<RefundPolicyPage />} />
            
            {/* Auth pages - redirect if logged in */}
            <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
            <Route path="/register" element={<PublicRoute><RegisterPage /></PublicRoute>} />
            <Route path="/forgot-password" element={<PublicRoute><ForgotPasswordPage /></PublicRoute>} />
            <Route path="/reset-password" element={<PublicRoute><ResetPasswordPage /></PublicRoute>} />
            
            {/* Email verification */}
            <Route path="/verify-email" element={<VerifyEmailPage />} />
            <Route path="/verify-email-pending" element={<VerifyEmailPendingPage />} />
            
            {/* Protected pages - require auth */}
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/history" element={<ProtectedRoute><HistoryPage /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
            <Route path="/writing-tools" element={<ProtectedRoute><WritingTools /></ProtectedRoute>} />
            
            {/* Admin pages */}
            <Route path="/admin/ml-dashboard" element={<ProtectedRoute><AdminDashboard /></ProtectedRoute>} />
            <Route path="/admin" element={<ProtectedRoute><AdminPanel /></ProtectedRoute>} />
            
            {/* Catch all */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </Router>
    </QueryClientProvider>
  );
}

export default App
// Cache bust 1769877197
