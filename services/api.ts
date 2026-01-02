/**
 * API Service - Handles all backend API calls
 */

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

interface FetchOptions extends RequestInit {
  retries?: number;
  retryDelay?: number;
}

/**
 * Base fetch wrapper with retry logic and error handling
 */
async function apiFetch<T>(
  endpoint: string,
  options: FetchOptions = {}
): Promise<T> {
  const { retries = 3, retryDelay = 1000, ...fetchOptions } = options;
  
  const url = `${API_BASE}${endpoint}`;
  
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await fetch(url, {
        ...fetchOptions,
        headers: {
          'Content-Type': 'application/json',
          ...fetchOptions.headers,
        },
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new ApiError(
          errorData.error?.message || `Request failed with status ${response.status}`,
          response.status,
          errorData.error?.code || 'API_ERROR',
          errorData.error?.traceId
        );
      }
      
      return await response.json();
    } catch (error) {
      if (error instanceof ApiError) {
        // Don't retry client errors (4xx)
        if (error.status >= 400 && error.status < 500) {
          throw error;
        }
      }
      
      if (attempt === retries - 1) {
        throw error;
      }
      
      // Exponential backoff
      await new Promise(resolve => setTimeout(resolve, retryDelay * Math.pow(2, attempt)));
    }
  }
  
  throw new Error('Max retries exceeded');
}

/**
 * Custom API Error class
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code: string,
    public traceId?: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// ============== Dashboard API ==============

export interface DashboardMetric {
  label: string;
  value: string;
  change: number;
  trend: 'up' | 'down' | 'neutral';
  format: 'currency' | 'number' | 'percentage';
}

export interface DashboardCampaign {
  id: string;
  name: string;
  platform: 'google' | 'meta';
  status: 'active' | 'paused' | 'deleted';
  spend: number;
  revenue: number;
  conversions: number;
  roas: number;
}

export interface ChartDataPoint {
  date: string;
  value: number;
  spend: number;
}

export interface DashboardData {
  metrics: DashboardMetric[];
  campaigns: DashboardCampaign[];
  chart: ChartDataPoint[];
  dateRange: {
    startDate: string;
    endDate: string;
  };
}

export async function fetchDashboardData(days: number = 30): Promise<DashboardData> {
  return apiFetch<DashboardData>(`/v1/dashboard-data?days=${days}`);
}

export interface CampaignDetail {
  id: string;
  name: string;
  platform: string;
  status: string;
  objective?: string;
  accountName?: string;
  totals: {
    impressions: number;
    clicks: number;
    spend: number;
    conversions: number;
    revenue: number;
    roas: number;
    ctr: number;
    cpc: number;
    cpa: number;
  };
  dailyTrend: Array<{
    date: string;
    impressions: number;
    clicks: number;
    spend: number;
    conversions: number;
    revenue: number;
  }>;
}

export async function fetchCampaignDetail(id: string): Promise<CampaignDetail> {
  return apiFetch<CampaignDetail>(`/v1/campaigns/${id}`);
}

// ============== Integrations API ==============

export interface Integration {
  id: string;
  platform: string;
  name: string;
  icon: string;
  accountName: string;
  status: 'connected' | 'disconnected' | 'error' | 'syncing';
  lastSyncAt: string | null;
}

export interface IntegrationsResponse {
  integrations: Integration[];
}

export async function fetchIntegrations(): Promise<IntegrationsResponse> {
  return apiFetch<IntegrationsResponse>('/v1/integrations');
}

export async function triggerSync(integrationId: string): Promise<{ jobId: string; status: string }> {
  return apiFetch(`/v1/integrations/${integrationId}/sync`, {
    method: 'POST',
  });
}

export async function disconnectIntegration(platform: string): Promise<{ success: boolean }> {
  return apiFetch(`/auth/${platform}`, {
    method: 'DELETE',
  });
}

// ============== AI API ==============

export interface AIInsight {
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  category: 'optimization' | 'budget' | 'anomaly' | 'geo' | 'seo' | 'competitive';
  sources?: string[];
}

export interface InsightsContext {
  metrics: Array<{ label: string; value: string; change: number }>;
  campaigns: Array<{ name: string; spend: number; revenue: number; roas: number }>;
}

export async function fetchAIInsights(
  domain: string,
  context: InsightsContext
): Promise<AIInsight[]> {
  const response = await apiFetch<{ insights: AIInsight[] }>('/v1/ai/insights', {
    method: 'POST',
    body: JSON.stringify({ domain, ...context }),
  });
  return response.insights;
}

export interface ChatContext {
  domain: string;
  metrics: Array<{ label: string; value: string; change: number }>;
}

export interface ChatResponse {
  text: string;
  sources: Array<{ uri: string; title: string }>;
}

export async function chatWithAI(
  message: string,
  context: ChatContext
): Promise<ChatResponse> {
  return apiFetch<ChatResponse>('/v1/ai/chat', {
    method: 'POST',
    body: JSON.stringify({ message, ...context }),
  });
}

// ============== Health Check ==============

export async function checkApiHealth(): Promise<boolean> {
  try {
    await apiFetch<{ status: string }>('/health', { retries: 1 });
    return true;
  } catch {
    return false;
  }
}

