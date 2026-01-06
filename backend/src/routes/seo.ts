import { Hono } from 'hono';
import { z } from 'zod';
import { desc, eq, sql, gte, lte, and } from 'drizzle-orm';
import { db, seoStats, seoKeywords, seoPages } from '../db/index.js';
import { fetchGSCSummary } from '../services/search-console.js';
import { getDomainRankedKeywords, getDomainTopPages, getCompetitorDomains, getKeywordSuggestions } from '../services/dataforseo.js';
import { hasSearchConsole, hasDataForSEO, env } from '../config/env.js';
import { logger } from '../lib/logger.js';

const seo = new Hono();

// Query schema for date ranges
const dateRangeSchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  days: z.coerce.number().min(1).max(365).optional().default(28),
});

/**
 * GET /api/v1/seo/summary
 * Returns SEO summary data from Google Search Console
 */
seo.get('/summary', async (c) => {
  const query = dateRangeSchema.parse(c.req.query());
  
  // Try to get from database first
  const endDate = query.endDate ? new Date(query.endDate) : new Date();
  const startDate = query.startDate 
    ? new Date(query.startDate) 
    : new Date(endDate.getTime() - query.days * 24 * 60 * 60 * 1000);
  
  const startStr = startDate.toISOString().split('T')[0];
  const endStr = endDate.toISOString().split('T')[0];
  
  // Get aggregated stats from database
  const statsResult = await db.select({
    totalClicks: sql<number>`COALESCE(SUM(${seoStats.clicks}), 0)`,
    totalImpressions: sql<number>`COALESCE(SUM(${seoStats.impressions}), 0)`,
    avgCtr: sql<number>`COALESCE(AVG(${seoStats.ctr}), 0)`,
    avgPosition: sql<number>`COALESCE(AVG(${seoStats.position}), 0)`,
  }).from(seoStats)
    .where(and(
      gte(seoStats.statDate, startStr),
      lte(seoStats.statDate, endStr)
    ));
  
  const stats = statsResult[0] || { totalClicks: 0, totalImpressions: 0, avgCtr: 0, avgPosition: 0 };
  
  // Get top queries from seoKeywords
  const topKeywords = await db.select({
    keyword: seoKeywords.keyword,
    searchVolume: seoKeywords.searchVolume,
    position: seoKeywords.rankPosition,
    url: seoKeywords.rankUrl,
  }).from(seoKeywords)
    .orderBy(desc(seoKeywords.searchVolume))
    .limit(10);
  
  return c.json({
    summary: {
      totalClicks: stats.totalClicks,
      totalImpressions: stats.totalImpressions,
      averageCtr: stats.avgCtr,
      averagePosition: stats.avgPosition,
    },
    topKeywords: topKeywords.map(k => ({
      keyword: k.keyword,
      searchVolume: k.searchVolume || 0,
      position: k.position || 0,
      url: k.url,
    })),
    dateRange: {
      startDate: startStr,
      endDate: endStr,
    },
    hasLiveData: hasSearchConsole(),
  });
});

/**
 * GET /api/v1/seo/keywords
 * Returns ranked keywords for the domain
 */
seo.get('/keywords', async (c) => {
  const { limit = '50', offset = '0' } = c.req.query();
  
  // Get from database
  const keywords = await db.select()
    .from(seoKeywords)
    .orderBy(desc(seoKeywords.searchVolume))
    .limit(parseInt(limit))
    .offset(parseInt(offset));
  
  const countResult = await db.select({ count: sql<number>`count(*)` }).from(seoKeywords);
  const total = countResult[0]?.count || 0;
  
  return c.json({
    keywords: keywords.map(k => ({
      id: k.id,
      keyword: k.keyword,
      searchVolume: k.searchVolume || 0,
      difficulty: k.difficulty,
      cpc: k.cpc,
      competition: k.competition,
      intent: k.intent,
      position: k.rankPosition,
      url: k.rankUrl,
      serpFeatures: k.serpFeatures,
      lastUpdated: k.lastUpdated,
    })),
    pagination: {
      total,
      limit: parseInt(limit),
      offset: parseInt(offset),
    },
    hasLiveData: hasDataForSEO(),
  });
});

/**
 * GET /api/v1/seo/pages
 * Returns top pages by organic traffic
 */
seo.get('/pages', async (c) => {
  const { limit = '50', offset = '0' } = c.req.query();
  
  // Get from database
  const pages = await db.select()
    .from(seoPages)
    .orderBy(desc(seoPages.organicTraffic))
    .limit(parseInt(limit))
    .offset(parseInt(offset));
  
  const countResult = await db.select({ count: sql<number>`count(*)` }).from(seoPages);
  const total = countResult[0]?.count || 0;
  
  return c.json({
    pages: pages.map(p => ({
      id: p.id,
      url: p.url,
      title: p.title,
      organicTraffic: p.organicTraffic || 0,
      keywordsCount: p.keywordsCount || 0,
      backlinksCount: p.backlinksCount || 0,
      referringDomains: p.referringDomains || 0,
      topKeywords: p.topKeywords,
      lastUpdated: p.lastUpdated,
    })),
    pagination: {
      total,
      limit: parseInt(limit),
      offset: parseInt(offset),
    },
    hasLiveData: hasDataForSEO(),
  });
});

/**
 * GET /api/v1/seo/competitors
 * Returns competitor domains
 */
seo.get('/competitors', async (c) => {
  const { domain, limit = '10' } = c.req.query();
  const targetDomain = domain || env.GSC_SITE_URL?.replace('https://', '').replace('http://', '') || '';
  
  if (!targetDomain) {
    return c.json({ competitors: [], error: 'No domain configured' });
  }
  
  if (!hasDataForSEO()) {
    return c.json({ 
      competitors: [], 
      error: 'DataForSEO not configured',
      hasLiveData: false,
    });
  }
  
  try {
    const competitors = await getCompetitorDomains(targetDomain, 'United States', 'en', parseInt(limit));
    
    return c.json({
      domain: targetDomain,
      competitors,
      hasLiveData: true,
    });
  } catch (err) {
    logger.error({ error: err, domain: targetDomain }, 'Failed to fetch competitors');
    return c.json({ 
      competitors: [], 
      error: 'Failed to fetch competitor data',
      hasLiveData: true,
    });
  }
});

/**
 * POST /api/v1/seo/keywords/suggestions
 * Get keyword suggestions for a seed keyword
 */
seo.post('/keywords/suggestions', async (c) => {
  const body = await c.req.json();
  const { keyword, limit = 50 } = body;
  
  if (!keyword) {
    return c.json({ error: 'Keyword is required' }, 400);
  }
  
  if (!hasDataForSEO()) {
    return c.json({ 
      suggestions: [], 
      error: 'DataForSEO not configured',
      hasLiveData: false,
    });
  }
  
  try {
    const suggestions = await getKeywordSuggestions(keyword, 'United States', 'en', limit);
    
    return c.json({
      keyword,
      suggestions,
      hasLiveData: true,
    });
  } catch (err) {
    logger.error({ error: err, keyword }, 'Failed to fetch keyword suggestions');
    return c.json({ 
      suggestions: [], 
      error: 'Failed to fetch suggestions',
      hasLiveData: true,
    });
  }
});

/**
 * POST /api/v1/seo/refresh
 * Trigger a refresh of SEO data from DataForSEO
 */
seo.post('/refresh', async (c) => {
  const { domain } = await c.req.json();
  const targetDomain = domain || env.GSC_SITE_URL?.replace('https://', '').replace('http://', '') || '';
  
  if (!targetDomain) {
    return c.json({ error: 'No domain configured' }, 400);
  }
  
  if (!hasDataForSEO()) {
    return c.json({ error: 'DataForSEO not configured' }, 400);
  }
  
  try {
    // Fetch fresh data
    const [keywords, pages] = await Promise.all([
      getDomainRankedKeywords(targetDomain, 'United States', 'en', 100),
      getDomainTopPages(targetDomain, 'United States', 'en', 50),
    ]);
    
    // Update keywords
    for (const kw of keywords) {
      const existing = await db.query.seoKeywords.findFirst({
        where: eq(seoKeywords.keyword, kw.keyword),
      });
      
      if (existing) {
        await db.update(seoKeywords)
          .set({
            searchVolume: kw.searchVolume,
            rankPosition: kw.position,
            rankUrl: kw.url,
            lastUpdated: new Date(),
          })
          .where(eq(seoKeywords.id, existing.id));
      } else {
        await db.insert(seoKeywords).values({
          keyword: kw.keyword,
          searchVolume: kw.searchVolume,
          rankPosition: kw.position,
          rankUrl: kw.url,
        });
      }
    }
    
    // Update pages
    for (const page of pages) {
      const existing = await db.query.seoPages.findFirst({
        where: eq(seoPages.url, page.url),
      });
      
      if (existing) {
        await db.update(seoPages)
          .set({
            organicTraffic: page.organicTraffic,
            keywordsCount: page.keywordsCount,
            lastUpdated: new Date(),
          })
          .where(eq(seoPages.id, existing.id));
      } else {
        await db.insert(seoPages).values({
          url: page.url,
          organicTraffic: page.organicTraffic,
          keywordsCount: page.keywordsCount,
        });
      }
    }
    
    return c.json({
      success: true,
      domain: targetDomain,
      keywordsUpdated: keywords.length,
      pagesUpdated: pages.length,
    });
  } catch (err) {
    logger.error({ error: err, domain: targetDomain }, 'Failed to refresh SEO data');
    return c.json({ error: 'Failed to refresh SEO data' }, 500);
  }
});

export default seo;




