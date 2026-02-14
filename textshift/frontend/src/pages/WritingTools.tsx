import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { 
  ArrowLeft,
  CheckCircle2,
  Loader2,
  Copy,
  Download,
  AlertCircle,
  CreditCard,
  LogOut,
  Sparkles,
  FileText,
  Languages,
  BookOpen,
  PenTool,
  BarChart3,
  Quote,
  Hash,
  Wand2,
  FileOutput,
  Layers,
  Key,
  Palette,
  Lightbulb,
  Lock,
  Crown
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { creditsApi, authApi } from '@/lib/api';
import { useQuery } from '@tanstack/react-query';
import { detectFormat, FormatDetectionResult } from '@/lib/formatDetector';
import { FormatBadge } from '@/components/ui/FormatBadge';
import { usePageSEO } from '@/hooks/usePageSEO';

const API_BASE = '/api/tools';

interface ToolConfig {
  id: string;
  name: string;
  description: string;
  icon: any;
  color: string;
  minTier: 'free' | 'starter' | 'pro' | 'enterprise';
  endpoint: string;
  hasOptions?: boolean;
  options?: { value: string; label: string }[];
  optionLabel?: string;
}

const tools: ToolConfig[] = [
  {
    id: 'grammar',
    name: 'Grammar Checker',
    description: 'Check and fix grammar, spelling, and punctuation errors',
    icon: CheckCircle2,
    color: 'emerald',
    minTier: 'free',
    endpoint: '/grammar'
  },
  {
    id: 'tone-detect',
    name: 'Tone Detector',
    description: 'Analyze the emotional tone of your text',
    icon: BarChart3,
    color: 'blue',
    minTier: 'free',
    endpoint: '/tone/detect'
  },
  {
    id: 'tone-adjust',
    name: 'Tone Adjuster',
    description: 'Adjust your text to a different tone',
    icon: Palette,
    color: 'purple',
    minTier: 'starter',
    endpoint: '/tone/adjust',
    hasOptions: true,
    optionLabel: 'Target Tone',
    options: [
      { value: 'formal', label: 'Formal' },
      { value: 'casual', label: 'Casual' },
      { value: 'persuasive', label: 'Persuasive' },
      { value: 'academic', label: 'Academic' },
      { value: 'confident', label: 'Confident' },
      { value: 'empathetic', label: 'Empathetic' }
    ]
  },
  {
    id: 'readability',
    name: 'Readability Score',
    description: 'Analyze text readability with Flesch scores',
    icon: BookOpen,
    color: 'amber',
    minTier: 'free',
    endpoint: '/readability'
  },
  {
    id: 'summarize',
    name: 'Summarizer',
    description: 'Create concise summaries of long texts',
    icon: FileText,
    color: 'cyan',
    minTier: 'free',
    endpoint: '/summarize'
  },
  {
    id: 'paraphrase',
    name: 'Paraphraser',
    description: 'Rewrite text in different styles',
    icon: PenTool,
    color: 'pink',
    minTier: 'free',
    endpoint: '/paraphrase',
    hasOptions: true,
    optionLabel: 'Mode',
    options: [
      { value: 'standard', label: 'Standard' },
      { value: 'fluency', label: 'Fluency' },
      { value: 'creative', label: 'Creative' },
      { value: 'formal', label: 'Formal' },
      { value: 'simple', label: 'Simple' }
    ]
  },
  {
    id: 'citation',
    name: 'Citation Generator',
    description: 'Generate citations in APA, MLA, or Chicago style',
    icon: Quote,
    color: 'indigo',
    minTier: 'starter',
    endpoint: '/citation',
    hasOptions: true,
    optionLabel: 'Style',
    options: [
      { value: 'apa', label: 'APA' },
      { value: 'mla', label: 'MLA' },
      { value: 'chicago', label: 'Chicago' }
    ]
  },
  {
    id: 'word-count',
    name: 'Word Counter',
    description: 'Detailed word, character, and reading time analysis',
    icon: Hash,
    color: 'gray',
    minTier: 'free',
    endpoint: '/word-count'
  },
  {
    id: 'translate',
    name: 'Translator',
    description: 'Translate text between languages',
    icon: Languages,
    color: 'teal',
    minTier: 'free',
    endpoint: '/translate',
    hasOptions: true,
    optionLabel: 'Language Pair',
    options: [
      { value: 'en-es', label: 'English to Spanish' },
      { value: 'es-en', label: 'Spanish to English' },
      { value: 'en-fr', label: 'English to French' },
      { value: 'fr-en', label: 'French to English' },
      { value: 'en-de', label: 'English to German' },
      { value: 'de-en', label: 'German to English' },
      { value: 'en-hi', label: 'English to Hindi' }
    ]
  },
  {
    id: 'export',
    name: 'Export Options',
    description: 'Export text to TXT, HTML, Markdown, or PDF',
    icon: FileOutput,
    color: 'orange',
    minTier: 'free',
    endpoint: '/export',
    hasOptions: true,
    optionLabel: 'Format',
    options: [
      { value: 'txt', label: 'Plain Text (.txt)' },
      { value: 'html', label: 'HTML (.html)' },
      { value: 'markdown', label: 'Markdown (.md)' },
      { value: 'pdf', label: 'PDF (.pdf)' }
    ]
  },
  {
    id: 'style-analysis',
    name: 'Style Analysis',
    description: 'Analyze writing style, vocabulary, and structure',
    icon: Sparkles,
    color: 'violet',
    minTier: 'starter',
    endpoint: '/style-analysis'
  },
  {
    id: 'improve',
    name: 'Content Improver',
    description: 'Improve content clarity, engagement, or professionalism',
    icon: Lightbulb,
    color: 'yellow',
    minTier: 'starter',
    endpoint: '/improve',
    hasOptions: true,
    optionLabel: 'Focus',
    options: [
      { value: 'clarity', label: 'Clarity' },
      { value: 'conciseness', label: 'Conciseness' },
      { value: 'engagement', label: 'Engagement' },
      { value: 'professionalism', label: 'Professionalism' },
      { value: 'seo', label: 'SEO Optimization' }
    ]
  },
  {
    id: 'bulk',
    name: 'Bulk Processing',
    description: 'Process multiple texts at once (one per line)',
    icon: Layers,
    color: 'rose',
    minTier: 'pro',
    endpoint: '/bulk',
    hasOptions: true,
    optionLabel: 'Operation',
    options: [
      { value: 'word_count', label: 'Word Count' },
      { value: 'grammar', label: 'Grammar Check' },
      { value: 'tone_detect', label: 'Tone Detection' },
      { value: 'readability', label: 'Readability' },
      { value: 'summarize', label: 'Summarize' },
      { value: 'paraphrase', label: 'Paraphrase' }
    ]
  },
  {
    id: 'api-access',
    name: 'API Access',
    description: 'Access all tools via REST API',
    icon: Key,
    color: 'slate',
    minTier: 'enterprise',
    endpoint: '/api-docs'
  }
];

const tierOrder = { free: 0, starter: 1, pro: 2, enterprise: 3 };

const getColorClasses = (color: string, _isActive?: boolean) => {
  const colors: Record<string, { bg: string; border: string; text: string; hover: string }> = {
    emerald: { bg: 'bg-emerald-500/20', border: 'border-emerald-500/30', text: 'text-emerald-400', hover: 'hover:bg-emerald-500/10' },
    blue: { bg: 'bg-blue-500/20', border: 'border-blue-500/30', text: 'text-blue-400', hover: 'hover:bg-blue-500/10' },
    purple: { bg: 'bg-purple-500/20', border: 'border-purple-500/30', text: 'text-purple-400', hover: 'hover:bg-purple-500/10' },
    amber: { bg: 'bg-amber-500/20', border: 'border-amber-500/30', text: 'text-amber-400', hover: 'hover:bg-amber-500/10' },
    cyan: { bg: 'bg-cyan-500/20', border: 'border-cyan-500/30', text: 'text-cyan-400', hover: 'hover:bg-cyan-500/10' },
    pink: { bg: 'bg-pink-500/20', border: 'border-pink-500/30', text: 'text-pink-400', hover: 'hover:bg-pink-500/10' },
    indigo: { bg: 'bg-indigo-500/20', border: 'border-indigo-500/30', text: 'text-indigo-400', hover: 'hover:bg-indigo-500/10' },
    gray: { bg: 'bg-gray-500/20', border: 'border-gray-500/30', text: 'text-gray-400', hover: 'hover:bg-gray-500/10' },
    teal: { bg: 'bg-teal-500/20', border: 'border-teal-500/30', text: 'text-teal-400', hover: 'hover:bg-teal-500/10' },
    orange: { bg: 'bg-orange-500/20', border: 'border-orange-500/30', text: 'text-orange-400', hover: 'hover:bg-orange-500/10' },
    violet: { bg: 'bg-violet-500/20', border: 'border-violet-500/30', text: 'text-violet-400', hover: 'hover:bg-violet-500/10' },
    yellow: { bg: 'bg-yellow-500/20', border: 'border-yellow-500/30', text: 'text-yellow-400', hover: 'hover:bg-yellow-500/10' },
    rose: { bg: 'bg-rose-500/20', border: 'border-rose-500/30', text: 'text-rose-400', hover: 'hover:bg-rose-500/10' },
    slate: { bg: 'bg-slate-500/20', border: 'border-slate-500/30', text: 'text-slate-400', hover: 'hover:bg-slate-500/10' },
  };
  return colors[color] || colors.emerald;
};

export default function WritingTools() {
  const { user, logout, updateUser } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTool, setActiveTool] = useState<string>('grammar');

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const toolParam = params.get('tool');
    if (toolParam) {
      const idMap: Record<string, string> = {
        'word_count': 'word-count',
        'style': 'style-analysis',
        'tone': 'tone-adjust',
      };
      const mappedId = idMap[toolParam] || toolParam;
      const found = tools.find(t => t.id === mappedId);
      if (found) {
        setActiveTool(mappedId);
        if (found.options && found.options.length > 0) {
          setOption(found.options[0].value);
        }
      }
    }
  }, [location.search]);

  usePageSEO({
    title: 'Writing Tools - Grammar, Tone, Summarizer & More',
    description: 'Access 14 AI-powered writing tools: grammar checker, tone adjuster, summarizer, paraphraser, translator, citation generator, and more.',
    noIndex: true,
  });
  const [text, setText] = useState('');
  const [option, setOption] = useState('');
  const [result, setResult] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);
    const [formatDetection, setFormatDetection] = useState<FormatDetectionResult | null>(null);
  
    // Handle text change with format detection
    const handleTextChange = (newText: string) => {
      setText(newText);
      if (newText.trim().length > 20) {
        const detection = detectFormat(newText);
        setFormatDetection(detection);
      } else {
        setFormatDetection(null);
      }
    };
  
    // Handle stripping formatting
    const handleStripFormatting = (strippedText: string) => {
      handleTextChange(strippedText);
    };

  const { data: credits, refetch: refetchCredits } = useQuery({
    queryKey: ['credits'],
    queryFn: creditsApi.getBalance,
  });

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

  const currentTool = tools.find(t => t.id === activeTool);
  const userTier = user?.subscription_tier?.toLowerCase() || 'free';
  const userTierLevel = tierOrder[userTier as keyof typeof tierOrder] || 0;

  const canAccessTool = (tool: ToolConfig) => {
    const requiredLevel = tierOrder[tool.minTier];
    return userTierLevel >= requiredLevel;
  };

  const handleToolSelect = (toolId: string) => {
    const tool = tools.find(t => t.id === toolId);
    if (tool && canAccessTool(tool)) {
      setActiveTool(toolId);
      setResult(null);
      setError(null);
      if (tool.options && tool.options.length > 0) {
        setOption(tool.options[0].value);
      }
    }
  };

  const handleAnalyze = async () => {
    if (!currentTool || !text.trim()) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const token = localStorage.getItem('token');
      let body: any = { text };

      // Add tool-specific options
      if (currentTool.id === 'tone-adjust') {
        body.target_tone = option;
      } else if (currentTool.id === 'paraphrase') {
        body.mode = option;
      } else if (currentTool.id === 'citation') {
        body = { query: text, style: option };
      } else if (currentTool.id === 'translate') {
        const [source, target] = option.split('-');
        body.source_lang = source;
        body.target_lang = target;
      } else if (currentTool.id === 'export') {
        body.format = option;
        body.title = 'TextShift Export';
      } else if (currentTool.id === 'improve') {
        body.focus = option;
      } else if (currentTool.id === 'readability') {
        body.detailed = userTierLevel >= tierOrder.starter;
      } else if (currentTool.id === 'bulk') {
        // Split text by newlines to create multiple texts for bulk processing
        const texts = text.split('\n').filter(t => t.trim().length > 0);
        body = { texts, operation: option || 'word_count' };
      } else if (currentTool.id === 'api-access') {
        // API docs endpoint just needs any text to trigger
        body = { text: text || 'get docs' };
      }

      // 5 minute timeout for writing tools (ML operations can take time)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 300000);

      const response = await fetch(`${API_BASE}${currentTool.endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(body),
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || 'An error occurred');
      }

      setResult(data);
      refetchCredits();
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (content: string) => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadResult = () => {
    if (!result?.content) return;
    let blob: Blob;
    if (result.encoding === 'base64') {
      const binaryString = atob(result.content);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      blob = new Blob([bytes], { type: result.mime_type || 'application/octet-stream' });
    } else {
      blob = new Blob([result.content], { type: result.mime_type || 'text/plain' });
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = result.filename || 'export.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const getWordCount = () => text.trim().split(/\s+/).filter(w => w.length > 0).length;

  const renderResult = () => {
    if (!result || !result.success) return null;

    const colorClasses = getColorClasses(currentTool?.color || 'emerald', true);

    switch (activeTool) {
      case 'grammar':
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Errors Found:</span>
              <span className={`font-bold ${result.error_count > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                {result.error_count}
              </span>
            </div>
            {result.corrected_text && result.error_count > 0 && (
              <>
                <Button 
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3"
                  onClick={() => {
                    setText(result.corrected_text);
                    setResult(null);
                  }}
                >
                  <Wand2 className="w-4 h-4 mr-2" />
                  Apply All Fixes ({result.error_count} corrections)
                </Button>
                <div className="p-4 bg-black/30 rounded-xl border border-white/10">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-gray-500 text-sm">Corrected Text Preview</span>
                    <Button size="sm" variant="ghost" onClick={() => copyToClipboard(result.corrected_text)}>
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                  <div className="max-h-[400px] overflow-y-auto">
                    {result.corrections && result.corrections.length > 0 && result.original_text ? (() => {
                      const corrections = result.corrections as Array<{offset: number; length: number; original: string; replacement: string}>;
                      const orig = result.original_text as string;
                      const parts: Array<{type: string; text: string}> = [];
                      let lastEnd = 0;
                      for (const corr of corrections) {
                        if (corr.offset > lastEnd) {
                          parts.push({ type: 'equal', text: orig.substring(lastEnd, corr.offset) });
                        }
                        parts.push({ type: 'removed', text: orig.substring(corr.offset, corr.offset + corr.length) });
                        if (corr.replacement) {
                          parts.push({ type: 'added', text: corr.replacement });
                        }
                        lastEnd = corr.offset + corr.length;
                      }
                      if (lastEnd < orig.length) {
                        parts.push({ type: 'equal', text: orig.substring(lastEnd) });
                      }
                      return (
                        <p className="text-white whitespace-pre-wrap leading-relaxed">
                          {parts.map((part, i) => {
                            if (part.type === 'removed') return <span key={i} className="text-rose-400 line-through opacity-70 bg-rose-500/15 px-0.5 rounded">{part.text}</span>;
                            if (part.type === 'added') return <span key={i}><span className="text-gray-500 text-xs mx-0.5">→</span><span className="text-emerald-400 font-medium bg-emerald-500/15 px-0.5 rounded">{part.text}</span></span>;
                            return <span key={i}>{part.text}</span>;
                          })}
                        </p>
                      );
                    })() : (
                      <p className="text-white whitespace-pre-wrap">{result.corrected_text}</p>
                    )}
                  </div>
                </div>
              </>
            )}
            {result.error_count === 0 && (
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-center">
                <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                <p className="text-emerald-400 font-medium">No errors found! Your text looks great.</p>
              </div>
            )}
            {result.errors && result.errors.length > 0 && (
              <div className="space-y-2">
                <span className="text-gray-500 text-sm">Issues Found:</span>
                {result.errors.map((err: any, i: number) => (
                  <div key={i} className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-rose-400 text-sm font-medium">{err.message}</p>
                        {err.replacements && err.replacements.length > 0 && (
                          <p className="text-gray-400 text-xs mt-1">
                            <span className="text-emerald-400">Suggestion:</span> {err.replacements[0]}
                            {err.replacements.length > 1 && ` (or: ${err.replacements.slice(1).join(', ')})`}
                          </p>
                        )}
                      </div>
                      {err.replacements && err.replacements.length > 0 && (err.original || err.offset !== undefined) && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 flex-shrink-0 text-xs px-2 py-1 h-auto"
                          onClick={() => {
                            const original = (err.original || '') as string;
                            const replacement = err.replacements[0] as string;
                            if (original) {
                              const idx = text.indexOf(original);
                              if (idx !== -1) {
                                const updated = text.substring(0, idx) + replacement + text.substring(idx + original.length);
                                setText(updated);
                              }
                            } else if (err.offset !== undefined) {
                              const offset = err.offset as number;
                              const length = (err.length || 0) as number;
                              const updated = text.substring(0, offset) + replacement + text.substring(offset + length);
                              setText(updated);
                            }
                          }}
                        >
                          Apply
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );

      case 'tone-detect':
        return (
          <div className="space-y-4">
            <div className="p-4 bg-black/30 rounded-xl border border-white/10 text-center">
              <span className="text-gray-500 text-sm">Primary Tone</span>
              <p className={`text-2xl font-bold ${colorClasses.text} capitalize mt-1`}>{result.primary_tone}</p>
              <p className="text-gray-400 text-sm">{result.primary_confidence}% confidence</p>
              {result.overall_category && (
                <span className={`inline-block mt-2 px-3 py-1 rounded-full text-xs font-medium ${
                  result.overall_category === 'Positive' ? 'bg-emerald-500/20 text-emerald-400' :
                  result.overall_category === 'Negative' ? 'bg-rose-500/20 text-rose-400' :
                  result.overall_category === 'Mixed' ? 'bg-amber-500/20 text-amber-400' :
                  'bg-gray-500/20 text-gray-400'
                }`}>{result.overall_category}</span>
              )}
            </div>
            {result.category_breakdown && (
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 bg-emerald-500/10 rounded-lg text-center border border-emerald-500/20">
                  <span className="text-gray-500 text-xs">Positive</span>
                  <p className="text-emerald-400 font-medium">{result.category_breakdown.positive}%</p>
                </div>
                <div className="p-3 bg-rose-500/10 rounded-lg text-center border border-rose-500/20">
                  <span className="text-gray-500 text-xs">Negative</span>
                  <p className="text-rose-400 font-medium">{result.category_breakdown.negative}%</p>
                </div>
                <div className="p-3 bg-gray-500/10 rounded-lg text-center border border-gray-500/20">
                  <span className="text-gray-500 text-xs">Neutral</span>
                  <p className="text-gray-300 font-medium">{result.category_breakdown.neutral}%</p>
                </div>
              </div>
            )}
            {result.consistency_score !== undefined && (
              <div className="p-3 bg-black/20 rounded-lg flex items-center justify-between">
                <span className="text-gray-500 text-sm">Tone Consistency</span>
                <span className={`font-medium ${result.consistency_score >= 70 ? 'text-emerald-400' : result.consistency_score >= 40 ? 'text-amber-400' : 'text-rose-400'}`}>
                  {result.consistency_score}%
                </span>
              </div>
            )}
            {result.all_tones && result.all_tones.length > 1 && (
              <div className="space-y-2">
                <span className="text-gray-500 text-sm">All Detected Tones:</span>
                {result.all_tones.map((tone: any, i: number) => (
                  <div key={i} className="flex items-center justify-between p-2 bg-black/20 rounded-lg">
                    <div className="flex items-center gap-2">
                      <span className="text-white capitalize">{tone.tone}</span>
                      {tone.category && <span className="text-gray-500 text-xs">({tone.category})</span>}
                    </div>
                    <span className="text-gray-400">{tone.confidence}%</span>
                  </div>
                ))}
              </div>
            )}
            {result.sentence_tones && result.sentence_tones.length > 0 && (
              <div className="space-y-2">
                <span className="text-gray-500 text-sm">Sentence-Level Tones ({result.sentence_count_analyzed} analyzed):</span>
                {result.sentence_tones.map((st: any, i: number) => (
                  <div key={i} className="p-2 bg-black/20 rounded-lg">
                    <p className="text-gray-300 text-xs truncate">{st.sentence}</p>
                    <div className="flex items-center justify-between mt-1">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        st.category === 'Positive' ? 'bg-emerald-500/20 text-emerald-400' :
                        st.category === 'Negative' ? 'bg-rose-500/20 text-rose-400' :
                        'bg-gray-500/20 text-gray-400'
                      }`}>{st.primary_tone}</span>
                      <span className="text-gray-500 text-xs">{st.confidence}%</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );

      case 'tone-adjust':
      case 'paraphrase':
      case 'improve':
        const outputText = result.adjusted_text || result.paraphrased_text || result.improved_text;
        return (
          <div className="space-y-4">
            <div className="p-4 bg-black/30 rounded-xl border border-white/10">
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-500 text-sm">Result</span>
                <Button size="sm" variant="ghost" onClick={() => copyToClipboard(outputText)}>
                  {copied ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
              <p className="text-white whitespace-pre-wrap">{outputText}</p>
            </div>
          </div>
        );

      case 'readability':
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-black/30 rounded-xl border border-white/10 text-center">
                <span className="text-gray-500 text-sm">Flesch Score</span>
                <p className={`text-2xl font-bold ${result.flesch_reading_ease > 60 ? 'text-emerald-400' : result.flesch_reading_ease > 30 ? 'text-amber-400' : 'text-rose-400'}`}>
                  {result.flesch_reading_ease}
                </p>
              </div>
              <div className="p-4 bg-black/30 rounded-xl border border-white/10 text-center">
                <span className="text-gray-500 text-sm">Reading Level</span>
                <p className="text-lg font-medium text-white mt-1">{result.reading_level}</p>
              </div>
            </div>
            {result.recommended_audience && (
              <div className="p-3 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
                <span className="text-emerald-400 text-sm font-medium">Recommended Audience</span>
                <p className="text-white text-sm mt-1">{result.recommended_audience}</p>
              </div>
            )}
            {result.grade_explanation && (
              <div className="p-3 bg-blue-500/10 rounded-lg border border-blue-500/20">
                <div className="flex items-center justify-between">
                  <span className="text-blue-400 text-sm font-medium">Average Grade Level: {result.average_grade_level}</span>
                </div>
                <p className="text-white text-sm mt-1">{result.grade_explanation}</p>
              </div>
            )}
            {result.vocabulary_richness !== undefined && (
              <div className="p-3 bg-black/20 rounded-lg flex items-center justify-between">
                <span className="text-gray-500 text-sm">Vocabulary Richness (TTR)</span>
                <span className={`font-medium ${result.vocabulary_richness > 60 ? 'text-emerald-400' : result.vocabulary_richness > 40 ? 'text-amber-400' : 'text-rose-400'}`}>
                  {result.vocabulary_richness}%
                </span>
              </div>
            )}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div className="p-3 bg-black/20 rounded-lg text-center">
                <span className="text-gray-500 text-xs">Grade Level</span>
                <p className="text-white font-medium">{result.flesch_kincaid_grade}</p>
              </div>
              <div className="p-3 bg-black/20 rounded-lg text-center">
                <span className="text-gray-500 text-xs">Fog Index</span>
                <p className="text-white font-medium">{result.gunning_fog_index}</p>
              </div>
              <div className="p-3 bg-black/20 rounded-lg text-center">
                <span className="text-gray-500 text-xs">SMOG Index</span>
                <p className="text-white font-medium">{result.smog_index}</p>
              </div>
              <div className="p-3 bg-black/20 rounded-lg text-center">
                <span className="text-gray-500 text-xs">Coleman-Liau</span>
                <p className="text-white font-medium">{result.coleman_liau_index}</p>
              </div>
              <div className="p-3 bg-black/20 rounded-lg text-center">
                <span className="text-gray-500 text-xs">ARI</span>
                <p className="text-white font-medium">{result.automated_readability_index}</p>
              </div>
              <div className="p-3 bg-black/20 rounded-lg text-center">
                <span className="text-gray-500 text-xs">Avg Syllables/Word</span>
                <p className="text-white font-medium">{result.avg_syllables_per_word}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="p-2 bg-black/10 rounded text-center">
                <span className="text-gray-500 text-xs">Words</span>
                <p className="text-white text-sm">{result.word_count}</p>
              </div>
              <div className="p-2 bg-black/10 rounded text-center">
                <span className="text-gray-500 text-xs">Sentences</span>
                <p className="text-white text-sm">{result.sentence_count}</p>
              </div>
              <div className="p-2 bg-black/10 rounded text-center">
                <span className="text-gray-500 text-xs">Avg Sentence Length</span>
                <p className="text-white text-sm">{result.avg_sentence_length}</p>
              </div>
              <div className="p-2 bg-black/10 rounded text-center">
                <span className="text-gray-500 text-xs">Complex Words</span>
                <p className="text-white text-sm">{result.complex_word_percentage}%</p>
              </div>
            </div>
            {result.paragraph_breakdown && result.paragraph_breakdown.length > 1 && (
              <div className="space-y-2">
                <span className="text-gray-500 text-sm">Paragraph Readability:</span>
                {result.paragraph_breakdown.map((pb: any) => (
                  <div key={pb.paragraph} className="flex items-center justify-between p-2 bg-black/20 rounded-lg">
                    <span className="text-gray-300 text-sm">Paragraph {pb.paragraph}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-gray-500 text-xs">{pb.word_count} words</span>
                      <span className={`font-medium text-sm ${pb.flesch_score > 60 ? 'text-emerald-400' : pb.flesch_score > 30 ? 'text-amber-400' : 'text-rose-400'}`}>
                        {pb.flesch_score}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {result.suggestions && result.suggestions.length > 0 && (
              <div className="p-3 bg-amber-500/10 rounded-lg border border-amber-500/20">
                <span className="text-amber-400 text-sm font-medium">Suggestions</span>
                <ul className="text-white text-sm mt-1 space-y-1">
                  {result.suggestions.map((suggestion: string, idx: number) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-amber-400">•</span>
                      {suggestion}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        );

      case 'summarize':
        return (
          <div className="space-y-4">
            <div className="p-4 bg-black/30 rounded-xl border border-white/10">
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-500 text-sm">Summary</span>
                <Button size="sm" variant="ghost" onClick={() => copyToClipboard(result.summary)}>
                  {copied ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
              <p className="text-white whitespace-pre-wrap">{result.summary}</p>
            </div>
            <div className="flex items-center justify-between text-sm text-gray-400">
              <span>Original: {result.original_word_count} words</span>
              <span>Summary: {result.summary_word_count} words</span>
              <span className="text-emerald-400">{result.compression_ratio}% compressed</span>
            </div>
          </div>
        );

      case 'citation':
        return (
          <div className="space-y-4">
            <div className="p-4 bg-black/30 rounded-xl border border-white/10">
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-500 text-sm">{result.style?.toUpperCase()} Citation</span>
                <Button size="sm" variant="ghost" onClick={() => copyToClipboard(result.citation)}>
                  {copied ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
              <p className="text-white font-mono text-sm">{result.citation}</p>
            </div>
            {result.title && (
              <div className="text-sm text-gray-400">
                <p><strong>Title:</strong> {result.title}</p>
                {result.authors && <p><strong>Authors:</strong> {result.authors.join(', ')}</p>}
                {result.year && <p><strong>Year:</strong> {result.year}</p>}
              </div>
            )}
          </div>
        );

      case 'word-count':
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="p-4 bg-black/30 rounded-xl border border-white/10 text-center">
                <span className="text-gray-500 text-sm">Words</span>
                <p className="text-2xl font-bold text-white">{result.word_count}</p>
              </div>
              <div className="p-4 bg-black/30 rounded-xl border border-white/10 text-center">
                <span className="text-gray-500 text-sm">Characters</span>
                <p className="text-2xl font-bold text-white">{result.character_count}</p>
                <p className="text-gray-500 text-xs">({result.character_count_no_spaces} no spaces)</p>
              </div>
              <div className="p-4 bg-black/30 rounded-xl border border-white/10 text-center">
                <span className="text-gray-500 text-sm">Sentences</span>
                <p className="text-2xl font-bold text-white">{result.sentence_count}</p>
              </div>
              <div className="p-4 bg-black/30 rounded-xl border border-white/10 text-center">
                <span className="text-gray-500 text-sm">Paragraphs</span>
                <p className="text-2xl font-bold text-white">{result.paragraph_count}</p>
              </div>
              <div className="p-4 bg-black/30 rounded-xl border border-white/10 text-center">
                <span className="text-gray-500 text-sm">Reading Time</span>
                <p className="text-lg font-bold text-white">{result.reading_time_display || `${result.reading_time_minutes} min`}</p>
                <p className="text-gray-500 text-xs">238 wpm</p>
              </div>
              <div className="p-4 bg-black/30 rounded-xl border border-white/10 text-center">
                <span className="text-gray-500 text-sm">Speaking Time</span>
                <p className="text-lg font-bold text-white">{result.speaking_time_display || `${result.speaking_time_minutes} min`}</p>
                <p className="text-gray-500 text-xs">150 wpm</p>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="p-2 bg-black/10 rounded text-center">
                <span className="text-gray-500 text-xs">Unique Words</span>
                <p className="text-white text-sm">{result.unique_words}</p>
              </div>
              <div className="p-2 bg-black/10 rounded text-center">
                <span className="text-gray-500 text-xs">Avg Word Length</span>
                <p className="text-white text-sm">{result.avg_word_length}</p>
              </div>
              <div className="p-2 bg-black/10 rounded text-center">
                <span className="text-gray-500 text-xs">Avg Sentence</span>
                <p className="text-white text-sm">{result.avg_sentence_length} words</p>
              </div>
              <div className="p-2 bg-black/10 rounded text-center">
                <span className="text-gray-500 text-xs">Avg Paragraph</span>
                <p className="text-white text-sm">{result.avg_paragraph_length} words</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="p-2 bg-black/10 rounded text-center">
                <span className="text-gray-500 text-xs">Longest Sentence</span>
                <p className="text-white text-sm">{result.longest_sentence_words} words</p>
              </div>
              <div className="p-2 bg-black/10 rounded text-center">
                <span className="text-gray-500 text-xs">Shortest Sentence</span>
                <p className="text-white text-sm">{result.shortest_sentence_words} words</p>
              </div>
              <div className="p-2 bg-black/10 rounded text-center">
                <span className="text-gray-500 text-xs">Letters / Digits</span>
                <p className="text-white text-sm">{result.letter_count} / {result.digit_count}</p>
              </div>
            </div>
            {result.keyword_density && result.keyword_density.length > 0 && (
              <div className="space-y-2">
                <span className="text-gray-500 text-sm">Keyword Density (Top 10):</span>
                {result.keyword_density.map((kw: any, i: number) => (
                  <div key={i} className="flex items-center justify-between p-2 bg-black/20 rounded-lg">
                    <span className="text-white text-sm">{kw.word}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-gray-500 text-xs">{kw.count}x</span>
                      <span className="text-emerald-400 text-sm font-medium">{kw.density}%</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );

      case 'translate':
        return (
          <div className="space-y-4">
            <div className="p-4 bg-black/30 rounded-xl border border-white/10">
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-500 text-sm">{result.language_pair}</span>
                <Button size="sm" variant="ghost" onClick={() => copyToClipboard(result.translated_text)}>
                  {copied ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
              <p className="text-white whitespace-pre-wrap">{result.translated_text}</p>
            </div>
          </div>
        );

      case 'export':
        return (
          <div className="space-y-4">
            <div className="p-4 bg-black/30 rounded-xl border border-white/10">
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-500 text-sm">{result.filename}</span>
                <Button size="sm" variant="ghost" onClick={downloadResult}>
                  <Download className="w-4 h-4 mr-2" /> Download
                </Button>
              </div>
              <p className="text-gray-400 text-sm">Format: {result.format?.toUpperCase()} | Size: {result.size_bytes} bytes</p>
            </div>
          </div>
        );

      case 'style-analysis':
        return (
          <div className="space-y-4">
            <div className="p-4 bg-black/30 rounded-xl border border-white/10 text-center">
              <span className="text-gray-500 text-sm">Writing Style</span>
              <p className={`text-xl font-bold ${colorClasses.text} mt-1`}>{result.style_type}</p>
              {result.formality_label && (
                <span className={`inline-block mt-2 px-3 py-1 rounded-full text-xs font-medium ${
                  result.formality_score >= 55 ? 'bg-blue-500/20 text-blue-400' :
                  result.formality_score >= 40 ? 'bg-gray-500/20 text-gray-400' :
                  'bg-amber-500/20 text-amber-400'
                }`}>{result.formality_label} ({result.formality_score})</span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 bg-black/20 rounded-lg">
                <span className="text-gray-500 text-xs">Vocabulary Diversity</span>
                <p className="text-white">{result.vocabulary_diversity}%</p>
                <p className="text-gray-500 text-xs">{result.vocabulary_level}</p>
              </div>
              <div className="p-3 bg-black/20 rounded-lg">
                <span className="text-gray-500 text-xs">Sentence Variety</span>
                <p className="text-white">{result.sentence_variety_score}/100</p>
              </div>
              <div className="p-3 bg-black/20 rounded-lg">
                <span className="text-gray-500 text-xs">Avg Sentence Length</span>
                <p className="text-white">{result.avg_sentence_length} words</p>
              </div>
              <div className="p-3 bg-black/20 rounded-lg">
                <span className="text-gray-500 text-xs">Passive Voice</span>
                <p className="text-white">{result.passive_voice_percentage}%</p>
              </div>
            </div>
            {result.pos_distribution && (
              <div className="space-y-2">
                <span className="text-gray-500 text-sm">POS Distribution:</span>
                <div className="grid grid-cols-4 gap-2">
                  <div className="p-2 bg-blue-500/10 rounded-lg text-center border border-blue-500/20">
                    <span className="text-gray-500 text-xs">Nouns</span>
                    <p className="text-blue-400 font-medium">{result.pos_distribution.nouns}</p>
                  </div>
                  <div className="p-2 bg-emerald-500/10 rounded-lg text-center border border-emerald-500/20">
                    <span className="text-gray-500 text-xs">Verbs</span>
                    <p className="text-emerald-400 font-medium">{result.pos_distribution.verbs}</p>
                  </div>
                  <div className="p-2 bg-amber-500/10 rounded-lg text-center border border-amber-500/20">
                    <span className="text-gray-500 text-xs">Adjectives</span>
                    <p className="text-amber-400 font-medium">{result.pos_distribution.adjectives}</p>
                  </div>
                  <div className="p-2 bg-purple-500/10 rounded-lg text-center border border-purple-500/20">
                    <span className="text-gray-500 text-xs">Adverbs</span>
                    <p className="text-purple-400 font-medium">{result.pos_distribution.adverbs}</p>
                  </div>
                </div>
              </div>
            )}
            {result.transition_words_found && result.transition_words_found.length > 0 && (
              <div className="p-3 bg-black/20 rounded-lg">
                <span className="text-gray-500 text-sm">Transition Words ({result.transition_word_count}):</span>
                <div className="flex flex-wrap gap-2 mt-2">
                  {result.transition_words_found.map((tw: string, i: number) => (
                    <span key={i} className="px-2 py-1 bg-emerald-500/10 text-emerald-400 rounded text-xs">{tw}</span>
                  ))}
                </div>
              </div>
            )}
            {result.passive_voice_sentences && result.passive_voice_sentences.length > 0 && (
              <div className="space-y-2">
                <span className="text-gray-500 text-sm">Passive Voice Sentences:</span>
                {result.passive_voice_sentences.map((s: string, i: number) => (
                  <div key={i} className="p-2 bg-rose-500/10 rounded-lg border border-rose-500/20">
                    <p className="text-gray-300 text-xs">{s}</p>
                  </div>
                ))}
              </div>
            )}
            {result.recommendations && result.recommendations.length > 0 && (
              <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                <span className="text-amber-400 text-sm font-medium">Recommendations:</span>
                <ul className="mt-2 space-y-1">
                  {result.recommendations.map((rec: string, i: number) => (
                    <li key={i} className="text-gray-300 text-sm">- {rec}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        );

      case 'bulk':
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Processed:</span>
              <span className="text-emerald-400 font-bold">{result.processed_count} texts</span>
            </div>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {result.results && result.results.map((item: any, i: number) => (
                <div key={i} className="p-4 bg-black/30 rounded-xl border border-white/10">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-gray-500 text-sm">Text #{item.index + 1}</span>
                    <span className={`text-xs px-2 py-1 rounded ${item.success ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                      {item.success ? 'Success' : 'Failed'}
                    </span>
                  </div>
                  {item.error ? (
                    <p className="text-rose-400 text-sm">{item.error}</p>
                  ) : (
                    <div className="text-white text-sm">
                      {item.corrected_text && <p>{item.corrected_text}</p>}
                      {item.primary_tone && <p>Tone: {item.primary_tone} ({item.primary_confidence}%)</p>}
                      {item.flesch_reading_ease !== undefined && <p>Readability: {item.flesch_reading_ease} ({item.reading_level})</p>}
                      {item.summary && <p>{item.summary}</p>}
                      {item.paraphrased_text && <p>{item.paraphrased_text}</p>}
                      {item.word_count !== undefined && <p>Words: {item.word_count}, Characters: {item.character_count}</p>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        );

      case 'api-access':
        return (
          <div className="space-y-4">
            <div className="p-4 bg-black/30 rounded-xl border border-white/10">
              <h4 className="text-white font-medium mb-3">API Documentation</h4>
              <p className="text-gray-400 text-sm mb-4">
                Access all TextShift writing tools programmatically via our REST API.
              </p>
              <div className="space-y-3">
                <div className="p-3 bg-black/20 rounded-lg">
                  <span className="text-gray-500 text-xs">Base URL</span>
                  <p className="text-emerald-400 font-mono text-sm">{window.location.origin}/api/tools</p>
                </div>
                <div className="p-3 bg-black/20 rounded-lg">
                  <span className="text-gray-500 text-xs">Authentication</span>
                  <p className="text-white text-sm">Bearer Token (JWT)</p>
                </div>
              </div>
            </div>
            <div className="p-4 bg-black/30 rounded-xl border border-white/10">
              <h4 className="text-white font-medium mb-3">Available Endpoints</h4>
              <div className="space-y-2 text-sm">
                {[
                  { method: 'POST', path: '/grammar', desc: 'Check grammar' },
                  { method: 'POST', path: '/tone/detect', desc: 'Detect tone' },
                  { method: 'POST', path: '/tone/adjust', desc: 'Adjust tone' },
                  { method: 'POST', path: '/readability', desc: 'Analyze readability' },
                  { method: 'POST', path: '/summarize', desc: 'Summarize text' },
                  { method: 'POST', path: '/paraphrase', desc: 'Paraphrase text' },
                  { method: 'POST', path: '/citation', desc: 'Generate citation' },
                  { method: 'POST', path: '/word-count', desc: 'Count words' },
                  { method: 'POST', path: '/translate', desc: 'Translate text' },
                  { method: 'POST', path: '/export', desc: 'Export text' },
                  { method: 'POST', path: '/style-analysis', desc: 'Analyze style' },
                  { method: 'POST', path: '/improve', desc: 'Improve content' },
                  { method: 'POST', path: '/bulk', desc: 'Bulk processing' },
                ].map((endpoint, i) => (
                  <div key={i} className="flex items-center gap-3 p-2 bg-black/20 rounded">
                    <span className="text-emerald-400 font-mono text-xs px-2 py-1 bg-emerald-500/20 rounded">{endpoint.method}</span>
                    <span className="text-white font-mono">{endpoint.path}</span>
                    <span className="text-gray-500 ml-auto">{endpoint.desc}</span>
                  </div>
                ))}
              </div>
            </div>
            {result.api_key && (
              <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-amber-400 text-sm font-medium">Your API Key</span>
                  <Button size="sm" variant="ghost" onClick={() => copyToClipboard(result.api_key)}>
                    {copied ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  </Button>
                </div>
                <p className="text-white font-mono text-sm break-all">{result.api_key}</p>
              </div>
            )}
          </div>
        );

      default:
        return (
          <div className="p-4 bg-black/30 rounded-xl border border-white/10">
            <pre className="text-white text-sm overflow-auto">{JSON.stringify(result, null, 2)}</pre>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-gradient-to-b from-purple-500/10 via-purple-500/5 to-transparent rounded-full blur-3xl" />
      </div>

      <nav className="sticky top-0 z-50 border-b border-white/10 bg-[#0a0a0a]/80 backdrop-blur-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center gap-4">
              <Link to="/dashboard" className="flex items-center gap-2 text-gray-400 hover:text-white">
                <ArrowLeft className="w-4 h-4" />
                <span>Dashboard</span>
              </Link>
              <div className="w-px h-6 bg-white/10" />
              <div className="flex items-center gap-2">
                <Wand2 className="w-5 h-5 text-purple-400" />
                <span className="text-white font-medium">Writing Tools</span>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 bg-white/5 border border-white/10 px-4 py-2 rounded-full">
                <CreditCard className="w-4 h-4 text-emerald-400" />
                <span className="text-white font-medium">
                  {credits?.balance === -1 ? 'Unlimited' : (credits?.balance?.toLocaleString() ?? 0)}
                </span>
                <span className="text-gray-500">words</span>
              </div>
              <Button variant="ghost" size="sm" onClick={handleLogout} className="text-gray-400 hover:text-white hover:bg-white/5 rounded-full">
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-light text-white mb-2">Writing Tools</h1>
          <p className="text-gray-500">14 powerful tools to enhance your writing</p>
        </div>

        <div className="grid lg:grid-cols-4 gap-6">
          {/* Tool Selection Sidebar */}
          <div className="lg:col-span-1 space-y-2">
            {tools.map((tool) => {
              const colorClasses = getColorClasses(tool.color, activeTool === tool.id);
              const hasAccess = canAccessTool(tool);
              
              return (
                <button
                  key={tool.id}
                  onClick={() => handleToolSelect(tool.id)}
                  disabled={!hasAccess}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all text-left ${
                    activeTool === tool.id
                      ? `${colorClasses.bg} ${colorClasses.border} border`
                      : hasAccess
                        ? `bg-white/5 border border-transparent ${colorClasses.hover}`
                        : 'bg-white/5 border border-transparent opacity-50 cursor-not-allowed'
                  }`}
                >
                  <div className={`p-2 rounded-lg ${activeTool === tool.id ? colorClasses.bg : 'bg-white/5'}`}>
                    <tool.icon className={`w-4 h-4 ${activeTool === tool.id ? colorClasses.text : 'text-gray-400'}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-medium truncate ${activeTool === tool.id ? colorClasses.text : 'text-white'}`}>
                        {tool.name}
                      </span>
                      {!hasAccess && (
                        <Lock className="w-3 h-3 text-gray-500 flex-shrink-0" />
                      )}
                    </div>
                    {tool.minTier !== 'free' && (
                      <span className={`text-xs ${hasAccess ? 'text-gray-500' : 'text-amber-500'}`}>
                        {tool.minTier.charAt(0).toUpperCase() + tool.minTier.slice(1)}+
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Main Content Area */}
          <div className="lg:col-span-3 space-y-6">
            {currentTool && (
              <>
                {/* Tool Header */}
                <div className={`p-6 rounded-2xl border ${getColorClasses(currentTool.color, true).bg} ${getColorClasses(currentTool.color, true).border}`}>
                  <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-xl ${getColorClasses(currentTool.color, true).bg}`}>
                      <currentTool.icon className={`w-6 h-6 ${getColorClasses(currentTool.color, true).text}`} />
                    </div>
                    <div>
                      <h2 className="text-xl font-medium text-white">{currentTool.name}</h2>
                      <p className="text-gray-400 text-sm">{currentTool.description}</p>
                    </div>
                  </div>
                </div>

                                {/* Input Area */}
                                <div className="bg-gradient-to-b from-white/5 to-transparent border border-white/10 rounded-2xl p-6">
                                  {/* Format Detection Badge */}
                                  {formatDetection && formatDetection.hasFormatting && (
                                    <div className="mb-4 flex justify-end">
                                      <FormatBadge 
                                        detection={formatDetection} 
                                        onStripFormatting={handleStripFormatting}
                                        originalText={text}
                                      />
                                    </div>
                                  )}
                  
                                  {currentTool.id === 'citation' ? (
                                    <div className="space-y-4">
                                      <Input
                                        placeholder="Enter search query, DOI, or title..."
                                        className="bg-black/30 border-white/10 text-white placeholder:text-gray-600 rounded-xl"
                                        value={text}
                                        onChange={(e) => handleTextChange(e.target.value)}
                                      />
                                    </div>
                                  ) : (
                                    <Textarea
                                      placeholder="Paste your text here..."
                                      className="min-h-[200px] bg-black/30 border-white/10 text-white placeholder:text-gray-600 rounded-xl resize-none focus:border-purple-500/50"
                                      value={text}
                                      onChange={(e) => handleTextChange(e.target.value)}
                                    />
                                  )}

                  {currentTool.hasOptions && currentTool.options && (
                    <div className="mt-4">
                      <label className="text-gray-400 text-sm mb-2 block">{currentTool.optionLabel}</label>
                      <div className="flex flex-wrap gap-2">
                        {currentTool.options.map((opt) => {
                          // Check if option is available for user's tier (for paraphrase modes)
                          const isRestricted = currentTool.id === 'paraphrase' && opt.value !== 'standard' && userTierLevel < tierOrder.starter;
                          
                          return (
                            <button
                              key={opt.value}
                              onClick={() => !isRestricted && setOption(opt.value)}
                              disabled={isRestricted}
                              className={`px-4 py-2 rounded-lg text-sm transition-all ${
                                option === opt.value
                                  ? `${getColorClasses(currentTool.color, true).bg} ${getColorClasses(currentTool.color, true).text} border ${getColorClasses(currentTool.color, true).border}`
                                  : isRestricted
                                    ? 'bg-white/5 text-gray-600 cursor-not-allowed'
                                    : 'bg-white/5 text-gray-400 hover:bg-white/10'
                              }`}
                            >
                              {opt.label}
                              {isRestricted && <Lock className="w-3 h-3 ml-1 inline" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mt-4">
                    <div className="text-gray-500 text-sm">
                      {getWordCount()} words
                    </div>
                    <Button
                      onClick={handleAnalyze}
                      disabled={text.length < 10 || loading}
                      className={`rounded-full px-8 bg-purple-500 hover:bg-purple-600 text-white`}
                    >
                      {loading ? (
                        <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Processing...</>
                      ) : (
                        <><Wand2 className="w-4 h-4 mr-2" />Analyze</>
                      )}
                    </Button>
                  </div>

                  {error && (
                    <div className="mt-4 p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl">
                      <div className="flex items-center text-rose-400">
                        <AlertCircle className="w-4 h-4 mr-2" />
                        {error}
                      </div>
                    </div>
                  )}
                </div>

                {/* Results */}
                {result && result.success && (
                  <div className="bg-gradient-to-b from-white/5 to-transparent border border-white/10 rounded-2xl p-6">
                    <div className="flex items-center gap-2 mb-4">
                      <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                      <h3 className="text-lg font-medium text-white">Results</h3>
                    </div>
                    {renderResult()}
                  </div>
                )}

                {/* Upgrade CTA for locked features */}
                {!canAccessTool(currentTool) && (
                  <div className="p-6 bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/30 rounded-2xl">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-purple-500/20 rounded-xl">
                        <Crown className="w-6 h-6 text-purple-400" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-lg font-medium text-white">Upgrade to {currentTool.minTier.charAt(0).toUpperCase() + currentTool.minTier.slice(1)}</h3>
                        <p className="text-gray-400 text-sm">Unlock {currentTool.name} and more powerful features</p>
                      </div>
                      <Link to="/pricing">
                        <Button className="bg-purple-500 hover:bg-purple-600 text-white rounded-full px-6">
                          Upgrade Now
                        </Button>
                      </Link>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
