import { Integration } from '../db/schema.js';
import { decryptToken } from '../lib/crypto.js';
import { IntegrationError } from '../lib/errors.js';
import { logger } from '../lib/logger.js';
import { env, hasSearchConsole } from '../config/env.js';

interface GSCSearchAnalyticsResponse {
  rows?: Array<{
    keys: string[];
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
  }>;
  responseAggregationType?: string;
}

export interface SearchAnalyticsRow {
  date: string;
  query?: string;
  page?: string;
  country?: string;
  device?: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface GSCSummary {
  totalClicks: number;
  totalImpressions: number;
  averageCtr: number;
  averagePosition: number;
  topQueries: Array<{
    query: string;
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
  }>;
  topPages: Array<{
    page: string;
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
  }>;
}

/**
 * Refreshes Google OAuth access token
 */
async function refreshAccessToken(integration: Integration): Promise<string> {
  if (!integration.refreshToken) {
    throw new IntegrationError('No refresh token available', 'gsc');
  }
  
  const refreshToken = decryptToken(integration.refreshToken);
  
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID!,
      client_secret: env.GOOGLE_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  
  if (!response.ok) {
    throw new IntegrationError('Failed to refresh Google token', 'gsc');
  }
  
  const tokens = await response.json() as { access_token: string };
  return tokens.access_token;
}

/**
 * Gets valid access token
 */
async function getAccessToken(integration: Integration): Promise<string> {
  if (!integration.accessToken) {
    throw new IntegrationError('No access token available', 'gsc');
  }
  
  if (integration.accessTokenExpiresAt) {
    const expiresAt = new Date(integration.accessTokenExpiresAt);
    if (expiresAt.getTime() - 5 * 60 * 1000 < Date.now()) {
      return refreshAccessToken(integration);
    }
  }
  
  return decryptToken(integration.accessToken);
}

/**
 * Get site URL from integration config or env
 */
function getSiteUrl(integration: Integration): string {
  const config = integration.config as { siteUrl?: string } | null;
  return config?.siteUrl || env.GSC_SITE_URL || '';
}

/**
 * Fetches search analytics data from Google Search Console
 */
export async function fetchSearchAnalytics(
  integration: Integration,
  startDate: Date,
  endDate: Date,
  dimensions: string[] = ['date']
): Promise<SearchAnalyticsRow[]> {
  if (!hasSearchConsole()) {
    logger.warn('Search Console not configured');
    return [];
  }

  const accessToken = await getAccessToken(integration);
  const siteUrl = getSiteUrl(integration);
  
  if (!siteUrl) {
    throw new IntegrationError('No site URL configured', 'gsc');
  }
  
  const formatDate = (d: Date) => d.toISOString().split('T')[0];
  
  try {
    const response = await fetch(
      `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          startDate: formatDate(startDate),
          endDate: formatDate(endDate),
          dimensions,
          rowLimit: 1000,
        }),
      }
    );
    
    if (!response.ok) {
      const error = await response.text();
      logger.error({ status: response.status, error }, 'GSC API error');
      throw new IntegrationError(`GSC API error: ${response.status}`, 'gsc');
    }
    
    const data = await response.json() as GSCSearchAnalyticsResponse;
    
    if (!data.rows) {
      return [];
    }
    
    // Map dimensions to row properties
    return data.rows.map(row => {
      const result: SearchAnalyticsRow = {
        date: '',
        clicks: row.clicks,
        impressions: row.impressions,
        ctr: row.ctr,
        position: row.position,
      };
      
      dimensions.forEach((dim, idx) => {
        const value = row.keys[idx];
        switch (dim) {
          case 'date':
            result.date = value;
            break;
          case 'query':
            result.query = value;
            break;
          case 'page':
            result.page = value;
            break;
          case 'country':
            result.country = value;
            break;
          case 'device':
            result.device = value;
            break;
        }
      });
      
      return result;
    });
  } catch (err) {
    logger.error({ error: err, integrationId: integration.id }, 'Failed to fetch GSC data');
    throw err instanceof IntegrationError ? err : new IntegrationError('Failed to fetch Search Console data', 'gsc');
  }
}

/**
 * Fetches a summary of search performance
 */
export async function fetchGSCSummary(
  integration: Integration,
  days: number = 28
): Promise<GSCSummary> {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  // Fetch aggregated data
  const dateData = await fetchSearchAnalytics(integration, startDate, endDate, ['date']);
  
  // Calculate totals
  const totalClicks = dateData.reduce((sum, r) => sum + r.clicks, 0);
  const totalImpressions = dateData.reduce((sum, r) => sum + r.impressions, 0);
  const averageCtr = totalImpressions > 0 ? totalClicks / totalImpressions : 0;
  const averagePosition = dateData.length > 0 
    ? dateData.reduce((sum, r) => sum + r.position, 0) / dateData.length 
    : 0;
  
  // Fetch top queries
  const queryData = await fetchSearchAnalytics(integration, startDate, endDate, ['query']);
  const topQueries = queryData
    .sort((a, b) => b.clicks - a.clicks)
    .slice(0, 10)
    .map(r => ({
      query: r.query!,
      clicks: r.clicks,
      impressions: r.impressions,
      ctr: r.ctr,
      position: r.position,
    }));
  
  // Fetch top pages
  const pageData = await fetchSearchAnalytics(integration, startDate, endDate, ['page']);
  const topPages = pageData
    .sort((a, b) => b.clicks - a.clicks)
    .slice(0, 10)
    .map(r => ({
      page: r.page!,
      clicks: r.clicks,
      impressions: r.impressions,
      ctr: r.ctr,
      position: r.position,
    }));
  
  return {
    totalClicks,
    totalImpressions,
    averageCtr,
    averagePosition,
    topQueries,
    topPages,
  };
}

/**
 * Fetches daily stats for database storage
 */
export async function fetchGSCDailyStats(
  integration: Integration,
  startDate: Date,
  endDate: Date
): Promise<SearchAnalyticsRow[]> {
  return fetchSearchAnalytics(integration, startDate, endDate, ['date', 'query', 'page']);
}




