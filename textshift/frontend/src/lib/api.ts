import axios, { AxiosRequestConfig } from 'axios';

// In production, use empty string for same-origin requests (nginx proxies /api/ to backend)
// In development, use localhost:8000
const API_URL = import.meta.env.VITE_API_URL ?? (import.meta.env.PROD ? '' : 'http://localhost:8000');

// Request deduplication cache for identical concurrent requests
const pendingRequests = new Map<string, Promise<unknown>>();

// Simple in-memory cache for GET requests (Speed Optimization #30)
const responseCache = new Map<string, { data: unknown; timestamp: number }>();
const CACHE_TTL = 30000; // 30 seconds

const getCacheKey = (config: AxiosRequestConfig): string => {
  return `${config.method}-${config.url}-${JSON.stringify(config.params || {})}`;
};

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
    'Accept-Encoding': 'gzip, deflate, br', // Speed Optimization #50 - Request compression
  },
  timeout: 30000, // Speed Optimization #12 - Request timeouts
});

// Add auth token to requests and implement request deduplication
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  
  // Check cache for GET requests (Speed Optimization #30)
  if (config.method === 'get') {
    const cacheKey = getCacheKey(config);
    const cached = responseCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      config.adapter = () => Promise.resolve({
        data: cached.data,
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
      });
    }
  }
  
  return config;
});

// Cache successful GET responses
api.interceptors.response.use((response) => {
  if (response.config.method === 'get' && response.status === 200) {
    const cacheKey = getCacheKey(response.config);
    responseCache.set(cacheKey, { data: response.data, timestamp: Date.now() });
  }
  return response;
});

// Helper to deduplicate identical concurrent requests (Speed Optimization #35)
export const deduplicatedRequest = async <T>(key: string, requestFn: () => Promise<T>): Promise<T> => {
  if (pendingRequests.has(key)) {
    return pendingRequests.get(key) as Promise<T>;
  }
  
  const promise = requestFn().finally(() => {
    pendingRequests.delete(key);
  });
  
  pendingRequests.set(key, promise);
  return promise;
};

// Clear cache utility (for logout, etc.)
export const clearApiCache = () => {
  responseCache.clear();
  pendingRequests.clear();
};

// Auth API
export const authApi = {
  register: async (email: string, password: string, fullName?: string) => {
    const response = await api.post('/api/auth/register', {
      email,
      password,
      full_name: fullName,
    });
    return response.data;
  },

  login: async (email: string, password: string) => {
    const formData = new URLSearchParams();
    formData.append('username', email);
    formData.append('password', password);
    
    const response = await api.post('/api/auth/login', formData, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });
    return response.data;
  },

  getMe: async () => {
    const response = await api.get('/api/auth/me');
    return response.data;
  },

  changePassword: async (currentPassword: string, newPassword: string) => {
    const response = await api.post('/api/auth/change-password', {
      current_password: currentPassword,
      new_password: newPassword,
    });
    return response.data;
  },

  forgotPassword: async (email: string) => {
    const response = await api.post('/api/auth/forgot-password', { email });
    return response.data;
  },

  resetPassword: async (token: string, newPassword: string) => {
    const response = await api.post('/api/auth/reset-password', {
      token,
      new_password: newPassword,
    });
    return response.data;
  },

  verifyEmail: async (token: string) => {
    const response = await api.post('/api/auth/verify-email', { token });
    return response.data;
  },

  resendVerification: async (email: string) => {
    const response = await api.post('/api/auth/resend-verification', { email });
    return response.data;
  },
};

// 5 minute timeout for all scan/processing endpoints (ML operations can take time)
const SCAN_TIMEOUT = 300000;

// Scan API
export const scanApi = {
  detectAI: async (text: string) => {
    const response = await api.post('/api/scan/detect', {
      text,
      scan_type: 'ai_detection',
    }, {
      timeout: SCAN_TIMEOUT,
    });
    return response.data;
  },

  humanize: async (text: string) => {
    const response = await api.post('/api/scan/humanize', {
      text,
      scan_type: 'humanize',
    }, {
      timeout: SCAN_TIMEOUT,
    });
    return response.data;
  },

  checkPlagiarism: async (text: string) => {
    const response = await api.post('/api/scan/plagiarism', {
      text,
      scan_type: 'plagiarism',
    }, {
      timeout: SCAN_TIMEOUT,
    });
    return response.data;
  },

  getHistory: async (page = 1, perPage = 20, scanType?: string) => {
    const params = new URLSearchParams({
      page: page.toString(),
      per_page: perPage.toString(),
    });
    if (scanType) {
      params.append('scan_type', scanType);
    }
    const response = await api.get(`/api/scan/history?${params}`);
    return response.data;
  },

  getScan: async (scanId: number) => {
    const response = await api.get(`/api/scan/${scanId}`);
    return response.data;
  },
};

// Credits API
export const creditsApi = {
  getBalance: async () => {
    const response = await api.get('/api/credits/balance');
    return response.data;
  },

  getTransactions: async (page = 1, perPage = 20) => {
    const response = await api.get(`/api/credits/transactions?page=${page}&per_page=${perPage}`);
    return response.data;
  },

  getUsageStats: async () => {
    const response = await api.get('/api/credits/usage-stats');
    return response.data;
  },

  getPackages: async () => {
    const response = await api.get('/api/v1/user/credit-packages');
    return response.data;
  },

  topup: async (packageId: string) => {
    const response = await api.post('/api/v1/user/topup', { package: packageId });
    return response.data;
  },

  createTopupOrder: async (packageId: string) => {
    const response = await api.post('/api/v1/user/topup/create-order', { package: packageId });
    return response.data;
  },

  captureTopupOrder: async (orderId: string, packageId: string) => {
    const response = await api.post(`/api/v1/user/topup/capture-order?order_id=${orderId}&package=${packageId}`);
    return response.data;
  },
};

// Contact API
export const contactApi = {
  contactSales: async (data: {
    name: string;
    email: string;
    company?: string;
    phone?: string;
    message: string;
    plan_interest?: string;
  }) => {
    const response = await api.post('/api/contact/sales', data);
    return response.data;
  },
};

// API Keys API (Pro+ only)
export const apiKeysApi = {
  generate: async (name?: string) => {
    const response = await api.post('/api/keys/generate', { name });
    return response.data;
  },

  list: async () => {
    const response = await api.get('/api/keys/list');
    return response.data;
  },

  revoke: async (keyId: number) => {
    const response = await api.delete(`/api/keys/${keyId}`);
    return response.data;
  },
};

// Batch API (Pro+ only)
export const batchApi = {
  detectAI: async (items: { text: string; id?: string }[]) => {
    const response = await api.post('/api/batch/detect', { items }, {
      timeout: SCAN_TIMEOUT,
    });
    return response.data;
  },

  humanize: async (items: { text: string; id?: string }[]) => {
    const response = await api.post('/api/batch/humanize', { items }, {
      timeout: SCAN_TIMEOUT,
    });
    return response.data;
  },

  checkPlagiarism: async (items: { text: string; id?: string }[]) => {
    const response = await api.post('/api/batch/plagiarism', { items }, {
      timeout: SCAN_TIMEOUT,
    });
    return response.data;
  },
};

// Promo API
export const promoApi = {
  validate: async (code: string) => {
    const response = await api.get(`/api/promo/validate/${code}`);
    return response.data;
  },

  redeem: async (code: string) => {
    const response = await api.post('/api/promo/redeem', { code });
    return response.data;
  },
};

// User Settings API
export const userSettingsApi = {
  updateSettings: async (data: { full_name?: string; email_notifications?: boolean; marketing_emails?: boolean }) => {
    const response = await api.put('/api/v1/user/settings', data);
    return response.data;
  },

  changePassword: async (currentPassword: string, newPassword: string) => {
    const response = await api.put('/api/v1/user/password', {
      current_password: currentPassword,
      new_password: newPassword,
    });
    return response.data;
  },

  clearHistory: async () => {
    const response = await api.delete('/api/v1/user/history');
    return response.data;
  },

  deleteAccount: async () => {
    const response = await api.delete('/api/v1/user/account');
    return response.data;
  },
};

// Payment API
export const paymentApi = {
  getPlans: async () => {
    const response = await api.get('/api/payment/plans');
    return response.data;
  },

  createOrder: async (planId: string, billingPeriod: 'monthly' | 'yearly' = 'monthly') => {
    const response = await api.post(`/api/payment/create-order?plan_id=${planId}&billing_period=${billingPeriod}`);
    return response.data;
  },

  captureOrder: async (orderId: string, planId: string) => {
    const response = await api.post(`/api/payment/capture-order?order_id=${orderId}&plan_id=${planId}`);
    return response.data;
  },

  getSubscription: async () => {
    const response = await api.get('/api/payment/subscription');
    return response.data;
  },
};

export default api;
