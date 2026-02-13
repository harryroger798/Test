import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, ArrowRight } from 'lucide-react';
import { authApi } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { usePageSEO } from '@/hooks/usePageSEO';
import { useMTCaptcha } from '@/hooks/useMTCaptcha';
import SocialLoginButtons from '@/components/SocialLoginButtons';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);

  usePageSEO({
    title: 'Sign In to Your Account',
    description: 'Sign in to TextShift to access AI content detection, text humanization, plagiarism checking, and 14 writing tools.',
    noIndex: true,
  });

  const { getToken, reset: resetCaptcha } = useMTCaptcha('mtcaptcha-login');

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
      const response = await authApi.login(email, password);
      setAuth(response.access_token, response.user);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Login failed. Please try again.');
      resetCaptcha();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center px-4">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-gradient-to-b from-emerald-500/20 via-emerald-500/5 to-transparent rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md relative">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2 mb-8">
            <div className="w-2 h-2 bg-emerald-400 rounded-full" />
            <span className="text-white font-medium tracking-wide">TextShift</span>
          </Link>
          <h1 className="text-3xl md:text-4xl font-light text-white mb-2">Welcome back</h1>
          <p className="text-gray-500">Sign in to your account to continue</p>
        </div>

        <div className="bg-gradient-to-b from-white/5 to-transparent border border-white/10 rounded-3xl p-6 md:p-8">
          <SocialLoginButtons mode="login" />

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
                          <div className="flex items-center justify-between">
                            <Label htmlFor="password" className="text-gray-300 text-sm">Password</Label>
                            <Link to="/forgot-password" className="text-sm text-emerald-400 hover:text-emerald-300 transition">
                              Forgot password?
                            </Link>
                          </div>
                          <Input
                            id="password"
                            type="password"
                            placeholder="Enter your password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            className="bg-black/30 border-white/10 text-white placeholder:text-gray-600 rounded-xl h-12 focus:border-emerald-500/50 focus:ring-emerald-500/20"
                          />
                        </div>
            <div id="mtcaptcha-login" className="mt-1 mb-1" />
            <Button
              type="submit"
              className="w-full bg-emerald-500 hover:bg-emerald-600 text-black font-medium rounded-full h-12"
              disabled={loading}
            >
              {loading ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Signing in...</>
              ) : (
                <>Sign in <ArrowRight className="w-4 h-4 ml-2" /></>
              )}
            </Button>
          </form>
        </div>

        <div className="mt-8 text-center text-gray-500">
          Don't have an account?{' '}
          <Link to="/register" className="text-emerald-400 hover:text-emerald-300 transition">Sign up</Link>
        </div>
      </div>
    </div>
  );
}
