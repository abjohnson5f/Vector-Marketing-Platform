/**
 * Google Indexing API Integration (Using OAuth - More Secure)
 * 
 * Uses user OAuth credentials instead of service account keys.
 * This is the recommended secure approach per Google's authentication docs.
 * 
 * Prerequisites:
 * 1. User must authenticate via /api/auth/google/search-console
 * 2. User must have owner access to the property in Search Console
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { db, integrations } from '../db/index.js';
import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';
import { decryptToken, encryptToken } from '../lib/crypto.js';
import { eq } from 'drizzle-orm';
import { UnauthorizedError, IntegrationError } from '../lib/errors.js';

const indexingRoutes = new Hono();

// URL submission schema
const submitUrlSchema = z.object({
  url: z.string().url(),
  type: z.enum(['URL_UPDATED', 'URL_DELETED']).default('URL_UPDATED'),
});

const batchSubmitSchema = z.object({
  urls: z.array(z.string().url()).min(1).max(100),
  type: z.enum(['URL_UPDATED', 'URL_DELETED']).default('URL_UPDATED'),
});

/**
 * Get a valid access token for Search Console, refreshing if needed
 */
async function getSearchConsoleToken(): Promise<string> {
  const [integration] = await db
    .select()
    .from(integrations)
    .where(eq(integrations.platform, 'search_console'))
    .limit(1);

  if (!integration || integration.status !== 'connected') {
    throw new UnauthorizedError(
      'Search Console not connected. Please authenticate first at /api/auth/google/search-console'
    );
  }

  // Check if token is expired (with 5 min buffer)
  const isExpired = integration.accessTokenExpiresAt && 
    new Date(integration.accessTokenExpiresAt).getTime() < Date.now() + 5 * 60 * 1000;

  if (isExpired && integration.refreshToken) {
    // Refresh the token
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
      throw new IntegrationError('Failed to refresh Search Console token', 'search_console');
    }

    const tokens = await response.json() as { access_token: string; expires_in: number };
    
    // Update stored token
    await db.update(integrations)
      .set({
        accessToken: encryptToken(tokens.access_token),
        accessTokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
        updatedAt: new Date(),
      })
      .where(eq(integrations.id, integration.id));

    return tokens.access_token;
  }

  if (!integration.accessToken) {
    throw new UnauthorizedError('No access token available');
  }

  return decryptToken(integration.accessToken);
}

/**
 * POST /api/v1/indexing/submit
 * Submit a single URL for indexing
 */
indexingRoutes.post('/submit', async (c) => {
  const { url, type } = submitUrlSchema.parse(await c.req.json());
  
  const accessToken = await getSearchConsoleToken();
  
  const response = await fetch('https://indexing.googleapis.com/v3/urlNotifications:publish', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ url, type }),
  });

  const data = await response.json();

  if (!response.ok) {
    logger.error({ url, type, error: data }, 'Indexing API submission failed');
    return c.json({
      success: false,
      url,
      error: data.error?.message || 'Failed to submit URL',
    }, response.status as any);
  }

  logger.info({ url, type, response: data }, 'URL submitted to Indexing API');

  return c.json({
    success: true,
    url,
    type,
    notifyTime: data.urlNotificationMetadata?.latestUpdate?.notifyTime,
  });
});

/**
 * POST /api/v1/indexing/batch
 * Submit multiple URLs for indexing (max 100 per request)
 */
indexingRoutes.post('/batch', async (c) => {
  const { urls, type } = batchSubmitSchema.parse(await c.req.json());
  
  const accessToken = await getSearchConsoleToken();
  
  const results = await Promise.allSettled(
    urls.map(async (url) => {
      const response = await fetch('https://indexing.googleapis.com/v3/urlNotifications:publish', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url, type }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'Failed');
      }
      
      return response.json();
    })
  );

  const successful = results.filter(r => r.status === 'fulfilled').length;
  const failed = results.filter(r => r.status === 'rejected').length;

  logger.info({ 
    totalUrls: urls.length, 
    successful, 
    failed 
  }, 'Batch indexing submission completed');

  return c.json({
    success: true,
    submitted: urls.length,
    successful,
    failed,
    results: results.map((r, i) => ({
      url: urls[i],
      status: r.status,
      error: r.status === 'rejected' ? (r.reason as Error).message : undefined,
    })),
  });
});

/**
 * GET /api/v1/indexing/status
 * Check the indexing status of a URL
 */
indexingRoutes.get('/status', async (c) => {
  const url = c.req.query('url');
  if (!url) {
    return c.json({ error: 'URL parameter required' }, 400);
  }

  const accessToken = await getSearchConsoleToken();
  
  const response = await fetch(
    `https://indexing.googleapis.com/v3/urlNotifications/metadata?url=${encodeURIComponent(url)}`,
    {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    }
  );

  const data = await response.json();

  if (!response.ok) {
    return c.json({ 
      url, 
      error: data.error?.message || 'Failed to get status' 
    }, response.status as any);
  }

  return c.json({
    url,
    latestUpdate: data.latestUpdate,
    latestRemove: data.latestRemove,
  });
});

/**
 * POST /api/v1/indexing/submit-all
 * Submit all sitemap URLs for indexing
 */
indexingRoutes.post('/submit-all', async (c) => {
  const SITE_URL = 'https://stiltnerlandscapes.com';
  
  const URLS_TO_INDEX = [
    `${SITE_URL}/`,
    `${SITE_URL}/services`,
    `${SITE_URL}/contact`,
    `${SITE_URL}/free-quote`,
    `${SITE_URL}/services/landscape-design`,
    `${SITE_URL}/services/hardscaping`,
    `${SITE_URL}/services/lawn-care`,
    `${SITE_URL}/services/irrigation`,
    `${SITE_URL}/services/outdoor-lighting`,
    `${SITE_URL}/services/tree-services`,
    `${SITE_URL}/about`,
    `${SITE_URL}/portfolio`,
    `${SITE_URL}/gallery`,
    `${SITE_URL}/blog`,
    `${SITE_URL}/reviews`,
    `${SITE_URL}/service-areas`,
    `${SITE_URL}/faq`,
    `${SITE_URL}/estimate`,
  ];

  const accessToken = await getSearchConsoleToken();
  
  let successful = 0;
  let failed = 0;
  const results: { url: string; status: string; error?: string }[] = [];

  for (const url of URLS_TO_INDEX) {
    try {
      const response = await fetch('https://indexing.googleapis.com/v3/urlNotifications:publish', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url, type: 'URL_UPDATED' }),
      });

      if (response.ok) {
        successful++;
        results.push({ url, status: 'success' });
        logger.info({ url }, 'URL submitted for indexing');
      } else {
        const error = await response.json();
        failed++;
        results.push({ url, status: 'failed', error: error.error?.message });
      }

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 200));
      
    } catch (error: any) {
      failed++;
      results.push({ url, status: 'error', error: error.message });
    }
  }

  logger.info({ successful, failed, total: URLS_TO_INDEX.length }, 'Bulk indexing complete');

  return c.json({
    success: true,
    message: `Submitted ${successful} URLs successfully, ${failed} failed`,
    successful,
    failed,
    total: URLS_TO_INDEX.length,
    results,
  });
});

/**
 * GET /api/v1/indexing/auth-status
 * Check if Search Console OAuth is connected
 */
indexingRoutes.get('/auth-status', async (c) => {
  const [integration] = await db
    .select({
      status: integrations.status,
      accountName: integrations.accountName,
      expiresAt: integrations.accessTokenExpiresAt,
    })
    .from(integrations)
    .where(eq(integrations.platform, 'search_console'))
    .limit(1);

  if (!integration) {
    return c.json({
      connected: false,
      authUrl: '/api/auth/google/search-console',
      message: 'Please connect your Google Search Console account',
    });
  }

  return c.json({
    connected: integration.status === 'connected',
    account: integration.accountName,
    expiresAt: integration.expiresAt,
  });
});

export default indexingRoutes;
