import { Hono } from 'hono';
import { eq, desc } from 'drizzle-orm';
import { db, integrations, syncJobs } from '../db/index.js';
import { 
  enqueueSyncJob, 
  enqueueSeoJob, 
  enqueueWebVitalsJob,
  getSyncJobStatus,
  syncAllIntegrations,
} from '../jobs/sync-worker.js';
import { logger } from '../lib/logger.js';
import { env } from '../config/env.js';

const sync = new Hono();

/**
 * POST /api/v1/sync/google-ads
 * Trigger a sync for Google Ads integration
 */
sync.post('/google-ads', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const { jobType = 'delta', days } = body;
  
  // Find Google Ads integration
  const integration = await db.query.integrations.findFirst({
    where: eq(integrations.platform, 'google_ads'),
  });
  
  if (!integration) {
    return c.json({ error: 'Google Ads integration not found' }, 404);
  }
  
  if (integration.status !== 'connected') {
    return c.json({ error: 'Google Ads integration not connected' }, 400);
  }
  
  try {
    const jobId = await enqueueSyncJob(integration.id, jobType, { days });
    
    return c.json({
      success: true,
      jobId,
      integrationId: integration.id,
      jobType,
      message: 'Sync job queued successfully',
    });
  } catch (err) {
    logger.error({ error: err }, 'Failed to queue Google Ads sync');
    return c.json({ error: 'Failed to queue sync job' }, 500);
  }
});

/**
 * POST /api/v1/sync/all
 * Trigger sync for all connected integrations
 */
sync.post('/all', async (c) => {
  try {
    const jobIds = await syncAllIntegrations();
    
    return c.json({
      success: true,
      jobIds,
      count: jobIds.length,
      message: `Queued ${jobIds.length} sync jobs`,
    });
  } catch (err) {
    logger.error({ error: err }, 'Failed to queue all syncs');
    return c.json({ error: 'Failed to queue sync jobs' }, 500);
  }
});

/**
 * POST /api/v1/sync/seo
 * Trigger an SEO data refresh
 */
sync.post('/seo', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const { domain, jobType = 'full' } = body;
  
  const targetDomain = domain || env.GSC_SITE_URL?.replace('https://', '').replace('http://', '');
  
  if (!targetDomain) {
    return c.json({ error: 'No domain configured' }, 400);
  }
  
  try {
    const jobId = await enqueueSeoJob(targetDomain, jobType);
    
    return c.json({
      success: true,
      jobId,
      domain: targetDomain,
      jobType,
      message: 'SEO job queued successfully',
    });
  } catch (err) {
    logger.error({ error: err }, 'Failed to queue SEO job');
    return c.json({ error: 'Failed to queue SEO job' }, 500);
  }
});

/**
 * POST /api/v1/sync/webvitals
 * Trigger web vitals measurement
 */
sync.post('/webvitals', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const { urls, strategy = 'both' } = body;
  
  const targetUrls = urls || [env.GSC_SITE_URL].filter(Boolean);
  
  if (!targetUrls.length) {
    return c.json({ error: 'No URLs provided' }, 400);
  }
  
  try {
    const jobId = await enqueueWebVitalsJob(targetUrls, strategy);
    
    return c.json({
      success: true,
      jobId,
      urls: targetUrls,
      strategy,
      message: 'Web vitals job queued successfully',
    });
  } catch (err) {
    logger.error({ error: err }, 'Failed to queue web vitals job');
    return c.json({ error: 'Failed to queue web vitals job' }, 500);
  }
});

/**
 * GET /api/v1/sync/status/:jobId
 * Get the status of a sync job
 */
sync.get('/status/:jobId', async (c) => {
  const jobId = c.req.param('jobId');
  
  const job = await getSyncJobStatus(jobId);
  
  if (!job) {
    return c.json({ error: 'Job not found' }, 404);
  }
  
  return c.json({
    id: job.id,
    integrationId: job.integrationId,
    jobType: job.jobType,
    status: job.status,
    startedAt: job.startedAt,
    completedAt: job.completedAt,
    campaignsProcessed: job.campaignsProcessed,
    statsProcessed: job.statsProcessed,
    errorMessage: job.errorMessage,
    createdAt: job.createdAt,
  });
});

/**
 * GET /api/v1/sync/jobs
 * Get recent sync jobs
 */
sync.get('/jobs', async (c) => {
  const { limit = '20', integrationId } = c.req.query();
  
  let query = db.select()
    .from(syncJobs)
    .orderBy(desc(syncJobs.createdAt))
    .limit(parseInt(limit));
  
  if (integrationId) {
    query = db.select()
      .from(syncJobs)
      .where(eq(syncJobs.integrationId, integrationId))
      .orderBy(desc(syncJobs.createdAt))
      .limit(parseInt(limit));
  }
  
  const jobs = await query;
  
  return c.json({
    jobs: jobs.map(j => ({
      id: j.id,
      integrationId: j.integrationId,
      jobType: j.jobType,
      status: j.status,
      startedAt: j.startedAt,
      completedAt: j.completedAt,
      campaignsProcessed: j.campaignsProcessed,
      statsProcessed: j.statsProcessed,
      errorMessage: j.errorMessage,
      createdAt: j.createdAt,
    })),
  });
});

/**
 * POST /api/v1/sync/backfill
 * Trigger a full historical backfill (60-90 days)
 */
sync.post('/backfill', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const { integrationId, days = 90 } = body;
  
  if (!integrationId) {
    return c.json({ error: 'integrationId is required' }, 400);
  }
  
  const integration = await db.query.integrations.findFirst({
    where: eq(integrations.id, integrationId),
  });
  
  if (!integration) {
    return c.json({ error: 'Integration not found' }, 404);
  }
  
  if (integration.status !== 'connected') {
    return c.json({ error: 'Integration not connected' }, 400);
  }
  
  try {
    const jobId = await enqueueSyncJob(integration.id, 'backfill', { days });
    
    return c.json({
      success: true,
      jobId,
      integrationId: integration.id,
      days,
      message: `Backfill job queued for ${days} days`,
    });
  } catch (err) {
    logger.error({ error: err }, 'Failed to queue backfill');
    return c.json({ error: 'Failed to queue backfill job' }, 500);
  }
});

export default sync;




