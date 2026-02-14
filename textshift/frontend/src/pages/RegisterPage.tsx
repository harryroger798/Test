import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, CheckCircle, ArrowRight } from 'lucide-react';
import { authApi } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { triggerConfetti } from '@/components/animations/ConfettiEffect';
import { ParticlesBackground, GradientBackground, NoiseOverlay } from '@/components/animations';
import { usePageSEO } from '@/hooks/usePageSEO';
import { useMTCaptcha } from '@/hooks/useMTCaptcha';
import SocialLoginButtons from '@/components/SocialLoginButtons';

export default function RegisterPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);

  usePageSEO({
    title: 'Create Your Free Account',
    description: 'Sign up for TextShift and get 5,000 free words for AI detection. Access text humanization, plagiarism checking, and 14 writing tools.',
    keywords: 'TextShift signup, free AI detector, create account, AI writing tools free',
  });

  const { getToken, reset: resetCaptcha } = useMTCaptcha('mtcaptcha-register');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const captchaToken = getToken();
    if (!captchaToken) {
      setError('Please complete the CAPTCHA verification.');
      return;
    }

    setLoading(true);

    try {
      const response = await authApi.register(email, password, fullName, captchaToken);
      setAuth(response.access_token, response.user);
      triggerConfetti();
      // Redirect to verification pending page instead of dashboard
      setTimeout(() => navigate('/verify-email-pending', { state: { email } }), 1500);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Registration failed. Please try again.');
      resetCaptcha();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center px-4 py-12">
      <ParticlesBackground />
      <GradientBackground />
      <NoiseOverlay />

      <div className="w-full max-w-md relative">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2 mb-8">
            <div className="w-2 h-2 bg-emerald-400 rounded-full" />
            <span className="text-white font-medium tracking-wide">TextShift</span>
          </Link>
          <h1 className="text-3xl md:text-4xl font-light text-white mb-2">Create your account</h1>
          <p className="text-gray-500">Start with 5,000 free words for AI Detection</p>
        </div>

        <div className="bg-gradient-to-b from-white/5 to-transparent border border-white/10 rounded-3xl p-6 md:p-8">
          <SocialLoginButtons mode="signup" />

          <div className="flex items-center gap-4 my-6">
            <div className="flex-1 h-px bg-white/10" />
            <span className="text-xs text-gray-500 uppercase tracking-wider">or</span>
            <div className="flex-1 h-px bg-white/10" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-400 text-sm">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="fullName" className="text-gray-300 text-sm">Full Name</Label>
              <Input
                id="fullName"
                type="text"
                placeholder="John Doe"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="bg-black/30 border-white/10 text-white placeholder:text-gray-600 rounded-xl h-12 focus:border-emerald-500/50 focus:ring-emerald-500/20"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email" className="text-gray-300 text-sm">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="bg-black/30 border-white/10 text-white placeholder:text-gray-600 rounded-xl h-12 focus:border-emerald-500/50 focus:ring-emerald-500/20"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-gray-300 text-sm">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Create a password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="bg-black/30 border-white/10 text-white placeholder:text-gray-600 rounded-xl h-12 focus:border-emerald-500/50 focus:ring-emerald-500/20"
              />
            </div>
            <div id="mtcaptcha-register" className="mt-1 mb-1" />
            <Button
              type="submit"
              className="w-full bg-emerald-500 hover:bg-emerald-600 text-black font-medium rounded-full h-12"
              disabled={loading}
            >
              {loading ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Creating account...</>
              ) : (
                <>Create account <ArrowRight className="w-4 h-4 ml-2" /></>
              )}
            </Button>
          </form>
          
          <div className="mt-6 pt-6 border-t border-white/10">
            <div className="text-gray-500 text-sm text-center mb-4">What you get:</div>
            <div className="space-y-3">
              {['5,000 free words/month', 'AI Detection included', 'Upgrade for all 3 tools'].map((item, i) => (
                <div key={i} className="flex items-center text-gray-300 text-sm">
                  <CheckCircle className="w-4 h-4 text-emerald-400 mr-3 flex-shrink-0" />{item}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-8 text-center text-gray-500">
          Already have an account?{' '}
          <Link to="/login" className="text-emerald-400 hover:text-emerald-300 transition">Sign in</Link>
        </div>
      </div>
    </div>
  );
}
