import { Worker, Queue, Job } from 'bullmq';
import { nanoid } from 'nanoid';
import { eq, and } from 'drizzle-orm';
import IORedis from 'ioredis';
import { db, integrations, campaigns, dailyStats, syncJobs, seoStats, seoKeywords, webVitals } from '../db/index.js';
import type { Integration } from '../db/schema.js';
import { fetchGoogleAdsCampaigns, fetchGoogleAdsStats } from '../services/google-ads.js';
import { fetchMetaCampaigns, fetchMetaStats } from '../services/meta-ads.js';
import { fetchGSCDailyStats } from '../services/search-console.js';
import { getDomainRankedKeywords } from '../services/dataforseo.js';
import { getPageSpeedInsights } from '../services/pagespeed.js';
import { logger } from '../lib/logger.js';
import { env } from '../config/env.js';

// Queue names
export const QUEUE_NAMES = {
  SYNC: 'sync-jobs',
  SEO: 'seo-jobs',
  WEBVITALS: 'webvitals-jobs',
} as const;

// Job types
export type SyncJobType = 'full' | 'delta' | 'backfill';
export type SeoJobType = 'keywords' | 'rankings' | 'full';
export type WebVitalsJobType = 'single' | 'batch';

// Job data interfaces
export interface SyncJobData {
  integrationId: string;
  jobType: SyncJobType;
  startDate?: string;
  endDate?: string;
  days?: number;
}

export interface SeoJobData {
  domain: string;
  jobType: SeoJobType;
  keywords?: string[];
}

export interface WebVitalsJobData {
  urls: string[];
  strategy: 'mobile' | 'desktop' | 'both';
}

// Default sync lookback: 35 days for delta, 90 for backfill
const DELTA_LOOKBACK_DAYS = 35;
const BACKFILL_LOOKBACK_DAYS = 90;

interface SyncResult {
  campaignsProcessed: number;
  statsProcessed: number;
  errors: string[];
}

// Redis connection
let redisConnection: IORedis | null = null;

function getRedisConnection(): IORedis {
  if (!redisConnection) {
    redisConnection = new IORedis(env.REDIS_URL, {
      maxRetriesPerRequest: null, // Required for BullMQ
    });
    
    redisConnection.on('error', (err) => {
      logger.error({ error: err }, 'Redis connection error');
    });
    
    redisConnection.on('connect', () => {
      logger.info('Redis connected');
    });
  }
  return redisConnection;
}

// Queues
let syncQueue: Queue<SyncJobData> | null = null;
let seoQueue: Queue<SeoJobData> | null = null;
let webVitalsQueue: Queue<WebVitalsJobData> | null = null;

export function getSyncQueue(): Queue<SyncJobData> {
  if (!syncQueue) {
    syncQueue = new Queue<SyncJobData>(QUEUE_NAMES.SYNC, {
      connection: getRedisConnection(),
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 50 },
      },
    });
  }
  return syncQueue;
}

export function getSeoQueue(): Queue<SeoJobData> {
  if (!seoQueue) {
    seoQueue = new Queue<SeoJobData>(QUEUE_NAMES.SEO, {
      connection: getRedisConnection(),
      defaultJobOptions: {
        attempts: 2,
        backoff: { type: 'fixed', delay: 10000 },
        removeOnComplete: { count: 50 },
        removeOnFail: { count: 20 },
      },
    });
  }
  return seoQueue;
}

export function getWebVitalsQueue(): Queue<WebVitalsJobData> {
  if (!webVitalsQueue) {
    webVitalsQueue = new Queue<WebVitalsJobData>(QUEUE_NAMES.WEBVITALS, {
      connection: getRedisConnection(),
      defaultJobOptions: {
        attempts: 2,
        backoff: { type: 'fixed', delay: 5000 },
        removeOnComplete: { count: 50 },
        removeOnFail: { count: 20 },
      },
    });
  }
  return webVitalsQueue;
}

/**
 * Adds a sync job to the queue
 */
export async function enqueueSyncJob(
  integrationId: string,
  jobType: SyncJobType = 'delta',
  options?: { startDate?: Date; endDate?: Date; days?: number }
): Promise<string> {
  const jobId = nanoid();
  const queue = getSyncQueue();
  
  await queue.add(
    `sync-${integrationId}`,
    {
      integrationId,
      jobType,
      startDate: options?.startDate?.toISOString(),
      endDate: options?.endDate?.toISOString(),
      days: options?.days,
    },
    { jobId }
  );
  
  logger.info({ jobId, integrationId, jobType }, 'Sync job enqueued');
  return jobId;
}

/**
 * Adds an SEO job to the queue
 */
export async function enqueueSeoJob(
  domain: string,
  jobType: SeoJobType = 'full',
  keywords?: string[]
): Promise<string> {
  const jobId = nanoid();
  const queue = getSeoQueue();
  
  await queue.add(
    `seo-${domain}`,
    { domain, jobType, keywords },
    { jobId }
  );
  
  logger.info({ jobId, domain, jobType }, 'SEO job enqueued');
  return jobId;
}

/**
 * Adds a web vitals job to the queue
 */
export async function enqueueWebVitalsJob(
  urls: string[],
  strategy: 'mobile' | 'desktop' | 'both' = 'mobile'
): Promise<string> {
  const jobId = nanoid();
  const queue = getWebVitalsQueue();
  
  await queue.add(
    `webvitals-${Date.now()}`,
    { urls, strategy },
    { jobId }
  );
  
  logger.info({ jobId, urlCount: urls.length, strategy }, 'Web vitals job enqueued');
  return jobId;
}

/**
 * Schedule recurring sync jobs
 */
export async function scheduleRecurringSyncs(): Promise<void> {
  const queue = getSyncQueue();
  
  // Get all connected integrations
  const connectedIntegrations = await db.query.integrations.findMany({
    where: eq(integrations.status, 'connected'),
  });
  
  for (const integration of connectedIntegrations) {
    // Daily full sync at 02:00 UTC
    await queue.add(
      `daily-sync-${integration.id}`,
      { integrationId: integration.id, jobType: 'full' },
      {
        repeat: {
          pattern: '0 2 * * *', // 2 AM UTC daily
          tz: 'UTC',
        },
        jobId: `daily-${integration.id}`,
      }
    );
    
    // Hourly delta sync
    await queue.add(
      `hourly-sync-${integration.id}`,
      { integrationId: integration.id, jobType: 'delta' },
      {
        repeat: {
          pattern: '0 * * * *', // Every hour
          tz: 'UTC',
        },
        jobId: `hourly-${integration.id}`,
      }
    );
  }
  
  logger.info({ count: connectedIntegrations.length }, 'Scheduled recurring syncs');
}

/**
 * Syncs all connected integrations (manual trigger)
 */
export async function syncAllIntegrations(): Promise<string[]> {
  const connectedIntegrations = await db.query.integrations.findMany({
    where: eq(integrations.status, 'connected'),
  });
  
  logger.info({ count: connectedIntegrations.length }, 'Queueing sync for all integrations');
  
  const jobIds: string[] = [];
  for (const integration of connectedIntegrations) {
    const jobId = await enqueueSyncJob(integration.id, 'delta');
    jobIds.push(jobId);
  }
  
  return jobIds;
}

/**
 * Syncs a single integration (creates job record and processes)
 */
export async function syncIntegration(integration: Integration): Promise<string> {
  const jobId = nanoid();
  
  // Create sync job record
  await db.insert(syncJobs).values({
    id: jobId,
    integrationId: integration.id,
    jobType: 'full',
    status: 'running',
    startedAt: new Date(),
  });
  
  // Mark integration as syncing
  await db.update(integrations)
    .set({ status: 'syncing', updatedAt: new Date() })
    .where(eq(integrations.id, integration.id));
  
  logger.info({ jobId, integrationId: integration.id, platform: integration.platform }, 'Starting sync');
  
  try {
    const result = await performSync(integration, 'full');
    
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
        lastError: null,
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
        lastError: errorMessage,
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
async function performSync(
  integration: Integration,
  jobType: SyncJobType,
  startDateOverride?: Date,
  endDateOverride?: Date
): Promise<SyncResult> {
  const result: SyncResult = {
    campaignsProcessed: 0,
    statsProcessed: 0,
    errors: [],
  };
  
  const endDate = endDateOverride || new Date();
  const startDate = startDateOverride || new Date();
  
  // Set date range based on job type
  if (!startDateOverride) {
    switch (jobType) {
      case 'backfill':
        startDate.setDate(startDate.getDate() - BACKFILL_LOOKBACK_DAYS);
        break;
      case 'delta':
        startDate.setDate(startDate.getDate() - 7); // Last 7 days for delta
        break;
      case 'full':
      default:
        startDate.setDate(startDate.getDate() - DELTA_LOOKBACK_DAYS);
        break;
    }
  }
  
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
        // Analytics data is synced separately
        break;
    }
  } catch (err) {
    result.errors.push(`Fetch error: ${err instanceof Error ? err.message : 'Unknown'}`);
    throw err;
  }
  
  // Upsert campaigns
  for (const campaign of fetchedCampaigns) {
    try {
      const existingCampaign = await db.query.campaigns.findFirst({
        where: and(
          eq(campaigns.integrationId, integration.id),
          eq(campaigns.externalId, campaign.externalId)
        ),
      });
      
      if (existingCampaign) {
        await db.update(campaigns)
          .set({
            name: campaign.name,
            status: campaign.status,
            objective: campaign.objective,
            updatedAt: new Date(),
          })
          .where(eq(campaigns.id, existingCampaign.id));
      } else {
        await db.insert(campaigns).values({
          integrationId: integration.id,
          externalId: campaign.externalId,
          platform: integration.platform,
          name: campaign.name,
          status: campaign.status,
          objective: campaign.objective,
        });
      }
      result.campaignsProcessed++;
    } catch (err) {
      result.errors.push(`Campaign upsert error: ${campaign.externalId}`);
      logger.error({ error: err, campaign: campaign.externalId }, 'Campaign upsert failed');
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
      
      const statDateStr = stat.date.toISOString().split('T')[0];
      
      const existingStat = await db.query.dailyStats.findFirst({
        where: and(
          eq(dailyStats.campaignId, campaignId),
          eq(dailyStats.statDate, statDateStr)
        ),
      });
      
      const statData = {
        impressions: stat.impressions,
        clicks: stat.clicks,
        spend: String(spend),
        conversions: stat.conversions,
        revenue: String(stat.revenue),
        roas: roas ? String(roas) : null,
        ctr: ctr ? String(ctr) : null,
        cpc: cpc ? String(cpc) : null,
        cpa: cpa ? String(cpa) : null,
        updatedAt: new Date(),
      };
      
      if (existingStat) {
        await db.update(dailyStats)
          .set(statData)
          .where(eq(dailyStats.id, existingStat.id));
      } else {
        await db.insert(dailyStats).values({
          campaignId,
          statDate: statDateStr,
          sourceType: integration.platform,
          ...statData,
        });
      }
      result.statsProcessed++;
    } catch (err) {
      result.errors.push(`Stats upsert error: ${stat.campaignExternalId} ${stat.date}`);
      logger.error({ error: err, stat }, 'Stats upsert failed');
    }
  }
  
  return result;
}

/**
 * Process sync job from queue
 */
async function processSyncJob(job: Job<SyncJobData>): Promise<void> {
  const { integrationId, jobType, startDate, endDate } = job.data;
  
  logger.info({ jobId: job.id, integrationId, jobType }, 'Processing sync job');
  
  const integration = await db.query.integrations.findFirst({
    where: eq(integrations.id, integrationId),
  });
  
  if (!integration) {
    throw new Error(`Integration not found: ${integrationId}`);
  }
  
  // Create sync job record
  await db.insert(syncJobs).values({
    id: job.id!,
    integrationId,
    jobType,
    status: 'running',
    startedAt: new Date(),
    metadata: { startDate, endDate },
  });
  
  try {
    const result = await performSync(
      integration,
      jobType,
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined
    );
    
    await db.update(syncJobs)
      .set({
        status: 'completed',
        completedAt: new Date(),
        campaignsProcessed: result.campaignsProcessed,
        statsProcessed: result.statsProcessed,
        errorMessage: result.errors.length > 0 ? result.errors.join('; ') : null,
      })
      .where(eq(syncJobs.id, job.id!));
    
    await db.update(integrations)
      .set({
        status: 'connected',
        lastSyncAt: new Date(),
        lastError: null,
        updatedAt: new Date(),
      })
      .where(eq(integrations.id, integrationId));
      
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    
    await db.update(syncJobs)
      .set({
        status: 'failed',
        completedAt: new Date(),
        errorMessage,
      })
      .where(eq(syncJobs.id, job.id!));
    
    await db.update(integrations)
      .set({
        status: 'error',
        lastError: errorMessage,
        updatedAt: new Date(),
      })
      .where(eq(integrations.id, integrationId));
    
    throw err;
  }
}

/**
 * Process SEO job from queue
 */
async function processSeoJob(job: Job<SeoJobData>): Promise<void> {
  const { domain, jobType, keywords } = job.data;
  
  logger.info({ jobId: job.id, domain, jobType }, 'Processing SEO job');
  
  try {
    if (jobType === 'keywords' || jobType === 'full') {
      // Fetch ranked keywords from DataForSEO
      const rankedKeywords = await getDomainRankedKeywords(domain);
      
      // Store in database
      for (const kw of rankedKeywords) {
        const existingKeyword = await db.query.seoKeywords.findFirst({
          where: eq(seoKeywords.keyword, kw.keyword),
        });
        
        if (existingKeyword) {
          await db.update(seoKeywords)
            .set({
              searchVolume: kw.searchVolume,
              rankPosition: kw.position,
              rankUrl: kw.url,
              lastUpdated: new Date(),
            })
            .where(eq(seoKeywords.id, existingKeyword.id));
        } else {
          await db.insert(seoKeywords).values({
            keyword: kw.keyword,
            searchVolume: kw.searchVolume,
            rankPosition: kw.position,
            rankUrl: kw.url,
          });
        }
      }
      
      logger.info({ domain, keywordsCount: rankedKeywords.length }, 'SEO keywords updated');
    }
  } catch (err) {
    logger.error({ error: err, domain, jobType }, 'SEO job failed');
    throw err;
  }
}

/**
 * Process web vitals job from queue
 */
async function processWebVitalsJob(job: Job<WebVitalsJobData>): Promise<void> {
  const { urls, strategy } = job.data;
  
  logger.info({ jobId: job.id, urlCount: urls.length, strategy }, 'Processing web vitals job');
  
  for (const url of urls) {
    try {
      const strategies: Array<'mobile' | 'desktop'> = 
        strategy === 'both' ? ['mobile', 'desktop'] : [strategy];
      
      for (const strat of strategies) {
        const result = await getPageSpeedInsights(url, strat);
        
        await db.insert(webVitals).values({
          url: result.url,
          strategy: strat,
          lcp: result.lcp,
          lcpScore: result.lcpScore,
          inp: result.inp,
          inpScore: result.inpScore,
          cls: result.cls,
          clsScore: result.clsScore,
          fcp: result.fcp,
          ttfb: result.ttfb,
          speedIndex: result.speedIndex,
          totalBlockingTime: result.totalBlockingTime,
          performanceScore: result.performanceScore,
          accessibilityScore: result.accessibilityScore,
          bestPracticesScore: result.bestPracticesScore,
          seoScore: result.seoScore,
          measuredAt: new Date(),
        });
      }
    } catch (err) {
      logger.error({ error: err, url }, 'Web vitals fetch failed');
    }
  }
}

/**
 * Start the worker processes
 */
export function startWorkers(): void {
  const connection = getRedisConnection();
  
  // Sync worker
  const syncWorker = new Worker<SyncJobData>(
    QUEUE_NAMES.SYNC,
    processSyncJob,
    { connection, concurrency: 2 }
  );
  
  syncWorker.on('completed', (job) => {
    logger.info({ jobId: job.id }, 'Sync job completed');
  });
  
  syncWorker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, error: err.message }, 'Sync job failed');
  });
  
  // SEO worker
  const seoWorker = new Worker<SeoJobData>(
    QUEUE_NAMES.SEO,
    processSeoJob,
    { connection, concurrency: 1 }
  );
  
  seoWorker.on('completed', (job) => {
    logger.info({ jobId: job.id }, 'SEO job completed');
  });
  
  seoWorker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, error: err.message }, 'SEO job failed');
  });
  
  // Web vitals worker
  const webVitalsWorker = new Worker<WebVitalsJobData>(
    QUEUE_NAMES.WEBVITALS,
    processWebVitalsJob,
    { connection, concurrency: 1 }
  );
  
  webVitalsWorker.on('completed', (job) => {
    logger.info({ jobId: job.id }, 'Web vitals job completed');
  });
  
  webVitalsWorker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, error: err.message }, 'Web vitals job failed');
  });
  
  logger.info('All workers started');
}

/**
 * Gets the status of a sync job
 */
export async function getSyncJobStatus(jobId: string) {
  return db.query.syncJobs.findFirst({
    where: eq(syncJobs.id, jobId),
  });
}

// Export for standalone worker process
export { processSyncJob, processSeoJob, processWebVitalsJob };
