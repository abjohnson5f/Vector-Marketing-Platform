import { Integration } from '../db/schema.js';
import { decryptToken } from '../lib/crypto.js';
import { IntegrationError } from '../lib/errors.js';
import { logger } from '../lib/logger.js';

interface MetaCampaign {
  id: string;
  name: string;
  status: 'ACTIVE' | 'PAUSED' | 'DELETED' | 'ARCHIVED';
  objective?: string;
}

interface MetaInsight {
  campaign_id: string;
  date_start: string;
  impressions: string;
  clicks: string;
  spend: string;
  actions?: Array<{ action_type: string; value: string }>;
  action_values?: Array<{ action_type: string; value: string }>;
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

const META_API_VERSION = 'v19.0';

/**
 * Gets valid access token from integration
 */
function getAccessToken(integration: Integration): string {
  if (!integration.accessToken) {
    throw new IntegrationError('No access token available', 'meta_ads');
  }
  return decryptToken(integration.accessToken);
}

/**
 * Fetches ad accounts associated with the user
 */
export async function fetchAdAccounts(integration: Integration): Promise<string[]> {
  const accessToken = getAccessToken(integration);
  
  try {
    const response = await fetch(
      `https://graph.facebook.com/${META_API_VERSION}/me/adaccounts?fields=id,name&access_token=${accessToken}`
    );
    
    if (!response.ok) {
      throw new IntegrationError('Failed to fetch ad accounts', 'meta_ads');
    }
    
    const data = await response.json() as { data: Array<{ id: string; name: string }> };
    return data.data.map(acc => acc.id);
  } catch (err) {
    logger.error({ error: err, integrationId: integration.id }, 'Failed to fetch Meta ad accounts');
    throw new IntegrationError('Failed to fetch ad accounts from Meta', 'meta_ads');
  }
}

/**
 * Fetches campaigns from Meta Marketing API
 */
export async function fetchMetaCampaigns(
  integration: Integration,
  adAccountId?: string
): Promise<NormalizedCampaign[]> {
  const accessToken = getAccessToken(integration);
  
  try {
    // If no specific ad account, fetch all accounts first
    const adAccounts = adAccountId ? [adAccountId] : await fetchAdAccounts(integration);
    
    const allCampaigns: NormalizedCampaign[] = [];
    
    for (const accountId of adAccounts) {
      const response = await fetch(
        `https://graph.facebook.com/${META_API_VERSION}/${accountId}/campaigns?fields=id,name,status,objective&access_token=${accessToken}`
      );
      
      if (!response.ok) {
        logger.warn({ accountId }, 'Failed to fetch campaigns for ad account');
        continue;
      }
      
      const data = await response.json() as { data: MetaCampaign[] };
      
      for (const campaign of data.data) {
        allCampaigns.push({
          externalId: campaign.id,
          name: campaign.name,
          status: normalizeStatus(campaign.status),
          objective: campaign.objective,
        });
      }
    }
    
    logger.info({ 
      integrationId: integration.id,
      campaignCount: allCampaigns.length,
    }, 'Fetched Meta campaigns');
    
    return allCampaigns;
  } catch (err) {
    logger.error({ error: err, integrationId: integration.id }, 'Failed to fetch Meta campaigns');
    if (err instanceof IntegrationError) throw err;
    throw new IntegrationError('Failed to fetch campaigns from Meta', 'meta_ads');
  }
}

/**
 * Fetches daily insights from Meta Marketing API for a date range
 */
export async function fetchMetaStats(
  integration: Integration,
  startDate: Date,
  endDate: Date,
  adAccountId?: string
): Promise<NormalizedDailyStats[]> {
  const accessToken = getAccessToken(integration);
  
  const formatDate = (d: Date) => d.toISOString().split('T')[0];
  
  try {
    const adAccounts = adAccountId ? [adAccountId] : await fetchAdAccounts(integration);
    
    const allStats: NormalizedDailyStats[] = [];
    
    for (const accountId of adAccounts) {
      const params = new URLSearchParams({
        fields: 'campaign_id,impressions,clicks,spend,actions,action_values',
        time_range: JSON.stringify({
          since: formatDate(startDate),
          until: formatDate(endDate),
        }),
        time_increment: '1', // Daily breakdown
        level: 'campaign',
        access_token: accessToken,
      });
      
      const response = await fetch(
        `https://graph.facebook.com/${META_API_VERSION}/${accountId}/insights?${params}`
      );
      
      if (!response.ok) {
        logger.warn({ accountId }, 'Failed to fetch insights for ad account');
        continue;
      }
      
      const data = await response.json() as { data: MetaInsight[] };
      
      for (const insight of data.data) {
        const conversions = extractConversions(insight.actions);
        const revenue = extractRevenue(insight.action_values);
        
        allStats.push({
          campaignExternalId: insight.campaign_id,
          date: new Date(insight.date_start),
          impressions: parseInt(insight.impressions, 10) || 0,
          clicks: parseInt(insight.clicks, 10) || 0,
          spend: parseFloat(insight.spend) || 0,
          conversions,
          revenue,
        });
      }
    }
    
    logger.info({ 
      integrationId: integration.id,
      startDate: formatDate(startDate),
      endDate: formatDate(endDate),
      statsCount: allStats.length,
    }, 'Fetched Meta stats');
    
    return allStats;
  } catch (err) {
    logger.error({ error: err, integrationId: integration.id }, 'Failed to fetch Meta stats');
    if (err instanceof IntegrationError) throw err;
    throw new IntegrationError('Failed to fetch stats from Meta', 'meta_ads');
  }
}

/**
 * Extracts conversion count from Meta actions array
 */
function extractConversions(actions?: Array<{ action_type: string; value: string }>): number {
  if (!actions) return 0;
  
  // Sum up offsite conversion actions
  const conversionTypes = [
    'offsite_conversion',
    'offsite_conversion.fb_pixel_purchase',
    'purchase',
    'omni_purchase',
  ];
  
  let total = 0;
  for (const action of actions) {
    if (conversionTypes.some(type => action.action_type.includes(type))) {
      total += parseInt(action.value, 10) || 0;
    }
  }
  
  return total;
}

/**
 * Extracts revenue from Meta action_values array
 */
function extractRevenue(actionValues?: Array<{ action_type: string; value: string }>): number {
  if (!actionValues) return 0;
  
  const revenueTypes = [
    'offsite_conversion.fb_pixel_purchase',
    'purchase',
    'omni_purchase',
  ];
  
  let total = 0;
  for (const action of actionValues) {
    if (revenueTypes.some(type => action.action_type.includes(type))) {
      total += parseFloat(action.value) || 0;
    }
  }
  
  return total;
}

/**
 * Normalizes Meta campaign status to our internal format
 */
export function normalizeStatus(status: string): 'active' | 'paused' | 'deleted' {
  switch (status) {
    case 'ACTIVE':
      return 'active';
    case 'PAUSED':
      return 'paused';
    case 'DELETED':
    case 'ARCHIVED':
    default:
      return 'deleted';
  }
}

