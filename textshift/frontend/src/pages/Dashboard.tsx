import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { 
  Shield, 
  Sparkles, 
  Search, 
  Zap, 
  LogOut,
  CreditCard,
  History,
  Settings,
  Loader2,
  Copy,
  CheckCircle,
  AlertCircle,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Mail,
  BarChart3,
  AlertTriangle,
  FileText,
  ExternalLink,
  ArrowRight,
  Brain,
  Wand2,
  Globe,
  Key,
  FileCheck,
  Type,
  BookOpen,
  Languages,
  Repeat,
  Volume2,
  FileDown,
  Quote,
  Layers,
  PenTool
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { scanApi, creditsApi, authApi, promoApi } from '@/lib/api';
import { useQuery, useMutation } from '@tanstack/react-query';
import { FeedbackWidget } from '@/components/ui/FeedbackWidget';
import { detectFormat, FormatDetectionResult } from '@/lib/formatDetector';
import { FormatBadge } from '@/components/ui/FormatBadge';

// Animated Loading Component for AI Detection
const AIDetectionLoader = () => {
  const [statusIndex, setStatusIndex] = useState(0);
  const statuses = [
    'Initializing neural network...',
    'Analyzing text patterns...',
    'Detecting AI markers...',
    'Evaluating sentence structure...',
    'Computing probability scores...',
    'Finalizing analysis...'
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setStatusIndex((prev) => (prev + 1) % statuses.length);
    }, 1500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="bg-gradient-to-b from-emerald-500/10 to-transparent border border-emerald-500/30 rounded-3xl p-8">
      <div className="flex flex-col items-center justify-center space-y-6">
        {/* Animated Brain/Neural Network */}
        <div className="relative">
          <div className="w-24 h-24 rounded-full bg-emerald-500/20 flex items-center justify-center animate-pulse">
            <Brain className="w-12 h-12 text-emerald-400 animate-bounce" />
          </div>
          {/* Orbiting particles */}
          <div className="absolute inset-0 animate-spin" style={{ animationDuration: '3s' }}>
            <div className="absolute top-0 left-1/2 w-2 h-2 bg-emerald-400 rounded-full transform -translate-x-1/2" />
          </div>
          <div className="absolute inset-0 animate-spin" style={{ animationDuration: '4s', animationDirection: 'reverse' }}>
            <div className="absolute bottom-0 left-1/2 w-2 h-2 bg-emerald-300 rounded-full transform -translate-x-1/2" />
          </div>
          <div className="absolute inset-0 animate-spin" style={{ animationDuration: '5s' }}>
            <div className="absolute top-1/2 right-0 w-2 h-2 bg-emerald-500 rounded-full transform -translate-y-1/2" />
          </div>
        </div>

        {/* Scanning line effect */}
        <div className="w-full max-w-md h-1 bg-black/30 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-transparent via-emerald-400 to-transparent animate-pulse" 
               style={{ animation: 'scan 1.5s ease-in-out infinite' }} />
        </div>

        {/* Status text */}
        <div className="text-center">
          <p className="text-emerald-400 font-medium text-lg animate-pulse">{statuses[statusIndex]}</p>
          <p className="text-gray-500 text-sm mt-2">This may take a few moments</p>
        </div>

        {/* Progress dots */}
        <div className="flex gap-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className={`w-2 h-2 rounded-full transition-all duration-300 ${
                i <= statusIndex % 5 ? 'bg-emerald-400 scale-125' : 'bg-gray-600'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

// Animated Loading Component for Humanizer
const HumanizerLoader = () => {
  const [statusIndex, setStatusIndex] = useState(0);
  const statuses = [
    'Reading your text...',
    'Analyzing writing style...',
    'Applying human touch...',
    'Restructuring sentences...',
    'Adding natural variations...',
    'Polishing final output...'
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setStatusIndex((prev) => (prev + 1) % statuses.length);
    }, 1500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="bg-gradient-to-b from-purple-500/10 to-transparent border border-purple-500/30 rounded-3xl p-8">
      <div className="flex flex-col items-center justify-center space-y-6">
        {/* Animated Magic Wand with Sparkles */}
        <div className="relative">
          <div className="w-24 h-24 rounded-full bg-purple-500/20 flex items-center justify-center">
            <Wand2 className="w-12 h-12 text-purple-400 animate-bounce" />
          </div>
          {/* Sparkle particles */}
          <div className="absolute -top-2 -right-2 animate-ping">
            <Sparkles className="w-6 h-6 text-purple-300" />
          </div>
          <div className="absolute -bottom-2 -left-2 animate-ping" style={{ animationDelay: '0.5s' }}>
            <Sparkles className="w-5 h-5 text-purple-400" />
          </div>
          <div className="absolute top-1/2 -right-4 animate-ping" style={{ animationDelay: '1s' }}>
            <Sparkles className="w-4 h-4 text-purple-200" />
          </div>
        </div>

        {/* Transformation animation */}
        <div className="flex items-center gap-4">
          <div className="w-16 h-8 bg-gray-700 rounded animate-pulse flex items-center justify-center">
            <span className="text-xs text-gray-400">AI</span>
          </div>
          <ArrowRight className="w-6 h-6 text-purple-400 animate-pulse" />
          <div className="w-16 h-8 bg-purple-500/30 rounded animate-pulse flex items-center justify-center">
            <span className="text-xs text-purple-300">Human</span>
          </div>
        </div>

        {/* Status text */}
        <div className="text-center">
          <p className="text-purple-400 font-medium text-lg animate-pulse">{statuses[statusIndex]}</p>
          <p className="text-gray-500 text-sm mt-2">Transforming your content</p>
        </div>

        {/* Progress bar */}
        <div className="w-full max-w-md h-2 bg-black/30 rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-purple-600 to-purple-400 rounded-full transition-all duration-500"
            style={{ width: `${((statusIndex + 1) / statuses.length) * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
};

// Animated Loading Component for Plagiarism
const PlagiarismLoader = () => {
  const [statusIndex, setStatusIndex] = useState(0);
  const [sourceCount, setSourceCount] = useState(0);
  const statuses = [
    'Connecting to database...',
    'Scanning web sources...',
    'Checking academic papers...',
    'Analyzing document similarity...',
    'Cross-referencing content...',
    'Compiling results...'
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setStatusIndex((prev) => (prev + 1) % statuses.length);
    }, 1500);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const countInterval = setInterval(() => {
      setSourceCount((prev) => {
        if (prev >= 10000000) return 0;
        return prev + Math.floor(Math.random() * 500000) + 100000;
      });
    }, 200);
    return () => clearInterval(countInterval);
  }, []);

  return (
    <div className="bg-gradient-to-b from-blue-500/10 to-transparent border border-blue-500/30 rounded-3xl p-8">
      <div className="flex flex-col items-center justify-center space-y-6">
        {/* Animated Globe with Search */}
        <div className="relative">
          <div className="w-24 h-24 rounded-full bg-blue-500/20 flex items-center justify-center">
            <Globe className="w-12 h-12 text-blue-400 animate-spin" style={{ animationDuration: '8s' }} />
          </div>
          {/* Scanning magnifying glass */}
          <div className="absolute -bottom-2 -right-2 animate-bounce">
            <div className="w-10 h-10 bg-blue-500/30 rounded-full flex items-center justify-center">
              <Search className="w-5 h-5 text-blue-300" />
            </div>
          </div>
          {/* Connection lines */}
          <div className="absolute inset-0">
            <div className="absolute top-0 left-1/2 w-px h-4 bg-blue-400/50 animate-pulse" />
            <div className="absolute bottom-0 left-1/2 w-px h-4 bg-blue-400/50 animate-pulse" style={{ animationDelay: '0.3s' }} />
            <div className="absolute left-0 top-1/2 w-4 h-px bg-blue-400/50 animate-pulse" style={{ animationDelay: '0.6s' }} />
            <div className="absolute right-0 top-1/2 w-4 h-px bg-blue-400/50 animate-pulse" style={{ animationDelay: '0.9s' }} />
          </div>
        </div>

        {/* Source counter */}
        <div className="text-center">
          <p className="text-blue-300 text-sm">Checking against</p>
          <p className="text-blue-400 font-mono text-2xl font-bold">
            {sourceCount.toLocaleString()}+
          </p>
          <p className="text-blue-300 text-sm">sources</p>
        </div>

        {/* Status text */}
        <div className="text-center">
          <p className="text-blue-400 font-medium text-lg animate-pulse">{statuses[statusIndex]}</p>
          <p className="text-gray-500 text-sm mt-2">Comprehensive plagiarism scan in progress</p>
        </div>

        {/* Animated dots */}
        <div className="flex gap-1">
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
            <div
              key={i}
              className="w-2 h-2 rounded-full bg-blue-400 animate-pulse"
              style={{ animationDelay: `${i * 0.1}s` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default function Dashboard() {
  const { user, logout, updateUser } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState('detect');
  // Separate text state for each tool to prevent cross-contamination
  const [detectText, setDetectText] = useState('');
  const [humanizeText, setHumanizeText] = useState('');
    const [plagiarismText, setPlagiarismText] = useState('');
      const [result, setResult] = useState<any>(null);
      const [copied, setCopied] = useState(false);
    
      // Format detection state
      const [formatDetection, setFormatDetection] = useState<FormatDetectionResult | null>(null);
  
      // Promo code state
      const [promoCode, setPromoCode] = useState('');
      const [promoLoading, setPromoLoading] = useState(false);
      const [promoMessage, setPromoMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    
            // Writing tools expanded state - default to open
            const [writingToolsExpanded, setWritingToolsExpanded] = useState(true);
    
      // Writing tools configuration
      const writingTools = [
        { id: 'grammar', name: 'Grammar Check', icon: FileCheck, color: 'emerald', description: 'Fix grammar errors' },
        { id: 'readability', name: 'Readability', icon: BookOpen, color: 'blue', description: 'Analyze readability' },
        { id: 'tone', name: 'Tone Adjust', icon: Volume2, color: 'purple', description: 'Change writing tone' },
        { id: 'summarize', name: 'Summarize', icon: FileText, color: 'amber', description: 'Summarize content' },
        { id: 'paraphrase', name: 'Paraphrase', icon: Repeat, color: 'cyan', description: 'Rewrite content' },
        { id: 'translate', name: 'Translate', icon: Languages, color: 'rose', description: 'Translate text' },
        { id: 'word_count', name: 'Word Count', icon: Type, color: 'gray', description: 'Count words & chars' },
        { id: 'style', name: 'Style Analysis', icon: PenTool, color: 'indigo', description: 'Analyze writing style' },
        { id: 'improve', name: 'Content Improve', icon: Wand2, color: 'pink', description: 'Enhance content' },
        { id: 'citation', name: 'Citation Gen', icon: Quote, color: 'orange', description: 'Generate citations' },
        { id: 'export', name: 'Export', icon: FileDown, color: 'teal', description: 'Export to formats' },
        { id: 'bulk', name: 'Bulk Process', icon: Layers, color: 'violet', description: 'Process multiple files' },
      ];
    
    // Buy Credits modal state
    const [showBuyCreditsModal, setShowBuyCreditsModal] = useState(false);
    const [buyCreditsLoading, setBuyCreditsLoading] = useState<string | null>(null);
    const [buyCreditsMessage, setBuyCreditsMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    
    const creditPackages = [
      { id: '10k', name: '10,000 Words', price: 4.99, credits: 10000 },
      { id: '25k', name: '25,000 Words', price: 9.99, credits: 25000 },
      { id: '50k', name: '50,000 Words', price: 17.99, credits: 50000 },
      { id: '100k', name: '100,000 Words', price: 29.99, credits: 100000 },
    ];

  // Get current text based on active tab
  const getCurrentText = () => {
    switch (activeTab) {
      case 'detect': return detectText;
      case 'humanize': return humanizeText;
      case 'plagiarism': return plagiarismText;
      default: return detectText;
    }
  };

    // Set current text based on active tab
    const setCurrentText = (text: string) => {
      switch (activeTab) {
        case 'detect': setDetectText(text); break;
        case 'humanize': setHumanizeText(text); break;
        case 'plagiarism': setPlagiarismText(text); break;
      }
      // Detect format when text changes
      if (text.trim().length > 20) {
        const detection = detectFormat(text);
        setFormatDetection(detection);
      } else {
        setFormatDetection(null);
      }
    };
  
    // Handle stripping formatting
    const handleStripFormatting = (strippedText: string) => {
      setCurrentText(strippedText);
    };

  // Handle pre-filled text from navigation state (e.g., from History page re-analyze)
  useEffect(() => {
    const state = location.state as { text?: string; tool?: string } | null;
    if (state?.text && state?.tool) {
      // Only set text for the specific tool requested
      const toolMap: Record<string, string> = { 'humanize': 'humanize', 'plagiarism': 'plagiarism', 'detect': 'detect', 'ai_detection': 'detect' };
      const targetTool = toolMap[state.tool] || 'detect';
      setActiveTab(targetTool);
      // Set text only for the target tool
      switch (targetTool) {
        case 'detect': setDetectText(state.text); break;
        case 'humanize': setHumanizeText(state.text); break;
        case 'plagiarism': setPlagiarismText(state.text); break;
      }
    } else if (state?.tool) {
      const toolMap: Record<string, string> = { 'humanize': 'humanize', 'plagiarism': 'plagiarism', 'detect': 'detect', 'ai_detection': 'detect' };
      setActiveTab(toolMap[state.tool] || 'detect');
    }
    // Clear the state after reading it
    if (state) {
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  const { data: credits, refetch: refetchCredits } = useQuery({
    queryKey: ['credits'],
    queryFn: creditsApi.getBalance,
  });

  // Refresh user data on dashboard load to get latest subscription tier
  useEffect(() => {
    const refreshUserData = async () => {
      try {
        const userData = await authApi.getMe();
        updateUser(userData);
      } catch (error) {
        console.error('Failed to refresh user data:', error);
      }
    };
    refreshUserData();
  }, [updateUser]);

  const detectMutation = useMutation({
    mutationFn: scanApi.detectAI,
    onSuccess: (data) => {
      setResult(data);
      refetchCredits();
    },
  });

  const humanizeMutation = useMutation({
    mutationFn: scanApi.humanize,
    onSuccess: (data) => {
      setResult(data);
      refetchCredits();
    },
  });

  const plagiarismMutation = useMutation({
    mutationFn: scanApi.checkPlagiarism,
    onSuccess: (data) => {
      setResult(data);
      refetchCredits();
    },
  });

    const handleLogout = () => {
      logout();
      navigate('/');
    };

    const handleRedeemPromo = async () => {
      if (!promoCode.trim()) return;
    
      setPromoLoading(true);
      setPromoMessage(null);
    
      try {
        const result = await promoApi.redeem(promoCode.trim());
        setPromoMessage({ type: 'success', text: result.message || 'Promo code redeemed successfully!' });
        setPromoCode('');
        // Refresh user data and credits
        const userData = await authApi.getMe();
        updateUser(userData);
        refetchCredits();
      } catch (error: any) {
        const errorMessage = error?.response?.data?.detail || 'Failed to redeem promo code';
        setPromoMessage({ type: 'error', text: errorMessage });
      } finally {
        setPromoLoading(false);
      }
    };

    const handleBuyCredits = async (packageId: string) => {
      // Check if user is on a paid plan
      if (user?.subscription_tier === 'free') {
        setBuyCreditsMessage({ type: 'error', text: 'Credit top-ups are only available for paid plan users. Please upgrade to Starter, Pro, or Enterprise.' });
        return;
      }
      
      setBuyCreditsLoading(packageId);
      setBuyCreditsMessage(null);
      
      try {
        // Create PayPal order for credit top-up
        const orderResult = await creditsApi.createTopupOrder(packageId);
        
        if (orderResult.approval_url) {
          // Redirect to PayPal for payment
          window.location.href = orderResult.approval_url;
        } else {
          setBuyCreditsMessage({ type: 'error', text: 'Failed to create payment order' });
        }
      } catch (error: any) {
        const errorMessage = error?.response?.data?.detail || 'Failed to initiate payment';
        setBuyCreditsMessage({ type: 'error', text: errorMessage });
      } finally {
        setBuyCreditsLoading(null);
      }
    };

    // Handle PayPal return from credit top-up
    useEffect(() => {
      const urlParams = new URLSearchParams(window.location.search);
      const topupStatus = urlParams.get('topup');
      const packageId = urlParams.get('package');
      const token = urlParams.get('token'); // PayPal order ID
      
      if (topupStatus === 'success' && packageId && token) {
        // Capture the PayPal order
        const captureOrder = async () => {
          try {
            const result = await creditsApi.captureTopupOrder(token, packageId);
            setBuyCreditsMessage({ 
              type: 'success', 
              text: result.message || `Successfully added ${result.credits_added?.toLocaleString()} credits!` 
            });
            // Refresh user data and credits
            const userData = await authApi.getMe();
            updateUser(userData);
            refetchCredits();
            // Clean up URL
            window.history.replaceState({}, '', '/dashboard');
          } catch (error: any) {
            const errorMessage = error?.response?.data?.detail || 'Failed to complete payment';
            setBuyCreditsMessage({ type: 'error', text: errorMessage });
            window.history.replaceState({}, '', '/dashboard');
          }
        };
        captureOrder();
      } else if (topupStatus === 'cancelled') {
        setBuyCreditsMessage({ type: 'error', text: 'Payment was cancelled' });
        window.history.replaceState({}, '', '/dashboard');
      }
    }, []);

    const handleOpenBuyCredits = () => {
      if (user?.subscription_tier === 'free') {
        // Redirect free users to pricing page
        navigate('/pricing');
      } else {
        setShowBuyCreditsModal(true);
        setBuyCreditsMessage(null);
      }
    };

  const handleAnalyze = () => {
    setResult(null);
    const text = getCurrentText();
    if (activeTab === 'detect') {
      detectMutation.mutate(text);
    } else if (activeTab === 'humanize') {
      humanizeMutation.mutate(text);
    } else if (activeTab === 'plagiarism') {
      plagiarismMutation.mutate(text);
    }
  };

  const isLoading = detectMutation.isPending || humanizeMutation.isPending || plagiarismMutation.isPending;
  const error = detectMutation.error || humanizeMutation.error || plagiarismMutation.error;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getWordCount = () => {
    const text = getCurrentText();
    return text.trim().split(/\s+/).filter(w => w.length > 0).length;
  };

  const getCreditCost = () => {
    const wordCount = getWordCount();
    let multiplier = 1;
    switch (activeTab) {
      case 'detect': multiplier = 1; break;
      case 'humanize': multiplier = 2; break;
      case 'plagiarism': multiplier = 1.5; break;
      default: multiplier = 1;
    }
    // Formula: max(50, wordCount * multiplier)
    return Math.max(50, Math.floor(wordCount * multiplier));
  };

    const tabs = [
      { id: 'detect', label: 'AI Detection', icon: Shield, color: 'emerald', description: 'Powered by Advanced Neural Intelligence - spot machine-generated content with 99% accuracy.' },
      { id: 'humanize', label: 'Humanizer', icon: Sparkles, color: 'purple', description: 'Transform robotic text into authentic, human-sounding content while preserving your meaning.' },
      { id: 'plagiarism', label: 'Plagiarism', icon: Search, color: 'blue', description: 'Scan your content against billions of web pages and documents in real-time.' }
    ];

  const activeTabData = tabs.find(t => t.id === activeTab);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <style>{`
        @keyframes scan {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-gradient-to-b from-emerald-500/10 via-emerald-500/5 to-transparent rounded-full blur-3xl" />
      </div>

      <nav className="sticky top-0 z-50 border-b border-white/10 bg-[#0a0a0a]/80 backdrop-blur-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
                                                <Link to="/" className="flex items-center gap-2">
                                                  <img src="/images/logo.png" alt="TextShift" className="h-8 w-auto" />
                                                  <span className="text-white font-medium tracking-wide">TextShift</span>
                                                </Link>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 bg-white/5 border border-white/10 px-4 py-2 rounded-full">
                <CreditCard className="w-4 h-4 text-emerald-400" />
                <span className="text-white font-medium">
                  {credits?.balance === -1 ? 'Unlimited' : (credits?.balance?.toLocaleString() ?? user?.credits_balance?.toLocaleString() ?? 0)}
                </span>
                <span className="text-gray-500">words</span>
              </div>
              <Link to="/pricing">
                <Button className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20 rounded-full px-4">Upgrade</Button>
              </Link>
              <Button variant="ghost" size="sm" onClick={handleLogout} className="text-gray-400 hover:text-white hover:bg-white/5 rounded-full">
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-light text-white mb-2">
            Welcome back{user?.full_name ? `, ${user.full_name}` : ''}
          </h1>
          <p className="text-gray-500">Choose a tool below to analyze your text.</p>
        </div>

        {!user?.is_verified && (
          <div className="mb-8 p-6 bg-amber-500/10 border border-amber-500/30 rounded-2xl">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-amber-500/20 rounded-full">
                <Mail className="w-6 h-6 text-amber-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-medium text-amber-400 mb-2">Verify Your Email</h3>
                <p className="text-gray-300 mb-4">
                  Please verify your email address to access all features. Check your inbox for a verification link.
                </p>
                <div className="flex flex-wrap gap-3">
                  <Button
                    onClick={() => navigate('/verify-email')}
                    className="bg-amber-500 hover:bg-amber-600 text-black rounded-full px-6"
                  >
                    Enter Verification Code
                  </Button>
                  <Button
                    variant="outline"
                    onClick={async () => {
                      try {
                        const response = await fetch('/api/auth/resend-verification', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ email: user?.email })
                        });
                        if (response.ok) {
                          alert('Verification email sent! Please check your inbox.');
                        }
                      } catch (e) {
                        alert('Failed to resend verification email. Please try again.');
                      }
                    }}
                    className="border-amber-500/30 text-amber-400 hover:bg-amber-500/10 rounded-full px-6"
                  >
                    Resend Email
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <div className="flex gap-2 p-1 bg-white/5 rounded-2xl border border-white/10">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => { setActiveTab(tab.id); setResult(null); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-medium transition-all ${
                    activeTab === tab.id 
                      ? tab.color === 'emerald' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                        : tab.color === 'purple' ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                        : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                      : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
                  }`}
                >
                  <tab.icon className="w-4 h-4" />
                  <span className="hidden sm:inline">{tab.label}</span>
                </button>
              ))}
            </div>

                        <div className="bg-gradient-to-b from-white/5 to-transparent border border-white/10 rounded-3xl p-6">
                          <div className="flex items-center justify-between mb-4">
                            <p className="text-gray-400 text-sm">{activeTabData?.description}</p>
                            {formatDetection && formatDetection.hasFormatting && (
                              <FormatBadge 
                                detection={formatDetection} 
                                onStripFormatting={handleStripFormatting}
                                originalText={getCurrentText()}
                              />
                            )}
                          </div>
              
                          <Textarea
                            placeholder="Paste your text here..."
                            className="min-h-[250px] bg-black/30 border-white/10 text-white placeholder:text-gray-600 rounded-2xl resize-none focus:border-emerald-500/50 focus:ring-emerald-500/20 mb-4"
                            value={getCurrentText()}
                            onChange={(e) => setCurrentText(e.target.value)}
                          />

                          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                            <div className="text-gray-500 text-sm">
                              {getWordCount()} words | Cost: <span className="text-white">{getCreditCost()}</span> words
                            </div>
                <Button
                  onClick={handleAnalyze}
                  disabled={getCurrentText().length < 50 || isLoading}
                  className={`rounded-full px-8 ${
                    activeTab === 'detect' ? 'bg-emerald-500 hover:bg-emerald-600 text-black' :
                    activeTab === 'humanize' ? 'bg-purple-500 hover:bg-purple-600 text-white' :
                    'bg-blue-500 hover:bg-blue-600 text-white'
                  }`}
                >
                  {isLoading ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Analyzing...</>
                  ) : (
                    <><Zap className="w-4 h-4 mr-2" />{activeTab === 'detect' ? 'Detect AI' : activeTab === 'humanize' ? 'Humanize' : 'Check Plagiarism'}</>
                  )}
                </Button>
              </div>

              {error && (
                <div className="mt-4 p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl">
                  <div className="flex items-center text-rose-400">
                    <AlertCircle className="w-4 h-4 mr-2" />
                    {(error as any)?.response?.data?.detail || 'An error occurred. Please try again.'}
                  </div>
                </div>
              )}
            </div>

            {/* Animated Loading States */}
            {isLoading && activeTab === 'detect' && <AIDetectionLoader />}
            {isLoading && activeTab === 'humanize' && <HumanizerLoader />}
            {isLoading && activeTab === 'plagiarism' && <PlagiarismLoader />}

                        {result && (
                          <div className="bg-gradient-to-b from-white/5 to-transparent border border-white/10 rounded-3xl p-6">
                            <div className="flex items-center gap-2 mb-6">
                              <CheckCircle className="w-5 h-5 text-emerald-400" />
                              <h3 className="text-lg font-medium text-white">Analysis Complete</h3>
                            </div>

                            {/* AI Detection Results with Full Details */}
                            {activeTab === 'detect' && result.ai_probability !== undefined && (
                              <div className="space-y-6">
                                {/* Summary Cards */}
                                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                  <div className="p-4 bg-black/30 rounded-2xl border border-white/10">
                                    <div className="flex items-center gap-2 text-gray-500 text-xs uppercase tracking-wider mb-2">
                                      <BarChart3 className="w-3 h-3" />
                                      AI Probability
                                    </div>
                                    <div className={`text-2xl font-light ${result.ai_probability > 50 ? 'text-rose-400' : 'text-emerald-400'}`}>
                                      {result.ai_probability}%
                                    </div>
                                  </div>
                                  <div className="p-4 bg-black/30 rounded-2xl border border-white/10">
                                    <div className="flex items-center gap-2 text-gray-500 text-xs uppercase tracking-wider mb-2">
                                      <AlertTriangle className="w-3 h-3" />
                                      Confidence
                                    </div>
                                    <div className="text-lg font-light text-amber-400">
                                      {result.results?.confidence_level === 'very_high' ? 'Very High' : 
                                       result.results?.confidence_level === 'high' ? 'High' :
                                       result.results?.confidence_level === 'medium' ? 'Medium' :
                                       result.results?.confidence_level === 'low' ? 'Low' : 'Very Low'}
                                    </div>
                                    <div className="text-xs text-gray-500">Score: {result.results?.confidence_score || 0}/10</div>
                                  </div>
                                  <div className="p-4 bg-black/30 rounded-2xl border border-white/10">
                                    <div className="flex items-center gap-2 text-gray-500 text-xs uppercase tracking-wider mb-2">
                                      <FileText className="w-3 h-3" />
                                      Analysis
                                    </div>
                                    <div className="text-lg font-light text-white">
                                      {result.results?.analysis?.word_count || getWordCount()} words
                                    </div>
                                    <div className="text-xs text-gray-500">Avg: {result.results?.analysis?.avg_sentence_length?.toFixed(1) || 0} w/s</div>
                                  </div>
                                  <div className="p-4 bg-black/30 rounded-2xl border border-white/10">
                                    <h4 className="text-gray-500 text-xs uppercase tracking-wider mb-2">Confidence Meter</h4>
                                    <div className="relative w-full h-4 bg-gradient-to-r from-emerald-500 via-yellow-500 to-rose-500 rounded-full overflow-hidden">
                                      <div 
                                        className="absolute top-0 h-full w-1 bg-white shadow-lg"
                                        style={{ left: `${Math.min(result.ai_probability, 100)}%` }}
                                      />
                                    </div>
                                    <div className="flex justify-between mt-1">
                                      <span className={`text-sm font-medium ${result.ai_probability > 50 ? 'text-rose-400' : 'text-emerald-400'}`}>
                                        {result.ai_probability}%
                                      </span>
                                      <span className="text-xs text-gray-500">
                                        {result.ai_probability > 70 ? 'Likely AI' : result.ai_probability > 30 ? 'Mixed' : 'Likely Human'}
                                      </span>
                                    </div>
                                  </div>
                                </div>

                                {/* Verdict */}
                                <div className="p-4 bg-black/30 rounded-2xl border border-white/10">
                                  <div className="flex items-center justify-between">
                                    <h4 className="text-gray-500 text-sm uppercase tracking-wider">Verdict</h4>
                                    <span className={`px-3 py-1 rounded-full text-sm ${
                                      result.ai_probability > 70 ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' :
                                      result.ai_probability > 30 ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                                      'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                    }`}>
                                      {result.ai_probability > 70 ? 'AI Generated' : result.ai_probability > 30 ? 'Mixed Content' : 'Human Written'}
                                    </span>
                                  </div>
                                  <p className="text-gray-400 text-sm mt-2">
                                    {result.ai_probability > 70 ? 'Strong AI indicators detected.' :
                                     result.ai_probability > 30 ? 'Some AI patterns found, but also human elements.' :
                                     'Content appears to be human-written.'}
                                  </p>
                                </div>

                                {/* Heat Map Visualization */}
                                {result.results?.sentence_analysis && result.results.sentence_analysis.length > 0 && (
                                  <div className="p-4 bg-black/30 rounded-2xl border border-white/10">
                                    <h4 className="text-gray-500 text-sm uppercase tracking-wider mb-3">Heat Map Visualization</h4>
                                    <div className="flex flex-wrap gap-2 mb-3">
                                      {result.results.sentence_analysis.map((sentence: any, idx: number) => {
                                        const prob = sentence.ai_probability;
                                        const bgColor = prob >= 80 ? 'bg-rose-500' : prob >= 60 ? 'bg-orange-500' : prob >= 40 ? 'bg-yellow-500' : prob >= 20 ? 'bg-lime-500' : 'bg-emerald-500';
                                        return (
                                          <div
                                            key={idx}
                                            className={`w-8 h-8 ${bgColor} rounded flex items-center justify-center text-xs font-medium text-white cursor-pointer hover:scale-110 transition-transform`}
                                            title={`"${sentence.text}" - ${prob}% AI`}
                                          >
                                            {idx + 1}
                                          </div>
                                        );
                                      })}
                                    </div>
                                    <div className="flex items-center gap-4 text-xs text-gray-500">
                                      <span className="flex items-center gap-1"><span className="w-3 h-3 bg-rose-500 rounded" /> 80%+</span>
                                      <span className="flex items-center gap-1"><span className="w-3 h-3 bg-orange-500 rounded" /> 60-80%</span>
                                      <span className="flex items-center gap-1"><span className="w-3 h-3 bg-yellow-500 rounded" /> 40-60%</span>
                                      <span className="flex items-center gap-1"><span className="w-3 h-3 bg-lime-500 rounded" /> 20-40%</span>
                                      <span className="flex items-center gap-1"><span className="w-3 h-3 bg-emerald-500 rounded" /> &lt;20%</span>
                                    </div>
                                  </div>
                                )}

                                {/* Highlighted Analysis */}
                                {result.results?.sentence_analysis && result.results.sentence_analysis.length > 0 && (
                                  <div className="p-4 bg-black/30 rounded-2xl border border-white/10">
                                    <div className="flex items-center justify-between mb-3">
                                      <h4 className="text-gray-500 text-sm uppercase tracking-wider">Highlighted Analysis</h4>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => {
                                          const highAI = result.results.sentence_analysis.filter((s: any) => s.ai_probability > 50).map((s: any) => s.text).join(' ');
                                          navigator.clipboard.writeText(highAI || getCurrentText());
                                          alert('Copied to clipboard!');
                                        }}
                                        className="text-gray-400 hover:text-white hover:bg-white/5 rounded-full text-xs"
                                      >
                                        <Copy className="w-3 h-3 mr-1" /> Copy AI Sections
                                      </Button>
                                    </div>
                                    <div className="flex items-center gap-4 text-xs text-gray-500 mb-3">
                                      <span className="flex items-center gap-1"><span className="w-3 h-3 bg-rose-500/30 border border-rose-500/50 rounded" /> High AI (70%+)</span>
                                      <span className="flex items-center gap-1"><span className="w-3 h-3 bg-amber-500/30 border border-amber-500/50 rounded" /> Medium (40-70%)</span>
                                      <span className="flex items-center gap-1"><span className="w-3 h-3 bg-emerald-500/30 border border-emerald-500/50 rounded" /> Human-like (&lt;40%)</span>
                                    </div>
                                    <div className="space-y-2">
                                      {result.results.sentence_analysis.map((sentence: any, idx: number) => {
                                        const prob = sentence.ai_probability;
                                        const borderColor = prob >= 70 ? 'border-rose-500/50 bg-rose-500/10' : prob >= 40 ? 'border-amber-500/50 bg-amber-500/10' : 'border-emerald-500/50 bg-emerald-500/10';
                                        const textColor = prob >= 70 ? 'text-rose-300' : prob >= 40 ? 'text-amber-300' : 'text-emerald-300';
                                        return (
                                          <span key={idx} className={`inline-block px-2 py-1 rounded border ${borderColor} mr-2 mb-2`}>
                                            <span className="text-white text-sm">{sentence.text}</span>
                                            <span className={`ml-2 text-xs ${textColor}`}>{prob}%</span>
                                          </span>
                                        );
                                      })}
                                    </div>
                                  </div>
                                )}

                                {/* Sentence Breakdown */}
                                {result.results?.sentence_analysis && result.results.sentence_analysis.length > 0 && (
                                  <div className="p-4 bg-black/30 rounded-2xl border border-white/10">
                                    <h4 className="text-gray-500 text-sm uppercase tracking-wider mb-1">Sentence Breakdown</h4>
                                    <p className="text-gray-500 text-xs mb-3 italic">Note: Individual sentence scores may differ from the overall result, as AI patterns are often detected across multiple sentences rather than within single sentences.</p>
                                    <div className="space-y-2 max-h-48 overflow-y-auto">
                                      {result.results.sentence_analysis.map((sentence: any, idx: number) => (
                                        <div key={idx} className="flex items-start gap-3 p-2 rounded-lg hover:bg-white/5">
                                          <div className={`px-2 py-1 rounded text-xs font-medium ${
                                            sentence.ai_probability >= 70 ? 'bg-rose-500/20 text-rose-400' :
                                            sentence.ai_probability >= 40 ? 'bg-amber-500/20 text-amber-400' :
                                            'bg-emerald-500/20 text-emerald-400'
                                          }`}>
                                            {sentence.ai_probability}%
                                          </div>
                                          <p className="text-gray-300 text-sm flex-1">{sentence.text}</p>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {/* Humanize Actions */}
                                <div className="p-4 bg-gradient-to-r from-purple-500/10 to-emerald-500/10 rounded-2xl border border-purple-500/30">
                                  <h4 className="text-gray-300 text-sm font-medium mb-3">Want to humanize this text?</h4>
                                  <div className="flex flex-wrap gap-3">
                                    <Button
                                      onClick={() => {
                                        setHumanizeText(detectText);
                                        setActiveTab('humanize');
                                        setResult(null);
                                      }}
                                      className="bg-purple-500 hover:bg-purple-600 text-white rounded-full px-6"
                                    >
                                      <Wand2 className="w-4 h-4 mr-2" />
                                      Humanize Entire Text
                                    </Button>
                                    {result.results?.sentence_analysis && result.results.sentence_analysis.some((s: any) => s.ai_probability >= 50) && (
                                      <Button
                                        onClick={() => {
                                          const aiParts = result.results.sentence_analysis
                                            .filter((s: any) => s.ai_probability >= 50)
                                            .map((s: any) => s.text)
                                            .join(' ');
                                          setHumanizeText(aiParts);
                                          setActiveTab('humanize');
                                          setResult(null);
                                        }}
                                        variant="outline"
                                        className="border-purple-500/50 text-purple-400 hover:bg-purple-500/20 rounded-full px-6"
                                      >
                                        <Sparkles className="w-4 h-4 mr-2" />
                                        Humanize AI Parts Only ({result.results.sentence_analysis.filter((s: any) => s.ai_probability >= 50).length} sentences)
                                      </Button>
                                    )}
                                  </div>
                                  <p className="text-gray-500 text-xs mt-3">
                                    {result.results?.sentence_analysis?.some((s: any) => s.ai_probability >= 50) 
                                      ? `${result.results.sentence_analysis.filter((s: any) => s.ai_probability >= 50).length} of ${result.results.sentence_analysis.length} sentences detected as AI-generated (50%+ probability)`
                                      : 'No sentences with high AI probability detected'}
                                  </p>
                                </div>

                                {/* Feedback Widget */}
                                {result.id && (
                                  <FeedbackWidget 
                                    scanId={result.id} 
                                    scanType="ai_detection"
                                    modelPrediction={result.results?.ai_probability >= 50 ? 'AI Generated' : 'Human Written'}
                                    modelConfidence={result.results?.ai_probability / 100}
                                  />
                                )}
                              </div>
                            )}

                            {/* Humanizer Results with Word-Level Diff */}
                            {activeTab === 'humanize' && result.output_text && (
                              <div className="space-y-6">
                                {/* Summary */}
                                <div className="grid grid-cols-3 gap-4">
                                  <div className="p-4 bg-black/30 rounded-2xl border border-white/10">
                                    <div className="text-gray-500 text-xs uppercase tracking-wider mb-2">Original</div>
                                    <div className="text-lg font-light text-white">{result.results?.original_length || getCurrentText().length} chars</div>
                                  </div>
                                  <div className="p-4 bg-black/30 rounded-2xl border border-white/10">
                                    <div className="text-gray-500 text-xs uppercase tracking-wider mb-2">Humanized</div>
                                    <div className="text-lg font-light text-purple-400">{result.results?.humanized_length || result.output_text.length} chars</div>
                                  </div>
                                  <div className="p-4 bg-black/30 rounded-2xl border border-white/10">
                                    <div className="text-gray-500 text-xs uppercase tracking-wider mb-2">Changes Made</div>
                                    <div className="text-lg font-light text-emerald-400">{result.results?.changes_made || 0} words</div>
                                  </div>
                                </div>

                                {/* Side-by-Side Comparison */}
                                <div className="grid md:grid-cols-2 gap-4">
                                  <div className="p-4 bg-black/30 rounded-2xl border border-white/10">
                                    <div className="flex items-center justify-between mb-3">
                                      <div className="text-gray-500 text-sm uppercase tracking-wider">Original Text</div>
                                    </div>
                                    <p className="text-gray-400 whitespace-pre-wrap leading-relaxed text-sm">{getCurrentText()}</p>
                                  </div>
                                  <div className="p-4 bg-purple-500/10 rounded-2xl border border-purple-500/30">
                                    <div className="flex items-center justify-between mb-3">
                                      <div className="text-purple-400 text-sm uppercase tracking-wider">Humanized Text</div>
                                      <Button variant="ghost" size="sm" onClick={() => copyToClipboard(result.output_text)} className="text-gray-400 hover:text-white hover:bg-white/5 rounded-full">
                                        {copied ? <CheckCircle className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                                      </Button>
                                    </div>
                                    <p className="text-white whitespace-pre-wrap leading-relaxed text-sm">{result.output_text}</p>
                                  </div>
                                </div>

                                {/* Word-Level Diff */}
                                <div className="p-4 bg-black/30 rounded-2xl border border-white/10">
                                  <h4 className="text-gray-500 text-sm uppercase tracking-wider mb-3">Word-Level Changes</h4>
                                  <div className="flex items-center gap-4 text-xs text-gray-500 mb-3">
                                    <span className="flex items-center gap-1"><span className="w-3 h-3 bg-rose-500/30 border border-rose-500/50 rounded" /> Removed</span>
                                    <span className="flex items-center gap-1"><span className="w-3 h-3 bg-emerald-500/30 border border-emerald-500/50 rounded" /> Added</span>
                                  </div>
                                  <div className="text-sm leading-relaxed">
                                    {(() => {
                                      const originalWords = getCurrentText().split(/\s+/);
                                      const humanizedWords = result.output_text.split(/\s+/);
                                      const originalSet = new Set(originalWords.map((w: string) => w.toLowerCase()));
                                      const humanizedSet = new Set(humanizedWords.map((w: string) => w.toLowerCase()));
                          
                                      return (
                                        <div className="space-y-2">
                                          <div>
                                            {originalWords.map((word: string, idx: number) => {
                                              const isRemoved = !humanizedSet.has(word.toLowerCase());
                                              return (
                                                <span key={idx} className={isRemoved ? 'line-through text-rose-400 bg-rose-500/10 px-1 rounded' : 'text-gray-400'}>
                                                  {word}{' '}
                                                </span>
                                              );
                                            })}
                                          </div>
                                          <ArrowRight className="w-4 h-4 text-gray-500 mx-auto" />
                                          <div>
                                            {humanizedWords.map((word: string, idx: number) => {
                                              const isAdded = !originalSet.has(word.toLowerCase());
                                              return (
                                                <span key={idx} className={isAdded ? 'text-emerald-400 bg-emerald-500/10 px-1 rounded' : 'text-white'}>
                                                  {word}{' '}
                                                </span>
                                              );
                                            })}
                                          </div>
                                        </div>
                                      );
                                    })()}
                                  </div>
                                </div>

                                {/* Scan for AI Detection */}
                                <div className="p-4 bg-gradient-to-r from-emerald-500/10 to-purple-500/10 rounded-2xl border border-emerald-500/30">
                                  <h4 className="text-gray-300 text-sm font-medium mb-3">Verify your humanized text</h4>
                                  <div className="flex flex-wrap gap-3">
                                    <Button
                                      onClick={() => {
                                        setDetectText(result.output_text);
                                        setActiveTab('detect');
                                        setResult(null);
                                      }}
                                      className="bg-emerald-500 hover:bg-emerald-600 text-black rounded-full px-6"
                                    >
                                      <Shield className="w-4 h-4 mr-2" />
                                      Scan Humanized Text for AI
                                    </Button>
                                  </div>
                                  <p className="text-gray-500 text-xs mt-3">
                                    Check if your humanized text passes AI detection
                                  </p>
                                </div>

                                {/* Feedback Widget */}
                                {result.id && (
                                  <FeedbackWidget 
                                    scanId={result.id} 
                                    scanType="humanize"
                                    modelPrediction="Humanized"
                                  />
                                )}
                              </div>
                            )}

                            {/* Plagiarism Results with Sources */}
                            {activeTab === 'plagiarism' && result.plagiarism_score !== undefined && (
                              <div className="space-y-6">
                                {/* Summary Cards */}
                                <div className="grid grid-cols-3 gap-4">
                                  <div className="p-4 bg-black/30 rounded-2xl border border-white/10">
                                    <div className="text-gray-500 text-xs uppercase tracking-wider mb-2">Originality</div>
                                    <div className="text-2xl font-light text-emerald-400">{(100 - result.plagiarism_score).toFixed(1)}%</div>
                                  </div>
                                  <div className="p-4 bg-black/30 rounded-2xl border border-white/10">
                                    <div className="text-gray-500 text-xs uppercase tracking-wider mb-2">Plagiarism</div>
                                    <div className={`text-2xl font-light ${result.plagiarism_score > 20 ? 'text-rose-400' : 'text-emerald-400'}`}>
                                      {result.plagiarism_score.toFixed(1)}%
                                    </div>
                                  </div>
                                  <div className="p-4 bg-black/30 rounded-2xl border border-white/10">
                                    <div className="text-gray-500 text-xs uppercase tracking-wider mb-2">Risk Level</div>
                                    <div className={`text-lg font-light ${
                                      result.results?.risk_level === 'high' ? 'text-rose-400' :
                                      result.results?.risk_level === 'medium' ? 'text-amber-400' :
                                      result.results?.risk_level === 'low' ? 'text-yellow-400' : 'text-emerald-400'
                                    }`}>
                                      {result.results?.risk_level?.charAt(0).toUpperCase() + result.results?.risk_level?.slice(1) || 'Minimal'}
                                    </div>
                                  </div>
                                </div>

                                {/* Verdict */}
                                <div className="p-4 bg-black/30 rounded-2xl border border-white/10">
                                  <div className="flex items-center justify-between">
                                    <h4 className="text-gray-500 text-sm uppercase tracking-wider">Verdict</h4>
                                    <span className={`px-3 py-1 rounded-full text-sm ${
                                      result.plagiarism_score > 50 ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' :
                                      result.plagiarism_score > 20 ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                                      'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                    }`}>
                                      {result.plagiarism_score > 50 ? 'High Plagiarism' : result.plagiarism_score > 20 ? 'Some Matches Found' : 'Original Content'}
                                    </span>
                                  </div>
                                  <p className="text-gray-400 text-sm mt-2">
                                    {result.plagiarism_score > 50 ? 'Significant portions of this text match existing sources.' :
                                     result.plagiarism_score > 20 ? 'Some similarities found with existing content.' :
                                     'This content appears to be original.'}
                                  </p>
                                </div>

                                {/* Progress Bar */}
                                <div className="p-4 bg-black/30 rounded-2xl border border-white/10">
                                  <div className="flex justify-between text-sm mb-2">
                                    <span className="text-emerald-400">Original ({(100 - result.plagiarism_score).toFixed(1)}%)</span>
                                    <span className="text-rose-400">Matched ({result.plagiarism_score.toFixed(1)}%)</span>
                                  </div>
                                  <div className="h-4 bg-rose-500/30 rounded-full overflow-hidden">
                                    <div 
                                      className="h-full bg-emerald-500 rounded-full transition-all"
                                      style={{ width: `${100 - result.plagiarism_score}%` }}
                                    />
                                  </div>
                                </div>

                                {/* Sources Found */}
                                {result.results?.sources && result.results.sources.length > 0 && (
                                  <div className="p-4 bg-black/30 rounded-2xl border border-white/10">
                                    <h4 className="text-gray-500 text-sm uppercase tracking-wider mb-3">Sources Found ({result.results.sources.length})</h4>
                                    <div className="space-y-3">
                                      {result.results.sources.map((source: any, idx: number) => (
                                        <div key={idx} className="p-3 bg-white/5 rounded-xl border border-white/10">
                                          <div className="flex items-center justify-between mb-2">
                                            <span className="text-white font-medium">{source.title || 'Source'}</span>
                                            <span className="text-rose-400 text-sm">{source.similarity_score}% match</span>
                                          </div>
                                          {source.url && source.url !== 'internal_source' && (
                                            <a href={source.url} target="_blank" rel="noopener noreferrer" className="text-blue-400 text-sm flex items-center gap-1 hover:underline">
                                              <ExternalLink className="w-3 h-3" /> {source.url}
                                            </a>
                                          )}
                                          {source.matched_text && (
                                            <p className="text-gray-400 text-sm mt-2 italic">"{source.matched_text}"</p>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {/* No Sources Message */}
                                {(!result.results?.sources || result.results.sources.length === 0) && (
                                  <div className="p-4 bg-emerald-500/10 rounded-2xl border border-emerald-500/30">
                                    <div className="flex items-center gap-2 text-emerald-400">
                                      <CheckCircle className="w-5 h-5" />
                                      <span>No matching sources found. Your content appears to be original!</span>
                                    </div>
                                  </div>
                                )}

                                {/* Feedback Widget */}
                                {result.id && (
                                  <FeedbackWidget 
                                    scanId={result.id} 
                                    scanType="plagiarism"
                                    modelPrediction={result.plagiarism_score > 50 ? 'Plagiarized' : 'Original'}
                                    modelConfidence={result.plagiarism_score / 100}
                                  />
                                )}
                              </div>
                            )}

                            <div className="mt-6 pt-4 border-t border-white/10 text-gray-500 text-sm">
                              Words used: <span className="text-white">{result.credits_used}</span> | Remaining: <span className="text-white">{credits?.balance === -1 ? 'Unlimited' : credits?.balance?.toLocaleString()}</span>
                            </div>
                          </div>
                        )}
          </div>

          <div className="space-y-6">
            <div className="bg-gradient-to-b from-white/5 to-transparent border border-white/10 rounded-3xl p-6">
              <h3 className="text-lg font-medium text-white mb-4">Your Stats</h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">Plan</span>
                  <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-3 py-1 rounded-full text-sm">
                    {user?.subscription_tier || 'Free'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">Words Remaining</span>
                  <span className="text-white font-medium">
                    {credits?.balance === -1 ? 'Unlimited' : (credits?.balance?.toLocaleString() ?? user?.credits_balance?.toLocaleString() ?? 0)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">Total Used</span>
                  <span className="text-white font-medium">{user?.credits_used_total?.toLocaleString() || 0}</span>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-b from-white/5 to-transparent border border-white/10 rounded-3xl p-6">
              <h3 className="text-lg font-medium text-white mb-4">How Words Are Counted</h3>
              <p className="text-gray-400 text-sm mb-4">Usage is measured in words. Each scan costs words based on the tool used. Minimum 50 words per scan.</p>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-emerald-400" />
                    <span className="text-gray-300">AI Detection</span>
                  </div>
                  <span className="text-white text-sm">1 word = 1 credit</span>
                </div>
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-purple-400" />
                    <span className="text-gray-300">Humanize</span>
                  </div>
                  <span className="text-white text-sm">1 word = 2 credits</span>
                </div>
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <Search className="w-4 h-4 text-blue-400" />
                    <span className="text-gray-300">Plagiarism</span>
                  </div>
                          <span className="text-white text-sm">1 word = 1.5 credits</span>
                        </div>
                      </div>
                      <p className="text-gray-500 text-xs mt-4">Pro and Enterprise plans have unlimited words!</p>
                    </div>

                    {/* Writing Tools Quick Access - Collapsible (default open) */}
                    <div className="bg-gradient-to-b from-white/5 to-transparent border border-white/10 rounded-3xl overflow-hidden">
                      <button 
                        onClick={() => setWritingToolsExpanded(!writingToolsExpanded)}
                        className="w-full flex items-center justify-between p-4 text-white hover:bg-white/5 transition"
                      >
                        <div className="flex items-center gap-3">
                          <Wand2 className="w-5 h-5 text-purple-400" />
                          <span className="font-medium">Writing Tools</span>
                          <span className="text-xs bg-purple-500/20 text-purple-400 px-2 py-0.5 rounded-full">14 Tools</span>
                        </div>
                        {writingToolsExpanded ? (
                          <ChevronUp className="w-4 h-4 text-gray-500" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-gray-500" />
                        )}
                      </button>
                      {writingToolsExpanded && (
                        <div className="p-4 pt-0 border-t border-white/10">
                          <div className="grid grid-cols-2 gap-2 mt-4">
                            {writingTools.map((tool) => (
                              <Link
                                key={tool.id}
                                to={`/writing-tools?tool=${tool.id}`}
                                className={`p-3 rounded-xl border border-white/10 hover:border-${tool.color}-500/30 hover:bg-${tool.color}-500/10 transition group`}
                              >
                                <div className="flex items-center gap-2">
                                  <tool.icon className={`w-4 h-4 text-${tool.color}-400`} />
                                  <span className="text-sm text-gray-300 group-hover:text-white truncate">{tool.name}</span>
                                </div>
                              </Link>
                            ))}
                          </div>
                          <Link 
                            to="/writing-tools"
                            className="mt-3 flex items-center justify-center gap-2 p-2 text-purple-400 hover:text-purple-300 text-sm transition"
                          >
                            <span>View All Tools</span>
                            <ArrowRight className="w-4 h-4" />
                          </Link>
                        </div>
                      )}
                    </div>

                    {/* Quick Links: Scan History, Buy Credits, Settings */}
                    <div className="bg-gradient-to-b from-white/5 to-transparent border border-white/10 rounded-3xl overflow-hidden">
                      <Link to="/history" className="flex items-center justify-between p-4 text-gray-300 hover:text-white hover:bg-white/5 transition border-b border-white/10">
                        <div className="flex items-center gap-3">
                          <History className="w-4 h-4" />
                          <span>Scan History</span>
                        </div>
                        <ChevronRight className="w-4 h-4 text-gray-500" />
                      </Link>
                      <button onClick={handleOpenBuyCredits} className="w-full flex items-center justify-between p-4 text-gray-300 hover:text-white hover:bg-white/5 transition border-b border-white/10">
                        <div className="flex items-center gap-3">
                          <CreditCard className="w-4 h-4" />
                          <span>Buy Credits</span>
                        </div>
                        <ChevronRight className="w-4 h-4 text-gray-500" />
                      </button>
                      <Link to="/settings" className="flex items-center justify-between p-4 text-gray-300 hover:text-white hover:bg-white/5 transition">
                        <div className="flex items-center gap-3">
                          <Settings className="w-4 h-4" />
                          <span>Settings</span>
                        </div>
                        <ChevronRight className="w-4 h-4 text-gray-500" />
                      </Link>
                    </div>

                    {/* API Settings - Enterprise Only */}
                    {user?.subscription_tier?.toLowerCase() === 'enterprise' && (
                      <div className="bg-gradient-to-b from-amber-500/10 to-transparent border border-amber-500/30 rounded-3xl p-6">
                        <div className="flex items-center gap-3 mb-4">
                          <div className="p-2 bg-amber-500/20 rounded-full">
                            <Key className="w-5 h-5 text-amber-400" />
                          </div>
                          <div>
                            <h3 className="text-lg font-medium text-white">API Access</h3>
                            <p className="text-xs text-amber-400">Enterprise Feature</p>
                          </div>
                        </div>
                        <p className="text-gray-400 text-sm mb-4">
                          Integrate TextShift into your applications with our REST API.
                        </p>
                        <div className="space-y-3">
                          <Link 
                            to="/api-docs"
                            className="flex items-center justify-between p-3 bg-black/30 rounded-xl border border-white/10 hover:border-amber-500/30 transition"
                          >
                            <div className="flex items-center gap-2">
                              <FileText className="w-4 h-4 text-amber-400" />
                              <span className="text-gray-300 text-sm">API Documentation</span>
                            </div>
                            <ExternalLink className="w-4 h-4 text-gray-500" />
                          </Link>
                          <div className="p-3 bg-black/30 rounded-xl border border-white/10">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-gray-500 text-xs">API Endpoint</span>
                            </div>
                            <code className="text-amber-400 text-xs break-all">https://textshift.org/api</code>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Promo Code Redemption - At the end */}
                    <div className="bg-gradient-to-b from-white/5 to-transparent border border-white/10 rounded-3xl p-6">
                      <h3 className="text-lg font-medium text-white mb-4">Have a Promo Code?</h3>
                      <div className="space-y-3">
                        <input
                          type="text"
                          value={promoCode}
                          onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                          placeholder="Enter promo code"
                          className="w-full px-4 py-2 bg-black/30 border border-white/10 rounded-xl text-white placeholder:text-gray-500 focus:border-emerald-500/50 focus:outline-none"
                        />
                        <Button
                          onClick={handleRedeemPromo}
                          disabled={!promoCode.trim() || promoLoading}
                          className="w-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20 rounded-xl"
                        >
                          {promoLoading ? (
                            <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Redeeming...</>
                          ) : (
                            'Redeem Code'
                          )}
                        </Button>
                        {promoMessage && (
                          <div className={`p-3 rounded-xl text-sm ${
                            promoMessage.type === 'success' 
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' 
                              : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                          }`}>
                            {promoMessage.text}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

      {/* Buy Credits Modal */}
      {showBuyCreditsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowBuyCreditsModal(false)} />
          <div className="relative w-full max-w-lg bg-gradient-to-b from-[#1a1a1a] to-[#0a0a0a] border border-white/10 rounded-3xl p-6 md:p-8 shadow-2xl">
            <button 
              onClick={() => setShowBuyCreditsModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
            >
              <span className="text-2xl">&times;</span>
            </button>

            <div className="text-center mb-6">
              <div className="w-12 h-12 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <CreditCard className="w-6 h-6 text-emerald-400" />
              </div>
              <h3 className="text-2xl font-medium text-white mb-2">Buy Credits</h3>
              <p className="text-gray-400">
                Current balance: <span className="text-emerald-400 font-medium">{credits?.balance === -1 || user?.credits_balance === -1 ? 'Unlimited' : (credits?.balance?.toLocaleString() || user?.credits_balance?.toLocaleString() || 0)}</span> words
              </p>
            </div>

            {buyCreditsMessage && (
              <div className={`mb-4 p-3 rounded-xl text-sm ${
                buyCreditsMessage.type === 'success' 
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' 
                  : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
              }`}>
                {buyCreditsMessage.text}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 mb-6">
              {creditPackages.map((pkg) => (
                <button
                  key={pkg.id}
                  onClick={() => handleBuyCredits(pkg.id)}
                  disabled={buyCreditsLoading !== null}
                  className={`p-4 rounded-xl border transition-all ${
                    buyCreditsLoading === pkg.id
                      ? 'bg-emerald-500/20 border-emerald-500/50'
                      : 'bg-white/5 border-white/10 hover:border-emerald-500/50 hover:bg-emerald-500/10'
                  }`}
                >
                  <div className="text-white font-medium">{pkg.name}</div>
                  <div className="text-emerald-400 text-lg font-bold">${pkg.price.toFixed(2)}</div>
                  {buyCreditsLoading === pkg.id && (
                    <Loader2 className="w-4 h-4 animate-spin mx-auto mt-2 text-emerald-400" />
                  )}
                </button>
              ))}
            </div>

            <p className="text-center text-gray-500 text-xs">
              Credits are added instantly to your account. No expiration.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
