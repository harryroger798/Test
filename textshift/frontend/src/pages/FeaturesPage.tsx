import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Button } from '@/components/ui/button';
import { 
  CheckCircle, 
  ArrowLeft,
  ArrowRight,
  Shield,
  Zap,
  FileText,
  Languages,
  BookOpen,
  PenTool,
  BarChart3,
  FileCheck,
  Copy,
  Sparkles,
  Brain,
  Search,
  Download,
  Users,
  Lock
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore';

export default function FeaturesPage() {
  const { isAuthenticated } = useAuthStore();

  const coreTools = [
    {
      icon: Shield,
      name: 'AI Detection',
      description: 'Industry-leading 99% accuracy in detecting AI-generated content. Our Advanced Neural Intelligence reads text like a human expert, spotting machine-generated patterns with precision.',
      features: [
        'Heat map visualization showing AI probability per sentence',
        'Sentence-by-sentence breakdown with confidence scores',
        'PDF export & shareable reports',
        'Confidence meter gauge with detailed analysis',
        'Support for multiple AI models (GPT-4, Claude, Gemini, etc.)',
        'Real-time processing with instant results'
      ],
      tiers: { free: '10 scans/day', starter: '100 scans/day', pro: '500 scans/day', enterprise: 'Unlimited' }
    },
    {
      icon: Sparkles,
      name: 'Text Humanizer',
      description: 'Transform AI-generated text into authentic, human-sounding content while preserving your original meaning. Our Natural Language Engine ensures your content passes all detection tools.',
      features: [
        'Word-level diff comparison showing exact changes',
        'Side-by-side before/after view',
        'Preserves original meaning and context',
        'Re-analyze with one click',
        'Multiple humanization modes (Standard, Academic, Creative)',
        'Maintains tone and style consistency'
      ],
      tiers: { free: 'Not available', starter: 'Included', pro: 'Included', enterprise: 'Included' }
    },
    {
      icon: Search,
      name: 'Plagiarism Checker',
      description: 'Scans your content against billions of web pages and documents in real-time. Get instant results with pinpoint accuracy and detailed source matching.',
      features: [
        'Source URLs with exact match locations',
        'Percentage breakdown per source',
        'PDF export reports with citations',
        'Comparison mode for document analysis',
        'Academic database integration',
        'Paraphrase detection technology'
      ],
      tiers: { free: 'Not available', starter: 'Included', pro: 'Included', enterprise: 'Included' }
    }
  ];

  const writingTools = [
    {
      icon: FileCheck,
      name: 'Grammar Checker',
      description: 'Fix grammar, spelling, and punctuation errors with AI-powered suggestions.',
      tiers: { free: '500 words/day', starter: '5,000 words/day', pro: 'Unlimited', enterprise: 'Unlimited' }
    },
    {
      icon: BarChart3,
      name: 'Tone Detector',
      description: 'Analyze the emotional tone of your text - professional, casual, formal, friendly, etc.',
      tiers: { free: 'Basic', starter: 'Unlimited', pro: 'Unlimited', enterprise: 'Unlimited' }
    },
    {
      icon: PenTool,
      name: 'Tone Adjuster',
      description: 'Adjust your text to match different tones - make it more professional, casual, or persuasive.',
      tiers: { free: 'Not available', starter: 'Included', pro: 'Included', enterprise: 'Included' }
    },
    {
      icon: BookOpen,
      name: 'Readability Score',
      description: 'Get Flesch-Kincaid scores, reading level analysis, and suggestions for improvement.',
      tiers: { free: 'Basic', starter: 'Detailed', pro: 'Detailed', enterprise: 'Detailed' }
    },
    {
      icon: FileText,
      name: 'Summarizer',
      description: 'Create concise summaries of long documents while preserving key information.',
      tiers: { free: '500 words max', starter: '5,000 words max', pro: 'Unlimited', enterprise: 'Unlimited' }
    },
    {
      icon: Copy,
      name: 'Paraphraser',
      description: 'Rewrite content in different styles - standard, fluent, formal, creative, or academic.',
      tiers: { free: 'Standard mode', starter: 'All 5 modes', pro: 'All 5 modes', enterprise: 'All 5 modes' }
    },
    {
      icon: BookOpen,
      name: 'Citation Generator',
      description: 'Generate citations in APA, MLA, Chicago, Harvard, and IEEE formats automatically.',
      tiers: { free: 'Not available', starter: 'Included', pro: 'Included', enterprise: 'Included' }
    },
    {
      icon: Languages,
      name: 'Translator',
      description: 'Translate text between 6 language pairs with high accuracy.',
      tiers: { free: '500 words/day', starter: '5,000 words/day', pro: 'Unlimited', enterprise: 'Unlimited' }
    },
    {
      icon: Sparkles,
      name: 'Content Improver',
      description: 'Enhance clarity, engagement, and overall quality of your writing.',
      tiers: { free: 'Not available', starter: 'Included', pro: 'Included', enterprise: 'Included' }
    },
    {
      icon: BarChart3,
      name: 'Style Analysis',
      description: 'Get insights on vocabulary diversity, sentence structure, and writing patterns.',
      tiers: { free: 'Not available', starter: 'Included', pro: 'Included', enterprise: 'Included' }
    },
    {
      icon: FileText,
      name: 'Word Counter',
      description: 'Detailed text statistics including word count, character count, reading time, and more.',
      tiers: { free: 'Included', starter: 'Included', pro: 'Included', enterprise: 'Included' }
    },
    {
      icon: Download,
      name: 'Export Options',
      description: 'Export your work in multiple formats - TXT, HTML, Markdown, and PDF.',
      tiers: { free: 'TXT only', starter: 'TXT, HTML, MD', pro: 'All formats', enterprise: 'All formats' }
    },
    {
      icon: Users,
      name: 'Bulk Processing',
      description: 'Process multiple files at once for efficient batch analysis.',
      tiers: { free: 'Not available', starter: 'Not available', pro: 'Up to 10 files', enterprise: 'Up to 50 files' }
    },
    {
      icon: Lock,
      name: 'API Access',
      description: 'Full REST API access for integration with your applications and workflows.',
      tiers: { free: 'Not available', starter: 'Not available', pro: 'Not available', enterprise: 'Full access' }
    }
  ];

  const getTierBadgeColor = (tier: string) => {
    if (tier === 'Not available') return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    if (tier === 'Unlimited' || tier === 'Included' || tier === 'Full access') return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
    return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <Helmet>
        <title>Features - TextShift | AI Detection, Humanizer & 14 Writing Tools</title>
        <meta name="description" content="Explore TextShift features: AI detection with 99% accuracy, text humanizer, plagiarism checker, grammar checker, tone adjuster, summarizer, paraphraser, and 14 more writing tools." />
        <link rel="canonical" href="https://textshift.org/features" />
        <meta property="og:title" content="TextShift Features - AI Detection, Humanizer & Writing Tools" />
        <meta property="og:description" content="Explore TextShift features: AI detection with 99% accuracy, text humanizer, plagiarism checker, and 14 writing tools." />
        <meta property="og:url" content="https://textshift.org/features" />
        <meta property="og:type" content="website" />
        <meta name="twitter:title" content="TextShift Features - AI Detection, Humanizer & Writing Tools" />
        <meta name="twitter:description" content="Explore TextShift features: AI detection with 99% accuracy, text humanizer, plagiarism checker, and 14 writing tools." />
      </Helmet>
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
              <a href="https://textshift.blog" target="_blank" rel="noopener noreferrer" className="text-sm text-gray-300 hover:text-white transition">Blog</a>
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
            All <span className="text-emerald-400">Features</span>
          </h1>
          <p className="text-gray-400 text-lg max-w-3xl mx-auto">
            TextShift combines powerful AI detection, humanization, plagiarism checking, and 14 writing tools in one comprehensive platform. Everything you need to create authentic, original content.
          </p>
        </div>

        {/* Core Tools Section */}
        <div className="mb-20">
          <div className="text-center mb-12">
            <span className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/30 rounded-full text-emerald-400 text-sm mb-4">
              <Brain className="w-4 h-4" /> Core AI Tools
            </span>
            <h2 className="text-3xl md:text-4xl font-light text-white">
              Three Powerful Tools, One Platform
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {coreTools.map((tool, i) => (
              <div key={i} className="bg-gradient-to-b from-white/5 to-transparent border border-white/10 rounded-3xl p-6 md:p-8">
                <div className="w-12 h-12 bg-emerald-500/20 rounded-xl flex items-center justify-center mb-6">
                  <tool.icon className="w-6 h-6 text-emerald-400" />
                </div>
                <h3 className="text-xl font-medium text-white mb-3">{tool.name}</h3>
                <p className="text-gray-400 mb-6">{tool.description}</p>
                
                <h4 className="text-sm font-medium text-white mb-3">Key Features:</h4>
                <ul className="space-y-2 mb-6">
                  {tool.features.map((feature, j) => (
                    <li key={j} className="flex items-start text-gray-300 text-sm">
                      <CheckCircle className="w-4 h-4 text-emerald-400 mr-2 flex-shrink-0 mt-0.5" />
                      {feature}
                    </li>
                  ))}
                </ul>

                <h4 className="text-sm font-medium text-white mb-3">Availability by Tier:</h4>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(tool.tiers).map(([tier, value]) => (
                    <div key={tier} className="text-xs">
                      <span className="text-gray-500 capitalize">{tier}:</span>
                      <span className={`ml-1 px-2 py-0.5 rounded-full border ${getTierBadgeColor(value)}`}>
                        {value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Writing Tools Section */}
        <div className="mb-20">
          <div className="text-center mb-12">
            <span className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500/10 border border-blue-500/30 rounded-full text-blue-400 text-sm mb-4">
              <Zap className="w-4 h-4" /> 14 Writing Tools
            </span>
            <h2 className="text-3xl md:text-4xl font-light text-white">
              Complete Writing Suite
            </h2>
            <p className="text-gray-400 mt-4 max-w-2xl mx-auto">
              Beyond detection and humanization - TextShift offers a complete suite of writing tools to enhance your content.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {writingTools.map((tool, i) => (
              <div key={i} className="bg-gradient-to-b from-white/5 to-transparent border border-white/10 rounded-2xl p-5">
                <div className="w-10 h-10 bg-white/5 rounded-lg flex items-center justify-center mb-4">
                  <tool.icon className="w-5 h-5 text-emerald-400" />
                </div>
                <h3 className="text-base font-medium text-white mb-2">{tool.name}</h3>
                <p className="text-gray-400 text-sm mb-4">{tool.description}</p>
                
                <div className="space-y-1">
                  {Object.entries(tool.tiers).map(([tier, value]) => (
                    <div key={tier} className="flex justify-between text-xs">
                      <span className="text-gray-500 capitalize">{tier}</span>
                      <span className={`px-2 py-0.5 rounded-full border ${getTierBadgeColor(value)}`}>
                        {value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Self-Learning AI Section */}
        <div className="mb-20">
          <div className="bg-gradient-to-b from-emerald-500/10 to-transparent border border-emerald-500/20 rounded-3xl p-8 md:p-12">
            <div className="text-center mb-8">
              <span className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500/20 border border-emerald-500/30 rounded-full text-emerald-400 text-sm mb-4">
                <Brain className="w-4 h-4" /> Self-Learning AI Technology
              </span>
              <h2 className="text-3xl md:text-4xl font-light text-white mb-4">
                Our AI Gets Smarter Every Day
              </h2>
              <p className="text-gray-400 max-w-2xl mx-auto">
                Unlike static AI tools, TextShift continuously learns from user feedback. Every correction you make helps our models improve, creating an ever-evolving detection system.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              <div className="text-center p-6">
                <div className="text-3xl font-light text-emerald-400 mb-2">99.18%</div>
                <div className="text-gray-400 text-sm">AI Detection Accuracy</div>
              </div>
              <div className="text-center p-6">
                <div className="text-3xl font-light text-emerald-400 mb-2">0%</div>
                <div className="text-gray-400 text-sm">False Positives</div>
              </div>
              <div className="text-center p-6">
                <div className="text-3xl font-light text-emerald-400 mb-2">7 days</div>
                <div className="text-gray-400 text-sm">To Detect New AI Models</div>
              </div>
            </div>
          </div>
        </div>

        {/* CTA Section */}
        <div className="text-center py-12 border-t border-white/10">
          <h2 className="text-2xl md:text-3xl font-light text-white mb-4">Ready to get started?</h2>
          <p className="text-gray-400 mb-8">Join thousands of users who trust TextShift for their content needs.</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to={isAuthenticated ? "/dashboard" : "/register"}>
              <Button className="bg-emerald-500 hover:bg-emerald-600 text-black rounded-full px-8 py-3">
                {isAuthenticated ? "Go to Dashboard" : "Start Free"} <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </Link>
            <Link to="/pricing">
              <Button variant="outline" className="bg-transparent border-white/20 text-white hover:bg-white/5 rounded-full px-8 py-3">
                View Pricing
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
