import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { db, integrations, syncJobs } from '../db/index.js';
import { syncIntegration, getSyncJobStatus } from '../jobs/sync-worker.js';
import { NotFoundError } from '../lib/errors.js';
import { logger } from '../lib/logger.js';

const integrationsRouter = new Hono();

/**
 * GET /api/v1/integrations
 * Returns list of all integrations with their status
 */
integrationsRouter.get('/', async (c) => {
  const allIntegrations = await db.query.integrations.findMany({
    orderBy: (integrations, { desc }) => [desc(integrations.updatedAt)],
  });
  
  return c.json({
    integrations: allIntegrations.map(int => ({
      id: int.id,
      platform: int.platform,
      accountName: int.accountName,
      status: int.status,
      lastSyncAt: int.lastSyncAt?.toISOString() || null,
      // Friendly display name
      name: getPlatformDisplayName(int.platform),
      icon: getPlatformIcon(int.platform),
    })),
  });
});

/**
 * GET /api/v1/integrations/:id
 * Returns detailed integration info
 */
integrationsRouter.get('/:id', async (c) => {
  const integrationId = c.req.param('id');
  
  const integration = await db.query.integrations.findFirst({
    where: eq(integrations.id, integrationId),
  });
  
  if (!integration) {
    throw new NotFoundError('Integration not found');
  }
  
  // Get recent sync jobs
  const recentJobs = await db.query.syncJobs.findMany({
    where: eq(syncJobs.integrationId, integrationId),
    orderBy: (syncJobs, { desc }) => [desc(syncJobs.createdAt)],
    limit: 5,
  });
  
  return c.json({
    id: integration.id,
    platform: integration.platform,
    accountId: integration.accountId,
    accountName: integration.accountName,
    status: integration.status,
    lastSyncAt: integration.lastSyncAt?.toISOString() || null,
    tokenExpiresAt: integration.tokenExpiresAt?.toISOString() || null,
    createdAt: integration.createdAt.toISOString(),
    recentSyncJobs: recentJobs.map(job => ({
      id: job.id,
      status: job.status,
      startedAt: job.startedAt?.toISOString() || null,
      completedAt: job.completedAt?.toISOString() || null,
      campaignsProcessed: job.campaignsProcessed,
      statsProcessed: job.statsProcessed,
      errorMessage: job.errorMessage,
    })),
  });
});

/**
 * POST /api/v1/integrations/:id/sync
 * Triggers a sync for the integration
 */
integrationsRouter.post('/:id/sync', async (c) => {
  const integrationId = c.req.param('id');
  
  const integration = await db.query.integrations.findFirst({
    where: eq(integrations.id, integrationId),
  });
  
  if (!integration) {
    throw new NotFoundError('Integration not found');
  }
  
  if (integration.status === 'syncing') {
    return c.json({ 
      message: 'Sync already in progress',
      status: 'syncing',
    }, 409);
  }
  
  logger.info({ integrationId }, 'Manual sync triggered');
  
  // Start sync in background
  const jobId = await syncIntegration(integration);
  
  return c.json({
    jobId,
    status: 'queued',
    message: 'Sync started successfully',
  });
});

/**
 * GET /api/v1/integrations/sync/:jobId
 * Gets the status of a sync job
 */
integrationsRouter.get('/sync/:jobId', async (c) => {
  const jobId = c.req.param('jobId');
  
  const job = await getSyncJobStatus(jobId);
  
  if (!job) {
    throw new NotFoundError('Sync job not found');
  }
  
  return c.json({
    id: job.id,
    integrationId: job.integrationId,
    status: job.status,
    startedAt: job.startedAt?.toISOString() || null,
    completedAt: job.completedAt?.toISOString() || null,
    campaignsProcessed: job.campaignsProcessed,
    statsProcessed: job.statsProcessed,
    errorMessage: job.errorMessage,
  });
});

// Helper functions
function getPlatformDisplayName(platform: string): string {
  const names: Record<string, string> = {
    google_ads: 'Google Ads',
    meta_ads: 'Meta Business',
    ga4: 'Google Analytics 4',
  };
  return names[platform] || platform;
}

function getPlatformIcon(platform: string): string {
  const icons: Record<string, string> = {
    google_ads: 'google',
    meta_ads: 'facebook',
    ga4: 'activity',
  };
  return icons[platform] || 'link';
}

export default integrationsRouter;

