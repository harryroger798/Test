import { useState, useEffect } from 'react';
import { 
  Brain, 
  Users, 
  Activity, 
  RefreshCw, 
  Play, 
  CheckCircle, 
  XCircle,
  Clock,
  BarChart3,
  Zap,
  AlertTriangle,
  Settings,
  Download,
  Search,
  Edit,
  Trash2,
  Plus,
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  FileText,
  TrendingUp,
  CreditCard,
  Shield,
  Gift,
  Mail,
  Send,
  Eye,
  Wand2
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { usePageSEO } from '@/hooks/usePageSEO';

const API_URL = import.meta.env.VITE_API_URL ?? (import.meta.env.PROD ? '' : 'http://localhost:8000');

type TabType = 'overview' | 'users' | 'scans' | 'feedback' | 'ml' | 'promos' | 'emails' | 'writing-tools' | 'settings';

interface DashboardSummary {
  users: { total: number; today: number; this_week: number; this_month: number };
  scans: { total: number; today: number; this_week: number; this_month: number };
  credits: { today: number; this_week: number; this_month: number };
  feedback: { today: number; this_week: number };
  top_users: Array<{ id: number; email: string; full_name: string; scan_count: number }>;
  recent_activity: {
    scans: Array<{ id: number; scan_type: string; status: string; created_at: string }>;
    users: Array<{ id: number; email: string; created_at: string }>;
  };
}

interface UserData {
  id: number;
  email: string;
  full_name: string;
  subscription_tier: string;
  credits_balance: number;
  credits_used_total: number;
  is_active: boolean;
  is_admin: boolean;
  is_verified: boolean;
  created_at: string;
  last_login_at: string;
  scan_count: number;
}

interface ScanData {
  id: number;
  user_id: number;
  user_email: string;
  scan_type: string;
  status: string;
  input_length: number;
  credits_used: number;
  ai_probability: number | null;
  plagiarism_score: number | null;
  created_at: string;
  completed_at: string | null;
}

interface FeedbackData {
  id: number;
  scan_id: number;
  user_id: number;
  user_email: string;
  feedback_type: string;
  is_correct: boolean;
  scan_type: string;
  user_comment: string | null;
  used_in_training: boolean;
  created_at: string;
}

interface PromoData {
  id: number;
  code: string;
  title: string;
  description: string;
  promo_type: string;
  plan_tier: string | null;
  discount_percentage: number | null;
  credits_amount: number | null;
  duration_days: number;
  start_date: string;
  end_date: string | null;
  max_redemptions: number | null;
  current_redemptions: number;
  is_active: boolean;
  show_on_landing: boolean;
  landing_headline: string | null;
  landing_subtext: string | null;
  landing_button_text: string | null;
  landing_badge_text: string | null;
  created_at: string;
  updated_at: string;
}

interface PromoRedemption {
  id: number;
  user_id: number;
  user_email: string;
  promo_id: number;
  redeemed_at: string;
  ip_address: string | null;
}

export default function AdminPanel() {
  const { token, user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<TabType>('overview');

  usePageSEO({
    title: 'Admin Panel',
    description: 'TextShift admin panel for managing users, scans, feedback, ML models, promos, and system settings.',
    noIndex: true,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Overview data
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  
  // Users data
  const [users, setUsers] = useState<UserData[]>([]);
  const [usersTotal, setUsersTotal] = useState(0);
  const [usersPage, setUsersPage] = useState(1);
  const [userSearch, setUserSearch] = useState('');
  const [userTierFilter, setUserTierFilter] = useState('');
  const [editingUser, setEditingUser] = useState<UserData | null>(null);
  
  // Scans data
  const [scans, setScans] = useState<ScanData[]>([]);
  const [scansTotal, setScansTotal] = useState(0);
  const [scansPage, setScansPage] = useState(1);
  const [scanTypeFilter, setScanTypeFilter] = useState('');
  
  // Feedback data
  const [feedback, setFeedback] = useState<FeedbackData[]>([]);
  const [feedbackTotal, setFeedbackTotal] = useState(0);
  const [feedbackPage, setFeedbackPage] = useState(1);
  
  // ML data
  const [mlMetrics, setMlMetrics] = useState<any>(null);
  const [trainingHistory, setTrainingHistory] = useState<any[]>([]);
  const [triggeringTraining, setTriggeringTraining] = useState<string | null>(null);
  
    // Settings
    const [settings, setSettings] = useState<any>(null);

    // Site settings (cookie consent)
    const [cookieConsentEnabled, setCookieConsentEnabled] = useState(true);
    const [siteSettingsLoading, setSiteSettingsLoading] = useState(false);

    // Promos data
    const [promos, setPromos] = useState<PromoData[]>([]);
    const [promosLoading, setPromosLoading] = useState(false);
    const [editingPromo, setEditingPromo] = useState<PromoData | null>(null);
    const [creatingPromo, setCreatingPromo] = useState(false);
    const [viewingRedemptions, setViewingRedemptions] = useState<number | null>(null);
    const [redemptions, setRedemptions] = useState<PromoRedemption[]>([]);
    
    // Email campaigns data
    const [emailTypes, setEmailTypes] = useState<any>(null);
    const [emailStats, setEmailStats] = useState<any>(null);
    const [campaigns, setCampaigns] = useState<any[]>([]);
    const [sendingTestEmail, setSendingTestEmail] = useState(false);
    const [testEmailType, setTestEmailType] = useState('scan_complete');
    const [testEmailAddress, setTestEmailAddress] = useState('');
    const [emailMessage, setEmailMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);
    
    const [newPromo, setNewPromo] = useState({
      code: '',
      title: '',
      description: '',
      promo_type: 'free_plan',
      plan_tier: 'Starter',
      discount_percentage: 0,
      credits_amount: 0,
      duration_days: 30,
      end_date: '',
      max_redemptions: 0,
      is_active: true,
      show_on_landing: true,
      landing_headline: '',
      landing_subtext: '',
      landing_button_text: 'Claim Now',
      landing_badge_text: 'Limited Time'
    });

    const fetchSummary = async () => {
    try {
      const response = await fetch(`${API_URL}/api/admin/dashboard/summary`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setSummary(data);
      }
    } catch (err) {
      console.error('Failed to fetch summary:', err);
    }
  };

  const fetchUsers = async () => {
    try {
      const params = new URLSearchParams({
        page: usersPage.toString(),
        per_page: '10',
        ...(userSearch && { search: userSearch }),
        ...(userTierFilter && { tier: userTierFilter })
      });
      const response = await fetch(`${API_URL}/api/admin/users?${params}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setUsers(data.users);
        setUsersTotal(data.total);
      }
    } catch (err) {
      console.error('Failed to fetch users:', err);
    }
  };

  const fetchScans = async () => {
    try {
      const params = new URLSearchParams({
        page: scansPage.toString(),
        per_page: '10',
        ...(scanTypeFilter && { scan_type: scanTypeFilter })
      });
      const response = await fetch(`${API_URL}/api/admin/analytics/scans?${params}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setScans(data.scans);
        setScansTotal(data.total);
      }
    } catch (err) {
      console.error('Failed to fetch scans:', err);
    }
  };

  const fetchFeedback = async () => {
    try {
      const params = new URLSearchParams({
        page: feedbackPage.toString(),
        per_page: '10'
      });
      const response = await fetch(`${API_URL}/api/admin/feedback/list?${params}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setFeedback(data.feedback);
        setFeedbackTotal(data.total);
      }
    } catch (err) {
      console.error('Failed to fetch feedback:', err);
    }
  };

  const fetchMlMetrics = async () => {
    try {
      const [metricsRes, historyRes] = await Promise.all([
        fetch(`${API_URL}/api/admin/metrics/overview`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`${API_URL}/api/admin/training/history?limit=10`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ]);
      
      if (metricsRes.ok) {
        const data = await metricsRes.json();
        setMlMetrics(data);
      }
      if (historyRes.ok) {
        const data = await historyRes.json();
        setTrainingHistory(data.training_runs || []);
      }
    } catch (err) {
      console.error('Failed to fetch ML metrics:', err);
    }
  };

    const fetchSettings = async () => {
      try {
        const [settingsRes, siteSettingsRes] = await Promise.all([
          fetch(`${API_URL}/api/admin/settings`, {
            headers: { 'Authorization': `Bearer ${token}` }
          }),
          fetch(`${API_URL}/api/admin/site-settings`, {
            headers: { 'Authorization': `Bearer ${token}` }
          })
        ]);
        if (settingsRes.ok) {
          const data = await settingsRes.json();
          setSettings(data);
        }
        if (siteSettingsRes.ok) {
          const data = await siteSettingsRes.json();
          setCookieConsentEnabled(data.cookie_consent_enabled);
        }
      } catch (err) {
        console.error('Failed to fetch settings:', err);
      }
    };

    const toggleCookieConsent = async (enabled: boolean) => {
      setSiteSettingsLoading(true);
      try {
        const response = await fetch(`${API_URL}/api/admin/site-settings`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ cookie_consent_enabled: enabled })
        });
        if (response.ok) {
          const data = await response.json();
          setCookieConsentEnabled(data.cookie_consent_enabled);
        } else {
          setError('Failed to update cookie consent setting');
        }
      } catch (err) {
        setError('Failed to update cookie consent setting');
      } finally {
        setSiteSettingsLoading(false);
      }
    };

    const fetchPromos = async () => {
      setPromosLoading(true);
      try {
        const response = await fetch(`${API_URL}/api/promo/admin/list`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
          const data = await response.json();
          setPromos(data);
        }
      } catch (err) {
        console.error('Failed to fetch promos:', err);
      } finally {
        setPromosLoading(false);
      }
    };

    const fetchEmailData = async () => {
      try {
        const [typesRes, statsRes, campaignsRes] = await Promise.all([
          fetch(`${API_URL}/api/v1/admin/email-campaigns/types`, {
            headers: { 'Authorization': `Bearer ${token}` }
          }),
          fetch(`${API_URL}/api/v1/admin/email-campaigns/stats/overview`, {
            headers: { 'Authorization': `Bearer ${token}` }
          }),
          fetch(`${API_URL}/api/v1/admin/email-campaigns/`, {
            headers: { 'Authorization': `Bearer ${token}` }
          })
        ]);
        
        if (typesRes.ok) {
          const data = await typesRes.json();
          setEmailTypes(data);
        }
        if (statsRes.ok) {
          const data = await statsRes.json();
          setEmailStats(data);
        }
        if (campaignsRes.ok) {
          const data = await campaignsRes.json();
          setCampaigns(data);
        }
      } catch (err) {
        console.error('Failed to fetch email data:', err);
      }
    };

    const sendTestEmail = async () => {
      setSendingTestEmail(true);
      setEmailMessage(null);
      try {
        const response = await fetch(`${API_URL}/api/v1/admin/email-campaigns/send-test`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            email_type: testEmailType,
            to_email: testEmailAddress || user?.email
          })
        });
        
        if (response.ok) {
          setEmailMessage({ type: 'success', text: `Test email sent to ${testEmailAddress || user?.email}` });
        } else {
          const data = await response.json();
          setEmailMessage({ type: 'error', text: data.detail || 'Failed to send test email' });
        }
      } catch (err) {
        setEmailMessage({ type: 'error', text: 'Failed to send test email' });
      } finally {
        setSendingTestEmail(false);
      }
    };

    const createPromo = async () => {
      try {
        const payload = {
          ...newPromo,
          end_date: newPromo.end_date || null,
          max_redemptions: newPromo.max_redemptions || null,
          discount_percentage: newPromo.promo_type === 'percentage' ? newPromo.discount_percentage : null,
          credits_amount: newPromo.promo_type === 'fixed_credits' ? newPromo.credits_amount : null,
          plan_tier: newPromo.promo_type === 'free_plan' ? newPromo.plan_tier : null
        };
      
        const response = await fetch(`${API_URL}/api/promo/admin/create`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(payload)
        });
      
        if (response.ok) {
          setCreatingPromo(false);
          setNewPromo({
            code: '',
            title: '',
            description: '',
            promo_type: 'free_plan',
            plan_tier: 'Starter',
            discount_percentage: 0,
            credits_amount: 0,
            duration_days: 30,
            end_date: '',
            max_redemptions: 0,
            is_active: true,
            show_on_landing: true,
            landing_headline: '',
            landing_subtext: '',
            landing_button_text: 'Claim Now',
            landing_badge_text: 'Limited Time'
          });
          fetchPromos();
        } else {
          const data = await response.json();
          setError(data.detail || 'Failed to create promo');
        }
      } catch (err) {
        setError('Failed to create promo');
      }
    };

    const updatePromo = async (promoId: number, updates: Partial<PromoData>) => {
      try {
        const response = await fetch(`${API_URL}/api/promo/admin/${promoId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(updates)
        });
      
        if (response.ok) {
          setEditingPromo(null);
          fetchPromos();
        } else {
          const data = await response.json();
          setError(data.detail || 'Failed to update promo');
        }
      } catch (err) {
        setError('Failed to update promo');
      }
    };

    const deletePromo = async (promoId: number) => {
      if (!confirm('Are you sure you want to delete this promo?')) return;
    
      try {
        const response = await fetch(`${API_URL}/api/promo/admin/${promoId}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        });
      
        if (response.ok) {
          fetchPromos();
        } else {
          const data = await response.json();
          setError(data.detail || 'Failed to delete promo');
        }
      } catch (err) {
        setError('Failed to delete promo');
      }
    };

    const fetchRedemptions = async (promoId: number) => {
      try {
        const response = await fetch(`${API_URL}/api/promo/admin/${promoId}/redemptions`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
          const data = await response.json();
          setRedemptions(data);
          setViewingRedemptions(promoId);
        }
      } catch (err) {
        console.error('Failed to fetch redemptions:', err);
      }
    };

    const updateUser = async (userId: number, updates: Partial<UserData>) => {
    try {
      const response = await fetch(`${API_URL}/api/admin/users/${userId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(updates)
      });
      
      if (response.ok) {
        setEditingUser(null);
        fetchUsers();
      } else {
        const data = await response.json();
        setError(data.detail || 'Failed to update user');
      }
    } catch (err) {
      setError('Failed to update user');
    }
  };

  const addCredits = async (userId: number, amount: number) => {
    try {
      const response = await fetch(`${API_URL}/api/admin/users/${userId}/add-credits?amount=${amount}&reason=Admin adjustment`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        fetchUsers();
      }
    } catch (err) {
      setError('Failed to add credits');
    }
  };

  const deleteFeedback = async (feedbackId: number) => {
    if (!confirm('Are you sure you want to delete this feedback?')) return;
    
    try {
      const response = await fetch(`${API_URL}/api/admin/feedback/${feedbackId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        fetchFeedback();
      }
    } catch (err) {
      setError('Failed to delete feedback');
    }
  };

  const triggerTraining = async (modelType: string) => {
    setTriggeringTraining(modelType);
    try {
      const response = await fetch(`${API_URL}/api/admin/training/trigger`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ model_type: modelType })
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || 'Failed to trigger training');
      }
      
      fetchMlMetrics();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to trigger training');
    } finally {
      setTriggeringTraining(null);
    }
  };

  const exportData = async (type: 'users' | 'scans', format: 'json' | 'csv') => {
    try {
      const response = await fetch(`${API_URL}/api/admin/export/${type}?format=${format}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        
        if (format === 'csv') {
          const blob = new Blob([data.data], { type: 'text/csv' });
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = data.filename;
          a.click();
        } else {
          const blob = new Blob([JSON.stringify(data.data, null, 2)], { type: 'application/json' });
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${type}_export.json`;
          a.click();
        }
      }
    } catch (err) {
      setError('Failed to export data');
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await fetchSummary();
      setLoading(false);
    };
    loadData();
  }, [token]);

    useEffect(() => {
      if (activeTab === 'users') fetchUsers();
      if (activeTab === 'scans') fetchScans();
      if (activeTab === 'feedback') fetchFeedback();
      if (activeTab === 'ml') fetchMlMetrics();
      if (activeTab === 'settings') fetchSettings();
      if (activeTab === 'promos') fetchPromos();
      if (activeTab === 'emails') fetchEmailData();
    }, [activeTab, usersPage, userSearch, userTierFilter, scansPage, scanTypeFilter, feedbackPage]);

  if (!user?.is_admin) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">Admin Access Required</h1>
          <p className="text-gray-400">You need admin privileges to view this page.</p>
        </div>
      </div>
    );
  }

        const tabs = [
          { id: 'overview' as TabType, label: 'Overview', icon: BarChart3 },
          { id: 'users' as TabType, label: 'Users', icon: Users },
          { id: 'scans' as TabType, label: 'Scans', icon: FileText },
          { id: 'feedback' as TabType, label: 'Feedback', icon: MessageSquare },
          { id: 'ml' as TabType, label: 'ML System', icon: Brain },
          { id: 'promos' as TabType, label: 'Promos', icon: Gift },
          { id: 'emails' as TabType, label: 'Emails', icon: Mail },
          { id: 'writing-tools' as TabType, label: 'Writing Tools', icon: Wand2 },
          { id: 'settings' as TabType, label: 'Settings', icon: Settings },
        ];

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Shield className="w-8 h-8 text-emerald-500" />
              <div>
                <h1 className="text-2xl font-bold text-white">Admin Panel</h1>
                <p className="text-gray-400 text-sm">Complete control over TextShift platform</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={() => {
                  fetchSummary();
                  if (activeTab === 'users') fetchUsers();
                  if (activeTab === 'scans') fetchScans();
                  if (activeTab === 'feedback') fetchFeedback();
                  if (activeTab === 'ml') fetchMlMetrics();
                }}
                className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-gray-800/50 border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex gap-1 overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'text-emerald-400 border-b-2 border-emerald-400'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="max-w-7xl mx-auto px-4 mt-4">
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
            <p className="text-red-400">{error}</p>
            <button onClick={() => setError(null)} className="text-red-300 text-sm underline mt-2">
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Overview Tab */}
        {activeTab === 'overview' && summary && (
          <div className="space-y-6">
            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-400">Total Users</span>
                  <Users className="w-5 h-5 text-blue-500" />
                </div>
                <p className="text-3xl font-bold text-white">{summary.users.total}</p>
                <p className="text-sm text-green-400 mt-1">+{summary.users.this_week} this week</p>
              </div>
              
              <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-400">Total Scans</span>
                  <FileText className="w-5 h-5 text-purple-500" />
                </div>
                <p className="text-3xl font-bold text-white">{summary.scans.total}</p>
                <p className="text-sm text-green-400 mt-1">+{summary.scans.this_week} this week</p>
              </div>
              
              <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-400">Credits Used (Month)</span>
                  <CreditCard className="w-5 h-5 text-emerald-500" />
                </div>
                <p className="text-3xl font-bold text-white">{summary.credits.this_month.toLocaleString()}</p>
                <p className="text-sm text-gray-400 mt-1">{summary.credits.today} today</p>
              </div>
              
              <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-400">Feedback (Week)</span>
                  <MessageSquare className="w-5 h-5 text-yellow-500" />
                </div>
                <p className="text-3xl font-bold text-white">{summary.feedback.this_week}</p>
                <p className="text-sm text-gray-400 mt-1">{summary.feedback.today} today</p>
              </div>
            </div>

            {/* Top Users & Recent Activity */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-emerald-500" />
                  Top Users (This Month)
                </h3>
                <div className="space-y-3">
                  {summary.top_users.map((u, idx) => (
                    <div key={u.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 text-xs flex items-center justify-center">
                          {idx + 1}
                        </span>
                        <div>
                          <p className="text-white text-sm">{u.full_name || u.email}</p>
                          <p className="text-gray-500 text-xs">{u.email}</p>
                        </div>
                      </div>
                      <span className="text-emerald-400 font-medium">{u.scan_count} scans</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <Activity className="w-5 h-5 text-blue-500" />
                  Recent Activity
                </h3>
                <div className="space-y-3">
                  {summary.recent_activity.scans.slice(0, 5).map((scan) => (
                    <div key={scan.id} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-gray-500" />
                        <span className="text-white capitalize">{scan.scan_type.replace('_', ' ')}</span>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-xs ${
                        scan.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                        scan.status === 'failed' ? 'bg-red-500/20 text-red-400' :
                        'bg-yellow-500/20 text-yellow-400'
                      }`}>
                        {scan.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Users Tab */}
        {activeTab === 'users' && (
          <div className="space-y-4">
            {/* Filters */}
            <div className="flex flex-wrap gap-4 items-center">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="text"
                  placeholder="Search users..."
                  value={userSearch}
                  onChange={(e) => { setUserSearch(e.target.value); setUsersPage(1); }}
                  className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500"
                />
              </div>
              <select
                value={userTierFilter}
                onChange={(e) => { setUserTierFilter(e.target.value); setUsersPage(1); }}
                className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-emerald-500"
              >
                <option value="">All Tiers</option>
                <option value="Free">Free</option>
                <option value="Starter">Starter</option>
                <option value="Pro">Pro</option>
                <option value="Enterprise">Enterprise</option>
              </select>
              <button
                onClick={() => exportData('users', 'csv')}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors"
              >
                <Download className="w-4 h-4" />
                Export CSV
              </button>
            </div>

            {/* Users Table */}
            <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-700/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">User</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Tier</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Credits</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Scans</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Status</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {users.map((u) => (
                    <tr key={u.id} className="hover:bg-gray-700/30">
                      <td className="px-4 py-3">
                        <div>
                          <p className="text-white">{u.full_name || 'No name'}</p>
                          <p className="text-gray-500 text-sm">{u.email}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded text-xs ${
                          u.subscription_tier === 'Enterprise' ? 'bg-purple-500/20 text-purple-400' :
                          u.subscription_tier === 'Pro' ? 'bg-blue-500/20 text-blue-400' :
                          u.subscription_tier === 'Starter' ? 'bg-emerald-500/20 text-emerald-400' :
                          'bg-gray-500/20 text-gray-400'
                        }`}>
                          {u.subscription_tier}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-white">
                        {u.credits_balance === -1 ? 'Unlimited' : u.credits_balance.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-white">{u.scan_count}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {u.is_active ? (
                            <span className="w-2 h-2 rounded-full bg-green-500" />
                          ) : (
                            <span className="w-2 h-2 rounded-full bg-red-500" />
                          )}
                          {u.is_admin && (
                            <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-400 text-xs rounded">Admin</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setEditingUser(u)}
                            className="p-1 hover:bg-gray-700 rounded"
                            title="Edit user"
                          >
                            <Edit className="w-4 h-4 text-gray-400" />
                          </button>
                          <button
                            onClick={() => addCredits(u.id, 1000)}
                            className="p-1 hover:bg-gray-700 rounded"
                            title="Add 1000 credits"
                          >
                            <Plus className="w-4 h-4 text-emerald-400" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between">
              <p className="text-gray-400 text-sm">
                Showing {users.length} of {usersTotal} users
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setUsersPage(p => Math.max(1, p - 1))}
                  disabled={usersPage === 1}
                  className="p-2 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 rounded-lg"
                >
                  <ChevronLeft className="w-4 h-4 text-white" />
                </button>
                <span className="text-white px-4">Page {usersPage}</span>
                <button
                  onClick={() => setUsersPage(p => p + 1)}
                  disabled={users.length < 10}
                  className="p-2 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 rounded-lg"
                >
                  <ChevronRight className="w-4 h-4 text-white" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Scans Tab */}
        {activeTab === 'scans' && (
          <div className="space-y-4">
            {/* Filters */}
            <div className="flex flex-wrap gap-4 items-center">
              <select
                value={scanTypeFilter}
                onChange={(e) => { setScanTypeFilter(e.target.value); setScansPage(1); }}
                className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-emerald-500"
              >
                <option value="">All Types</option>
                <option value="ai_detection">AI Detection</option>
                <option value="humanize">Humanize</option>
                <option value="plagiarism">Plagiarism</option>
              </select>
              <button
                onClick={() => exportData('scans', 'csv')}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors"
              >
                <Download className="w-4 h-4" />
                Export CSV
              </button>
            </div>

            {/* Scans Table */}
            <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-700/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">ID</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">User</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Type</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Status</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Result</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Credits</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {scans.map((scan) => (
                    <tr key={scan.id} className="hover:bg-gray-700/30">
                      <td className="px-4 py-3 text-gray-400">#{scan.id}</td>
                      <td className="px-4 py-3 text-white text-sm">{scan.user_email}</td>
                      <td className="px-4 py-3">
                        <span className="capitalize text-white">{scan.scan_type.replace('_', ' ')}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded text-xs ${
                          scan.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                          scan.status === 'failed' ? 'bg-red-500/20 text-red-400' :
                          'bg-yellow-500/20 text-yellow-400'
                        }`}>
                          {scan.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-white">
                        {scan.ai_probability !== null && `${scan.ai_probability.toFixed(1)}% AI`}
                        {scan.plagiarism_score !== null && `${scan.plagiarism_score.toFixed(1)}% match`}
                        {scan.scan_type === 'humanize' && scan.status === 'completed' && 'Humanized'}
                      </td>
                      <td className="px-4 py-3 text-white">{scan.credits_used}</td>
                      <td className="px-4 py-3 text-gray-400 text-sm">
                        {new Date(scan.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between">
              <p className="text-gray-400 text-sm">
                Showing {scans.length} of {scansTotal} scans
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setScansPage(p => Math.max(1, p - 1))}
                  disabled={scansPage === 1}
                  className="p-2 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 rounded-lg"
                >
                  <ChevronLeft className="w-4 h-4 text-white" />
                </button>
                <span className="text-white px-4">Page {scansPage}</span>
                <button
                  onClick={() => setScansPage(p => p + 1)}
                  disabled={scans.length < 10}
                  className="p-2 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 rounded-lg"
                >
                  <ChevronRight className="w-4 h-4 text-white" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Feedback Tab */}
        {activeTab === 'feedback' && (
          <div className="space-y-4">
            <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-700/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">ID</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">User</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Type</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Scan Type</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Correct?</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Training</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Date</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {feedback.map((fb) => (
                    <tr key={fb.id} className="hover:bg-gray-700/30">
                      <td className="px-4 py-3 text-gray-400">#{fb.id}</td>
                      <td className="px-4 py-3 text-white text-sm">{fb.user_email}</td>
                      <td className="px-4 py-3">
                        <span className="capitalize text-white">{fb.feedback_type.replace('_', ' ')}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="capitalize text-white">{fb.scan_type.replace('_', ' ')}</span>
                      </td>
                      <td className="px-4 py-3">
                        {fb.is_correct ? (
                          <CheckCircle className="w-5 h-5 text-green-400" />
                        ) : (
                          <XCircle className="w-5 h-5 text-red-400" />
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {fb.used_in_training ? (
                          <span className="px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded">Used</span>
                        ) : (
                          <span className="px-2 py-1 bg-gray-500/20 text-gray-400 text-xs rounded">Pending</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-sm">
                        {new Date(fb.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => deleteFeedback(fb.id)}
                          className="p-1 hover:bg-gray-700 rounded"
                          title="Delete feedback"
                        >
                          <Trash2 className="w-4 h-4 text-red-400" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between">
              <p className="text-gray-400 text-sm">
                Showing {feedback.length} of {feedbackTotal} feedback entries
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setFeedbackPage(p => Math.max(1, p - 1))}
                  disabled={feedbackPage === 1}
                  className="p-2 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 rounded-lg"
                >
                  <ChevronLeft className="w-4 h-4 text-white" />
                </button>
                <span className="text-white px-4">Page {feedbackPage}</span>
                <button
                  onClick={() => setFeedbackPage(p => p + 1)}
                  disabled={feedback.length < 10}
                  className="p-2 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 rounded-lg"
                >
                  <ChevronRight className="w-4 h-4 text-white" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ML System Tab */}
        {activeTab === 'ml' && mlMetrics && (
          <div className="space-y-6">
            {/* System Health */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
                <div className="flex items-center justify-between">
                  <span className="text-gray-400 text-sm">System Status</span>
                  <div className={`w-3 h-3 rounded-full ${mlMetrics.system_health?.status === 'healthy' ? 'bg-green-500' : 'bg-red-500'}`} />
                </div>
                <p className="text-2xl font-bold text-white mt-2 capitalize">
                  {mlMetrics.system_health?.status || 'Unknown'}
                </p>
              </div>
              
              <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
                <div className="flex items-center justify-between">
                  <span className="text-gray-400 text-sm">Active A/B Tests</span>
                  <Activity className="w-5 h-5 text-blue-500" />
                </div>
                <p className="text-2xl font-bold text-white mt-2">
                  {mlMetrics.active_ab_tests || 0}
                </p>
              </div>
              
              <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
                <div className="flex items-center justify-between">
                  <span className="text-gray-400 text-sm">Feedback (30 days)</span>
                  <Users className="w-5 h-5 text-green-500" />
                </div>
                <p className="text-2xl font-bold text-white mt-2">
                  {mlMetrics.feedback?.total_last_30_days || 0}
                </p>
              </div>
              
              <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
                <div className="flex items-center justify-between">
                  <span className="text-gray-400 text-sm">Ready for Training</span>
                  <Zap className="w-5 h-5 text-yellow-500" />
                </div>
                <p className="text-2xl font-bold text-white mt-2">
                  {mlMetrics.feedback?.ready_for_training || 0}
                </p>
              </div>
            </div>

            {/* Model Cards */}
            <h2 className="text-xl font-semibold text-white flex items-center gap-2">
              <Brain className="w-5 h-5 text-purple-500" />
              Model Performance
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {(['detector', 'humanizer', 'plagiarism'] as const).map((modelType) => {
                const model = mlMetrics.models?.[modelType];
                const displayName = {
                  detector: 'AI Detector',
                  humanizer: 'Humanizer',
                  plagiarism: 'Plagiarism Checker'
                }[modelType];
                
                return (
                  <div key={modelType} className="bg-gray-800 rounded-xl p-6 border border-gray-700">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-white">{displayName}</h3>
                      {model?.ready_for_training && (
                        <span className="px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded-full">
                          Ready to Train
                        </span>
                      )}
                    </div>
                    
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-gray-400">Version</span>
                        <span className="text-white font-medium">
                          {model?.deployed_version || 'v1.0'}
                        </span>
                      </div>
                      
                      <div className="flex justify-between">
                        <span className="text-gray-400">Accuracy</span>
                        <span className="text-white font-medium">
                          {model?.accuracy ? `${model.accuracy.toFixed(2)}%` : 'N/A'}
                        </span>
                      </div>
                      
                      <div className="flex justify-between">
                        <span className="text-gray-400">Samples Ready</span>
                        <span className="text-white font-medium">
                          {model?.samples_ready || 0}
                        </span>
                      </div>
                      
                      <div className="w-full bg-gray-700 rounded-full h-2 mt-2">
                        <div 
                          className="bg-purple-500 h-2 rounded-full transition-all"
                          style={{ width: `${Math.min(100, ((model?.samples_ready || 0) / 100) * 100)}%` }}
                        />
                      </div>
                      <p className="text-xs text-gray-500 text-center">
                        {model?.samples_ready || 0} / 100 samples for training
                      </p>
                    </div>
                    
                    <button
                      onClick={() => triggerTraining(modelType)}
                      disabled={!model?.ready_for_training || triggeringTraining === modelType}
                      className="w-full mt-4 flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg transition-colors"
                    >
                      {triggeringTraining === modelType ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          Training...
                        </>
                      ) : (
                        <>
                          <Play className="w-4 h-4" />
                          Trigger Training
                        </>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Training History */}
            <h2 className="text-xl font-semibold text-white flex items-center gap-2">
              <Clock className="w-5 h-5 text-green-500" />
              Training History
            </h2>
            <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
              {trainingHistory.length === 0 ? (
                <div className="p-8 text-center">
                  <Brain className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-400">No training runs yet</p>
                  <p className="text-gray-500 text-sm mt-1">
                    Training will start automatically when 100+ feedback samples are collected
                  </p>
                </div>
              ) : (
                <table className="w-full">
                  <thead className="bg-gray-700/50">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">ID</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Model</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Status</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Samples</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Accuracy</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-700">
                    {trainingHistory.map((run: any) => (
                      <tr key={run.id} className="hover:bg-gray-700/30">
                        <td className="px-4 py-3 text-gray-400">#{run.id}</td>
                        <td className="px-4 py-3 text-white capitalize">{run.model_type}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded text-xs ${
                            run.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                            run.status === 'failed' ? 'bg-red-500/20 text-red-400' :
                            'bg-yellow-500/20 text-yellow-400'
                          }`}>
                            {run.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-300">{run.training_samples || '-'}</td>
                        <td className="px-4 py-3 text-gray-300">
                          {run.final_accuracy ? `${run.final_accuracy.toFixed(2)}%` : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* Emails Tab */}
        {activeTab === 'emails' && (
          <div className="space-y-6">
            {/* Email Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
                <div className="flex items-center gap-3 mb-2">
                  <Mail className="w-5 h-5 text-blue-500" />
                  <span className="text-gray-400">Total Campaigns</span>
                </div>
                <p className="text-2xl font-bold text-white">{emailStats?.total_campaigns || 0}</p>
              </div>
              <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
                <div className="flex items-center gap-3 mb-2">
                  <Send className="w-5 h-5 text-emerald-500" />
                  <span className="text-gray-400">Emails Sent</span>
                </div>
                <p className="text-2xl font-bold text-white">{emailStats?.total_emails_sent || 0}</p>
              </div>
              <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
                <div className="flex items-center gap-3 mb-2">
                  <Eye className="w-5 h-5 text-purple-500" />
                  <span className="text-gray-400">Open Rate</span>
                </div>
                <p className="text-2xl font-bold text-white">{emailStats?.open_rate || '0%'}</p>
              </div>
              <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
                <div className="flex items-center gap-3 mb-2">
                  <TrendingUp className="w-5 h-5 text-yellow-500" />
                  <span className="text-gray-400">Click Rate</span>
                </div>
                <p className="text-2xl font-bold text-white">{emailStats?.click_rate || '0%'}</p>
              </div>
            </div>

            {/* Send Test Email Section */}
            <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Send className="w-5 h-5 text-emerald-500" />
                Send Test Email
              </h3>
              <p className="text-gray-400 text-sm mb-4">
                Test any email type by sending it to a specific address. Great for previewing templates before campaigns.
              </p>
              
              {emailMessage && (
                <div className={`mb-4 p-3 rounded-lg ${
                  emailMessage.type === 'success' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
                }`}>
                  {emailMessage.text}
                </div>
              )}
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-gray-400 text-sm block mb-2">Email Type</label>
                  <select
                    value={testEmailType}
                    onChange={(e) => setTestEmailType(e.target.value)}
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                  >
                    <optgroup label="Notification Emails">
                      <option value="scan_complete">Scan Complete</option>
                      <option value="low_credits">Low Credits Warning</option>
                      <option value="weekly_summary">Weekly Summary</option>
                      <option value="subscription_expiring">Subscription Expiring</option>
                      <option value="password_changed">Password Changed</option>
                    </optgroup>
                    <optgroup label="Marketing Emails">
                      <option value="new_feature">New Feature Announcement</option>
                      <option value="promotional">Promotional Offer</option>
                      <option value="tips_tricks">Tips & Tricks</option>
                      <option value="product_update">Product Update</option>
                    </optgroup>
                  </select>
                </div>
                <div>
                  <label className="text-gray-400 text-sm block mb-2">Send To (leave empty for your email)</label>
                  <input
                    type="email"
                    value={testEmailAddress}
                    onChange={(e) => setTestEmailAddress(e.target.value)}
                    placeholder={user?.email || 'your@email.com'}
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                  />
                </div>
                <div className="flex items-end">
                  <button
                    onClick={sendTestEmail}
                    disabled={sendingTestEmail}
                    className="w-full px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-600 text-white rounded-lg flex items-center justify-center gap-2"
                  >
                    {sendingTestEmail ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        Send Test Email
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Email Types Reference */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Notification Emails */}
              <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-yellow-500" />
                  Notification Emails
                </h3>
                <p className="text-gray-400 text-sm mb-4">
                  Sent to users with email notifications enabled
                </p>
                <div className="space-y-3">
                  {emailTypes?.notification_types?.map((type: any) => (
                    <div key={type.type} className="bg-gray-700/50 rounded-lg p-3">
                      <p className="text-white font-medium">{type.name}</p>
                      <p className="text-gray-400 text-sm">{type.description}</p>
                    </div>
                  )) || (
                    <>
                      <div className="bg-gray-700/50 rounded-lg p-3">
                        <p className="text-white font-medium">Scan Complete</p>
                        <p className="text-gray-400 text-sm">Sent when a scan finishes</p>
                      </div>
                      <div className="bg-gray-700/50 rounded-lg p-3">
                        <p className="text-white font-medium">Low Credits Warning</p>
                        <p className="text-gray-400 text-sm">Sent when credits drop below 1,000</p>
                      </div>
                      <div className="bg-gray-700/50 rounded-lg p-3">
                        <p className="text-white font-medium">Weekly Summary</p>
                        <p className="text-gray-400 text-sm">Weekly usage digest</p>
                      </div>
                      <div className="bg-gray-700/50 rounded-lg p-3">
                        <p className="text-white font-medium">Subscription Expiring</p>
                        <p className="text-gray-400 text-sm">7 days before subscription ends</p>
                      </div>
                      <div className="bg-gray-700/50 rounded-lg p-3">
                        <p className="text-white font-medium">Password Changed</p>
                        <p className="text-gray-400 text-sm">Security notification</p>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Marketing Emails */}
              <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <Gift className="w-5 h-5 text-pink-500" />
                  Marketing Emails
                </h3>
                <p className="text-gray-400 text-sm mb-4">
                  Sent to users with marketing emails enabled
                </p>
                <div className="space-y-3">
                  {emailTypes?.marketing_types?.map((type: any) => (
                    <div key={type.type} className="bg-gray-700/50 rounded-lg p-3">
                      <p className="text-white font-medium">{type.name}</p>
                      <p className="text-gray-400 text-sm">{type.description}</p>
                    </div>
                  )) || (
                    <>
                      <div className="bg-gray-700/50 rounded-lg p-3">
                        <p className="text-white font-medium">New Feature</p>
                        <p className="text-gray-400 text-sm">Announce new features</p>
                      </div>
                      <div className="bg-gray-700/50 rounded-lg p-3">
                        <p className="text-white font-medium">Promotional</p>
                        <p className="text-gray-400 text-sm">Special offers and discounts</p>
                      </div>
                      <div className="bg-gray-700/50 rounded-lg p-3">
                        <p className="text-white font-medium">Tips & Tricks</p>
                        <p className="text-gray-400 text-sm">Best practices and tips</p>
                      </div>
                      <div className="bg-gray-700/50 rounded-lg p-3">
                        <p className="text-white font-medium">Product Update</p>
                        <p className="text-gray-400 text-sm">Platform improvements</p>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Recent Campaigns */}
            <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-500" />
                Recent Campaigns
              </h3>
              {campaigns.length === 0 ? (
                <div className="text-center py-8">
                  <Mail className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-400">No campaigns yet</p>
                  <p className="text-gray-500 text-sm">Use the test email feature above to preview email templates</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="text-left text-gray-400 text-sm border-b border-gray-700">
                        <th className="pb-3 font-medium">Campaign</th>
                        <th className="pb-3 font-medium">Type</th>
                        <th className="pb-3 font-medium">Status</th>
                        <th className="pb-3 font-medium">Sent</th>
                        <th className="pb-3 font-medium">Opens</th>
                        <th className="pb-3 font-medium">Clicks</th>
                      </tr>
                    </thead>
                    <tbody>
                      {campaigns.map((campaign: any) => (
                        <tr key={campaign.id} className="border-b border-gray-700/50">
                          <td className="py-3">
                            <p className="text-white font-medium">{campaign.name}</p>
                            <p className="text-gray-400 text-sm">{campaign.subject}</p>
                          </td>
                          <td className="py-3">
                            <span className="px-2 py-1 bg-gray-700 rounded text-xs text-gray-300">
                              {campaign.email_type}
                            </span>
                          </td>
                          <td className="py-3">
                            <span className={`px-2 py-1 rounded text-xs ${
                              campaign.status === 'sent' ? 'bg-emerald-500/20 text-emerald-400' :
                              campaign.status === 'draft' ? 'bg-gray-500/20 text-gray-400' :
                              campaign.status === 'scheduled' ? 'bg-blue-500/20 text-blue-400' :
                              'bg-yellow-500/20 text-yellow-400'
                            }`}>
                              {campaign.status}
                            </span>
                          </td>
                          <td className="py-3 text-gray-300">{campaign.emails_sent}</td>
                          <td className="py-3 text-gray-300">{campaign.emails_opened}</td>
                          <td className="py-3 text-gray-300">{campaign.emails_clicked}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Writing Tools Tab */}
        {activeTab === 'writing-tools' && (
          <div className="space-y-6">
            <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Wand2 className="w-5 h-5 text-cyan-500" />
                Writing Tools Overview
              </h3>
              <p className="text-gray-400 mb-6">
                14 writing tools are available across different subscription tiers. Monitor usage and performance here.
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                {[
                  { name: 'Grammar Checker', tier: 'Free', icon: '✓', color: 'emerald' },
                  { name: 'Tone Detector', tier: 'Free', icon: '🎭', color: 'blue' },
                  { name: 'Tone Adjuster', tier: 'Starter', icon: '🎨', color: 'purple' },
                  { name: 'Readability Score', tier: 'Free', icon: '📖', color: 'amber' },
                  { name: 'Summarizer', tier: 'Free', icon: '📝', color: 'cyan' },
                  { name: 'Paraphraser', tier: 'Free', icon: '✏️', color: 'pink' },
                  { name: 'Citation Generator', tier: 'Starter', icon: '📚', color: 'indigo' },
                  { name: 'Word Counter', tier: 'Free', icon: '🔢', color: 'gray' },
                  { name: 'Translator', tier: 'Free', icon: '🌐', color: 'teal' },
                  { name: 'Export Options', tier: 'Free', icon: '📤', color: 'orange' },
                  { name: 'Bulk Processing', tier: 'Pro', icon: '📦', color: 'red' },
                  { name: 'API Access', tier: 'Pro', icon: '🔌', color: 'violet' },
                  { name: 'Style Analysis', tier: 'Starter', icon: '🎯', color: 'lime' },
                  { name: 'Content Improver', tier: 'Starter', icon: '💡', color: 'yellow' },
                ].map((tool, i) => (
                  <div key={i} className="bg-gray-700/50 rounded-lg p-4 border border-gray-600">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-2xl">{tool.icon}</span>
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        tool.tier === 'Free' ? 'bg-emerald-500/20 text-emerald-400' :
                        tool.tier === 'Starter' ? 'bg-purple-500/20 text-purple-400' :
                        'bg-orange-500/20 text-orange-400'
                      }`}>
                        {tool.tier}
                      </span>
                    </div>
                    <h4 className="text-white font-medium text-sm">{tool.name}</h4>
                  </div>
                ))}
              </div>

              <div className="bg-gray-700/30 rounded-lg p-4 border border-gray-600">
                <h4 className="text-white font-medium mb-3">Tier Feature Limits</h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-gray-400 border-b border-gray-600">
                        <th className="text-left py-2">Feature</th>
                        <th className="text-center py-2">Free</th>
                        <th className="text-center py-2">Starter</th>
                        <th className="text-center py-2">Pro</th>
                        <th className="text-center py-2">Enterprise</th>
                      </tr>
                    </thead>
                    <tbody className="text-gray-300">
                      <tr className="border-b border-gray-700">
                        <td className="py-2">Grammar Checker</td>
                        <td className="text-center">500/day</td>
                        <td className="text-center">5,000/day</td>
                        <td className="text-center">Unlimited</td>
                        <td className="text-center">Unlimited</td>
                      </tr>
                      <tr className="border-b border-gray-700">
                        <td className="py-2">Tone Detector</td>
                        <td className="text-center">500/day</td>
                        <td className="text-center">Unlimited</td>
                        <td className="text-center">Unlimited</td>
                        <td className="text-center">Unlimited</td>
                      </tr>
                      <tr className="border-b border-gray-700">
                        <td className="py-2">Summarizer</td>
                        <td className="text-center">500 words</td>
                        <td className="text-center">5,000 words</td>
                        <td className="text-center">Unlimited</td>
                        <td className="text-center">Unlimited</td>
                      </tr>
                      <tr className="border-b border-gray-700">
                        <td className="py-2">Translator</td>
                        <td className="text-center">500/day</td>
                        <td className="text-center">5,000/day</td>
                        <td className="text-center">Unlimited</td>
                        <td className="text-center">Unlimited</td>
                      </tr>
                      <tr className="border-b border-gray-700">
                        <td className="py-2">Bulk Processing</td>
                        <td className="text-center text-red-400">-</td>
                        <td className="text-center text-red-400">-</td>
                        <td className="text-center">10 files</td>
                        <td className="text-center">50 files</td>
                      </tr>
                      <tr>
                        <td className="py-2">API Access</td>
                        <td className="text-center text-red-400">-</td>
                        <td className="text-center text-red-400">-</td>
                        <td className="text-center text-emerald-400">Yes</td>
                        <td className="text-center text-emerald-400">Full</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Settings Tab */}
        {activeTab === 'settings' && settings && (
          <div className="space-y-6">
            <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Shield className="w-5 h-5 text-orange-500" />
                Site Settings
              </h3>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white font-medium">Cookie Consent Banner (Termly)</p>
                  <p className="text-gray-400 text-sm">Show/hide the Termly cookie consent banner on the site</p>
                </div>
                <button
                  onClick={() => toggleCookieConsent(!cookieConsentEnabled)}
                  disabled={siteSettingsLoading}
                  className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors ${
                    cookieConsentEnabled ? 'bg-emerald-500' : 'bg-gray-600'
                  } ${siteSettingsLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                      cookieConsentEnabled ? 'translate-x-8' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
              <p className="mt-2 text-xs text-gray-500">
                Status: {cookieConsentEnabled ? 'Enabled' : 'Disabled'}
                {siteSettingsLoading && ' (Saving...)'}
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Rate Limits */}
              <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <Shield className="w-5 h-5 text-blue-500" />
                  Rate Limits
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="text-gray-400 text-sm">Feedback per hour</label>
                    <p className="text-white text-xl font-medium">{settings.rate_limits?.feedback_per_hour || 10}</p>
                  </div>
                  <div>
                    <label className="text-gray-400 text-sm">Scans per minute</label>
                    <p className="text-white text-xl font-medium">{settings.rate_limits?.scans_per_minute || 5}</p>
                  </div>
                </div>
              </div>

              {/* Training Settings */}
              <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <Brain className="w-5 h-5 text-purple-500" />
                  Training Settings
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="text-gray-400 text-sm">Minimum samples</label>
                    <p className="text-white text-xl font-medium">{settings.training?.min_samples || 100}</p>
                  </div>
                  <div>
                    <label className="text-gray-400 text-sm">Auto training</label>
                    <p className="text-white text-xl font-medium">
                      {settings.training?.auto_training_enabled ? 'Enabled' : 'Disabled'}
                    </p>
                  </div>
                  <div>
                    <label className="text-gray-400 text-sm">Training schedule</label>
                    <p className="text-white text-xl font-medium capitalize">
                      {settings.training?.training_day || 'Sunday'} at {settings.training?.training_hour || 3}:00 UTC
                    </p>
                  </div>
                </div>
              </div>

              {/* A/B Testing Settings */}
              <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <Activity className="w-5 h-5 text-emerald-500" />
                  A/B Testing
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="text-gray-400 text-sm">Test percentage</label>
                    <p className="text-white text-xl font-medium">{settings.ab_testing?.test_percentage || 20}%</p>
                  </div>
                  <div>
                    <label className="text-gray-400 text-sm">Min test duration</label>
                    <p className="text-white text-xl font-medium">{settings.ab_testing?.min_test_duration_days || 7} days</p>
                  </div>
                  <div>
                    <label className="text-gray-400 text-sm">Auto-rollback threshold</label>
                    <p className="text-white text-xl font-medium">{(settings.ab_testing?.auto_rollback_threshold || 0.05) * 100}%</p>
                  </div>
                </div>
              </div>

              {/* Credits Settings */}
              <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-yellow-500" />
                  Credits Configuration
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="text-gray-400 text-sm">Free tier monthly</label>
                    <p className="text-white text-xl font-medium">{settings.credits?.free_tier_monthly?.toLocaleString() || '5,000'}</p>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="text-gray-400 text-xs">AI Detection</label>
                      <p className="text-white font-medium">{settings.credits?.ai_detection_cost || 1}x</p>
                    </div>
                    <div>
                      <label className="text-gray-400 text-xs">Humanize</label>
                      <p className="text-white font-medium">{settings.credits?.humanize_cost || 2}x</p>
                    </div>
                    <div>
                      <label className="text-gray-400 text-xs">Plagiarism</label>
                      <p className="text-white font-medium">{settings.credits?.plagiarism_cost || 1.5}x</p>
                    </div>
                  </div>
                </div>
              </div>
                  </div>
                </div>
              )}

              {/* Promos Tab */}
              {activeTab === 'promos' && (
                <div className="space-y-6">
                  {/* Header */}
                  <div className="flex items-center justify-between">
                    <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                      <Gift className="w-5 h-5 text-pink-500" />
                      Promo Management
                    </h2>
                    <button
                      onClick={() => setCreatingPromo(true)}
                      className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      Create Promo
                    </button>
                  </div>

                  {/* Promos List */}
                  {promosLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <RefreshCw className="w-8 h-8 text-emerald-500 animate-spin" />
                    </div>
                  ) : promos.length === 0 ? (
                    <div className="bg-gray-800 rounded-xl p-12 border border-gray-700 text-center">
                      <Gift className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                      <h3 className="text-xl font-semibold text-white mb-2">No Promos Yet</h3>
                      <p className="text-gray-400 mb-4">Create your first promo to attract users</p>
                      <button
                        onClick={() => setCreatingPromo(true)}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg"
                      >
                        Create Promo
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {promos.map((promo) => {
                        const isExpired = promo.end_date && new Date(promo.end_date) < new Date();
                        const daysLeft = promo.end_date 
                          ? Math.ceil((new Date(promo.end_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                          : null;
                  
                        return (
                          <div key={promo.id} className={`bg-gray-800 rounded-xl p-6 border ${isExpired ? 'border-red-500/30' : promo.is_active ? 'border-emerald-500/30' : 'border-gray-700'}`}>
                            <div className="flex items-start justify-between mb-4">
                              <div>
                                <div className="flex items-center gap-2">
                                  <h3 className="text-lg font-semibold text-white">{promo.title}</h3>
                                  {promo.show_on_landing && (
                                    <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 text-xs rounded-full">Landing</span>
                                  )}
                                </div>
                                <code className="text-emerald-400 text-sm bg-emerald-500/10 px-2 py-0.5 rounded mt-1 inline-block">
                                  {promo.code}
                                </code>
                              </div>
                              <div className={`px-2 py-1 rounded-full text-xs ${
                                isExpired ? 'bg-red-500/20 text-red-400' :
                                promo.is_active ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'
                              }`}>
                                {isExpired ? 'Expired' : promo.is_active ? 'Active' : 'Inactive'}
                              </div>
                            </div>
                      
                            <p className="text-gray-400 text-sm mb-4 line-clamp-2">{promo.description}</p>
                      
                            <div className="space-y-2 text-sm">
                              <div className="flex justify-between">
                                <span className="text-gray-500">Type</span>
                                <span className="text-white capitalize">{promo.promo_type.replace('_', ' ')}</span>
                              </div>
                              {promo.plan_tier && (
                                <div className="flex justify-between">
                                  <span className="text-gray-500">Plan</span>
                                  <span className="text-white capitalize">{promo.plan_tier}</span>
                                </div>
                              )}
                              <div className="flex justify-between">
                                <span className="text-gray-500">Duration</span>
                                <span className="text-white">{promo.duration_days} days</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-500">Redemptions</span>
                                <span className="text-white">
                                  {promo.current_redemptions}{promo.max_redemptions ? ` / ${promo.max_redemptions}` : ''}
                                </span>
                              </div>
                              {daysLeft !== null && daysLeft > 0 && (
                                <div className="flex justify-between">
                                  <span className="text-gray-500">Expires in</span>
                                  <span className={`${daysLeft <= 7 ? 'text-yellow-400' : 'text-white'}`}>
                                    {daysLeft} days
                                  </span>
                                </div>
                              )}
                            </div>
                      
                            <div className="flex gap-2 mt-4 pt-4 border-t border-gray-700">
                              <button
                                onClick={() => setEditingPromo(promo)}
                                className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded-lg"
                              >
                                <Edit className="w-3 h-3" />
                                Edit
                              </button>
                              <button
                                onClick={() => fetchRedemptions(promo.id)}
                                className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded-lg"
                              >
                                <Users className="w-3 h-3" />
                                Users
                              </button>
                              <button
                                onClick={() => deletePromo(promo.id)}
                                className="px-3 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 text-sm rounded-lg"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Create Promo Modal */}
            {creatingPromo && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 overflow-y-auto py-8">
                <div className="bg-gray-800 rounded-xl p-6 w-full max-w-2xl border border-gray-700 mx-4">
                  <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                    <Gift className="w-5 h-5 text-pink-500" />
                    Create New Promo
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-gray-400 text-sm block mb-1">Promo Code *</label>
                      <input
                        type="text"
                        value={newPromo.code}
                        onChange={(e) => setNewPromo({ ...newPromo, code: e.target.value.toUpperCase() })}
                        placeholder="STARTER1MONTH"
                        className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white uppercase"
                      />
                    </div>
                    <div>
                      <label className="text-gray-400 text-sm block mb-1">Title *</label>
                      <input
                        type="text"
                        value={newPromo.title}
                        onChange={(e) => setNewPromo({ ...newPromo, title: e.target.value })}
                        placeholder="1 Month Free Starter Plan"
                        className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="text-gray-400 text-sm block mb-1">Description</label>
                      <textarea
                        value={newPromo.description}
                        onChange={(e) => setNewPromo({ ...newPromo, description: e.target.value })}
                        placeholder="Get a free month of our Starter plan..."
                        rows={2}
                        className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                      />
                    </div>
                    <div>
                      <label className="text-gray-400 text-sm block mb-1">Promo Type</label>
                      <select
                        value={newPromo.promo_type}
                        onChange={(e) => setNewPromo({ ...newPromo, promo_type: e.target.value })}
                        className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                      >
                        <option value="free_plan">Free Plan</option>
                        <option value="percentage">Percentage Discount</option>
                        <option value="fixed_credits">Fixed Credits</option>
                        <option value="trial_extension">Trial Extension</option>
                      </select>
                    </div>
                    {newPromo.promo_type === 'free_plan' && (
                      <div>
                        <label className="text-gray-400 text-sm block mb-1">Plan Tier</label>
                        <select
                          value={newPromo.plan_tier}
                          onChange={(e) => setNewPromo({ ...newPromo, plan_tier: e.target.value })}
                          className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                        >
                          <option value="Starter">Starter</option>
                          <option value="Pro">Pro</option>
                          <option value="Enterprise">Enterprise</option>
                        </select>
                      </div>
                    )}
                    {newPromo.promo_type === 'percentage' && (
                      <div>
                        <label className="text-gray-400 text-sm block mb-1">Discount %</label>
                        <input
                          type="number"
                          value={newPromo.discount_percentage}
                          onChange={(e) => setNewPromo({ ...newPromo, discount_percentage: parseInt(e.target.value) || 0 })}
                          min={1}
                          max={100}
                          className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                        />
                      </div>
                    )}
                    {newPromo.promo_type === 'fixed_credits' && (
                      <div>
                        <label className="text-gray-400 text-sm block mb-1">Credits Amount</label>
                        <input
                          type="number"
                          value={newPromo.credits_amount}
                          onChange={(e) => setNewPromo({ ...newPromo, credits_amount: parseInt(e.target.value) || 0 })}
                          min={1}
                          className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                        />
                      </div>
                    )}
                    <div>
                      <label className="text-gray-400 text-sm block mb-1">Duration (days)</label>
                      <input
                        type="number"
                        value={newPromo.duration_days}
                        onChange={(e) => setNewPromo({ ...newPromo, duration_days: parseInt(e.target.value) || 30 })}
                        min={1}
                        className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                      />
                    </div>
                    <div>
                      <label className="text-gray-400 text-sm block mb-1">Expiry Date (optional)</label>
                      <input
                        type="date"
                        value={newPromo.end_date}
                        onChange={(e) => setNewPromo({ ...newPromo, end_date: e.target.value })}
                        className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                      />
                    </div>
                    <div>
                      <label className="text-gray-400 text-sm block mb-1">Max Redemptions (0 = unlimited)</label>
                      <input
                        type="number"
                        value={newPromo.max_redemptions}
                        onChange={(e) => setNewPromo({ ...newPromo, max_redemptions: parseInt(e.target.value) || 0 })}
                        min={0}
                        className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                      />
                    </div>
              
                    <div className="md:col-span-2 border-t border-gray-700 pt-4 mt-2">
                      <h4 className="text-white font-medium mb-3">Landing Page Settings</h4>
                      <div className="flex items-center gap-4 mb-4">
                        <label className="flex items-center gap-2 text-white">
                          <input
                            type="checkbox"
                            checked={newPromo.is_active}
                            onChange={(e) => setNewPromo({ ...newPromo, is_active: e.target.checked })}
                            className="rounded"
                          />
                          Active
                        </label>
                        <label className="flex items-center gap-2 text-white">
                          <input
                            type="checkbox"
                            checked={newPromo.show_on_landing}
                            onChange={(e) => setNewPromo({ ...newPromo, show_on_landing: e.target.checked })}
                            className="rounded"
                          />
                          Show on Landing Page
                        </label>
                      </div>
                      {newPromo.show_on_landing && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="text-gray-400 text-sm block mb-1">Headline</label>
                            <input
                              type="text"
                              value={newPromo.landing_headline}
                              onChange={(e) => setNewPromo({ ...newPromo, landing_headline: e.target.value })}
                              placeholder="Limited Time Offer!"
                              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                            />
                          </div>
                          <div>
                            <label className="text-gray-400 text-sm block mb-1">Badge Text</label>
                            <input
                              type="text"
                              value={newPromo.landing_badge_text}
                              onChange={(e) => setNewPromo({ ...newPromo, landing_badge_text: e.target.value })}
                              placeholder="Limited Time"
                              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                            />
                          </div>
                          <div className="md:col-span-2">
                            <label className="text-gray-400 text-sm block mb-1">Subtext</label>
                            <input
                              type="text"
                              value={newPromo.landing_subtext}
                              onChange={(e) => setNewPromo({ ...newPromo, landing_subtext: e.target.value })}
                              placeholder="Sign up now and get 1 month free!"
                              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                            />
                          </div>
                          <div>
                            <label className="text-gray-400 text-sm block mb-1">Button Text</label>
                            <input
                              type="text"
                              value={newPromo.landing_button_text}
                              onChange={(e) => setNewPromo({ ...newPromo, landing_button_text: e.target.value })}
                              placeholder="Claim Now"
                              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex justify-end gap-3 mt-6">
                    <button
                      onClick={() => setCreatingPromo(false)}
                      className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={createPromo}
                      disabled={!newPromo.code || !newPromo.title}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg"
                    >
                      Create Promo
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Edit Promo Modal */}
            {editingPromo && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 overflow-y-auto py-8">
                <div className="bg-gray-800 rounded-xl p-6 w-full max-w-md border border-gray-700 mx-4">
                  <h3 className="text-xl font-semibold text-white mb-4">Edit Promo</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="text-gray-400 text-sm block mb-1">Title</label>
                      <input
                        type="text"
                        value={editingPromo.title}
                        onChange={(e) => setEditingPromo({ ...editingPromo, title: e.target.value })}
                        className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                      />
                    </div>
                    <div>
                      <label className="text-gray-400 text-sm block mb-1">Description</label>
                      <textarea
                        value={editingPromo.description}
                        onChange={(e) => setEditingPromo({ ...editingPromo, description: e.target.value })}
                        rows={2}
                        className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                      />
                    </div>
                    <div className="flex items-center gap-4">
                      <label className="flex items-center gap-2 text-white">
                        <input
                          type="checkbox"
                          checked={editingPromo.is_active}
                          onChange={(e) => setEditingPromo({ ...editingPromo, is_active: e.target.checked })}
                          className="rounded"
                        />
                        Active
                      </label>
                      <label className="flex items-center gap-2 text-white">
                        <input
                          type="checkbox"
                          checked={editingPromo.show_on_landing}
                          onChange={(e) => setEditingPromo({ ...editingPromo, show_on_landing: e.target.checked })}
                          className="rounded"
                        />
                        Show on Landing
                      </label>
                    </div>
                    {editingPromo.show_on_landing && (
                      <>
                        <div>
                          <label className="text-gray-400 text-sm block mb-1">Landing Headline</label>
                          <input
                            type="text"
                            value={editingPromo.landing_headline || ''}
                            onChange={(e) => setEditingPromo({ ...editingPromo, landing_headline: e.target.value })}
                            className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                          />
                        </div>
                        <div>
                          <label className="text-gray-400 text-sm block mb-1">Landing Subtext</label>
                          <input
                            type="text"
                            value={editingPromo.landing_subtext || ''}
                            onChange={(e) => setEditingPromo({ ...editingPromo, landing_subtext: e.target.value })}
                            className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                          />
                        </div>
                      </>
                    )}
                  </div>
                  <div className="flex justify-end gap-3 mt-6">
                    <button
                      onClick={() => setEditingPromo(null)}
                      className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => updatePromo(editingPromo.id, {
                        title: editingPromo.title,
                        description: editingPromo.description,
                        is_active: editingPromo.is_active,
                        show_on_landing: editingPromo.show_on_landing,
                        landing_headline: editingPromo.landing_headline,
                        landing_subtext: editingPromo.landing_subtext
                      })}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg"
                    >
                      Save Changes
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Redemptions Modal */}
            {viewingRedemptions && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                <div className="bg-gray-800 rounded-xl p-6 w-full max-w-lg border border-gray-700 mx-4">
                  <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                    <Users className="w-5 h-5 text-blue-500" />
                    Promo Redemptions
                  </h3>
                  {redemptions.length === 0 ? (
                    <p className="text-gray-400 text-center py-8">No redemptions yet</p>
                  ) : (
                    <div className="max-h-96 overflow-y-auto space-y-2">
                      {redemptions.map((r) => (
                        <div key={r.id} className="bg-gray-700/50 rounded-lg p-3 flex items-center justify-between">
                          <div>
                            <p className="text-white">{r.user_email}</p>
                            <p className="text-gray-400 text-xs">
                              {new Date(r.redeemed_at).toLocaleString()}
                            </p>
                          </div>
                          {r.ip_address && (
                            <span className="text-gray-500 text-xs">{r.ip_address}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex justify-end mt-6">
                    <button
                      onClick={() => {
                        setViewingRedemptions(null);
                        setRedemptions([]);
                      }}
                      className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg"
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Edit User Modal */}
            {editingUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-xl p-6 w-full max-w-md border border-gray-700">
            <h3 className="text-xl font-semibold text-white mb-4">Edit User</h3>
            <div className="space-y-4">
              <div>
                <label className="text-gray-400 text-sm">Email</label>
                <p className="text-white">{editingUser.email}</p>
              </div>
              <div>
                <label className="text-gray-400 text-sm block mb-1">Full Name</label>
                <input
                  type="text"
                  value={editingUser.full_name || ''}
                  onChange={(e) => setEditingUser({ ...editingUser, full_name: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                />
              </div>
              <div>
                <label className="text-gray-400 text-sm block mb-1">Subscription Tier</label>
                <select
                  value={editingUser.subscription_tier}
                  onChange={(e) => setEditingUser({ ...editingUser, subscription_tier: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                >
                  <option value="Free">Free</option>
                  <option value="Starter">Starter</option>
                  <option value="Pro">Pro</option>
                  <option value="Enterprise">Enterprise</option>
                </select>
              </div>
              <div>
                <label className="text-gray-400 text-sm block mb-1">Credits Balance</label>
                <input
                  type="number"
                  value={editingUser.credits_balance}
                  onChange={(e) => setEditingUser({ ...editingUser, credits_balance: parseInt(e.target.value) || 0 })}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                />
                <p className="text-gray-500 text-xs mt-1">Use -1 for unlimited credits</p>
              </div>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-white">
                  <input
                    type="checkbox"
                    checked={editingUser.is_active}
                    onChange={(e) => setEditingUser({ ...editingUser, is_active: e.target.checked })}
                    className="rounded"
                  />
                  Active
                </label>
                <label className="flex items-center gap-2 text-white">
                  <input
                    type="checkbox"
                    checked={editingUser.is_verified}
                    onChange={(e) => setEditingUser({ ...editingUser, is_verified: e.target.checked })}
                    className="rounded"
                  />
                  Verified
                </label>
                <label className="flex items-center gap-2 text-white">
                  <input
                    type="checkbox"
                    checked={editingUser.is_admin}
                    onChange={(e) => setEditingUser({ ...editingUser, is_admin: e.target.checked })}
                    className="rounded"
                  />
                  Admin
                </label>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setEditingUser(null)}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={() => updateUser(editingUser.id, {
                  full_name: editingUser.full_name,
                  subscription_tier: editingUser.subscription_tier,
                  credits_balance: editingUser.credits_balance,
                  is_active: editingUser.is_active,
                  is_verified: editingUser.is_verified,
                  is_admin: editingUser.is_admin
                })}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
