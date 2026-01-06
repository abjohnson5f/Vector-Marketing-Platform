import { Integration } from '../db/schema.js';
import { decryptToken } from '../lib/crypto.js';
import { IntegrationError } from '../lib/errors.js';
import { logger } from '../lib/logger.js';
import { env, hasGoogleAds } from '../config/env.js';

interface GoogleAdsApiResponse {
  results?: Array<{
    campaign?: {
      resourceName: string;
      id: string;
      name: string;
      status: 'ENABLED' | 'PAUSED' | 'REMOVED';
      advertisingChannelType?: string;
    };
    metrics?: {
      impressions: string;
      clicks: string;
      costMicros: string;
      conversions: string;
      conversionsValue: string;
    };
    segments?: {
      date: string;
    };
  }>;
  fieldMask?: string;
  requestId?: string;
}

export interface NormalizedCampaign {
  externalId: string;
  name: string;
  status: 'active' | 'paused' | 'deleted';
  objective?: string;
}

export interface NormalizedDailyStats {
  campaignExternalId: string;
  date: Date;
  impressions: number;
  clicks: number;
  spend: number;
  conversions: number;
  revenue: number;
}

/**
 * Google Ads API Version
 */
const ADS_API_VERSION = 'v17';

/**
 * Refreshes Google OAuth access token if expired
 */
async function refreshAccessToken(integration: Integration): Promise<string> {
  if (!integration.refreshToken) {
    throw new IntegrationError('No refresh token available', 'google_ads');
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
    const error = await response.text();
    logger.error({ error }, 'Failed to refresh Google token');
    throw new IntegrationError('Failed to refresh Google token', 'google_ads');
  }
  
  const tokens = await response.json() as { access_token: string };
  return tokens.access_token;
}

/**
 * Gets valid access token, refreshing if necessary
 */
async function getAccessToken(integration: Integration): Promise<string> {
  if (!integration.accessToken) {
    throw new IntegrationError('No access token available', 'google_ads');
  }
  
  // Check if token is expired (with 5 min buffer)
  if (integration.accessTokenExpiresAt) {
    const expiresAt = new Date(integration.accessTokenExpiresAt);
    const bufferTime = 5 * 60 * 1000; // 5 minutes
    if (expiresAt.getTime() - bufferTime < Date.now()) {
      logger.info({ integrationId: integration.id }, 'Refreshing expired Google token');
      return refreshAccessToken(integration);
    }
  }
  
  return decryptToken(integration.accessToken);
}

/**
 * Get the Google Ads customer ID from integration config or env
 */
function getCustomerId(integration: Integration): string {
  const config = integration.config as { customerId?: string } | null;
  return config?.customerId || integration.accountId || env.GOOGLE_ADS_CUSTOMER_ID || '';
}

/**
 * Makes a Google Ads API search request
 */
async function executeGoogleAdsQuery(
  accessToken: string,
  customerId: string,
  query: string
): Promise<GoogleAdsApiResponse> {
  if (!hasGoogleAds()) {
    logger.warn('Google Ads API not configured, returning empty results');
    return { results: [] };
  }

  // Remove dashes from customer ID
  const cleanCustomerId = customerId.replace(/-/g, '');
  
  const response = await fetch(
    `https://googleads.googleapis.com/${ADS_API_VERSION}/customers/${cleanCustomerId}/googleAds:search`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'developer-token': env.GOOGLE_ADS_DEVELOPER_TOKEN!,
        'login-customer-id': (env.GOOGLE_ADS_LOGIN_CUSTOMER_ID || '').replace(/-/g, ''),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query }),
    }
  );
  
  if (!response.ok) {
    const errorText = await response.text();
    logger.error({ 
      status: response.status, 
      error: errorText,
      customerId: cleanCustomerId,
    }, 'Google Ads API error');
    throw new IntegrationError(`Google Ads API error: ${response.status}`, 'google_ads');
  }
  
  return await response.json() as GoogleAdsApiResponse;
}

/**
 * Fetches campaigns from Google Ads API
 */
export async function fetchGoogleAdsCampaigns(
  integration: Integration
): Promise<NormalizedCampaign[]> {
  const accessToken = await getAccessToken(integration);
  const customerId = getCustomerId(integration);
  
  if (!customerId) {
    throw new IntegrationError('No customer ID configured', 'google_ads');
  }
  
  const query = `
    SELECT 
      campaign.id,
      campaign.name,
      campaign.status,
      campaign.advertising_channel_type
    FROM campaign
    WHERE campaign.status != 'REMOVED'
    ORDER BY campaign.name
  `;
  
  try {
    logger.info({ integrationId: integration.id, customerId }, 'Fetching Google Ads campaigns');
    
    const data = await executeGoogleAdsQuery(accessToken, customerId, query);
    
    if (!data.results || data.results.length === 0) {
      logger.info({ integrationId: integration.id }, 'No campaigns found');
      return [];
    }
    
    const campaigns: NormalizedCampaign[] = data.results
      .filter(r => r.campaign)
      .map(r => ({
        externalId: r.campaign!.id,
        name: r.campaign!.name,
        status: normalizeStatus(r.campaign!.status),
        objective: r.campaign!.advertisingChannelType,
      }));
    
    logger.info({ 
      integrationId: integration.id, 
      count: campaigns.length 
    }, 'Fetched Google Ads campaigns');
    
    return campaigns;
  } catch (err) {
    logger.error({ error: err, integrationId: integration.id }, 'Failed to fetch Google Ads campaigns');
    throw err instanceof IntegrationError ? err : new IntegrationError('Failed to fetch campaigns from Google Ads', 'google_ads');
  }
}

/**
 * Fetches daily stats from Google Ads API for a date range
 */
export async function fetchGoogleAdsStats(
  integration: Integration,
  startDate: Date,
  endDate: Date
): Promise<NormalizedDailyStats[]> {
  const accessToken = await getAccessToken(integration);
  const customerId = getCustomerId(integration);
  
  if (!customerId) {
    throw new IntegrationError('No customer ID configured', 'google_ads');
  }
  
  const formatDate = (d: Date) => d.toISOString().split('T')[0];
  
  const query = `
    SELECT 
      campaign.id,
      segments.date,
      metrics.impressions,
      metrics.clicks,
      metrics.cost_micros,
      metrics.conversions,
      metrics.conversions_value
    FROM campaign
    WHERE segments.date BETWEEN '${formatDate(startDate)}' AND '${formatDate(endDate)}'
      AND campaign.status != 'REMOVED'
    ORDER BY segments.date DESC
  `;
  
  try {
    logger.info({ 
      integrationId: integration.id,
      customerId,
      startDate: formatDate(startDate),
      endDate: formatDate(endDate),
    }, 'Fetching Google Ads stats');
    
    const data = await executeGoogleAdsQuery(accessToken, customerId, query);
    
    if (!data.results || data.results.length === 0) {
      logger.info({ integrationId: integration.id }, 'No stats found for date range');
      return [];
    }
    
    const stats: NormalizedDailyStats[] = data.results
      .filter(r => r.campaign && r.metrics && r.segments)
      .map(r => {
        const costMicros = parseInt(r.metrics!.costMicros || '0', 10);
        return {
          campaignExternalId: r.campaign!.id,
          date: new Date(r.segments!.date),
          impressions: parseInt(r.metrics!.impressions || '0', 10),
          clicks: parseInt(r.metrics!.clicks || '0', 10),
          spend: costMicros / 1_000_000, // Convert micros to dollars
          conversions: parseFloat(r.metrics!.conversions || '0'),
          revenue: parseFloat(r.metrics!.conversionsValue || '0'),
        };
      });
    
    logger.info({ 
      integrationId: integration.id, 
      count: stats.length 
    }, 'Fetched Google Ads stats');
    
    return stats;
  } catch (err) {
    logger.error({ error: err, integrationId: integration.id }, 'Failed to fetch Google Ads stats');
    throw err instanceof IntegrationError ? err : new IntegrationError('Failed to fetch stats from Google Ads', 'google_ads');
  }
}

/**
 * Fetches stats for a specific date range (for backfill jobs)
 */
export async function backfillGoogleAdsStats(
  integration: Integration,
  days: number = 90
): Promise<{ campaignsCount: number; statsCount: number }> {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  logger.info({ 
    integrationId: integration.id, 
    days,
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
  }, 'Starting Google Ads backfill');
  
  const campaigns = await fetchGoogleAdsCampaigns(integration);
  const stats = await fetchGoogleAdsStats(integration, startDate, endDate);
  
  return {
    campaignsCount: campaigns.length,
    statsCount: stats.length,
  };
}

/**
 * Normalizes Google Ads campaign status to our internal format
 */
export function normalizeStatus(status: string): 'active' | 'paused' | 'deleted' {
  switch (status) {
    case 'ENABLED':
      return 'active';
    case 'PAUSED':
      return 'paused';
    case 'REMOVED':
    default:
      return 'deleted';
  }
}
