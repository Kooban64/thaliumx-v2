import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api/client';
import { getKeycloakToken } from '@/lib/auth/backend-auth';

// Define types for broker-related data
interface BrokerDashboardData {
  metrics: {
    totalUsers: number;
    activeUsers: number;
    totalTransactions: number;
    totalVolume: number;
    pendingKYC: number;
  };
  recentActivity: unknown[];
  permissions?: {
    canViewFinancials: boolean;
    canViewCompliance: boolean;
    canViewOperations: boolean;
    canViewTrading: boolean;
  };
}

interface BrokerUser {
  id: string;
  email: string;
  username: string;
  firstName?: string;
  lastName?: string;
  kycStatus: string;
  kycLevel: string;
  isActive: boolean;
  isVerified?: boolean;
  createdAt: string;
  updatedAt?: string;
}

interface BrokerTransaction {
  id: string;
  userId: string;
  type: string;
  status: string;
  amount: string;
  currency: string;
  createdAt: string;
}

interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

interface PaginatedResult<T> {
  data: T[];
  pagination: PaginationMeta;
}

/**
 * useBrokerDashboard - Fetches data for the broker dashboard overview
 */
export function useBrokerDashboard() {
  return useQuery<BrokerDashboardData>({
    queryKey: ['broker', 'dashboard'],
    queryFn: async () => {
      const response = await apiClient.get<BrokerDashboardData>('/api/broker/dashboard');
      if (response.success && response.data) {
        return response.data;
      }
      throw new Error('Failed to fetch broker dashboard data');
    },
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: 30 * 1000,
  });
}

/**
 * useBrokerHealth - Fetches broker health status
 */
export function useBrokerHealth() {
  return useQuery<Record<string, unknown>>({
    queryKey: ['broker', 'health'],
    queryFn: async () => {
      const response = await apiClient.get<Record<string, unknown>>('/api/broker/health');
      if (response.success && response.data) {
        return response.data;
      }
      throw new Error('Failed to fetch broker health');
    },
    staleTime: 15 * 1000, // 15 seconds
    refetchInterval: 15 * 1000,
  });
}

/**
 * useBrokerUsers - Fetches a list of broker users
 */
export function useBrokerUsers(params?: {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
}) {
  return useQuery<PaginatedResult<BrokerUser>>({
    queryKey: ['broker', 'users', params],
    queryFn: async () => {
      const queryParams = new URLSearchParams();
      if (params?.page) queryParams.append('page', params.page.toString());
      if (params?.limit) queryParams.append('limit', params.limit.toString());
      if (params?.search) queryParams.append('search', params.search);
      if (params?.status) queryParams.append('status', params.status);

      const response = await apiClient.get<PaginatedResult<BrokerUser>>(
        `/api/broker/users?${queryParams.toString()}`
      );
      if (response.success) {
        return response.data || {
          data: [],
          pagination: {
            page: 1,
            limit: 10,
            total: 0,
            totalPages: 0,
            hasNext: false,
            hasPrev: false,
          },
        };
      }
      throw new Error('Failed to fetch broker users');
    },
    staleTime: 60 * 1000, // 1 minute
  });
}

/**
 * useBrokerTransactions - Fetches broker transactions
 */
export function useBrokerTransactions(params?: {
  page?: number;
  limit?: number;
  status?: string;
  type?: string;
  userId?: string;
}) {
  return useQuery<PaginatedResult<BrokerTransaction>>({
    queryKey: ['broker', 'transactions', params],
    queryFn: async () => {
      const queryParams = new URLSearchParams();
      if (params?.page) queryParams.append('page', params.page.toString());
      if (params?.limit) queryParams.append('limit', params.limit.toString());
      if (params?.status) queryParams.append('status', params.status);
      if (params?.type) queryParams.append('type', params.type);
      if (params?.userId) queryParams.append('userId', params.userId);

      const response = await apiClient.get<PaginatedResult<BrokerTransaction>>(
        `/api/broker/transactions?${queryParams.toString()}`
      );
      if (response.success) {
        return response.data || {
          data: [],
          pagination: {
            page: 1,
            limit: 10,
            total: 0,
            totalPages: 0,
            hasNext: false,
            hasPrev: false,
          },
        };
      }
      throw new Error('Failed to fetch broker transactions');
    },
    staleTime: 30 * 1000, // 30 seconds
  });
}

/**
 * useBrokerKYC - Fetches broker KYC records
 */
export function useBrokerKYC(params?: {
  page?: number;
  limit?: number;
  status?: string;
  level?: string;
}) {
  return useQuery<PaginatedResult<Record<string, unknown>>>({
    queryKey: ['broker', 'kyc', params],
    queryFn: async () => {
      const queryParams = new URLSearchParams();
      if (params?.page) queryParams.append('page', params.page.toString());
      if (params?.limit) queryParams.append('limit', params.limit.toString());
      if (params?.status) queryParams.append('status', params.status);
      if (params?.level) queryParams.append('level', params.level);

      const response = await apiClient.get<PaginatedResult<Record<string, unknown>>>(
        `/api/broker/kyc?${queryParams.toString()}`
      );
      if (response.success) {
        return response.data || {
          data: [],
          pagination: {
            page: 1,
            limit: 10,
            total: 0,
            totalPages: 0,
            hasNext: false,
            hasPrev: false,
          },
        };
      }
      throw new Error('Failed to fetch broker KYC records');
    },
    staleTime: 60 * 1000, // 1 minute
  });
}

/**
 * useBrokerAuditLogs - Fetches broker audit logs
 */
export function useBrokerAuditLogs(params?: {
  page?: number;
  limit?: number;
  action?: string;
  userId?: string;
  startDate?: string;
  endDate?: string;
}) {
  return useQuery<PaginatedResult<Record<string, unknown>>>({
    queryKey: ['broker', 'audit-logs', params],
    queryFn: async () => {
      const queryParams = new URLSearchParams();
      if (params?.page) queryParams.append('page', params.page.toString());
      if (params?.limit) queryParams.append('limit', params.limit.toString());
      if (params?.action) queryParams.append('action', params.action);
      if (params?.userId) queryParams.append('userId', params.userId);
      if (params?.startDate) queryParams.append('startDate', params.startDate);
      if (params?.endDate) queryParams.append('endDate', params.endDate);

      const response = await apiClient.get<PaginatedResult<Record<string, unknown>>>(
        `/api/broker/audit-logs?${queryParams.toString()}`
      );
      if (response.success) {
        return response.data || {
          data: [],
          pagination: {
            page: 1,
            limit: 10,
            total: 0,
            totalPages: 0,
            hasNext: false,
            hasPrev: false,
          },
        };
      }
      throw new Error('Failed to fetch broker audit logs');
    },
    staleTime: 1 * 60 * 1000, // 1 minute
    refetchInterval: 30 * 1000,
  });
}

// Broker Financial Types
interface LedgerEntry {
  id: string;
  accountId: string;
  accountName: string;
  accountType: string;
  debit: number;
  credit: number;
  balance: number;
  currency: string;
  description: string;
  reference: string;
  createdAt: string;
}

interface BrokerLedgerData {
  entries: LedgerEntry[];
  summary: {
    totalAssets: number;
    totalLiabilities: number;
    totalEquity: number;
    totalRevenue: number;
    totalExpenses: number;
  };
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

interface ReconciliationJob {
  id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startDate: string;
  endDate: string;
  createdAt: string;
  completedAt?: string;
  discrepancies?: number;
  reportUrl?: string;
}

interface BrokerFinancialReport {
  id: string;
  type: string;
  period: string;
  status: 'generating' | 'completed' | 'failed';
  createdAt: string;
  completedAt?: string;
  downloadUrl?: string;
}

/**
 * useBrokerLedger - Fetches broker ledger entries
 */
export function useBrokerLedger(params?: {
  page?: number;
  limit?: number;
  accountType?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
}) {
  return useQuery<BrokerLedgerData>({
    queryKey: ['broker', 'financial', 'ledger', params],
    queryFn: async () => {
      const queryParams = new URLSearchParams();
      if (params?.page) queryParams.append('page', params.page.toString());
      if (params?.limit) queryParams.append('limit', params.limit.toString());
      if (params?.accountType) queryParams.append('accountType', params.accountType);
      if (params?.startDate) queryParams.append('startDate', params.startDate);
      if (params?.endDate) queryParams.append('endDate', params.endDate);
      if (params?.search) queryParams.append('search', params.search);

      const response = await apiClient.get<BrokerLedgerData>(
        `/api/broker/financial/ledger?${queryParams.toString()}`
      );
      if (response.success && response.data) {
        return response.data;
      }
      throw new Error('Failed to fetch broker ledger');
    },
    staleTime: 30 * 1000, // 30 seconds
  });
}

/**
 * useReconciliationJobs - Fetches reconciliation jobs
 */
export function useReconciliationJobs(params?: {
  page?: number;
  limit?: number;
  status?: string;
}) {
  return useQuery<PaginatedResult<ReconciliationJob>>({
    queryKey: ['broker', 'financial', 'reconciliation', params],
    queryFn: async () => {
      const queryParams = new URLSearchParams();
      if (params?.page) queryParams.append('page', params.page.toString());
      if (params?.limit) queryParams.append('limit', params.limit.toString());
      if (params?.status) queryParams.append('status', params.status);

      const response = await apiClient.get<PaginatedResult<ReconciliationJob>>(
        `/api/broker/financial/reconciliation/jobs?${queryParams.toString()}`
      );
      if (response.success) {
        return response.data || {
          data: [],
          pagination: {
            page: 1,
            limit: 10,
            total: 0,
            totalPages: 0,
            hasNext: false,
            hasPrev: false,
          },
        };
      }
      throw new Error('Failed to fetch reconciliation jobs');
    },
    staleTime: 60 * 1000, // 1 minute
  });
}

/**
 * useCreateReconciliationJob - Creates a new reconciliation job
 */
export function useCreateReconciliationJob() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (params: { startDate: string; endDate: string }) => {
      const response = await apiClient.post('/api/broker/financial/reconciliation/jobs', params);
      if (response.success) {
        return response.data;
      }
      throw new Error(response.error || 'Failed to create reconciliation job');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['broker', 'financial', 'reconciliation'] });
    },
  });
}

/**
 * useBrokerFinancialReports - Fetches broker financial reports
 */
export function useBrokerFinancialReports(params?: {
  page?: number;
  limit?: number;
  type?: string;
}) {
  return useQuery<PaginatedResult<BrokerFinancialReport>>({
    queryKey: ['broker', 'financial', 'reports', params],
    queryFn: async () => {
      const queryParams = new URLSearchParams();
      if (params?.page) queryParams.append('page', params.page.toString());
      if (params?.limit) queryParams.append('limit', params.limit.toString());
      if (params?.type) queryParams.append('type', params.type);

      const response = await apiClient.get<PaginatedResult<BrokerFinancialReport>>(
        `/api/broker/financial/reports?${queryParams.toString()}`
      );
      if (response.success) {
        return response.data || {
          data: [],
          pagination: {
            page: 1,
            limit: 10,
            total: 0,
            totalPages: 0,
            hasNext: false,
            hasPrev: false,
          },
        };
      }
      throw new Error('Failed to fetch financial reports');
    },
    staleTime: 60 * 1000, // 1 minute
  });
}

/**
 * useGenerateBrokerReport - Generates a new financial report
 */
export function useGenerateBrokerReport() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (params: { type: string; startDate?: string; endDate?: string }) => {
      const response = await apiClient.post('/api/broker/financial/reports/generate', params);
      if (response.success) {
        return response.data;
      }
      throw new Error(response.error || 'Failed to generate report');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['broker', 'financial', 'reports'] });
    },
  });
}

// Broker Compliance Types
interface ComplianceStatus {
  overall: 'compliant' | 'non-compliant' | 'review';
  kycCompliance: number; // percentage
  transactionCompliance: number;
  riskScore: number;
  alerts: number;
  lastReview: string;
}

interface SuspiciousTransaction {
  id: string;
  userId: string;
  type: string;
  amount: number;
  currency: string;
  riskScore: number;
  flags: string[];
  createdAt: string;
  status: 'pending' | 'reviewed' | 'resolved' | 'false_positive';
}

interface MarketData {
  symbol: string;
  price: number;
  change24h: number;
  volume24h: number;
  high24h: number;
  low24h: number;
  lastUpdate: string;
}

interface TradingPair {
  symbol: string;
  baseCurrency: string;
  quoteCurrency: string;
  status: 'active' | 'inactive' | 'maintenance';
  minOrderSize: number;
  maxOrderSize: number;
  tickSize: number;
  fee: number;
}

/**
 * useBrokerCompliance - Fetches broker compliance status
 */
export function useBrokerCompliance() {
  return useQuery<ComplianceStatus>({
    queryKey: ['broker', 'compliance'],
    queryFn: async () => {
      const response = await apiClient.get<ComplianceStatus>('/api/broker/compliance');
      if (response.success && response.data) {
        return response.data;
      }
      throw new Error('Failed to fetch compliance status');
    },
    staleTime: 60 * 1000, // 1 minute
    refetchInterval: 60 * 1000,
  });
}

/**
 * useBrokerTransactionMonitoring - Fetches suspicious transactions
 */
export function useBrokerTransactionMonitoring(params?: {
  page?: number;
  limit?: number;
  riskScore?: number;
  status?: string;
}) {
  return useQuery<PaginatedResult<SuspiciousTransaction>>({
    queryKey: ['broker', 'compliance', 'monitoring', params],
    queryFn: async () => {
      const queryParams = new URLSearchParams();
      if (params?.page) queryParams.append('page', params.page.toString());
      if (params?.limit) queryParams.append('limit', params.limit.toString());
      if (params?.riskScore) queryParams.append('riskScore', params.riskScore.toString());
      if (params?.status) queryParams.append('status', params.status);

      const response = await apiClient.get<PaginatedResult<SuspiciousTransaction>>(
        `/api/broker/compliance/monitoring?${queryParams.toString()}`
      );
      if (response.success) {
        return response.data || {
          data: [],
          pagination: {
            page: 1,
            limit: 10,
            total: 0,
            totalPages: 0,
            hasNext: false,
            hasPrev: false,
          },
        };
      }
      throw new Error('Failed to fetch suspicious transactions');
    },
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: 30 * 1000,
  });
}

/**
 * useBrokerMarketData - Fetches broker market data
 */
export function useBrokerMarketData(symbol?: string) {
  return useQuery<{
    data: MarketData[];
    pairs: TradingPair[];
  }>({
    queryKey: ['broker', 'trading', 'market-data', symbol],
    queryFn: async () => {
      const endpoint = symbol
        ? `/api/broker/trading/market-data?symbol=${symbol}`
        : '/api/broker/trading/market-data';
      const response = await apiClient.get<{ data: MarketData[]; pairs: TradingPair[] }>(endpoint);
      if (response.success && response.data) {
        return response.data;
      }
      throw new Error('Failed to fetch market data');
    },
    staleTime: 5 * 1000, // 5 seconds
    refetchInterval: 10 * 1000, // Refetch every 10 seconds
  });
}

/**
 * useBrokerTradingConfig - Fetches broker trading configuration
 */
export function useBrokerTradingConfig() {
  return useQuery<{
    pairs: TradingPair[];
    fees: Record<string, number>;
    rules: Record<string, unknown>;
  }>({
    queryKey: ['broker', 'trading', 'config'],
    queryFn: async () => {
      const response = await apiClient.get<{
        pairs: TradingPair[];
        fees: Record<string, number>;
        rules: Record<string, unknown>;
      }>('/api/broker/trading/config');
      if (response.success && response.data) {
        return response.data;
      }
      throw new Error('Failed to fetch trading configuration');
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * useUpdateBrokerTradingConfig - Updates broker trading configuration
 */
export function useUpdateBrokerTradingConfig() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (config: { pairs?: TradingPair[]; fees?: Record<string, number>; rules?: Record<string, unknown> }) => {
      const response = await apiClient.put('/api/broker/trading/config', config);
      if (response.success) {
        return response.data;
      }
      throw new Error(response.error || 'Failed to update trading configuration');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['broker', 'trading', 'config'] });
    },
  });
}

/**
 * useBrokerSettings - Fetches broker settings
 */
export function useBrokerSettings() {
  return useQuery<{
    name: string;
    email: string;
    contactPerson: string;
    phone: string;
    address: string;
    country: string;
    website: string;
    apiKeys: string[];
    webhooks: string[];
    features: Record<string, boolean>;
  }>({
    queryKey: ['broker', 'settings'],
    queryFn: async () => {
      const response = await apiClient.get<{
        name: string;
        email: string;
        contactPerson: string;
        phone: string;
        address: string;
        country: string;
        website: string;
        apiKeys: string[];
        webhooks: string[];
        features: Record<string, boolean>;
      }>('/api/broker/settings');
      if (response.success && response.data) {
        return response.data;
      }
      throw new Error('Failed to fetch broker settings');
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * useUpdateBrokerSettings - Updates broker settings
 */
export function useUpdateBrokerSettings() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (settings: unknown) => {
      const response = await apiClient.put('/api/broker/settings', settings);
      if (response.success) {
        return response.data;
      }
      throw new Error(response.error || 'Failed to update broker settings');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['broker', 'settings'] });
    },
  });
}

/**
 * useBrokerBranding - Fetches broker branding
 */
export function useBrokerBranding() {
  return useQuery<{
    logo: string;
    primaryColor: string;
    secondaryColor: string;
    customCSS: string;
  }>({
    queryKey: ['broker', 'settings', 'branding'],
    queryFn: async () => {
      const response = await apiClient.get<{
        logo: string;
        primaryColor: string;
        secondaryColor: string;
        customCSS: string;
      }>('/api/broker/settings/branding');
      if (response.success && response.data) {
        return response.data;
      }
      throw new Error('Failed to fetch branding');
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * useUpdateBrokerBranding - Updates broker branding
 */
export function useUpdateBrokerBranding() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (branding: { logo?: File; primaryColor?: string; secondaryColor?: string; customCSS?: string }) => {
      const formData = new FormData();
      if (branding.logo) formData.append('logo', branding.logo);
      if (branding.primaryColor) formData.append('primaryColor', branding.primaryColor);
      if (branding.secondaryColor) formData.append('secondaryColor', branding.secondaryColor);
      if (branding.customCSS) formData.append('customCSS', branding.customCSS);

      // Use fetch directly for FormData
      const response = await fetch('/api/broker/settings/branding', {
        method: 'PUT',
        body: formData,
        headers: {
          'Authorization': `Bearer ${typeof window !== 'undefined' ? getKeycloakToken() || '' : ''}`,
        },
      });

      const data = await response.json();
      if (data.success) {
        return data.data;
      }
      throw new Error(data.error || 'Failed to update branding');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['broker', 'settings', 'branding'] });
    },
  });
}

/**
 * useBrokerLimits - Fetches broker limits
 */
export function useBrokerLimits() {
  return useQuery<{
    defaultUserLimits: Record<string, number>;
    transactionLimits: Record<string, number>;
    withdrawalLimits: Record<string, number>;
    depositLimits: Record<string, number>;
  }>({
    queryKey: ['broker', 'settings', 'limits'],
    queryFn: async () => {
      const response = await apiClient.get<{
        defaultUserLimits: Record<string, number>;
        transactionLimits: Record<string, number>;
        withdrawalLimits: Record<string, number>;
        depositLimits: Record<string, number>;
      }>('/api/broker/settings/limits');
      if (response.success && response.data) {
        return response.data;
      }
      throw new Error('Failed to fetch broker limits');
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * useUpdateBrokerLimits - Updates broker limits
 */
export function useUpdateBrokerLimits() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (limits: unknown) => {
      const response = await apiClient.put('/api/broker/settings/limits', limits);
      if (response.success) {
        return response.data;
      }
      throw new Error(response.error || 'Failed to update broker limits');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['broker', 'settings', 'limits'] });
    },
  });
}

// Broker Analytics Types
interface BrokerAnalytics {
  users: {
    total: number;
    active: number;
    new: number;
    growth: number;
  };
  trading: {
    volume24h: number;
    volume7d: number;
    volume30d: number;
    orders24h: number;
    revenue24h: number;
  };
  financial: {
    revenue: number;
    expenses: number;
    profit: number;
    balance: number;
  };
}

/**
 * useBrokerUserAnalytics - Fetches broker user analytics
 */
export function useBrokerUserAnalytics(params?: {
  startDate?: string;
  endDate?: string;
}) {
  return useQuery<BrokerAnalytics['users']>({
    queryKey: ['broker', 'analytics', 'users', params],
    queryFn: async () => {
      const queryParams = new URLSearchParams();
      if (params?.startDate) queryParams.append('startDate', params.startDate);
      if (params?.endDate) queryParams.append('endDate', params.endDate);

      const response = await apiClient.get<BrokerAnalytics['users']>(
        `/api/broker/analytics/users?${queryParams.toString()}`
      );
      if (response.success && response.data) {
        return response.data;
      }
      throw new Error('Failed to fetch user analytics');
    },
    staleTime: 60 * 1000, // 1 minute
  });
}

/**
 * useBrokerTradingAnalytics - Fetches broker trading analytics
 */
export function useBrokerTradingAnalytics(params?: {
  startDate?: string;
  endDate?: string;
}) {
  return useQuery<BrokerAnalytics['trading']>({
    queryKey: ['broker', 'analytics', 'trading', params],
    queryFn: async () => {
      const queryParams = new URLSearchParams();
      if (params?.startDate) queryParams.append('startDate', params.startDate);
      if (params?.endDate) queryParams.append('endDate', params.endDate);

      const response = await apiClient.get<BrokerAnalytics['trading']>(
        `/api/broker/analytics/trading?${queryParams.toString()}`
      );
      if (response.success && response.data) {
        return response.data;
      }
      throw new Error('Failed to fetch trading analytics');
    },
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: 60 * 1000,
  });
}

/**
 * useBrokerFinancialAnalytics - Fetches broker financial analytics
 */
export function useBrokerFinancialAnalytics(params?: {
  startDate?: string;
  endDate?: string;
}) {
  return useQuery<BrokerAnalytics['financial']>({
    queryKey: ['broker', 'analytics', 'financial', params],
    queryFn: async () => {
      const queryParams = new URLSearchParams();
      if (params?.startDate) queryParams.append('startDate', params.startDate);
      if (params?.endDate) queryParams.append('endDate', params.endDate);

      const response = await apiClient.get<BrokerAnalytics['financial']>(
        `/api/broker/analytics/financial?${queryParams.toString()}`
      );
      if (response.success && response.data) {
        return response.data;
      }
      throw new Error('Failed to fetch financial analytics');
    },
    staleTime: 60 * 1000, // 1 minute
  });
}
