import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Button } from '@/components/ui/button';
import { Copy, CheckCircle2, ArrowLeft, Key, Zap, Shield, BookOpen } from 'lucide-react';

const API_BASE = 'https://textshift.org';

interface Endpoint {
  method: string;
  path: string;
  description: string;
  tier: string;
  requestBody?: object;
  responseExample?: object;
}

// Core Tools - Main Features
const coreEndpoints: Endpoint[] = [
  {
    method: 'POST',
    path: '/api/scan/detect',
    description: 'AI Detection - Detect if text is AI-generated or human-written',
    tier: 'Free (limited), Paid (unlimited)',
    requestBody: { 
      text: 'Your text to analyze for AI detection.',
      scan_type: 'ai_detection'
    },
    responseExample: {
      id: 63,
      scan_type: 'ai_detection',
      status: 'completed',
      input_text: 'Your text to analyze...',
      results: {
        ai_probability: 0.85,
        human_probability: 15.0,
        confidence_level: 'high',
        sentence_analysis: [
          { text: 'First sentence...', ai_probability: 0.82 }
        ]
      },
      credits_used: 50
    }
  },
  {
    method: 'POST',
    path: '/api/scan/humanize',
    description: 'Humanizer - Transform AI-generated text to sound more human',
    tier: 'Starter+ (not available on Free)',
    requestBody: { 
      text: 'Your AI-generated text to humanize.',
      scan_type: 'humanize'
    },
    responseExample: {
      id: 64,
      scan_type: 'humanize',
      status: 'completed',
      input_text: 'Your AI-generated text to humanize.',
      output_text: 'Your naturally rewritten text that sounds human.',
      results: {
        humanized_text: 'Your naturally rewritten text that sounds human.',
        original_length: 35,
        humanized_length: 48
      },
      credits_used: 70
    }
  },
  {
    method: 'POST',
    path: '/api/scan/plagiarism',
    description: 'Plagiarism Checker - Check text for plagiarism against web sources',
    tier: 'Starter+ (not available on Free)',
    requestBody: { 
      text: 'Your text to check for plagiarism.',
      scan_type: 'plagiarism'
    },
    responseExample: {
      id: 65,
      scan_type: 'plagiarism',
      status: 'completed',
      input_text: 'Your text to check for plagiarism.',
      results: {
        plagiarism_score: 15.0,
        original_score: 85.0,
        sources_found: 2,
        sources: [
          { url: 'https://example.com', similarity: 12.0 }
        ]
      },
      credits_used: 52
    }
  },
  {
    method: 'GET',
    path: '/api/scan/history',
    description: 'Get scan history - Retrieve all past scans for the authenticated user',
    tier: 'All tiers',
    requestBody: { 
      page: 1,
      per_page: 20,
      scan_type: 'ai_detection (optional)'
    },
    responseExample: {
      scans: [
        {
          id: 63,
          scan_type: 'ai_detection',
          status: 'completed',
          input_length: 150,
          credits_used: 50,
          created_at: '2026-01-15T10:30:00Z'
        }
      ],
      total: 45,
      page: 1,
      per_page: 20
    }
  },
  {
    method: 'GET',
    path: '/api/scan/{scan_id}',
    description: 'Get single scan - Retrieve details of a specific scan by ID',
    tier: 'All tiers',
    requestBody: {},
    responseExample: {
      id: 63,
      scan_type: 'ai_detection',
      status: 'completed',
      input_text: 'Full text that was scanned...',
      results: {
        ai_probability: 0.85,
        human_probability: 15.0,
        confidence_level: 'high'
      },
      credits_used: 50,
      created_at: '2026-01-15T10:30:00Z'
    }
  },
  {
    method: 'GET',
    path: '/api/credits/balance',
    description: 'Get credits balance - Check remaining credits for the authenticated user',
    tier: 'All tiers',
    requestBody: {},
    responseExample: {
      credits_balance: 5000,
      credits_used_total: 1500,
      subscription_tier: 'Pro',
      unlimited: true
    }
  }
];

// Writing Tools - 14 Additional Features
const endpoints: Endpoint[] = [
  {
    method: 'POST',
    path: '/api/tools/grammar',
    description: 'Check grammar, spelling, and punctuation errors',
    tier: 'Free',
    requestBody: { text: 'Your text to check for grammar errors.' },
    responseExample: {
      success: true,
      original_text: 'Your text to check for grammar errors.',
      corrected_text: 'Your text to check for grammar errors.',
      error_count: 0,
      errors: []
    }
  },
  {
    method: 'POST',
    path: '/api/tools/tone/detect',
    description: 'Detect the emotional tone of text',
    tier: 'Free',
    requestBody: { text: 'I am so excited about this new feature!' },
    responseExample: {
      success: true,
      primary_tone: 'joy',
      primary_confidence: 92.5,
      all_tones: [
        { tone: 'joy', confidence: 92.5 },
        { tone: 'optimism', confidence: 45.2 }
      ]
    }
  },
  {
    method: 'POST',
    path: '/api/tools/tone/adjust',
    description: 'Adjust text tone to a target style',
    tier: 'Starter+',
    requestBody: { text: 'Hey, can you help me with this?', target_tone: 'formal' },
    responseExample: {
      success: true,
      original_text: 'Hey, can you help me with this?',
      adjusted_text: 'I would appreciate your assistance with this matter.',
      target_tone: 'formal'
    }
  },
  {
    method: 'POST',
    path: '/api/tools/readability',
    description: 'Analyze text readability with Flesch scores',
    tier: 'Free',
    requestBody: { text: 'Your text to analyze for readability.', detailed: true },
    responseExample: {
      success: true,
      flesch_reading_ease: 65.2,
      reading_level: 'Standard',
      word_count: 6,
      sentence_count: 1,
      flesch_kincaid_grade: 8.2,
      gunning_fog_index: 9.1
    }
  },
  {
    method: 'POST',
    path: '/api/tools/summarize',
    description: 'Summarize long text into key points',
    tier: 'Free',
    requestBody: { text: 'Your long text to summarize...', max_length: 150, min_length: 50 },
    responseExample: {
      success: true,
      summary: 'Summarized version of your text.',
      original_word_count: 500,
      summary_word_count: 75,
      compression_ratio: 85.0
    }
  },
  {
    method: 'POST',
    path: '/api/tools/paraphrase',
    description: 'Paraphrase text with different modes',
    tier: 'Free (standard mode)',
    requestBody: { text: 'The quick brown fox jumps over the lazy dog.', mode: 'standard' },
    responseExample: {
      success: true,
      original_text: 'The quick brown fox jumps over the lazy dog.',
      paraphrased_text: 'A swift brown fox leaps across a sluggish canine.',
      mode: 'standard'
    }
  },
  {
    method: 'POST',
    path: '/api/tools/citation',
    description: 'Generate citations in APA, MLA, or Chicago style',
    tier: 'Starter+',
    requestBody: { query: 'machine learning', style: 'apa' },
    responseExample: {
      success: true,
      citation: 'Author, A. (2024). Title of the work. Publisher.',
      style: 'apa',
      title: 'Title of the work',
      authors: ['Author, A.'],
      year: 2024
    }
  },
  {
    method: 'POST',
    path: '/api/tools/word-count',
    description: 'Get detailed word and character statistics',
    tier: 'Free',
    requestBody: { text: 'Your text to count words and characters.' },
    responseExample: {
      success: true,
      word_count: 7,
      character_count: 42,
      character_count_no_spaces: 36,
      sentence_count: 1,
      paragraph_count: 1,
      reading_time_minutes: 0.03,
      speaking_time_minutes: 0.05
    }
  },
  {
    method: 'POST',
    path: '/api/tools/translate',
    description: 'Translate text between languages',
    tier: 'Free',
    requestBody: { text: 'Hello, how are you?', source_lang: 'en', target_lang: 'es' },
    responseExample: {
      success: true,
      original_text: 'Hello, how are you?',
      translated_text: 'Hola, como estas?',
      source_language: 'en',
      target_language: 'es'
    }
  },
  {
    method: 'POST',
    path: '/api/tools/export',
    description: 'Export text to different formats',
    tier: 'Free (txt), Starter+ (html, markdown)',
    requestBody: { text: 'Your text to export.', format: 'markdown', title: 'My Document' },
    responseExample: {
      success: true,
      content: '# My Document\n\nYour text to export.',
      format: 'markdown',
      mime_type: 'text/markdown',
      filename: 'My Document.md'
    }
  },
  {
    method: 'POST',
    path: '/api/tools/style-analysis',
    description: 'Analyze writing style and get recommendations',
    tier: 'Starter+',
    requestBody: { text: 'Your text to analyze for writing style patterns and characteristics.' },
    responseExample: {
      success: true,
      style_type: 'Formal',
      vocabulary_diversity: 0.85,
      vocabulary_level: 'Advanced',
      avg_sentence_length: 12.5,
      passive_voice_percentage: 15.2,
      recommendations: ['Consider varying sentence length', 'Reduce passive voice usage']
    }
  },
  {
    method: 'POST',
    path: '/api/tools/improve',
    description: 'Improve content based on focus area',
    tier: 'Starter+',
    requestBody: { text: 'Your text to improve.', focus: 'clarity' },
    responseExample: {
      success: true,
      original_text: 'Your text to improve.',
      improved_text: 'Your enhanced and clearer text.',
      focus: 'clarity'
    }
  },
  {
    method: 'POST',
    path: '/api/tools/bulk',
    description: 'Process multiple texts at once',
    tier: 'Pro+',
    requestBody: { texts: ['First text', 'Second text', 'Third text'], operation: 'word_count' },
    responseExample: {
      success: true,
      results: [
        { index: 0, success: true, word_count: 2, character_count: 10 },
        { index: 1, success: true, word_count: 2, character_count: 11 },
        { index: 2, success: true, word_count: 2, character_count: 10 }
      ],
      processed_count: 3
    }
  }
];

export default function ApiDocsPage() {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [copiedSection, setCopiedSection] = useState<string | null>(null);

  const copyToClipboard = (text: string, index?: number, section?: string) => {
    navigator.clipboard.writeText(text);
    if (index !== undefined) {
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    }
    if (section) {
      setCopiedSection(section);
      setTimeout(() => setCopiedSection(null), 2000);
    }
  };

  const getTierColor = (tier: string) => {
    if (tier.includes('Enterprise')) return 'text-purple-400 bg-purple-500/20';
    if (tier.includes('Pro')) return 'text-rose-400 bg-rose-500/20';
    if (tier.includes('Starter')) return 'text-amber-400 bg-amber-500/20';
    return 'text-emerald-400 bg-emerald-500/20';
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-gray-950">
      <Helmet>
        <title>API Documentation - TextShift | REST API for AI Detection & Writing Tools</title>
        <meta name="description" content="TextShift REST API documentation. Access AI detection, humanization, plagiarism checking, and 14 writing tools programmatically. Full API reference with examples." />
        <link rel="canonical" href="https://textshift.org/api-docs" />
        <meta property="og:title" content="TextShift API Documentation" />
        <meta property="og:description" content="Access AI detection, humanization, and 14 writing tools via REST API. Full documentation with examples." />
        <meta property="og:url" content="https://textshift.org/api-docs" />
        <meta property="og:type" content="website" />
        <meta name="twitter:title" content="TextShift API Documentation" />
        <meta name="twitter:description" content="Access AI detection, humanization, and 14 writing tools via REST API." />
      </Helmet>
      {/* Header */}
      <header className="border-b border-white/10 bg-black/20 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link to="/" className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors">
                <ArrowLeft className="w-5 h-5" />
                <span>Back to Home</span>
              </Link>
            </div>
            <div className="flex items-center gap-2">
              <BookOpen className="w-6 h-6 text-emerald-400" />
              <span className="text-xl font-bold text-white">TextShift API</span>
            </div>
            <Link to="/login">
              <Button variant="outline" className="border-emerald-500/50 text-emerald-400 hover:bg-emerald-500/10">
                Get Started
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            TextShift API Documentation
          </h1>
          <p className="text-xl text-gray-400 max-w-3xl mx-auto">
            Access all 14 writing tools programmatically via our REST API. 
            Build powerful text processing applications with ease.
          </p>
        </div>

        {/* Quick Start Cards */}
        <div className="grid md:grid-cols-3 gap-6 mb-16">
          <div className="p-6 bg-black/30 rounded-2xl border border-white/10">
            <div className="w-12 h-12 bg-emerald-500/20 rounded-xl flex items-center justify-center mb-4">
              <Key className="w-6 h-6 text-emerald-400" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Authentication</h3>
            <p className="text-gray-400 text-sm">
              Use Bearer token authentication with your JWT access token in the Authorization header.
            </p>
          </div>
          <div className="p-6 bg-black/30 rounded-2xl border border-white/10">
            <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center mb-4">
              <Zap className="w-6 h-6 text-blue-400" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Rate Limits</h3>
            <p className="text-gray-400 text-sm">
              Free: 500 words/day. Starter: 5,000 words/day. Pro: Unlimited. Enterprise: Unlimited + API access.
            </p>
          </div>
          <div className="p-6 bg-black/30 rounded-2xl border border-white/10">
            <div className="w-12 h-12 bg-purple-500/20 rounded-xl flex items-center justify-center mb-4">
              <Shield className="w-6 h-6 text-purple-400" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Tier Access</h3>
            <p className="text-gray-400 text-sm">
              Some endpoints require higher tiers. Check the tier badge on each endpoint for requirements.
            </p>
          </div>
        </div>

        {/* Base URL Section */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold text-white mb-4">Base URL</h2>
          <div className="p-4 bg-black/40 rounded-xl border border-white/10 flex items-center justify-between">
            <code className="text-emerald-400 font-mono text-lg">{API_BASE}</code>
            <Button 
              size="sm" 
              variant="ghost" 
              onClick={() => copyToClipboard(API_BASE, undefined, 'base')}
              className="text-gray-400 hover:text-white"
            >
              {copiedSection === 'base' ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            </Button>
          </div>
        </div>

        {/* Authentication Section */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold text-white mb-4">Authentication</h2>
          <div className="p-6 bg-black/30 rounded-2xl border border-white/10 space-y-4">
            <p className="text-gray-300">
              All API requests require authentication using a Bearer token. First, obtain your access token by logging in:
            </p>
            
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-emerald-400 font-mono text-xs px-2 py-1 bg-emerald-500/20 rounded">POST</span>
                <code className="text-white font-mono">/api/auth/token</code>
              </div>
              <p className="text-gray-500 text-sm">Use JSON body with Content-Type: application/json</p>
              <div className="p-4 bg-black/40 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-500 text-sm">Request Body (JSON)</span>
                  <Button 
                    size="sm" 
                    variant="ghost" 
                    onClick={() => copyToClipboard(JSON.stringify({ email: 'your@email.com', password: 'yourpassword' }, null, 2), undefined, 'login')}
                    className="text-gray-400 hover:text-white h-6"
                  >
                    {copiedSection === 'login' ? <CheckCircle2 className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  </Button>
                </div>
                <pre className="text-gray-300 font-mono text-sm overflow-x-auto">
{`{
  "email": "your@email.com",
  "password": "yourpassword"
}`}
                </pre>
              </div>
              <div className="p-4 bg-black/40 rounded-lg">
                <span className="text-gray-500 text-sm">Response</span>
                <pre className="text-gray-300 font-mono text-sm overflow-x-auto mt-2">
{`{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "token_type": "bearer",
  "user": {
    "id": 1,
    "email": "your@email.com",
    "subscription_tier": "Enterprise",
    "credits_balance": 5000
  }
}`}
                </pre>
              </div>
            </div>

            <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg">
              <p className="text-amber-400 text-sm">
                <strong>Important:</strong> Include the token in all API requests:
              </p>
              <code className="text-white font-mono text-sm mt-2 block">
                Authorization: Bearer YOUR_ACCESS_TOKEN
              </code>
            </div>
          </div>
        </div>

        {/* Supported Languages (for Translator) */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold text-white mb-4">Supported Languages (Translator)</h2>
          <div className="p-6 bg-black/30 rounded-2xl border border-white/10">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { code: 'en', name: 'English' },
                { code: 'es', name: 'Spanish' },
                { code: 'fr', name: 'French' },
                { code: 'de', name: 'German' },
                { code: 'hi', name: 'Hindi' },
                { code: 'zh', name: 'Chinese' },
                { code: 'ja', name: 'Japanese' },
                { code: 'ko', name: 'Korean' }
              ].map(lang => (
                <div key={lang.code} className="p-3 bg-black/20 rounded-lg flex items-center gap-2">
                  <code className="text-emerald-400 font-mono">{lang.code}</code>
                  <span className="text-gray-400">{lang.name}</span>
                </div>
              ))}
            </div>
            <p className="text-gray-500 text-sm mt-4">
              Use language codes in the <code className="text-emerald-400">source_lang</code> and <code className="text-emerald-400">target_lang</code> fields.
            </p>
          </div>
        </div>

        {/* Core Tools Section */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold text-white mb-2">Core Tools API</h2>
          <p className="text-gray-400 mb-6">AI Detection, Humanizer, Plagiarism Checker, and Scan History</p>
          <div className="space-y-6">
            {coreEndpoints.map((endpoint, index) => (
              <div key={`core-${index}`} className="p-6 bg-black/30 rounded-2xl border border-blue-500/20">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <span className={`font-mono text-sm px-3 py-1 rounded ${endpoint.method === 'GET' ? 'text-blue-400 bg-blue-500/20' : 'text-emerald-400 bg-emerald-500/20'}`}>
                      {endpoint.method}
                    </span>
                    <code className="text-white font-mono">{endpoint.path}</code>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded ${getTierColor(endpoint.tier)}`}>
                    {endpoint.tier}
                  </span>
                </div>
                <p className="text-gray-400 mb-4">{endpoint.description}</p>
                
                <div className="grid md:grid-cols-2 gap-4">
                  {/* Request */}
                  <div className="p-4 bg-black/40 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-gray-500 text-sm">{endpoint.method === 'GET' ? 'Query Parameters' : 'Request Body'}</span>
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        onClick={() => copyToClipboard(JSON.stringify(endpoint.requestBody, null, 2), index)}
                        className="text-gray-400 hover:text-white h-6"
                      >
                        {copiedIndex === index ? <CheckCircle2 className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      </Button>
                    </div>
                    <pre className="text-gray-300 font-mono text-xs overflow-x-auto">
                      {JSON.stringify(endpoint.requestBody, null, 2)}
                    </pre>
                  </div>
                  
                  {/* Response */}
                  <div className="p-4 bg-black/40 rounded-lg">
                    <span className="text-gray-500 text-sm">Response Example</span>
                    <pre className="text-gray-300 font-mono text-xs overflow-x-auto mt-2">
                      {JSON.stringify(endpoint.responseExample, null, 2)}
                    </pre>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Writing Tools Section */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold text-white mb-2">Writing Tools API</h2>
          <p className="text-gray-400 mb-6">14 additional writing and content tools</p>
          <div className="space-y-6">
            {endpoints.map((endpoint, index) => (
              <div key={`writing-${index}`} className="p-6 bg-black/30 rounded-2xl border border-white/10">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <span className="text-emerald-400 font-mono text-sm px-3 py-1 bg-emerald-500/20 rounded">
                      {endpoint.method}
                    </span>
                    <code className="text-white font-mono">{endpoint.path}</code>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded ${getTierColor(endpoint.tier)}`}>
                    {endpoint.tier}
                  </span>
                </div>
                <p className="text-gray-400 mb-4">{endpoint.description}</p>
                
                <div className="grid md:grid-cols-2 gap-4">
                  {/* Request */}
                  <div className="p-4 bg-black/40 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-gray-500 text-sm">Request Body</span>
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        onClick={() => copyToClipboard(JSON.stringify(endpoint.requestBody, null, 2), index + 100)}
                        className="text-gray-400 hover:text-white h-6"
                      >
                        {copiedIndex === index + 100 ? <CheckCircle2 className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      </Button>
                    </div>
                    <pre className="text-gray-300 font-mono text-xs overflow-x-auto">
                      {JSON.stringify(endpoint.requestBody, null, 2)}
                    </pre>
                  </div>
                  
                  {/* Response */}
                  <div className="p-4 bg-black/40 rounded-lg">
                    <span className="text-gray-500 text-sm">Response Example</span>
                    <pre className="text-gray-300 font-mono text-xs overflow-x-auto mt-2">
                      {JSON.stringify(endpoint.responseExample, null, 2)}
                    </pre>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Error Handling */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold text-white mb-4">Error Handling</h2>
          <div className="p-6 bg-black/30 rounded-2xl border border-white/10">
            <p className="text-gray-300 mb-4">
              The API returns standard HTTP status codes. Error responses include a detail message:
            </p>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="p-4 bg-black/40 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-rose-400 font-mono text-sm px-2 py-1 bg-rose-500/20 rounded">401</span>
                  <span className="text-gray-400">Unauthorized</span>
                </div>
                <pre className="text-gray-300 font-mono text-xs">
{`{
  "detail": "Could not validate credentials"
}`}
                </pre>
              </div>
              <div className="p-4 bg-black/40 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-rose-400 font-mono text-sm px-2 py-1 bg-rose-500/20 rounded">403</span>
                  <span className="text-gray-400">Forbidden</span>
                </div>
                <pre className="text-gray-300 font-mono text-xs">
{`{
  "detail": "API Access requires Enterprise tier"
}`}
                </pre>
              </div>
              <div className="p-4 bg-black/40 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-amber-400 font-mono text-sm px-2 py-1 bg-amber-500/20 rounded">429</span>
                  <span className="text-gray-400">Rate Limited</span>
                </div>
                <pre className="text-gray-300 font-mono text-xs">
{`{
  "detail": "Text exceeds your daily limit"
}`}
                </pre>
              </div>
              <div className="p-4 bg-black/40 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-rose-400 font-mono text-sm px-2 py-1 bg-rose-500/20 rounded">500</span>
                  <span className="text-gray-400">Server Error</span>
                </div>
                <pre className="text-gray-300 font-mono text-xs">
{`{
  "detail": "Internal server error"
}`}
                </pre>
              </div>
            </div>
          </div>
        </div>

        {/* Postman Setup Guide */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold text-white mb-4">Postman Setup Guide</h2>
          <div className="p-6 bg-black/30 rounded-2xl border border-white/10 space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-white mb-3">Step 1: Get Your Access Token</h3>
              <div className="space-y-2">
                <p className="text-gray-400 text-sm">Create a new POST request in Postman:</p>
                <div className="p-3 bg-black/40 rounded-lg">
                  <code className="text-emerald-400 font-mono text-sm">POST {API_BASE}/api/auth/token</code>
                </div>
                <p className="text-gray-400 text-sm">In the Body tab, select "raw" and change dropdown from "Text" to "JSON", then enter:</p>
                <div className="p-3 bg-black/40 rounded-lg">
                  <pre className="text-gray-300 font-mono text-xs">{`{
  "email": "your@email.com",
  "password": "yourpassword"
}`}</pre>
                </div>
                <p className="text-gray-400 text-sm">Copy the <code className="text-emerald-400">access_token</code> from the response.</p>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-white mb-3">Step 2: Set Up Authorization</h3>
              <div className="space-y-2">
                <p className="text-gray-400 text-sm">For all other requests, go to the Headers tab and add:</p>
                <div className="p-3 bg-black/40 rounded-lg flex items-center gap-4">
                  <div>
                    <span className="text-gray-500 text-sm">Key: </span>
                    <code className="text-emerald-400 font-mono">Authorization</code>
                  </div>
                  <div>
                    <span className="text-gray-500 text-sm">Value: </span>
                    <code className="text-white font-mono text-sm">Bearer YOUR_ACCESS_TOKEN</code>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-white mb-3">Step 3: Test an Endpoint</h3>
              <div className="space-y-2">
                <p className="text-gray-400 text-sm">Try the AI Detection endpoint:</p>
                <div className="p-3 bg-black/40 rounded-lg">
                  <code className="text-emerald-400 font-mono text-sm">POST {API_BASE}/api/scan/detect</code>
                </div>
                <p className="text-gray-400 text-sm">Body (raw JSON):</p>
                <div className="p-3 bg-black/40 rounded-lg">
                  <pre className="text-gray-300 font-mono text-xs">{`{
  "text": "Your text to analyze for AI detection.",
  "scan_type": "ai_detection"
}`}</pre>
                </div>
              </div>
            </div>

            <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg">
              <p className="text-amber-400 text-sm">
                <strong>Important:</strong> Make sure to select "JSON" (not "Text") in the Body dropdown when sending requests. Using "Text" will cause 422 errors.
              </p>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="text-center p-8 bg-gradient-to-r from-emerald-500/10 to-blue-500/10 rounded-2xl border border-white/10">
          <h2 className="text-2xl font-bold text-white mb-4">Ready to Get Started?</h2>
          <p className="text-gray-400 mb-6">
            Create an account and upgrade to Enterprise to unlock full API access.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Link to="/register">
              <Button className="bg-emerald-500 hover:bg-emerald-600 text-white">
                Create Account
              </Button>
            </Link>
            <Link to="/pricing">
              <Button variant="outline" className="border-white/20 text-white hover:bg-white/10">
                View Pricing
              </Button>
            </Link>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/10 mt-16 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-gray-500 text-sm">
          <p>&copy; {new Date().getFullYear()} TextShift. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
