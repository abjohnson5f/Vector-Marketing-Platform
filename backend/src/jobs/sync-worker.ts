import { nanoid } from 'nanoid';
import { eq, and, gte, lte } from 'drizzle-orm';
import { db, integrations, campaigns, dailyStats, syncJobs, type Integration } from '../db/index.js';
import { fetchGoogleAdsCampaigns, fetchGoogleAdsStats } from '../services/google-ads.js';
import { fetchMetaCampaigns, fetchMetaStats } from '../services/meta-ads.js';
import { logger } from '../lib/logger.js';

// Default sync lookback: 35 days
const DEFAULT_LOOKBACK_DAYS = 35;

interface SyncResult {
  campaignsProcessed: number;
  statsProcessed: number;
  errors: string[];
}

/**
 * Syncs all connected integrations
 */
export async function syncAllIntegrations(): Promise<void> {
  const connectedIntegrations = await db.query.integrations.findMany({
    where: eq(integrations.status, 'connected'),
  });
  
  logger.info({ count: connectedIntegrations.length }, 'Starting sync for all integrations');
  
  for (const integration of connectedIntegrations) {
    try {
      await syncIntegration(integration);
    } catch (err) {
      logger.error({ error: err, integrationId: integration.id }, 'Failed to sync integration');
    }
  }
}

/**
 * Syncs a single integration
 */
export async function syncIntegration(integration: Integration): Promise<string> {
  const jobId = nanoid();
  
  // Create sync job record
  await db.insert(syncJobs).values({
    id: jobId,
    integrationId: integration.id,
    status: 'running',
    startedAt: new Date(),
  });
  
  // Mark integration as syncing
  await db.update(integrations)
    .set({ status: 'syncing', updatedAt: new Date() })
    .where(eq(integrations.id, integration.id));
  
  logger.info({ jobId, integrationId: integration.id, platform: integration.platform }, 'Starting sync');
  
  try {
    const result = await performSync(integration);
    
    // Update job as completed
    await db.update(syncJobs)
      .set({
        status: 'completed',
        completedAt: new Date(),
        campaignsProcessed: result.campaignsProcessed,
        statsProcessed: result.statsProcessed,
        errorMessage: result.errors.length > 0 ? result.errors.join('; ') : null,
      })
      .where(eq(syncJobs.id, jobId));
    
    // Update integration
    await db.update(integrations)
      .set({
        status: 'connected',
        lastSyncAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(integrations.id, integration.id));
    
    logger.info({ 
      jobId, 
      integrationId: integration.id,
      campaignsProcessed: result.campaignsProcessed,
      statsProcessed: result.statsProcessed,
    }, 'Sync completed');
    
    return jobId;
    
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    
    // Update job as failed
    await db.update(syncJobs)
      .set({
        status: 'failed',
        completedAt: new Date(),
        errorMessage,
      })
      .where(eq(syncJobs.id, jobId));
    
    // Mark integration as error
    await db.update(integrations)
      .set({
        status: 'error',
        updatedAt: new Date(),
      })
      .where(eq(integrations.id, integration.id));
    
    logger.error({ jobId, integrationId: integration.id, error: errorMessage }, 'Sync failed');
    
    throw err;
  }
}

/**
 * Performs the actual data sync for an integration
 */
async function performSync(integration: Integration): Promise<SyncResult> {
  const result: SyncResult = {
    campaignsProcessed: 0,
    statsProcessed: 0,
    errors: [],
  };
  
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - DEFAULT_LOOKBACK_DAYS);
  
  let fetchedCampaigns: Array<{
    externalId: string;
    name: string;
    status: 'active' | 'paused' | 'deleted';
    objective?: string;
  }> = [];
  
  let fetchedStats: Array<{
    campaignExternalId: string;
    date: Date;
    impressions: number;
    clicks: number;
    spend: number;
    conversions: number;
    revenue: number;
  }> = [];
  
  // Fetch data based on platform
  try {
    switch (integration.platform) {
      case 'google_ads':
        fetchedCampaigns = await fetchGoogleAdsCampaigns(integration);
        fetchedStats = await fetchGoogleAdsStats(integration, startDate, endDate);
        break;
        
      case 'meta_ads':
        fetchedCampaigns = await fetchMetaCampaigns(integration);
        fetchedStats = await fetchMetaStats(integration, startDate, endDate);
        break;
        
      case 'ga4':
        // GA4 doesn't have campaigns in the same sense
        // We'd sync analytics data separately
        break;
    }
  } catch (err) {
    result.errors.push(`Fetch error: ${err instanceof Error ? err.message : 'Unknown'}`);
    throw err;
  }
  
  // Upsert campaigns
  for (const campaign of fetchedCampaigns) {
    try {
      await db.insert(campaigns).values({
        id: nanoid(),
        integrationId: integration.id,
        externalId: campaign.externalId,
        platform: integration.platform,
        name: campaign.name,
        status: campaign.status,
        objective: campaign.objective,
      }).onConflictDoUpdate({
        target: [campaigns.integrationId, campaigns.externalId],
        set: {
          name: campaign.name,
          status: campaign.status,
          objective: campaign.objective,
          updatedAt: new Date(),
        },
      });
      result.campaignsProcessed++;
    } catch (err) {
      result.errors.push(`Campaign upsert error: ${campaign.externalId}`);
    }
  }
  
  // Get campaign ID mapping
  const campaignRecords = await db.query.campaigns.findMany({
    where: eq(campaigns.integrationId, integration.id),
  });
  const campaignIdMap = new Map(
    campaignRecords.map(c => [c.externalId, c.id])
  );
  
  // Upsert daily stats
  for (const stat of fetchedStats) {
    const campaignId = campaignIdMap.get(stat.campaignExternalId);
    if (!campaignId) {
      result.errors.push(`Unknown campaign: ${stat.campaignExternalId}`);
      continue;
    }
    
    try {
      // Calculate derived metrics
      const spend = stat.spend;
      const roas = spend > 0 ? stat.revenue / spend : null;
      const ctr = stat.impressions > 0 ? (stat.clicks / stat.impressions) * 100 : null;
      const cpc = stat.clicks > 0 ? spend / stat.clicks : null;
      const cpa = stat.conversions > 0 ? spend / stat.conversions : null;
      
      await db.insert(dailyStats).values({
        id: nanoid(),
        campaignId,
        date: stat.date,
        impressions: stat.impressions,
        clicks: stat.clicks,
        spend: String(spend),
        conversions: stat.conversions,
        revenue: String(stat.revenue),
        roas: roas ? String(roas) : null,
        ctr: ctr ? String(ctr) : null,
        cpc: cpc ? String(cpc) : null,
        cpa: cpa ? String(cpa) : null,
      }).onConflictDoUpdate({
        target: [dailyStats.campaignId, dailyStats.date],
        set: {
          impressions: stat.impressions,
          clicks: stat.clicks,
          spend: String(spend),
          conversions: stat.conversions,
          revenue: String(stat.revenue),
          roas: roas ? String(roas) : null,
          ctr: ctr ? String(ctr) : null,
          cpc: cpc ? String(cpc) : null,
          cpa: cpa ? String(cpa) : null,
        },
      });
      result.statsProcessed++;
    } catch (err) {
      result.errors.push(`Stats upsert error: ${stat.campaignExternalId} ${stat.date}`);
    }
  }
  
  return result;
}

/**
 * Gets the status of a sync job
 */
export async function getSyncJobStatus(jobId: string) {
  return db.query.syncJobs.findFirst({
    where: eq(syncJobs.id, jobId),
  });
}

