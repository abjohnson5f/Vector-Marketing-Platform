import { Hono } from 'hono';
import { z } from 'zod';
import { desc, eq, sql, gte, and } from 'drizzle-orm';
import { db, webVitals } from '../db/index.js';
import { getPageSpeedInsights, getPageSpeedBoth, getVitalsSummary, WebVitalsResult } from '../services/pagespeed.js';
import { hasPageSpeed, env } from '../config/env.js';
import { logger } from '../lib/logger.js';

const webvitalsRouter = new Hono();

/**
 * GET /api/v1/webvitals
 * Returns latest web vitals for the configured site
 */
webvitalsRouter.get('/', async (c) => {
  const { url, strategy = 'mobile', days = '7' } = c.req.query();
  
  // Default URL from env
  const targetUrl = url || env.GSC_SITE_URL || '';
  
  if (!targetUrl) {
    return c.json({ 
      vitals: null, 
      history: [],
      error: 'No URL configured',
      hasLiveData: false,
    });
  }
  
  // Get latest measurement from database
  const latestVital = await db.query.webVitals.findFirst({
    where: and(
      eq(webVitals.url, targetUrl),
      eq(webVitals.strategy, strategy)
    ),
    orderBy: desc(webVitals.measuredAt),
  });
  
  // Get historical data
  const daysAgo = new Date();
  daysAgo.setDate(daysAgo.getDate() - parseInt(days));
  
  const history = await db.select({
    measuredAt: webVitals.measuredAt,
    lcp: webVitals.lcp,
    cls: webVitals.cls,
    inp: webVitals.inp,
    performanceScore: webVitals.performanceScore,
  }).from(webVitals)
    .where(and(
      eq(webVitals.url, targetUrl),
      eq(webVitals.strategy, strategy),
      gte(webVitals.measuredAt, daysAgo)
    ))
    .orderBy(desc(webVitals.measuredAt))
    .limit(50);
  
  return c.json({
    url: targetUrl,
    strategy,
    vitals: latestVital ? {
      lcp: latestVital.lcp,
      lcpScore: latestVital.lcpScore,
      cls: latestVital.cls,
      clsScore: latestVital.clsScore,
      inp: latestVital.inp,
      inpScore: latestVital.inpScore,
      fcp: latestVital.fcp,
      ttfb: latestVital.ttfb,
      performanceScore: latestVital.performanceScore,
      accessibilityScore: latestVital.accessibilityScore,
      bestPracticesScore: latestVital.bestPracticesScore,
      seoScore: latestVital.seoScore,
      measuredAt: latestVital.measuredAt,
    } : null,
    history: history.map(h => ({
      date: h.measuredAt?.toISOString().split('T')[0],
      lcp: h.lcp,
      cls: h.cls,
      inp: h.inp,
      performanceScore: h.performanceScore,
    })),
    hasLiveData: hasPageSpeed(),
  });
});

/**
 * POST /api/v1/webvitals/measure
 * Trigger a new measurement for a URL
 */
webvitalsRouter.post('/measure', async (c) => {
  const body = await c.req.json();
  const { url, strategy = 'both' } = body;
  
  if (!url) {
    return c.json({ error: 'URL is required' }, 400);
  }
  
  if (!hasPageSpeed()) {
    return c.json({ error: 'PageSpeed API not configured' }, 400);
  }
  
  try {
    let results: WebVitalsResult[];
    
    if (strategy === 'both') {
      const { mobile, desktop } = await getPageSpeedBoth(url);
      results = [mobile, desktop];
    } else {
      const result = await getPageSpeedInsights(url, strategy);
      results = [result];
    }
    
    // Store results in database
    for (const result of results) {
      await db.insert(webVitals).values({
        url: result.url,
        strategy: result.strategy,
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
    
    return c.json({
      success: true,
      url,
      results: results.map(r => ({
        strategy: r.strategy,
        performanceScore: r.performanceScore,
        lcp: r.lcp,
        lcpScore: r.lcpScore,
        cls: r.cls,
        clsScore: r.clsScore,
        inp: r.inp,
        inpScore: r.inpScore,
        overall: getVitalsSummary(r).overall,
      })),
    });
  } catch (err) {
    logger.error({ error: err, url }, 'Failed to measure web vitals');
    return c.json({ error: 'Failed to measure web vitals' }, 500);
  }
});

/**
 * GET /api/v1/webvitals/summary
 * Returns a summary of web vitals across multiple pages
 */
webvitalsRouter.get('/summary', async (c) => {
  const { strategy = 'mobile' } = c.req.query();
  
  // Get average scores for all measured URLs
  const summary = await db.select({
    avgPerformance: sql<number>`COALESCE(AVG(${webVitals.performanceScore}), 0)`,
    avgLcp: sql<number>`COALESCE(AVG(${webVitals.lcp}), 0)`,
    avgCls: sql<number>`COALESCE(AVG(${webVitals.cls}), 0)`,
    avgInp: sql<number>`COALESCE(AVG(${webVitals.inp}), 0)`,
    urlCount: sql<number>`COUNT(DISTINCT ${webVitals.url})`,
  }).from(webVitals)
    .where(eq(webVitals.strategy, strategy));
  
  // Get latest measurements for each URL
  const latestMeasurements = await db.select({
    url: webVitals.url,
    performanceScore: webVitals.performanceScore,
    lcpScore: webVitals.lcpScore,
    clsScore: webVitals.clsScore,
    inpScore: webVitals.inpScore,
    measuredAt: webVitals.measuredAt,
  }).from(webVitals)
    .where(eq(webVitals.strategy, strategy))
    .orderBy(desc(webVitals.measuredAt))
    .limit(10);
  
  // Count scores by category
  const goodCount = latestMeasurements.filter(m => 
    m.lcpScore === 'GOOD' && m.clsScore === 'GOOD'
  ).length;
  
  const poorCount = latestMeasurements.filter(m => 
    m.lcpScore === 'POOR' || m.clsScore === 'POOR'
  ).length;
  
  const stats = summary[0] || { avgPerformance: 0, avgLcp: 0, avgCls: 0, avgInp: 0, urlCount: 0 };
  
  return c.json({
    strategy,
    summary: {
      averagePerformanceScore: Math.round(stats.avgPerformance),
      averageLcp: Math.round(stats.avgLcp),
      averageCls: Math.round(stats.avgCls * 1000) / 1000,
      averageInp: Math.round(stats.avgInp),
      urlsMeasured: stats.urlCount,
    },
    distribution: {
      good: goodCount,
      needsImprovement: latestMeasurements.length - goodCount - poorCount,
      poor: poorCount,
    },
    recentMeasurements: latestMeasurements.map(m => ({
      url: m.url,
      performanceScore: m.performanceScore,
      lcpScore: m.lcpScore,
      clsScore: m.clsScore,
      inpScore: m.inpScore,
      measuredAt: m.measuredAt,
    })),
    hasLiveData: hasPageSpeed(),
  });
});

export default webvitalsRouter;




