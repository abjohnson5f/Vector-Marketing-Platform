
export enum DataSource {
  GOOGLE_ADS = 'Google Ads',
  META_ADS = 'Meta Ads',
  GOOGLE_ANALYTICS = 'Google Analytics',
  PERFORMANCE = 'Web Performance',
  SEO = 'Organic Search'
}

export type DashboardView = 'overview' | 'spending' | 'campaigns' | 'forecast' | 'ltv' | 'seo' | 'reporting' | 'strategy' | 'connectors';

export interface MetricData {
  label: string;
  value: string | number;
  change: number;
  trend: 'up' | 'down' | 'neutral';
  format: 'currency' | 'number' | 'percentage' | 'time';
}

export interface LeadGeo {
  id: string;
  region: string;
  leadCount: number;
  attributedRevenue: number;
  cpa: number;
  coordinates: { x: number; y: number };
}

export interface SEOMetric {
  keyword: string;
  position: number;
  volume: number;
  difficulty: number;
  change: number;
}

export interface CompetitorData {
  name: string;
  estimatedTraffic: string;
  topKeyword: string;
  adOverlap: string;
}

export interface Campaign {
  id: string;
  name: string;
  platform: 'google' | 'meta';
  status: 'active' | 'paused';
  spend: number;
  revenue: number;
  roas: number;
  conversions: number;
  dailyTrend?: { date: string; spend: number; revenue: number }[];
}

export interface AIInsight {
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  category: 'optimization' | 'budget' | 'anomaly' | 'geo' | 'seo' | 'competitive';
  sources?: string[];
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  // Added to support Google Search grounding as per guidelines
  sources?: { uri: string; title: string }[];
}

export interface ReportRow {
  date: string;
  platform: string;
  impressions: number;
  clicks: number;
  ctr: number;
  spend: number;
  conversions: number;
  revenue: number;
}

export interface Integration {
  id: string;
  name: string;
  icon: string;
  status: 'connected' | 'disconnected' | 'error';
  lastSync: string;
  accountName?: string;
}
