
import { DataSource, LeadGeo, SEOMetric, CompetitorData, Campaign, ReportRow, Integration } from './types';

export const PERFORMANCE_METRICS = [
  { label: 'Attributed Revenue', value: '$842,592', change: 14.2, trend: 'up', format: 'currency' },
  { label: 'Total Ad Spend', value: '$124,200', change: 5.2, trend: 'up', format: 'currency' },
  { label: 'Average CAC', value: '$42.15', change: -8.4, trend: 'down', format: 'currency' },
  { label: 'Overall ROAS', value: '6.78x', change: 12.1, trend: 'up', format: 'number' },
];

export const INTEGRATIONS: Integration[] = [
  { id: '1', name: 'Google Ads', icon: 'google', status: 'connected', lastSync: '2 mins ago', accountName: 'Origin_Main_Search' },
  { id: '2', name: 'Meta Business', icon: 'facebook', status: 'connected', lastSync: '14 mins ago', accountName: 'Origin_Social_Global' },
  { id: '3', name: 'Google Analytics 4', icon: 'activity', status: 'connected', lastSync: 'Just now', accountName: 'Origin_App_Production' },
  { id: '4', name: 'Shopify Store', icon: 'shopping-bag', status: 'disconnected', lastSync: 'Never' },
];

export const CAMPAIGNS: Campaign[] = [
  { 
    id: 'c1', name: 'USA - Search - Core Brand', platform: 'google', status: 'active', spend: 45000, revenue: 310000, roas: 6.88, conversions: 450,
    dailyTrend: [
      { date: 'Oct 25', spend: 1200, revenue: 8400 },
      { date: 'Oct 26', spend: 1300, revenue: 9100 },
      { date: 'Oct 27', spend: 1250, revenue: 8800 }
    ]
  },
  { 
    id: 'c2', name: 'Global - Meta - Retargeting', platform: 'meta', status: 'active', spend: 12000, revenue: 98000, roas: 8.16, conversions: 320,
    dailyTrend: [
      { date: 'Oct 25', spend: 400, revenue: 3200 },
      { date: 'Oct 26', spend: 450, revenue: 3800 },
      { date: 'Oct 27', spend: 420, revenue: 3500 }
    ]
  },
  { id: 'c3', name: 'EU - Search - Competitor Conquest', platform: 'google', status: 'active', spend: 8500, revenue: 12000, roas: 1.41, conversions: 45 },
  { id: 'c4', name: 'Lookalike - Top 10% LTV', platform: 'meta', status: 'active', spend: 15000, revenue: 75000, roas: 5.0, conversions: 190 },
  { id: 'c5', name: 'Display - Awareness Q4', platform: 'google', status: 'paused', spend: 2000, revenue: 800, roas: 0.4, conversions: 12 },
];

// Added missing LEAD_GEOGRAPHY export for App.tsx
export const LEAD_GEOGRAPHY: LeadGeo[] = [
  { id: 'g1', region: 'North America', leadCount: 1240, attributedRevenue: 450000, cpa: 38.5, coordinates: { x: 22, y: 32 } },
  { id: 'g2', region: 'Europe', leadCount: 890, attributedRevenue: 220000, cpa: 42.2, coordinates: { x: 50, y: 28 } },
  { id: 'g3', region: 'Asia', leadCount: 560, attributedRevenue: 115000, cpa: 45.8, coordinates: { x: 75, y: 40 } },
  { id: 'g4', region: 'South America', leadCount: 120, attributedRevenue: 32000, cpa: 34.1, coordinates: { x: 35, y: 70 } },
  { id: 'g5', region: 'Australia', leadCount: 95, attributedRevenue: 25592, cpa: 52.3, coordinates: { x: 85, y: 80 } },
];

export const SEO_METRICS: SEOMetric[] = [
  { keyword: 'omnichannel marketing tool', position: 1, volume: 12000, difficulty: 68, change: 0 },
  { keyword: 'marketing roi dashboard', position: 3, volume: 8200, difficulty: 72, change: 1 },
  { keyword: 'attribution software for saas', position: 5, volume: 4400, difficulty: 45, change: 2 },
  { keyword: 'customer data platform comparison', position: 12, volume: 3100, difficulty: 88, change: -4 },
];

export const COMPETITORS: CompetitorData[] = [
  { name: 'AdVantage AI', estimatedTraffic: '2.1M', topKeyword: 'ad tracking', adOverlap: '72%' },
  { name: 'MetricFlow', estimatedTraffic: '950K', topKeyword: 'marketing bi', adOverlap: '38%' },
  { name: 'InsightPro', estimatedTraffic: '1.4M', topKeyword: 'attribution tech', adOverlap: '54%' },
];

export const REPORTING_DATA: ReportRow[] = [
  { date: '2023-10-25', platform: 'Google Ads', impressions: 45000, clicks: 1200, ctr: 2.6, spend: 1200, conversions: 45, revenue: 12000 },
  { date: '2023-10-25', platform: 'Meta Ads', impressions: 85000, clicks: 2400, ctr: 2.8, spend: 1400, conversions: 62, revenue: 18000 },
  { date: '2023-10-26', platform: 'Google Ads', impressions: 48000, clicks: 1350, ctr: 2.8, spend: 1300, conversions: 51, revenue: 14500 },
  { date: '2023-10-26', platform: 'Meta Ads', impressions: 72000, clicks: 1900, ctr: 2.6, spend: 1100, conversions: 48, revenue: 11200 },
  { date: '2023-10-27', platform: 'Google Ads', impressions: 51000, clicks: 1420, ctr: 2.7, spend: 1450, conversions: 58, revenue: 16800 },
  { date: '2023-10-27', platform: 'Meta Ads', impressions: 94000, clicks: 2800, ctr: 2.9, spend: 1600, conversions: 75, revenue: 21000 },
];

export const CORE_WEB_VITALS = [
  { label: 'LCP (Load Speed)', value: '1.1s', status: 'Good', score: 96 },
  { label: 'FID (Interactivity)', value: '14ms', status: 'Good', score: 98 },
  { label: 'CLS (Stability)', value: '0.02', status: 'Good', score: 99 },
  { label: 'INP (Responsiveness)', value: '180ms', status: 'Needs Improvement', score: 58 },
];

export const CHART_DATA = [
  { date: 'Oct 1', value: 24500, spend: 4200, projection: 25000 },
  { date: 'Oct 5', value: 28200, spend: 4100, projection: 29000 },
  { date: 'Oct 10', value: 32800, spend: 4400, projection: 35000 },
  { date: 'Oct 15', value: 41100, spend: 4600, projection: 45000 },
  { date: 'Oct 20', value: 48900, spend: 4800, projection: 55000 },
  { date: 'Oct 25', value: 65200, spend: 5200, projection: 75000 },
  { date: 'Oct 31', value: 84259, spend: 5800, projection: 110000 },
];

export const LTV_COHORTS = [
  { month: 'Jan', value: 450, retention: 98, ltv: 1200, cac: 400 },
  { month: 'Feb', value: 520, retention: 94, ltv: 1150, cac: 420 },
  { month: 'Mar', value: 480, retention: 92, ltv: 1300, cac: 380 },
  { month: 'Apr', value: 610, retention: 89, ltv: 1400, cac: 390 },
  { month: 'May', value: 720, retention: 85, ltv: 1550, cac: 410 },
];

export const CALENDAR_DATA = Array.from({ length: 31 }, (_, i) => ({
  day: i + 1,
  value: Math.floor(Math.random() * 200),
  intensity: Math.floor(Math.random() * 5)
}));
