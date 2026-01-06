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

export async function triggerSync(integrationId: string, fullBackfill: boolean = false): Promise<{ jobId: string; status: string }> {
  return apiFetch(`/v1/integrations/${integrationId}/sync`, {
    method: 'POST',
    body: JSON.stringify({ fullBackfill }),
  });
}

export async function checkSyncStatus(jobId: string): Promise<{ status: string; progress: number }> {
  return apiFetch(`/v1/sync/status/${jobId}`);
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

// ============== SEO API ==============

export interface SEOSummary {
  totalClicks: number;
  totalImpressions: number;
  averagePosition: number;
}

export interface SEOKeyword {
  keyword: string;
  clicks: number;
  impressions: number;
  averagePosition: number;
  ctr: number;
}

export interface SEOPage {
  page: string;
  clicks: number;
  impressions: number;
  averagePosition: number;
  ctr: number;
}

export async function fetchSEOSummary(days: number = 30): Promise<{ summary: SEOSummary; dateRange: { startDate: string; endDate: string } }> {
  return apiFetch(`/v1/seo/summary?days=${days}`);
}

export async function fetchSEOKeywords(days: number = 30): Promise<{ keywords: SEOKeyword[] }> {
  return apiFetch(`/v1/seo/keywords?days=${days}`);
}

export async function fetchSEOPages(days: number = 30): Promise<{ pages: SEOPage[] }> {
  return apiFetch(`/v1/seo/pages?days=${days}`);
}

// ============== Web Vitals API ==============

export interface WebVitalsData {
  id: string;
  url: string;
  strategy: 'mobile' | 'desktop';
  lcp: number | null;
  fid: number | null;
  cls: number | null;
  fcp: number | null;
  inp: number | null;
  ttfb: number | null;
  performanceScore: number | null;
  accessibilityScore: number | null;
  bestPracticesScore: number | null;
  seoScore: number | null;
  fetchTime: string;
}

export interface WebVitalsSummary {
  performanceScore: number;
  accessibilityScore: number;
  bestPracticesScore: number;
  seoScore: number;
  count: number;
}

export async function fetchWebVitals(url?: string, strategy?: 'mobile' | 'desktop', limit: number = 10): Promise<{ webVitals: WebVitalsData[] }> {
  const params = new URLSearchParams();
  if (url) params.append('url', url);
  if (strategy) params.append('strategy', strategy);
  params.append('limit', String(limit));
  return apiFetch(`/v1/webvitals?${params.toString()}`);
}

export async function fetchWebVitalsSummary(url?: string, strategy?: 'mobile' | 'desktop'): Promise<{ summary: WebVitalsSummary }> {
  const params = new URLSearchParams();
  if (url) params.append('url', url);
  if (strategy) params.append('strategy', strategy);
  return apiFetch(`/v1/webvitals/summary?${params.toString()}`);
}

// ============== Tracking API (Server-side) ==============

export interface TrackingEvent {
  event_name: string;
  client_id?: string;
  event_params?: Record<string, unknown>;
}

export async function sendTrackingEvent(event: TrackingEvent): Promise<{ success: boolean; client_id: string }> {
  return apiFetch('/v1/tracking/event', {
    method: 'POST',
    body: JSON.stringify(event),
    retries: 1, // Don't retry tracking calls
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

// ============== Utility Functions ==============

/**
 * Safely get a number value with fallback to 0
 */
export function safeNumber(value: number | null | undefined, fallback: number = 0): number {
  if (value === null || value === undefined || isNaN(value)) {
    return fallback;
  }
  return value;
}

/**
 * Format currency with empty→$0 fallback
 */
export function formatCurrency(value: number | null | undefined): string {
  const num = safeNumber(value, 0);
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(num);
}

/**
 * Format percentage with empty→0% fallback
 */
export function formatPercent(value: number | null | undefined, decimals: number = 1): string {
  const num = safeNumber(value, 0);
  return `${num.toFixed(decimals)}%`;
}

/**
 * Format large numbers with abbreviations
 */
export function formatNumber(value: number | null | undefined): string {
  const num = safeNumber(value, 0);
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return num.toLocaleString();
}

